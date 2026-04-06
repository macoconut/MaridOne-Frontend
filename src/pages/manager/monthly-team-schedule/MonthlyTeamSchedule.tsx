import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight, FiFilter, FiSave, FiX } from 'react-icons/fi';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import '../../hr/attendance-reports/AttendanceReports.css';
import {
  buildTemplateDrafts,
  DAY_ORDER,
  addMonths,
  formatDayLabel,
  formatMonthLabel,
  formatSpecificDateLabel,
  getMonthDates,
  normalizeMonthStart,
  parseDailyShifts,
  parseIsoDate,
  parseTeamEmployees,
  timeFromDateTime,
  toIsoDate,
} from '../team-shift-schedules/scheduleUtils';
import type { DailyShift, ShiftDraft, TeamEmployee } from '../team-shift-schedules/scheduleUtils';
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
  startTime: string;
  endTime: string;
  dayOff: boolean;
  isOverride: boolean;
  hasTemplate: boolean;
  templateStartTime: string;
  templateEndTime: string;
};

type HolidayLookupResponse = {
  holidayDates?: string[];
  regularHolidayDates?: string[];
};

type MonthlyScheduleBoardProps = {
  rosterUrl: string;
  employeeSingularLabel: string;
  employeePluralLabel: string;
  emptyRosterLabel: string;
  selectionHelpText: string;
  showDepartmentFilter?: boolean;
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

  return { holidayDates, regularHolidayDates };
}

function resolveTemplateTimes(employee: TeamEmployee | null, workDate: string) {
  const dayName = parseIsoDate(workDate).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const template = employee?.shiftSchedules.find((item) => String(item.dayOfWeek ?? '').toUpperCase() === dayName);

  return {
    hasTemplate: Boolean(template),
    startTime: template?.startTime?.slice(0, 5) || '',
    endTime: template?.endTime?.slice(0, 5) || '',
  };
}

function buildEditorDraft(
  employee: TeamEmployee | null,
  workDate: string,
  shiftMap: Map<string, DailyShift>
): EditorDraft {
  const template = resolveTemplateTimes(employee, workDate);
  const override = shiftMap.get(workDate);

  return {
    startTime: override && !override.dayOff ? timeFromDateTime(override.startDateTime) || template.startTime : template.startTime,
    endTime: override && !override.dayOff ? timeFromDateTime(override.endDateTime) || template.endTime : template.endTime,
    dayOff: override ? Boolean(override?.dayOff) : !template.hasTemplate,
    isOverride: Boolean(override?.dailyShiftId),
    hasTemplate: template.hasTemplate,
    templateStartTime: template.startTime,
    templateEndTime: template.endTime,
  };
}

