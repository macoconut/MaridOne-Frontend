import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiFilter, FiSave, FiX } from 'react-icons/fi';
import LargePopup from '../../../components/dialog/LargePopup';
import { useUiDialog } from '../../../components/dialog/useUiDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import '../../hr/attendance-reports/AttendanceReports.css';
import {
  buildDailyOverrideDraft,
  buildTemplateDrafts,
  DAY_ORDER,
  addMonths,
  formatShiftSegmentsLabel,
  formatDayLabel,
  formatMonthLabel,
  formatSpecificDateLabel,
  getMonthDates,
  groupDailyShiftsByWorkDate,
  normalizeMonthStart,
  parseDailyShifts,
  parseIsoDate,
  parseTeamEmployees,
  toIsoDate,
} from './scheduleUtils';
import type { DailyShift, DailyShiftSegmentDraft, TeamEmployee } from './scheduleUtils';
import './MonthlyTeamSchedule.css';

const CALENDAR_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const HR_SCHEDULE_ROLE_FILTERS = [
  { value: 'role:EMPLOYEE', label: 'Employee' },
  { value: 'role:HR', label: 'HR' },
  { value: 'role:ACCOUNTING', label: 'Accounting' },
  { value: 'role:MANAGER', label: 'Manager' },
  { value: 'role:MANAGEMENT', label: 'Management' },
] as const;

type EditorDraft = {
  segments: DailyShiftSegmentDraft[];
  dayOff: boolean;
  isOverride: boolean;
  hasTemplate: boolean;
  templateSegments: DailyShiftSegmentDraft[];
};

type SegmentFieldErrors = {
  startTime?: string;
  endTime?: string;
};

type HolidayLookupResponse = {
  holidayDates?: string[];
  regularHolidayDates?: string[];
  holidayNamesByDate?: Record<string, string>;
};

type MonthlyScheduleBoardProps = {
  rosterUrl: string;
  employeeSingularLabel: string;
  employeePluralLabel: string;
  emptyRosterLabel: string;
  selectionHelpText: string;
  showDepartmentFilter?: boolean;
  enableBatchSelection?: boolean;
  enableDefaultHoursBatchSelection?: boolean;
};

function buildCalendarCells(monthStart: string) {
  const monthDates = getMonthDates(monthStart);
  const firstDate = parseIsoDate(monthStart);
  const leadingBlanks = Array.from({ length: firstDate.getDay() }, (_, index) => `blank-start-${index}`);
  const totalCells = leadingBlanks.length + monthDates.length;
  const trailingCount = (7 - (totalCells % 7)) % 7;
  const trailingBlanks = Array.from({ length: trailingCount }, (_, index) => `blank-end-${index}`);
  return [...leadingBlanks, ...monthDates, ...trailingBlanks];
}

function formatTimeLabel(value: string) {
  const [hoursText = '0', minutesText = '00'] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const meridiem = safeHours >= 12 ? 'PM' : 'AM';
  const normalizedHour = safeHours % 12 === 0 ? 12 : safeHours % 12;
  return `${normalizedHour}:${String(safeMinutes).padStart(2, '0')} ${meridiem}`;
}

function toShiftSegmentRange(segment: Pick<DailyShiftSegmentDraft, 'startTime' | 'endTime'>) {
  const [startHour = '0', startMinute = '0'] = segment.startTime.split(':');
  const [endHour = '0', endMinute = '0'] = segment.endTime.split(':');
  const start = Number(startHour) * 60 + Number(startMinute);
  let end = Number(endHour) * 60 + Number(endMinute);
  if (end <= start) {
    end += 24 * 60;
  }
  return { start, end };
}