function buildLockedDayDrafts(
  employee: TeamEmployee | null,
  monthStart: string,
  shiftMap: Map<string, DailyShift>,
  todayKey: string
) {
  return getMonthDates(monthStart)
    .filter((workDate) => workDate <= todayKey)
    .reduce<Record<string, EditorDraft>>((next, workDate) => {
      next[workDate] = buildEditorDraft(employee, workDate, shiftMap);
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
}: MonthlyScheduleBoardProps) {
  const { showSuccess } = useUiDialog();
  const initialMonthStart = useMemo(() => normalizeMonthStart(toIsoDate(new Date())), []);
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => initialMonthStart);
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, ShiftDraft>>({});
  const [selectedTemplateDays, setSelectedTemplateDays] = useState<string[]>([]);
  const [templateStartTime, setTemplateStartTime] = useState('08:00');
  const [templateEndTime, setTemplateEndTime] = useState('17:00');
  const [templateDayOff, setTemplateDayOff] = useState(false);
  const [lockedDayDrafts, setLockedDayDrafts] = useState<Record<string, EditorDraft>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [holidayDateKeys, setHolidayDateKeys] = useState<string[]>([]);
  const [regularHolidayDateKeys, setRegularHolidayDateKeys] = useState<string[]>([]);
  const [savingDate, setSavingDate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const employeePickerRef = useRef<HTMLDivElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useErrorDialogEffect(loadError, 'Schedule calendar could not be loaded');
  useErrorDialogEffect(saveError, 'Schedule calendar could not be saved');
  useEscapeDismiss(editorOpen, closeEditor, 10);
  useEscapeDismiss(templateEditorOpen, closeTemplateEditor, 11);
  useEscapeDismiss(employeePickerOpen, closeEmployeePicker, 12);
  useEscapeDismiss(filterOpen, () => setFilterOpen(false), 13);

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
  const departmentOptions = useMemo(
    () =>
      [...new Set(sortedEmployees.map((employee) => employee.department).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right)),
    [sortedEmployees]
  );
  const filteredEmployees = useMemo(() => {
    const query = normalizeSearchText(employeeSearch);
    return sortedEmployees.filter((employee) => {
      if (showDepartmentFilter && roleFilter !== 'all' && employee.position !== roleFilter) {
        return false;
      }

      if (showDepartmentFilter && departmentFilter !== 'all' && employee.department !== departmentFilter) {
        return false;
      }

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
    });
  }, [departmentFilter, employeeSearch, roleFilter, showDepartmentFilter, sortedEmployees]);

  const calendarCells = useMemo(() => buildCalendarCells(selectedMonthStart), [selectedMonthStart]);
  const calendarStyle = useMemo(
    () =>
      ({
        '--calendar-week-rows': String(Math.max(1, calendarCells.length / 7)),
      }) as CSSProperties,
    [calendarCells.length]
  );

  const shiftMap = useMemo(
    () =>
      new Map(
        dailyShifts
          .filter((shift): shift is DailyShift & { workDate: string } => Boolean(shift.workDate))
          .map((shift) => [shift.workDate, shift])
      ),
    [dailyShifts]
  );
  const holidayDateSet = useMemo(() => new Set(holidayDateKeys), [holidayDateKeys]);
  const regularHolidayDateSet = useMemo(() => new Set(regularHolidayDateKeys), [regularHolidayDateKeys]);
  const selectedDateIsLocked = Boolean(selectedDateKey && selectedDateKey <= todayKey);
  const selectedDateIsHoliday = Boolean(selectedDateKey && holidayDateSet.has(selectedDateKey));
  const selectedDateDayTypeLabel = !selectedDateKey
    ? ''
    : selectedDateIsHoliday
      ? regularHolidayDateSet.has(selectedDateKey)
        ? 'Regular holiday'
        : 'Special holiday'
      : 'Regular workday';
  const selectedDateSavedTimeLabel = !editorDraft || editorDraft.dayOff || !editorDraft.startTime || !editorDraft.endTime
    ? 'Day off'
    : `${formatTimeLabel(editorDraft.startTime)} - ${formatTimeLabel(editorDraft.endTime)}`;
  const canClearEmployeePicker = employeeSearch.trim().length > 0;
  const activeFilterCount =
    (showDepartmentFilter && roleFilter !== 'all' ? 1 : 0) +
    (showDepartmentFilter && departmentFilter !== 'all' ? 1 : 0);
  const resolveDisplayedDraft = useCallback(
    (workDate: string) => {
      if (workDate <= todayKey && lockedDayDrafts[workDate]) {
        return lockedDayDrafts[workDate];
      }
      return buildEditorDraft(selectedEmployee, workDate, shiftMap);
    },
    [lockedDayDrafts, selectedEmployee, shiftMap, todayKey]
  );

  function closeEmployeePicker() {
    setEmployeePickerOpen(false);
    setEmployeeSearch(selectedEmployee?.name ?? '');
  }

  function closeEditor() {
    setEditorOpen(false);
    setSaveError('');
  }

  function closeTemplateEditor() {
    setTemplateEditorOpen(false);
    setSaveError('');
  }

  function clearEmployeeFilters() {
    setRoleFilter('all');
    setDepartmentFilter('all');
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
    } catch (error) {
      if (!silent) {
        setEmployees([]);
        setSelectedEmployeeId(null);
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
      } catch (error) {
        if (cancelled) return;
        setHolidayDateKeys([]);
        setRegularHolidayDateKeys([]);
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

    setLockedDayDrafts(buildLockedDayDrafts(selectedEmployee, selectedMonthStart, shiftMap, todayKey));
  }, [selectedEmployeeId, selectedMonthStart, dailyShifts, shiftMap, todayKey]);

  useEffect(() => {
    if (!selectedEmployee || !selectedDateKey) {
      setEditorDraft(null);
      return;
    }

    setEditorDraft(resolveDisplayedDraft(selectedDateKey));
  }, [resolveDisplayedDraft, selectedDateKey, selectedEmployee]);

  useEffect(() => {
    setTemplateDrafts(buildTemplateDrafts(selectedEmployee));
  }, [selectedEmployee]);

  useEffect(() => {
    if (!employeePickerOpen) {
      setEmployeeSearch(selectedEmployee?.name ?? '');
    }
  }, [employeePickerOpen, selectedEmployee]);

  useEffect(() => {
    if (!showDepartmentFilter || !filterOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!filterRef.current?.contains(target)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [filterOpen, showDepartmentFilter]);

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
  }, [employeePickerOpen, selectedEmployee]);

  function selectDate(workDate: string) {
    setSelectedDateKey(workDate);
    setTemplateEditorOpen(false);
    setEditorOpen(true);
    setSaveError('');
  }

  function selectEmployee(employee: TeamEmployee) {
    setSelectedEmployeeId(employee.id);
    setEmployeeSearch(employee.name);
    setEmployeePickerOpen(false);
  }

  function clearEmployeeSearch() {
    setEmployeeSearch('');
    setEmployeePickerOpen(true);
    employeeSearchInputRef.current?.focus();
  }

  function openTemplateEditor() {
    if (!selectedEmployee) return;
    setTemplateDrafts(buildTemplateDrafts(selectedEmployee));
    setSelectedTemplateDays([]);
    setTemplateStartTime('08:00');
    setTemplateEndTime('17:00');
    setTemplateDayOff(false);
    setEditorOpen(false);
    setTemplateEditorOpen(true);
    setSaveError('');
  }

  function toggleTemplateDay(day: string) {
    setSelectedTemplateDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day]
    );
  }

  function updateDraft(key: 'startTime' | 'endTime', value: string) {
    setEditorDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateDayOff(value: boolean) {
    setEditorDraft((current) => (current ? { ...current, dayOff: value } : current));
  }

  async function saveSelectedDate() {
    if (!selectedEmployee || !selectedDateKey || !editorDraft) return;

    if (selectedDateKey <= todayKey) {
      setSaveError('Schedule changes can only be made starting tomorrow.');
      return;
    }

    if (!editorDraft.dayOff && (!editorDraft.startTime || !editorDraft.endTime)) {
      setSaveError('Start time and end time are both required unless the date is marked as day off.');
      return;
    }

    if (!editorDraft.dayOff && editorDraft.startTime === editorDraft.endTime) {
      setSaveError('Start time and end time cannot be the same unless the date is marked as day off.');
      return;
    }

    setSaveError('');
    setSavingDate(true);

    try {
      const payload = await apiFetchJson<DailyShift>('/api/employee/schedule/daily/override', {
        method: 'PUT',
        body: JSON.stringify({
          empId: selectedEmployee.id,
          workDate: selectedDateKey,
          dayOff: editorDraft.dayOff,
          startTime: editorDraft.dayOff ? null : editorDraft.startTime,
          endTime: editorDraft.dayOff ? null : editorDraft.endTime,
        }),
      });

      const [savedShift] = parseDailyShifts([payload], toArray);
      if (savedShift) {
        setDailyShifts((current) => {
          const next = current.filter((shift) => shift.workDate !== selectedDateKey);
          return [...next, savedShift].sort((left, right) => String(left.workDate).localeCompare(String(right.workDate)));
        });
      }

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
    if (!selectedEmployee) return;

    if (selectedTemplateDays.length === 0) {
      setSaveError('Choose at least one weekday to update.');
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
        selectedTemplateDays.map(async (day) => {
          const draft = templateDrafts[day] ?? { startTime: '08:00', endTime: '17:00' };
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
              empId: selectedEmployee.id,
              startTime: templateStartTime,
              endTime: templateEndTime,
              dayOfWeek: day,
            }),
          });
        })
      );

      await loadTeamSchedules();
      setTemplateEditorOpen(false);
      const savedDays = DAY_ORDER.filter((day) => selectedTemplateDays.includes(day)).map((day) => formatDayLabel(day));
      showSuccess(
        templateDayOff
          ? `Selected weekdays are now marked as day off for ${savedDays.join(', ')}.`
          : `Default hours updated for ${savedDays.join(', ')}.`,
        templateDayOff ? 'Day Off Saved' : 'Default Hours Saved'
      );
    } catch (error) {
      setSaveError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <div className="hrAtt mgrMonth">
      <div className="hrAtt__head">
        <PageHeader
          title="Schedule Calendar"
          description="Set the default hours here, then click any calendar date when you need custom hours for a specific day."
        />

        <div className="hrAtt__controls">
          <div className="hrAtt__monthSelectWrap">
            <select
              className="hrAtt__monthSelect"
              value={selectedMonthStart}
              onChange={(event) => setSelectedMonthStart(event.target.value)}
              aria-label="Select month"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
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
                      : `Search ${employeeSingularLabel}`
                }
                disabled={loadingTeam || sortedEmployees.length === 0}
                aria-label={`Search ${employeeSingularLabel}`}
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
                  setEmployeeSearch(selectedEmployee?.name ?? '');
                  setEmployeePickerOpen((current) => !current);
                }}
                disabled={loadingTeam || sortedEmployees.length === 0}
                aria-label={employeePickerOpen ? `Close ${employeeSingularLabel} list` : `Open ${employeeSingularLabel} list`}
              >
                <FiChevronDown />
              </button>
            </div>

            {employeePickerOpen ? (
              <div className="hrEmpCombo__menu" id="shift-calendar-employee-options" role="listbox">
                {loadingTeam ? (
                  <div className="hrEmpCombo__empty">{`Loading ${employeePluralLabel}...`}</div>
                ) : filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => {
                    const isSelected = employee.id === selectedEmployeeId;
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`hrEmpCombo__option ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => selectEmployee(employee)}
                      >
                        <span className="hrEmpCombo__optionName">{employee.name}</span>
                        <span className="hrEmpCombo__optionMeta">{formatEmployeePickerMeta(employee)}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="hrEmpCombo__empty">{`No ${employeePluralLabel} match that search.`}</div>
                )}
              </div>
            ) : null}
          </div>

          {showDepartmentFilter ? (
            <div className="hrAttFilter mgrMonth__employeeFilter" ref={filterRef}>
              <button
                type="button"
                className={`hrAttFilter__toggle ${filterOpen ? 'is-open' : ''} ${activeFilterCount > 0 ? 'is-active' : ''}`}
                onClick={() => setFilterOpen((open) => !open)}
                disabled={loadingTeam}
              >
                <FiFilter />
                <span>Filter</span>
                {activeFilterCount > 0 ? <span className="hrAttFilter__count">{activeFilterCount}</span> : null}
              </button>

              {filterOpen ? (
                <div className="hrAttFilter__panel">
                  <label className="hrAttFilter__field">
                    <span>Role</span>
                    <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                      <option value="all">All roles</option>
                      {HR_SCHEDULE_ROLE_FILTERS.map((option) => (
                        <option key={option.value} value={option.value.replace('role:', '')}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="hrAttFilter__field">
                    <span>Department</span>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                      <option value="all">All departments</option>
                      {departmentOptions.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="hrAttFilter__actions">
                    <button type="button" onClick={clearEmployeeFilters}>
                      Clear Filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mgrMonth__toolbarActions">
          <button
            type="button"
            className="actionBtnX mgrMonth__toolbarBtn"
            onClick={openTemplateEditor}
            disabled={!selectedEmployee || loadingTeam || savingTemplate}
          >
            <span className="mgrMonth__toolbarBtnLabel">Edit Default Hours</span>
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
            <div className="hrAttCalendarShell__month">{formatMonthLabel(selectedMonthStart)}</div>
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
                    const dayNumber = parseIsoDate(cell).getDate();
                    const timeLabel = dayDraft.dayOff || isDefaultDayOff || !dayDraft.startTime || !dayDraft.endTime
                      ? 'Day off'
                      : `${formatTimeLabel(dayDraft.startTime)} - ${formatTimeLabel(dayDraft.endTime)}`;

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
                        </div>

                        <div className="hrCal__statusNotes">
                          {dayDraft.isOverride && !dayDraft.dayOff ? (
                            <span className="hrCal__note hrCal__note--ot">Custom hours</span>
                          ) : null}
                          {isHoliday && <span className="hrCal__note hrCal__note--holiday">Holiday</span>}
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
        <div className="hrAttModalBackdrop" role="dialog" aria-modal="true" aria-label="Schedule editor" onClick={closeEditor}>
          <div className="hrAttModal mgrMonth__modal" onClick={(event) => event.stopPropagation()}>
            <div className="hrAttModal__top">
              <div>
                <div className="hrAttModal__eyebrow">Schedule Calendar</div>
                <div className="hrAttModal__title">{formatSpecificDateLabel(selectedDateKey)}</div>
              </div>
              <ModalCloseButton className="hrAttModal__close" onClick={closeEditor} />
            </div>

            <div className="hrAttModal__rule" />

            <div className="hrAttSummary mgrMonth__editorSummary">
              <article className="hrAttSummary__card">
                <span>Employee</span>
                <strong>{selectedEmployee.name}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>Saved Time</span>
                <strong>{selectedDateSavedTimeLabel}</strong>
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

              <div className="mgrMonth__timeGrid">
                <label className="mgrMonth__field">
                  <span>Start Time</span>
                  <input
                    type="time"
                    value={editorDraft.startTime}
                    onChange={(event) => updateDraft('startTime', event.target.value)}
                    disabled={savingDate || loadingMonth || selectedDateIsLocked || editorDraft.dayOff}
                  />
                </label>

                <label className="mgrMonth__field">
                  <span>End Time</span>
                  <input
                    type="time"
                    value={editorDraft.endTime}
                    onChange={(event) => updateDraft('endTime', event.target.value)}
                    disabled={savingDate || loadingMonth || selectedDateIsLocked || editorDraft.dayOff}
                  />
                </label>
              </div>
            </section>

            {!selectedDateIsLocked ? (
              <div className="hrAttModal__actions mgrMonth__modalActions">
                <button type="button" onClick={closeEditor} disabled={savingDate || loadingMonth}>
                  Cancel
                </button>
                <button type="button" onClick={() => void saveSelectedDate()} disabled={savingDate || loadingMonth}>
                  <FiSave />
                  <span>{savingDate ? 'Saving...' : 'Save This Date'}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {templateEditorOpen && selectedEmployee ? (
        <div
          className="hrAttModalBackdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Default hours editor"
          onClick={closeTemplateEditor}
        >
          <div className="hrAttModal mgrMonth__modal mgrMonth__modal--template" onClick={(event) => event.stopPropagation()}>
            <div className="hrAttModal__top">
              <div>
                <div className="hrAttModal__eyebrow">Default Hours</div>
                <div className="hrAttModal__title">{selectedEmployee.name}</div>
                <p className="hrAttModal__subtitle">
                  Choose the weekdays that should share the same default hours. Existing custom day changes stay exactly as they are.
                </p>
              </div>
              <ModalCloseButton className="hrAttModal__close" onClick={closeTemplateEditor} />
            </div>

            <div className="hrAttModal__rule" />

            <section className="mgrMonth__templateWorkspace">
              <div className="mgrMonth__templateApply">
                <div className="mgrMonth__templateApplyHead">
                  <h2>Select weekdays</h2>
                  <p>Apply one default time range or a recurring day off to the weekdays you choose. Saved date-specific schedules stay untouched.</p>
                </div>

                <div className="mgrMonth__templateGrid">
                  {DAY_ORDER.map((day) => {
                    const draft = templateDrafts[day] ?? { startTime: '', endTime: '' };
                    const isSelected = selectedTemplateDays.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        className={`mgrMonth__templateDay ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleTemplateDay(day)}
                      >
                        <strong>{formatDayLabel(day)}</strong>
                        <span>
                          {draft.shiftId && draft.startTime && draft.endTime
                            ? `Current: ${formatTimeLabel(draft.startTime)} - ${formatTimeLabel(draft.endTime)}`
                            : 'Current: Day off'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <section className="mgrMonth__templateTimeCard">
                <div className="mgrMonth__templateTimeHead">
                  <h2>{templateDayOff ? 'Default day off' : 'Default time range'}</h2>
                  <p>
                    {templateDayOff
                      ? 'Selected weekdays will have no recurring working hours in the weekly template.'
                      : 'This becomes the weekly base schedule for the days you select.'}
                  </p>
                </div>

                <label className={`mgrMonth__dayOffToggle ${savingTemplate ? 'is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={templateDayOff}
                    onChange={(event) => setTemplateDayOff(event.target.checked)}
                    disabled={savingTemplate}
                  />
                  <div>
                    <strong>Make selected weekdays day off</strong>
                    <span>Existing default hours for those weekdays will be removed, while custom date changes stay untouched.</span>
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

            <div className="hrAttModal__actions mgrMonth__modalActions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSelectedTemplateDays([])}
                disabled={savingTemplate || selectedTemplateDays.length === 0}
              >
                Clear Selection
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void applyRecurringTemplate()}
                disabled={savingTemplate}
              >
                <FiSave />
                <span>{savingTemplate ? 'Saving...' : templateDayOff ? 'Apply Day Off to Selected Days' : 'Apply to Selected Days'}</span>
              </button>
            </div>
          </div>
        </div>
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
      selectionHelpText="Pick a team member from the search box to start planning future shifts for a month."
    />
  );
}