function createEmptySegment(): DailyShiftSegmentDraft {
  return { startTime: '00:00', endTime: '00:00' };
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function formatUiLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatEmployeePickerMeta(employee: TeamEmployee) {
  const parts = [formatUiLabel(employee.status)];

  if (employee.position && employee.position !== '-') {
    parts.push(formatUiLabel(employee.position));
  }

  return parts.join(' • ');
}

function getEmployeeMetaParts(employee: TeamEmployee, { includeDepartment = false }: { includeDepartment?: boolean } = {}) {
  const parts = [formatUiLabel(employee.status)];

  if (employee.position && employee.position !== '-') {
    parts.push(formatUiLabel(employee.position));
  }

  if (includeDepartment && employee.department) {
    parts.push(employee.department);
  }

  return parts.filter((value) => value && value !== '-');
}

function formatEmployeeMetaLabel(employee: TeamEmployee, { includeDepartment = false }: { includeDepartment?: boolean } = {}) {
  return getEmployeeMetaParts(employee, { includeDepartment }).join(' / ');
}

function matchesEmployeeFilters(
  employee: TeamEmployee,
  {
    showDepartmentFilter,
    roleFilter,
    departmentFilter,
  }: {
    showDepartmentFilter: boolean;
    roleFilter: string;
    departmentFilter: string;
  }
) {
  if (showDepartmentFilter && roleFilter !== 'all' && employee.position !== roleFilter) {
    return false;
  }

  if (showDepartmentFilter && departmentFilter !== 'all' && employee.department !== departmentFilter) {
    return false;
  }

  return true;
}

function matchesEmployeeSearch(employee: TeamEmployee, query: string) {
  if (!query) return true;

  return [
    employee.name,
    employee.status,
    formatUiLabel(employee.status),
    employee.position,
    formatUiLabel(employee.position),
    employee.department,
    formatEmployeePickerMeta(employee),
  ].some((value) => normalizeSearchText(value).includes(query));
}

function parseHolidayLookup(payload: unknown) {
  const object =
    payload && typeof payload === 'object'
      ? (payload as HolidayLookupResponse)
      : ({} as HolidayLookupResponse);

  const holidayDates = Array.isArray(object.holidayDates)
    ? [...new Set(object.holidayDates.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
    : [];
  const regularHolidayDates = Array.isArray(object.regularHolidayDates)
    ? [
        ...new Set(
          object.regularHolidayDates.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        ),
      ]
    : [];
  const holidayNamesByDate =
    object.holidayNamesByDate && typeof object.holidayNamesByDate === 'object'
      ? Object.fromEntries(
          Object.entries(object.holidayNamesByDate).flatMap(([dateKey, name]) => {
            if (typeof dateKey !== 'string' || typeof name !== 'string') return [];
            const normalizedDateKey = dateKey.trim();
            const normalizedName = name.trim();
            if (!normalizedDateKey || !normalizedName) return [];
            return [[normalizedDateKey, normalizedName]];
          })
        )
      : {};

  return { holidayDates, regularHolidayDates, holidayNamesByDate };
}

function buildEditorDraft(
  employee: TeamEmployee | null,
  workDate: string,
  dailyShiftsForDate: DailyShift[]
): EditorDraft {
  const baseDraft = buildDailyOverrideDraft(employee, workDate, dailyShiftsForDate);
  const templateDraft = buildDailyOverrideDraft(employee, workDate, []);

  return {
    segments: baseDraft.segments.map((segment) => ({ ...segment })),
    dayOff: baseDraft.dayOff,
    isOverride: baseDraft.isOverride,
    hasTemplate: baseDraft.hasTemplate,
    templateSegments: templateDraft.segments.map((segment) => ({ ...segment })),
  };
}

function buildLockedDayDrafts(
  employee: TeamEmployee | null,
  monthStart: string,
  dailyShiftsByDate: Map<string, DailyShift[]>,
  todayKey: string
) {
  return getMonthDates(monthStart)
    .filter((workDate) => workDate <= todayKey)
    .reduce<Record<string, EditorDraft>>((next, workDate) => {
      next[workDate] = buildEditorDraft(employee, workDate, dailyShiftsByDate.get(workDate) ?? []);
      return next;
    }, {});
}

export function MonthlyScheduleBoard({
  rosterUrl,
  employeeSingularLabel,
  employeePluralLabel,
  emptyRosterLabel,
  selectionHelpText,
  showDepartmentFilter = false,
  enableBatchSelection = false,
  enableDefaultHoursBatchSelection = false,
}: MonthlyScheduleBoardProps) {
  const { showSuccess } = useUiDialog();
  const initialMonthStart = useMemo(() => normalizeMonthStart(toIsoDate(new Date())), []);
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => initialMonthStart);
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [editorSegmentErrors, setEditorSegmentErrors] = useState<Record<number, SegmentFieldErrors>>({});
  const [templateTargetEmployeeIds, setTemplateTargetEmployeeIds] = useState<number[]>([]);
  const [templateTargetSearch, setTemplateTargetSearch] = useState('');
  const [selectedTemplateDays, setSelectedTemplateDays] = useState<string[]>([]);
  const [templateStartTime, setTemplateStartTime] = useState('08:00');
  const [templateEndTime, setTemplateEndTime] = useState('17:00');
  const [templateDayOff, setTemplateDayOff] = useState(false);
  const [lockedDayDrafts, setLockedDayDrafts] = useState<Record<string, EditorDraft>>({});
  const [templateFilterOpen, setTemplateFilterOpen] = useState(false);
  const [templateRoleFilter, setTemplateRoleFilter] = useState('all');
  const [templateDepartmentFilter, setTemplateDepartmentFilter] = useState('all');
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [holidayDateKeys, setHolidayDateKeys] = useState<string[]>([]);
  const [regularHolidayDateKeys, setRegularHolidayDateKeys] = useState<string[]>([]);
  const [holidayNamesByDate, setHolidayNamesByDate] = useState<Record<string, string>>({});
  const [savingDate, setSavingDate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const employeePickerRef = useRef<HTMLDivElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const templateFilterRef = useRef<HTMLDivElement | null>(null);

  useErrorDialogEffect(loadError, 'Schedule calendar could not be loaded');
  useErrorDialogEffect(saveError, 'Schedule calendar could not be saved');
  useEscapeDismiss(editorOpen, closeEditor, 10);
  useEscapeDismiss(templateEditorOpen, closeTemplateEditor, 11);
  useEscapeDismiss(templateFilterOpen, () => setTemplateFilterOpen(false), 14);

  const todayKey = useMemo(() => toIsoDate(new Date()), []);
  const monthOptions = useMemo(() => {
    const values = new Set<string>();
    for (let offset = -18; offset <= 18; offset += 1) {
      values.add(addMonths(initialMonthStart, offset));
    }
    values.add(selectedMonthStart);

    return [...values]
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: formatMonthLabel(value),
      }));
  }, [initialMonthStart, selectedMonthStart]);

  const sortedEmployees = useMemo(
    () => [...employees].sort((left, right) => left.name.localeCompare(right.name)),
    [employees]
  );

  const selectedEmployee = useMemo(
    () => sortedEmployees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [selectedEmployeeId, sortedEmployees]
  );
  const selectedEmployees = useMemo(
    () => sortedEmployees.filter((employee) => selectedEmployeeIds.includes(employee.id)),
    [selectedEmployeeIds, sortedEmployees]
  );
  const defaultTemplateEmployees = useMemo(
    () => (enableBatchSelection ? selectedEmployees : selectedEmployee ? [selectedEmployee] : []),
    [enableBatchSelection, selectedEmployee, selectedEmployees]
  );
  const templateTargetEmployees = useMemo(
    () => sortedEmployees.filter((employee) => templateTargetEmployeeIds.includes(employee.id)),
    [templateTargetEmployeeIds, sortedEmployees]
  );
  const batchTemplateEmployees = useMemo(
    () =>
      enableBatchSelection
        ? selectedEmployees
        : enableDefaultHoursBatchSelection
          ? templateTargetEmployees
          : selectedEmployee
            ? [selectedEmployee]
            : [],
    [enableBatchSelection, enableDefaultHoursBatchSelection, selectedEmployee, selectedEmployees, templateTargetEmployees]
  );
  const templateTargetSearchResults = useMemo(() => {
    if (!enableDefaultHoursBatchSelection || enableBatchSelection) return [];

    const query = normalizeSearchText(templateTargetSearch);
    return sortedEmployees.filter((employee) => {
      if (
        !matchesEmployeeFilters(employee, {
          showDepartmentFilter,
          roleFilter: templateRoleFilter,
          departmentFilter: templateDepartmentFilter,
        })
      ) {
        return false;
      }

      return matchesEmployeeSearch(employee, query);
    });
  }, [
    enableBatchSelection,
    enableDefaultHoursBatchSelection,
    showDepartmentFilter,
    sortedEmployees,
    templateDepartmentFilter,
    templateRoleFilter,
    templateTargetSearch,
  ]);
  const departmentOptions = useMemo(
    () =>
      [...new Set(sortedEmployees.map((employee) => employee.department).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right)),
    [sortedEmployees]
  );
  const filteredEmployees = useMemo(() => {
    const query = normalizeSearchText(employeeSearch);
    return sortedEmployees.filter((employee) => matchesEmployeeSearch(employee, query));
  }, [employeeSearch, sortedEmployees]);

  const calendarCells = useMemo(() => buildCalendarCells(selectedMonthStart), [selectedMonthStart]);
  const calendarStyle = useMemo(
    () =>
      ({
        '--calendar-week-rows': String(Math.max(1, calendarCells.length / 7)),
      }) as CSSProperties,
    [calendarCells.length]
  );

  const dailyShiftsByDate = useMemo(() => groupDailyShiftsByWorkDate(dailyShifts), [dailyShifts]);
  const holidayDateSet = useMemo(() => new Set(holidayDateKeys), [holidayDateKeys]);
  const regularHolidayDateSet = useMemo(() => new Set(regularHolidayDateKeys), [regularHolidayDateKeys]);
  const selectedDateIsLocked = Boolean(selectedDateKey && selectedDateKey <= todayKey);
  const selectedDateIsHoliday = Boolean(selectedDateKey && holidayDateSet.has(selectedDateKey));
  const selectedHolidayLabel = selectedDateKey
    ? holidayNamesByDate[selectedDateKey] ?? (regularHolidayDateSet.has(selectedDateKey) ? 'Regular Holiday' : 'Holiday')
    : '';
  const selectedDateDayTypeLabel = !selectedDateKey
    ? ''
    : selectedDateIsHoliday
      ? selectedHolidayLabel
      : 'Regular workday';
  const selectedDateSavedTimeLabel = !editorDraft || editorDraft.dayOff
    ? 'Day off'
    : formatShiftSegmentsLabel(editorDraft.segments, formatTimeLabel);
  const selectedDateSavedTimeSegments = !editorDraft || editorDraft.dayOff
    ? []
    : editorDraft.segments.map((segment) => ({
        label: `${formatTimeLabel(segment.startTime)} - ${formatTimeLabel(segment.endTime)}`,
      }));
  const canClearEmployeePicker = employeeSearch.trim().length > 0;
  const canClearTemplateTargetSearch = templateTargetSearch.trim().length > 0;
  const canOpenTemplateEditor = defaultTemplateEmployees.length > 0;
  const allVisibleTemplateTargetsSelected = useMemo(() => {
    if (!enableDefaultHoursBatchSelection || enableBatchSelection || templateTargetSearchResults.length === 0) return false;
    return templateTargetSearchResults.every((employee) => templateTargetEmployeeIds.includes(employee.id));
  }, [
    enableBatchSelection,
    enableDefaultHoursBatchSelection,
    templateTargetEmployeeIds,
    templateTargetSearchResults,
  ]);
  const allTemplateDaysSelected = selectedTemplateDays.length === DAY_ORDER.length;
  const canClearTemplateSelections =
    selectedTemplateDays.length > 0 ||
    (enableDefaultHoursBatchSelection && !enableBatchSelection && templateTargetEmployeeIds.length > 0);
  const batchSelectionSummary = useMemo(() => {
    if (!enableBatchSelection) return '';
    if (selectedEmployees.length === 0) return `No ${employeePluralLabel} selected for batch updates yet.`;
    if (selectedEmployees.length === 1) {
      return `${selectedEmployees[0].name} is selected for calendar viewing and default-hours updates.`;
    }
    return `${selectedEmployee?.name ?? selectedEmployees[0].name} is shown in the calendar. Default-hour changes will apply to all ${selectedEmployees.length} selected ${employeePluralLabel}.`;
  }, [enableBatchSelection, employeePluralLabel, selectedEmployee, selectedEmployees]);
  const templateActiveFilterCount =
    (showDepartmentFilter && templateRoleFilter !== 'all' ? 1 : 0) +
    (showDepartmentFilter && templateDepartmentFilter !== 'all' ? 1 : 0);
  const resolveDisplayedDraft = useCallback(
    (workDate: string) => {
      if (workDate <= todayKey && lockedDayDrafts[workDate]) {
        return lockedDayDrafts[workDate];
      }
      return buildEditorDraft(selectedEmployee, workDate, dailyShiftsByDate.get(workDate) ?? []);
    },
    [dailyShiftsByDate, lockedDayDrafts, selectedEmployee, todayKey]
  );

  const closeEmployeePicker = useCallback(() => {
    setEmployeePickerOpen(false);
    setEmployeeSearch(enableBatchSelection ? '' : selectedEmployee?.name ?? '');
  }, [enableBatchSelection, selectedEmployee]);
  useEscapeDismiss(employeePickerOpen, closeEmployeePicker, 12);

  function closeEditor() {
    setEditorOpen(false);
    setSaveError('');
    setEditorSegmentErrors({});
  }

  function closeTemplateEditor() {
    setTemplateEditorOpen(false);
    setTemplateFilterOpen(false);
    setTemplateTargetSearch('');
    setSaveError('');
  }

  function clearTemplateFilters() {
    setTemplateRoleFilter('all');
    setTemplateDepartmentFilter('all');
  }

  const loadTeamSchedules = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) {
      setLoadingTeam(true);
      setLoadError('');
    }

    try {
      const payload = await apiFetchJson<unknown>(rosterUrl);
      const mapped = parseTeamEmployees(payload, toArray).sort((left, right) => left.name.localeCompare(right.name));
      setEmployees(mapped);
      setSelectedEmployeeId((current) => {
        if (current && mapped.some((employee) => employee.id === current)) {
          return current;
        }
        return mapped[0]?.id ?? null;
      });
      setSelectedEmployeeIds((current) => {
        const validIds = current.filter((id) => mapped.some((employee) => employee.id === id));
        if (validIds.length > 0) {
          return validIds;
        }

        const fallbackId = mapped[0]?.id;
        return typeof fallbackId === 'number' ? [fallbackId] : [];
      });
      setTemplateTargetEmployeeIds((current) => current.filter((id) => mapped.some((employee) => employee.id === id)));
    } catch (error) {
      if (!silent) {
        setEmployees([]);
        setSelectedEmployeeId(null);
        setSelectedEmployeeIds([]);
        setTemplateTargetEmployeeIds([]);
        setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
      }
    } finally {
      if (!silent) {
        setLoadingTeam(false);
      }
    }
  }, [rosterUrl]);

  useAutoRefreshingPage(() => loadTeamSchedules({ silent: true }), {
    intervalMs: 15000,
    enabled: !savingDate && !savingTemplate && !editorOpen && !templateEditorOpen,
  });

  useEffect(() => {
    void loadTeamSchedules();
  }, [loadTeamSchedules]);

  useEffect(() => {
    if (selectedEmployeeId == null) {
      if (!enableBatchSelection) {
        setSelectedEmployeeIds([]);
      }
      return;
    }

    setSelectedEmployeeIds((current) => {
      if (enableBatchSelection) {
        return current.includes(selectedEmployeeId) ? current : [selectedEmployeeId, ...current];
      }

      return current.length === 1 && current[0] === selectedEmployeeId ? current : [selectedEmployeeId];
    });
  }, [enableBatchSelection, selectedEmployeeId]);

  useEffect(() => {
    const monthDates = getMonthDates(selectedMonthStart);
    const monthEnd = monthDates[monthDates.length - 1] ?? selectedMonthStart;
    let cancelled = false;

    async function loadMonthHolidays() {
      try {
        const payload = await apiFetchJson<unknown>(
          `/api/holidays?startDate=${selectedMonthStart}&endDate=${monthEnd}`
        );
        if (cancelled) return;
        const parsed = parseHolidayLookup(payload);
        setHolidayDateKeys(parsed.holidayDates);
        setRegularHolidayDateKeys(parsed.regularHolidayDates);
        setHolidayNamesByDate(parsed.holidayNamesByDate);
      } catch (error) {
        if (cancelled) return;
        setHolidayDateKeys([]);
        setRegularHolidayDateKeys([]);
        setHolidayNamesByDate({});
        setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
      }
    }

    void loadMonthHolidays();

    return () => {
      cancelled = true;
    };
  }, [selectedMonthStart]);

  useEffect(() => {
    if (editorOpen || templateEditorOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [editorOpen, templateEditorOpen]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setDailyShifts([]);
      setLockedDayDrafts({});
      return;
    }

    const employeeId = selectedEmployeeId;
    let cancelled = false;

    async function loadMonthPlan() {
      setLoadingMonth(true);
      setLoadError('');
      try {
        const monthDates = getMonthDates(selectedMonthStart);
        const monthEnd = monthDates[monthDates.length - 1] ?? selectedMonthStart;
        const payload = await apiFetchJson<unknown>(
          `/api/employee/schedule/daily/${employeeId}?startDate=${selectedMonthStart}&endDate=${monthEnd}`
        );

        if (cancelled) return;
        setDailyShifts(parseDailyShifts(payload, toArray));
      } catch (error) {
        if (cancelled) return;
        setDailyShifts([]);
        setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
      } finally {
        if (!cancelled) {
          setLoadingMonth(false);
        }
      }
    }

    void loadMonthPlan();

    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId, selectedMonthStart]);

  useEffect(() => {
    setSelectedDateKey(null);
    setEditorOpen(false);
    setTemplateEditorOpen(false);
  }, [selectedEmployeeId, selectedMonthStart]);

  useEffect(() => {
    if (!selectedEmployee) {
      setLockedDayDrafts({});
      return;
    }

    setLockedDayDrafts(buildLockedDayDrafts(selectedEmployee, selectedMonthStart, dailyShiftsByDate, todayKey));
  }, [dailyShiftsByDate, selectedEmployee, selectedMonthStart, todayKey]);

  useEffect(() => {
    if (!selectedEmployee || !selectedDateKey) {
      setEditorDraft(null);
      return;
    }

    setEditorDraft(resolveDisplayedDraft(selectedDateKey));
  }, [resolveDisplayedDraft, selectedDateKey, selectedEmployee]);

  useEffect(() => {
    if (!employeePickerOpen) {
      setEmployeeSearch(enableBatchSelection ? '' : selectedEmployee?.name ?? '');
    }
  }, [employeePickerOpen, enableBatchSelection, selectedEmployee]);

  useEffect(() => {
    if (!showDepartmentFilter || !templateFilterOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!templateFilterRef.current?.contains(target)) {
        setTemplateFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showDepartmentFilter, templateFilterOpen]);

  useEffect(() => {
    if (!employeePickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!employeePickerRef.current?.contains(target)) {
        closeEmployeePicker();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [employeePickerOpen, closeEmployeePicker]);

  function selectDate(workDate: string) {
    setSelectedDateKey(workDate);
    setTemplateEditorOpen(false);
    setEditorOpen(true);
    setSaveError('');
  }

  function selectEmployee(employee: TeamEmployee) {
    if (enableBatchSelection) {
      const isCurrentlySelected = selectedEmployeeIds.includes(employee.id);
      setSelectedEmployeeIds((current) => {
        const next = isCurrentlySelected ? current.filter((id) => id !== employee.id) : [...current, employee.id];
        return [...new Set(next)];
      });
      setSelectedEmployeeId((current) => {
        if (isCurrentlySelected) {
          if (current !== employee.id) {
            return current;
          }
          const fallback = selectedEmployeeIds.filter((id) => id !== employee.id)[0];
          return fallback ?? null;
        }
        return employee.id;
      });
      setEmployeeSearch('');
      setEmployeePickerOpen(true);
      employeeSearchInputRef.current?.focus();
      return;
    }

    setSelectedEmployeeId(employee.id);
    setEmployeeSearch(employee.name);
    setEmployeePickerOpen(false);
  }

  function clearEmployeeSearch() {
    setEmployeeSearch('');
    setEmployeePickerOpen(true);
    employeeSearchInputRef.current?.focus();
  }

  function selectVisibleEmployees() {
    if (!enableBatchSelection || filteredEmployees.length === 0) return;

    setSelectedEmployeeIds((current) => [...new Set([...current, ...filteredEmployees.map((employee) => employee.id)])]);
    setSelectedEmployeeId((current) => current ?? filteredEmployees[0]?.id ?? null);
  }

  function clearSelectedEmployees() {
    setSelectedEmployeeIds([]);
    setSelectedEmployeeId(null);
    setSelectedDateKey(null);
    setEditorOpen(false);
    setTemplateEditorOpen(false);
  }

  function openTemplateEditor() {
    if (defaultTemplateEmployees.length === 0) return;
    if (enableDefaultHoursBatchSelection && !enableBatchSelection) {
      setTemplateTargetEmployeeIds(defaultTemplateEmployees.map((employee) => employee.id));
      setTemplateTargetSearch('');
    }
    setSelectedTemplateDays([]);
    setTemplateStartTime('08:00');
    setTemplateEndTime('17:00');
    setTemplateDayOff(false);
    setEditorOpen(false);
    setTemplateEditorOpen(true);
    setSaveError('');
  }

  function toggleTemplateTargetEmployee(employee: TeamEmployee) {
    if (!enableDefaultHoursBatchSelection || enableBatchSelection) return;

    setTemplateTargetEmployeeIds((current) =>
      current.includes(employee.id) ? current.filter((id) => id !== employee.id) : [...current, employee.id]
    );
  }

  function toggleAllTemplateTargetEmployees(checked: boolean) {
    if (!enableDefaultHoursBatchSelection || enableBatchSelection || templateTargetSearchResults.length === 0) return;

    const visibleIds = templateTargetSearchResults.map((employee) => employee.id);
    setTemplateTargetEmployeeIds((current) => {
      if (checked) {
        return [...new Set([...current, ...visibleIds])];
      }

      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  function toggleTemplateDay(day: string) {
    setSelectedTemplateDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
    );
  }

  function toggleAllTemplateDays(checked: boolean) {
    setSelectedTemplateDays(checked ? [...DAY_ORDER] : []);
  }

  function clearTemplateSelections() {
    setSelectedTemplateDays([]);
    if (enableDefaultHoursBatchSelection && !enableBatchSelection) {
      setTemplateTargetEmployeeIds([]);
    }
  }

  function updateSegment(index: number, key: 'startTime' | 'endTime', value: string) {
    setEditorSegmentErrors((current) => {
      if (!current[index]) return current;
      const next = { ...current };
      const nextRow = { ...next[index] };
      delete nextRow[key];
      if (!nextRow.startTime && !nextRow.endTime) {
        delete next[index];
      } else {
        next[index] = nextRow;
      }
      return next;
    });
    setEditorDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        segments: current.segments.map((segment, segmentIndex) =>
          segmentIndex === index ? { ...segment, [key]: value } : segment
        ),
      };
    });
  }

  function updateDayOff(value: boolean) {
    setEditorSegmentErrors({});
    setEditorDraft((current) =>
      current
        ? {
            ...current,
            dayOff: value,
            segments: value ? current.segments : current.segments.length > 0 ? current.segments : current.templateSegments.length > 0 ? current.templateSegments : [createEmptySegment()],
          }
        : current
    );
  }

  function addSegment() {
    setEditorDraft((current) =>
      current
        ? {
            ...current,
            dayOff: false,
            segments: [...current.segments, createEmptySegment()],
          }
        : current
    );
  }

  function removeSegment(index: number) {
    setEditorSegmentErrors((current) => {
      const next: Record<number, SegmentFieldErrors> = {};
      Object.entries(current).forEach(([key, value]) => {
        const numericKey = Number(key);
        if (numericKey === index) return;
        next[numericKey > index ? numericKey - 1 : numericKey] = value;
      });
      return next;
    });
    setEditorDraft((current) => {
      if (!current) return current;
      const nextSegments = current.segments.filter((_, segmentIndex) => segmentIndex !== index);
      return {
        ...current,
        segments: nextSegments.length > 0 ? nextSegments : [createEmptySegment()],
        dayOff: false,
      };
    });
  }

  function validateEditorDraft(draft: EditorDraft) {
    const nextErrors: Record<number, SegmentFieldErrors> = {};
    const normalizedSegments = draft.segments
      .map((segment, index) => ({
        index,
        dailyShiftId: segment.dailyShiftId,
        startTime: segment.startTime.trim(),
        endTime: segment.endTime.trim(),
      }))
      .filter((segment) => segment.startTime || segment.endTime);

    if (!draft.dayOff && normalizedSegments.length === 0) {
      nextErrors[0] = {
        startTime: 'Start time is required.',
        endTime: 'End time is required.',
      };
      return {
        isValid: false,
        segmentErrors: nextErrors,
        normalizedSegments,
      };
    }

    if (!draft.dayOff) {
      for (const segment of normalizedSegments) {
        const rowErrors: SegmentFieldErrors = {};
        if (!segment.startTime) {
          rowErrors.startTime = 'Start time is required.';
        }
        if (!segment.endTime) {
          rowErrors.endTime = 'End time is required.';
        }
        if (rowErrors.startTime || rowErrors.endTime) {
          nextErrors[segment.index] = rowErrors;
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        return {
          isValid: false,
          segmentErrors: nextErrors,
          normalizedSegments,
        };
      }

      for (const segment of normalizedSegments) {
        if (segment.startTime === segment.endTime) {
          nextErrors[segment.index] = {
            startTime: 'Start and end cannot match.',
            endTime: 'Start and end cannot match.',
          };
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        return {
          isValid: false,
          segmentErrors: nextErrors,
          normalizedSegments,
        };
      }

      const sortedRanges = normalizedSegments
        .map((segment) => ({ ...segment, range: toShiftSegmentRange(segment) }))
        .sort((left, right) => left.range.start - right.range.start);

      for (let index = 1; index < sortedRanges.length; index += 1) {
        if (sortedRanges[index].range.start < sortedRanges[index - 1].range.end) {
          nextErrors[sortedRanges[index - 1].index] = {
            startTime: 'Overlaps another segment.',
            endTime: 'Overlaps another segment.',
          };
          nextErrors[sortedRanges[index].index] = {
            startTime: 'Overlaps another segment.',
            endTime: 'Overlaps another segment.',
          };
        }
      }

      if (Object.keys(nextErrors).length > 0) {
        return {
          isValid: false,
          segmentErrors: nextErrors,
          normalizedSegments,
        };
      }
    }

    return {
      isValid: true,
      segmentErrors: nextErrors,
      normalizedSegments,
    };
  }

  async function saveSelectedDate() {
    if (!selectedEmployee || !selectedDateKey || !editorDraft) return;

    if (selectedDateKey <= todayKey) {
      setSaveError('Schedule changes can only be made starting tomorrow.');
      return;
    }

    const validation = validateEditorDraft(editorDraft);
    if (!validation.isValid) {
      setEditorSegmentErrors(validation.segmentErrors);
      return;
    }

    setEditorSegmentErrors({});
    setSaveError('');
    setSavingDate(true);

    try {
      const payload = await apiFetchJson<DailyShift[]>('/api/employee/schedule/daily/override/batch', {
        method: 'PUT',
        body: JSON.stringify({
          empId: selectedEmployee.id,
          workDate: selectedDateKey,
          dayOff: editorDraft.dayOff,
          segments: editorDraft.dayOff
            ? []
            : validation.normalizedSegments.map((segment) => ({
                startTime: segment.startTime,
                endTime: segment.endTime,
              })),
        }),
      });

      const savedShifts = parseDailyShifts(payload, toArray);
      setDailyShifts((current) => {
        const next = current.filter((shift) => shift.workDate !== selectedDateKey);
        return [...next, ...savedShifts].sort((left, right) => {
          const byDate = String(left.workDate).localeCompare(String(right.workDate));
          if (byDate !== 0) return byDate;
          return String(left.startDateTime ?? '').localeCompare(String(right.startDateTime ?? ''));
        });
      });

      showSuccess(
        editorDraft.dayOff
          ? `${selectedEmployee.name} is now marked as day off on ${formatSpecificDateLabel(selectedDateKey)}.`
          : `${selectedEmployee.name}'s shift was saved for ${formatSpecificDateLabel(selectedDateKey)}.`,
        editorDraft.dayOff ? 'Day Off Saved' : 'Shift Saved'
      );
      closeEditor();
    } catch (error) {
      setSaveError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setSavingDate(false);
    }
  }

  function shiftMonth(offset: number) {
    setSelectedMonthStart((current) => addMonths(current, offset));
  }

  async function applyRecurringTemplate() {
    if (batchTemplateEmployees.length === 0) return;

    if (selectedTemplateDays.length === 0) {
      setSaveError('Choose at least one day to update.');
      return;
    }

    if (!templateDayOff && (!templateStartTime || !templateEndTime)) {
      setSaveError('Start time and end time are both required.');
      return;
    }

    if (!templateDayOff && templateStartTime === templateEndTime) {
      setSaveError('Start time and end time cannot be the same.');
      return;
    }

    setSaveError('');
    setSavingTemplate(true);

    try {
      await Promise.all(
        batchTemplateEmployees.flatMap((employee) =>
          selectedTemplateDays.map(async (day) => {
            const draft = buildTemplateDrafts(employee)[day] ?? { startTime: '08:00', endTime: '17:00' };
            if (templateDayOff) {
              if (draft.shiftId) {
                await apiFetchJson(`/api/employee/schedule/${draft.shiftId}`, {
                  method: 'DELETE',
                });
              }
              return;
            }

            if (draft.shiftId) {
              await apiFetchJson('/api/employee/schedule/update', {
                method: 'PATCH',
                body: JSON.stringify({
                  shiftId: draft.shiftId,
                  startTime: templateStartTime,
                  endTime: templateEndTime,
                  dayOfWeek: day,
                }),
              });
              return;
            }

            await apiFetchJson('/api/employee/schedule/add', {
              method: 'POST',
              body: JSON.stringify({
                empId: employee.id,
                startTime: templateStartTime,
                endTime: templateEndTime,
                dayOfWeek: day,
              }),
            });
          })
        )
      );

      await loadTeamSchedules();
      setTemplateEditorOpen(false);
      const savedDays = DAY_ORDER.filter((day) => selectedTemplateDays.includes(day)).map((day) => formatDayLabel(day));
      showSuccess(
        templateDayOff
          ? batchTemplateEmployees.length === 1
            ? `Selected days are now marked as day off for ${savedDays.join(', ')}.`
            : `Selected days are now marked as day off for ${batchTemplateEmployees.length} ${employeePluralLabel}.`
          : batchTemplateEmployees.length === 1
            ? `Default hours updated for ${savedDays.join(', ')}.`
            : `Default hours updated for ${batchTemplateEmployees.length} ${employeePluralLabel} on ${savedDays.join(', ')}.`,
        templateDayOff ? 'Day Off Saved' : 'Default Hours Saved'
      );
    } catch (error) {
      setSaveError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <div className={`hrAtt mgrMonth ${showDepartmentFilter ? 'mgrMonth--hr' : ''}`.trim()}>
      <div className="hrAtt__head">
        <PageHeader
          title="Schedule Calendar"
          description="Set the default hours here, then click any calendar date when you need custom hours for a specific day."
        />

      </div>

      <div className="hrAtt__toolbar mgrMonth__toolbar">
        <div className="mgrMonth__pickerTools">
          <div
            className={`hrEmpCombo hrEmpCombo--compact mgrMonth__employeeCombo ${employeePickerOpen ? 'is-open' : ''}`}
            ref={employeePickerRef}
          >
            <div className="hrEmpCombo__control">
              <input
                ref={employeeSearchInputRef}
                type="text"
                className="hrEmpCombo__input"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="shift-calendar-employee-options"
                aria-expanded={employeePickerOpen}
                aria-haspopup="listbox"
                value={employeeSearch}
                onFocus={() => setEmployeePickerOpen(true)}
                onChange={(event) => {
                  setEmployeeSearch(event.target.value);
                  setEmployeePickerOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && filteredEmployees.length > 0) {
                    event.preventDefault();
                    selectEmployee(filteredEmployees[0]);
                  }
                }}
                placeholder={
                  loadingTeam
                    ? `Loading ${employeePluralLabel}...`
                    : sortedEmployees.length === 0
                      ? emptyRosterLabel
                      : enableBatchSelection
                        ? `Search and add ${employeePluralLabel}`
                        : `Search ${employeeSingularLabel}`
                }
                disabled={loadingTeam || sortedEmployees.length === 0}
                aria-label={
                  enableBatchSelection
                    ? `Search and select ${employeePluralLabel} for batch schedule updates`
                    : `Search ${employeeSingularLabel}`
                }
              />
              {canClearEmployeePicker ? (
                <button
                  type="button"
                  className="hrEmpCombo__clear"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearEmployeeSearch}
                  disabled={loadingTeam || sortedEmployees.length === 0}
                  aria-label={`Clear ${employeeSingularLabel} search`}
                >
                  <FiX />
                </button>
              ) : null}
              <button
                type="button"
                className="hrEmpCombo__toggle"
                onClick={() => {
                  if (loadingTeam || sortedEmployees.length === 0) return;
                  setEmployeeSearch(enableBatchSelection ? '' : selectedEmployee?.name ?? '');
                  setEmployeePickerOpen((current) => !current);
                }}
                disabled={loadingTeam || sortedEmployees.length === 0}
                aria-label={employeePickerOpen ? `Close ${employeeSingularLabel} list` : `Open ${employeeSingularLabel} list`}
              >
                <FiChevronDown />
              </button>
            </div>

            {enableBatchSelection ? (
              <div className="mgrMonth__selectionSummary" aria-live="polite">
                <div className="mgrMonth__selectionSummaryText">{batchSelectionSummary}</div>
                {selectedEmployees.length > 0 ? (
                  <div className="mgrMonth__selectionChips">
                    {selectedEmployees.slice(0, 4).map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        className={`mgrMonth__selectionChip ${employee.id === selectedEmployeeId ? 'is-active' : ''}`}
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        title={
                          employee.id === selectedEmployeeId
                            ? `${employee.name} is currently shown in the calendar`
                            : `Show ${employee.name} in the calendar`
                        }
                      >
                        {employee.name}
                      </button>
                    ))}
                    {selectedEmployees.length > 4 ? (
                      <span className="mgrMonth__selectionMore">+{selectedEmployees.length - 4} more</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {employeePickerOpen ? (
              <div className="hrEmpCombo__menu" id="shift-calendar-employee-options" role="listbox">
                {loadingTeam ? (
                  <div className="hrEmpCombo__empty">{`Loading ${employeePluralLabel}...`}</div>
                ) : filteredEmployees.length > 0 ? (
                  <>
                    {enableBatchSelection ? (
                      <div className="mgrMonth__menuActions">
                        <button type="button" onClick={selectVisibleEmployees}>
                          Select Visible
                        </button>
                        <button type="button" onClick={clearSelectedEmployees} disabled={selectedEmployees.length === 0}>
                          Clear All
                        </button>
                      </div>
                    ) : null}

                    {filteredEmployees.map((employee) => {
                      const isSelected = enableBatchSelection
                        ? selectedEmployeeIds.includes(employee.id)
                        : employee.id === selectedEmployeeId;
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`hrEmpCombo__option ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => selectEmployee(employee)}
                        >
                          <span className="hrEmpCombo__optionName">
                            {employee.name}
                            {enableBatchSelection && employee.id === selectedEmployeeId ? ' (Calendar)' : ''}
                          </span>
                          <span className="hrEmpCombo__optionMeta">
                            {isSelected && enableBatchSelection ? 'Selected for batch update • ' : ''}
                            {formatEmployeeMetaLabel(employee, { includeDepartment: showDepartmentFilter })}
                          </span>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="hrEmpCombo__empty">{`No ${employeePluralLabel} match that search.`}</div>
                )}
              </div>
            ) : null}
          </div>

        </div>

        <div className="mgrMonth__toolbarActions">
          <button
            type="button"
            className="actionBtnX mgrMonth__toolbarBtn"
            onClick={openTemplateEditor}
            disabled={!canOpenTemplateEditor || loadingTeam || savingTemplate}
          >
            <span className="mgrMonth__toolbarBtnLabel">
              {enableBatchSelection && defaultTemplateEmployees.length > 1
                ? `Batch Edit Default Hours (${defaultTemplateEmployees.length})`
                : 'Edit Default Hours'}
            </span>
            <span className="mgrMonth__toolbarBtnIcon" aria-hidden="true">
              <FiCalendar />
            </span>
          </button>
        </div>
      </div>

      {loadingTeam && (
        <p className="hrAtt__hint">
          Loading team schedule data...
        </p>
      )}

      <section className="mgrMonth__shell">
        <section className="mgrMonth__calendarPanel hrAttCalendarShell">
          <div className="hrAttCalendarShell__top">
            <button type="button" className="hrAttCalendarShell__navBtn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <FiChevronLeft />
            </button>
            <div className="uCalendarMonthPicker uCalendarMonthPicker--minimal">
              <span>{formatMonthLabel(selectedMonthStart)}</span>
              <FiChevronRight style={{ transform: 'rotate(90deg)' }} />
              <select
                value={selectedMonthStart}
                aria-label="Select month"
                onChange={(event) => setSelectedMonthStart(event.target.value)}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="hrAttCalendarShell__navBtn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <FiChevronRight />
            </button>
          </div>

          {selectedEmployee ? (
            <>
              <div className="hrAttCalendarShell__legend" aria-hidden="true">
                <span className="hrAttCalendarShell__legendItem">
                  <span className="hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--ot" />
                  Custom hours
                </span>
                <span className="hrAttCalendarShell__legendItem">
                  <span className="hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--holiday" />
                  Holiday
                </span>
              </div>

              <div className="mgrMonth__calendarGridWrap">
                <div className="hrCal" style={calendarStyle}>
                  {CALENDAR_DAYS.map((day) => (
                    <div key={day} className="hrCal__dow">
                      {day}
                    </div>
                  ))}

                  {calendarCells.map((cell) => {
                    if (cell.startsWith('blank-')) {
                      return <div key={cell} className="hrCal__cell hrCal__cell--disabled" aria-hidden="true" />;
                    }

                    const dayDraft = resolveDisplayedDraft(cell);
                    const isDefaultDayOff = !dayDraft.isOverride && !dayDraft.hasTemplate && dayDraft.dayOff;
                    const isLocked = cell <= todayKey;
                    const isSelected = cell === selectedDateKey;
                    const isToday = cell === todayKey;
                    const isHoliday = holidayDateSet.has(cell);
                    const holidayLabel =
                      holidayNamesByDate[cell] ?? (regularHolidayDateSet.has(cell) ? 'Regular Holiday' : 'Holiday');
                    const dayNumber = parseIsoDate(cell).getDate();
                    const timeLabel = dayDraft.dayOff || isDefaultDayOff
                      ? 'Day off'
                      : formatShiftSegmentsLabel(dayDraft.segments, formatTimeLabel);

                    const cellClass = [
                      'hrCal__cell',
                      'hrCal__cell--click',
                      'hrCal__cell--focus',
                      isHoliday ? 'hrCal__cell--holiday' : '',
                      dayDraft.dayOff || isDefaultDayOff ? 'hrCal__cell--dayOff' : '',
                      dayDraft.isOverride && !dayDraft.dayOff ? 'hrCal__cell--ot' : '',
                      isLocked ? 'mgrMonth__cell--readonly' : '',
                      isSelected ? 'hrCal__cell--selected' : '',
                      isToday ? 'hrCal__cell--today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <button
                        key={cell}
                        type="button"
                        className={cellClass}
                        onClick={() => selectDate(cell)}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={`Shift details for ${formatSpecificDateLabel(cell)}`}
                      >
                        <div className="hrCal__cellTop">
                          <div className="hrCal__day">{dayNumber}</div>
                          {isHoliday ? <span className="hrCal__note hrCal__note--holiday">{holidayLabel}</span> : null}
                        </div>

                        <div className="hrCal__statusNotes">
                          {dayDraft.isOverride && !dayDraft.dayOff ? (
                            <span className="hrCal__note hrCal__note--ot">Custom hours</span>
                          ) : null}
                        </div>

                        <div className="hrCal__detailNotes">
                          <span className="hrCal__detail">{timeLabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="hrAttCalendarShell__empty">
              <div>
                <div className="hrAttCalendarShell__emptyTitle">
                  {loadingTeam ? `Loading ${employeePluralLabel}...` : `No ${employeeSingularLabel} selected`}
                </div>
                <p className="hrAttCalendarShell__emptyText">
                  {loadingTeam
                    ? 'The schedule calendar will appear once the employee roster finishes loading.'
                    : selectionHelpText}
                </p>
              </div>
            </div>
          )}
        </section>
      </section>

      {editorOpen && selectedEmployee && selectedDateKey && editorDraft ? (
        <LargePopup
          open
          ariaLabel="Schedule editor"
          title={formatSpecificDateLabel(selectedDateKey)}
          subtitle={
            selectedDateIsLocked
              ? 'Review the saved schedule for this date for attendance monitoring.'
              : 'Review the saved schedule for this date, then adjust the hours or mark it as a day off when needed.'
          }
          size="lg"
          onClose={closeEditor}
          dismissOnBackdrop
          footer={
            !selectedDateIsLocked ? (
              <>
                <button type="button" className="btn btn--ghost" onClick={closeEditor} disabled={savingDate || loadingMonth}>
                  Cancel
                </button>
                <button type="button" className="btn" onClick={() => void saveSelectedDate()} disabled={savingDate || loadingMonth}>
                  <FiSave />
                  <span>{savingDate ? 'Saving...' : 'Save This Date'}</span>
                </button>
              </>
            ) : undefined
          }
        >
          <div className="mgrMonth__editorContent">
            <div className="hrAttSummary mgrMonth__editorSummary">
              <article className="hrAttSummary__card">
                <span>Employee</span>
                <strong>{selectedEmployee.name}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>Saved Time</span>
                {selectedDateSavedTimeSegments.length === 0 ? (
                  <strong>{selectedDateSavedTimeLabel}</strong>
                ) : (
                  <div className="mgrMonth__summaryTimeList" aria-label="Saved time segments">
                    {selectedDateSavedTimeSegments.map((segment, index) => (
                      <div className="mgrMonth__summaryTimeChip" key={`saved-time-${index}`}>
                        {segment.label}
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <article className="hrAttSummary__card">
                <span>Day Type</span>
                <strong>{selectedDateDayTypeLabel}</strong>
              </article>
            </div>

            <section className="hrAttBreakdown__section mgrMonth__editorSection">
              <div className="hrAttBreakdown__title">{selectedDateIsLocked ? 'Saved schedule' : 'Edit saved schedule'}</div>

              <label className={`mgrMonth__dayOffToggle ${selectedDateIsLocked ? 'is-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={editorDraft.dayOff}
                  onChange={(event) => updateDayOff(event.target.checked)}
                  disabled={savingDate || loadingMonth || selectedDateIsLocked}
                />
                <div>
                  <strong>Mark this date as day off</strong>
                  <span>No working hours will be saved for this calendar date.</span>
                </div>
              </label>

              <div className="mgrMonth__segmentList">
                {editorDraft.segments.map((segment, index) => (
                  <div className="mgrMonth__segmentRow" key={`${selectedDateKey}-segment-${index}`}>
                    <div className="mgrMonth__timeGrid">
                      <label className={`mgrMonth__field ${editorSegmentErrors[index]?.startTime ? 'is-invalid' : ''}`}>
                        <span>Start Time</span>
                        <input
                          type="time"
                          value={segment.startTime}
                          onChange={(event) => updateSegment(index, 'startTime', event.target.value)}
                          disabled={savingDate || loadingMonth || selectedDateIsLocked || editorDraft.dayOff}
                        />
                        {editorSegmentErrors[index]?.startTime ? (
                          <small className="mgrMonth__fieldError">{editorSegmentErrors[index].startTime}</small>
                        ) : null}
                      </label>

                      <label className={`mgrMonth__field ${editorSegmentErrors[index]?.endTime ? 'is-invalid' : ''}`}>
                        <span>End Time</span>
                        <input
                          type="time"
                          value={segment.endTime}
                          onChange={(event) => updateSegment(index, 'endTime', event.target.value)}
                          disabled={savingDate || loadingMonth || selectedDateIsLocked || editorDraft.dayOff}
                        />
                        {editorSegmentErrors[index]?.endTime ? (
                          <small className="mgrMonth__fieldError">{editorSegmentErrors[index].endTime}</small>
                        ) : null}
                      </label>
                    </div>

                    {!selectedDateIsLocked ? (
                      <button
                        type="button"
                        className="btn btn--ghost mgrMonth__segmentRemove"
                        onClick={() => removeSegment(index)}
                        disabled={savingDate || loadingMonth || editorDraft.dayOff || editorDraft.segments.length === 1}
                      >
                        Remove Segment
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              {!selectedDateIsLocked ? (
                <div className="mgrMonth__segmentActions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={addSegment}
                    disabled={savingDate || loadingMonth || editorDraft.dayOff}
                  >
                    Add Segment
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        </LargePopup>
      ) : null}

      {templateEditorOpen && selectedEmployee ? (
        <LargePopup
          open
          ariaLabel="Default hours editor"
          title={
            enableDefaultHoursBatchSelection && !enableBatchSelection
              ? batchTemplateEmployees.length > 1
                ? `${batchTemplateEmployees.length} ${formatUiLabel(employeePluralLabel)} Selected`
                : batchTemplateEmployees[0]?.name ?? `Select ${formatUiLabel(employeePluralLabel)}`
              : batchTemplateEmployees.length > 1
                ? `${batchTemplateEmployees.length} ${formatUiLabel(employeePluralLabel)} Selected`
                : batchTemplateEmployees[0]?.name ?? selectedEmployee.name
          }
          subtitle={
            enableDefaultHoursBatchSelection && !enableBatchSelection
              ? `Choose one or more ${employeePluralLabel} below, then pick the days that should share the same default hours. Existing custom day changes stay exactly as they are.`
              : batchTemplateEmployees.length > 1
                ? `Choose the days that should share the same default hours for every selected ${employeeSingularLabel}. Existing custom day changes stay exactly as they are.`
                : 'Choose the days that should share the same default hours. Existing custom day changes stay exactly as they are.'
          }
          size="xl"
          onClose={closeTemplateEditor}
          dismissOnBackdrop
          footer={
            <div className="mgrMonth__templateFooter">
              <div className="mgrMonth__templateFooterGroup mgrMonth__templateFooterGroup--left">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={clearTemplateSelections}
                  disabled={savingTemplate || !canClearTemplateSelections}
                >
                  Clear Selection
                </button>
              </div>
              <div className="mgrMonth__templateFooterGroup mgrMonth__templateFooterGroup--right">
                <button type="button" className="btn btn--ghost" onClick={closeTemplateEditor} disabled={savingTemplate}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn mgrMonth__templateApplyButton"
                  onClick={() => void applyRecurringTemplate()}
                  disabled={savingTemplate || batchTemplateEmployees.length === 0}
                >
                  <span className="mgrMonth__templateApplyButtonContent">
                    <FiSave aria-hidden="true" />
                    <span className="mgrMonth__templateApplyButtonLabel">{savingTemplate ? 'Saving...' : 'Apply'}</span>
                  </span>
                </button>
              </div>
            </div>
          }
        >
          <div className="mgrMonth__templateContent">
            {enableDefaultHoursBatchSelection && !enableBatchSelection ? (
              <section className="mgrMonth__templateTargetsCard">
                <div className="mgrMonth__sectionIntro">
                  <div className="mgrMonth__sectionHeader">
                    <div className="mgrMonth__templateTargetsHead">
                      <h2>Who gets this default schedule?</h2>
                    </div>

                    <label className={`mgrMonth__selectAllToggle ${savingTemplate || templateTargetSearchResults.length === 0 ? 'is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={allVisibleTemplateTargetsSelected}
                        onChange={(event) => toggleAllTemplateTargetEmployees(event.target.checked)}
                        disabled={savingTemplate || templateTargetSearchResults.length === 0}
                      />
                      <span>Select all</span>
                    </label>
                  </div>
                </div>

                <div className="mgrMonth__field mgrMonth__templateTargetsField">
                  <div className="mgrMonth__templateSearchRow">
                    <div className="mgrMonth__templateSearchWrap">
                      <input
                        type="text"
                        className="mgrMonth__templateSearchInput"
                        value={templateTargetSearch}
                        onChange={(event) => setTemplateTargetSearch(event.target.value)}
                        placeholder={`Search ${employeePluralLabel}`}
                        aria-label={`Search ${employeePluralLabel}`}
                        disabled={savingTemplate || sortedEmployees.length === 0}
                      />
                      {canClearTemplateTargetSearch ? (
                        <button
                          type="button"
                          className="mgrMonth__templateSearchClear"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setTemplateTargetSearch('')}
                          disabled={savingTemplate}
                          aria-label={`Clear ${employeePluralLabel} search`}
                        >
                          <FiX />
                        </button>
                      ) : null}
                    </div>

                    {showDepartmentFilter ? (
                      <div className="hrAttFilter mgrMonth__employeeFilter mgrMonth__templateFilter" ref={templateFilterRef}>
                        <button
                          type="button"
                          className={`hrAttFilter__toggle ${templateFilterOpen ? 'is-open' : ''} ${templateActiveFilterCount > 0 ? 'is-active' : ''}`}
                          onClick={() => setTemplateFilterOpen((open) => !open)}
                          disabled={savingTemplate || sortedEmployees.length === 0}
                        >
                          <FiFilter />
                          <span>Filter</span>
                          {templateActiveFilterCount > 0 ? <span className="hrAttFilter__count">{templateActiveFilterCount}</span> : null}
                        </button>

                        {templateFilterOpen ? (
                          <div className="hrAttFilter__panel">
                            <label className="hrAttFilter__field">
                              <span>Role</span>
                              <select value={templateRoleFilter} onChange={(event) => setTemplateRoleFilter(event.target.value)}>
                                <option value="all">All roles</option>
                                {HR_SCHEDULE_ROLE_FILTERS.map((option) => (
                                  <option key={option.value} value={option.value.replace('role:', '')}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="hrAttFilter__field">
                              <span>Unit</span>
                              <select value={templateDepartmentFilter} onChange={(event) => setTemplateDepartmentFilter(event.target.value)}>
                                <option value="all">All units</option>
                                {departmentOptions.map((department) => (
                                  <option key={department} value={department}>
                                    {department}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="hrAttFilter__actions">
                              <button type="button" onClick={clearTemplateFilters}>
                                Clear Filters
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mgrMonth__templateTargetList" aria-label={`Choose ${employeePluralLabel} for default hours`}>
                  {templateTargetSearchResults.length > 0 ? (
                    templateTargetSearchResults.map((employee) => {
                      const isSelected = templateTargetEmployeeIds.includes(employee.id);
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          className={`mgrMonth__templateTargetOption ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => toggleTemplateTargetEmployee(employee)}
                          aria-pressed={isSelected}
                          disabled={savingTemplate}
                        >
                          <div className="mgrMonth__templateTargetOptionTop">
                            <strong>{employee.name}</strong>
                          </div>
                          <div className="mgrMonth__templateTargetOptionMeta">
                            {getEmployeeMetaParts(employee, { includeDepartment: showDepartmentFilter }).map((part, index) => (
                              <span key={`${employee.id}-${index}`}>{part}</span>
                            ))}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="mgrMonth__empty mgrMonth__empty--compact">{`No ${employeePluralLabel} match that search.`}</div>
                  )}
                </div>
              </section>
            ) : null}

            {enableBatchSelection && batchTemplateEmployees.length > 1 ? (
              <div className="mgrMonth__batchTargets" aria-label="Selected employees for batch default hours">
                {batchTemplateEmployees.map((employee) => (
                  <span key={employee.id} className={`mgrMonth__batchTarget ${employee.id === selectedEmployeeId ? 'is-active' : ''}`}>
                    {employee.name}
                  </span>
                ))}
              </div>
            ) : null}

            <section className="mgrMonth__templateWorkspace">
              <div className="mgrMonth__templateApply">
                <div className="mgrMonth__sectionIntro">
                  <div className="mgrMonth__sectionHeader">
                    <div className="mgrMonth__templateApplyHead">
                      <h2>Select days</h2>
                    </div>

                    <label className={`mgrMonth__selectAllToggle ${savingTemplate ? 'is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={allTemplateDaysSelected}
                        onChange={(event) => toggleAllTemplateDays(event.target.checked)}
                        disabled={savingTemplate}
                      />
                      <span>Select all</span>
                    </label>
                  </div>
                </div>

                <div className="mgrMonth__templateGrid">
                  {DAY_ORDER.map((day) => {
                    const isSelected = selectedTemplateDays.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        className={`mgrMonth__templateDay ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleTemplateDay(day)}
                      >
                        <strong>{formatDayLabel(day)}</strong>
                      </button>
                    );
                  })}
                </div>
              </div>

              <section className="mgrMonth__templateTimeCard">
                <div className="mgrMonth__sectionIntro">
                  <div className="mgrMonth__sectionHeader">
                    <div className="mgrMonth__templateTimeHead">
                      <h2>{templateDayOff ? 'Default day off' : 'Default time range'}</h2>
                    </div>

                    <span className="mgrMonth__selectAllToggle mgrMonth__selectAllToggle--ghost" aria-hidden="true">
                      <input type="checkbox" tabIndex={-1} />
                      <span>Select all</span>
                    </span>
                  </div>
                </div>

                <label className={`mgrMonth__dayOffToggle ${savingTemplate ? 'is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={templateDayOff}
                    onChange={(event) => setTemplateDayOff(event.target.checked)}
                    disabled={savingTemplate}
                  />
                  <div>
                    <strong>Mark as day off</strong>
                  </div>
                </label>

                <div className="mgrMonth__timeGrid mgrMonth__timeGrid--stacked">
                  <label className="mgrMonth__field">
                    <span>Start Time</span>
                    <input
                      type="time"
                      value={templateStartTime}
                      onChange={(event) => setTemplateStartTime(event.target.value)}
                      disabled={savingTemplate || templateDayOff}
                    />
                  </label>

                  <label className="mgrMonth__field">
                    <span>End Time</span>
                    <input
                      type="time"
                      value={templateEndTime}
                      onChange={(event) => setTemplateEndTime(event.target.value)}
                      disabled={savingTemplate || templateDayOff}
                    />
                  </label>
                </div>

                <p className="mgrMonth__templateNote">
                  {templateDayOff
                    ? 'This only changes the recurring weekly template. Custom hours already saved on specific calendar dates will stay exactly as they are.'
                    : 'Custom hours already saved on specific calendar dates will stay exactly as they are.'}
                </p>
              </section>
            </section>
          </div>
        </LargePopup>
      ) : null}
    </div>
  );
}

export default function ManagerMonthlyTeamSchedule() {
  return (
    <MonthlyScheduleBoard
      rosterUrl="/api/employees/team"
      employeeSingularLabel="team member"
      employeePluralLabel="team members"
      emptyRosterLabel="No team members assigned"
      selectionHelpText="Pick a team member from the search box to plan day-by-day shifts, then use Edit Default Hours when you want to batch-update recurring weekly hours."
      enableDefaultHoursBatchSelection
    />
  );
}
