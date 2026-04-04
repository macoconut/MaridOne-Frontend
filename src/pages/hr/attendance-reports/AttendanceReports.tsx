import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiFilter,
  FiSearch,
  FiUsers,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import PageHeader from '../../../components/layout/PageHeader';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { useRegisterPageRefresh } from '../../../lib/pageRefresh';
import './AttendanceReports.css';

type AttendanceLog = {
  attendanceId?: number;
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

type LeaveRequest = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  leaveType?: string;
  isPaid?: boolean;
};

type OvertimeRequest = {
  overtimeId?: number;
  employeeId?: number;
  requestStatus?: string;
  workDate?: string;
  overtimeType?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
};

type ShiftSchedule = {
  shiftId?: number;
  employeeId?: number;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  status: string;
  position: string;
  department?: string;
  shiftSchedules: ShiftSchedule[];
  gracePeriodMinutes?: number;
};

type DayCell = {
  day: number | null;
  presentCount: number;
  lateCount: number;
  incompleteCount: number;
  absentCount: number | null;
  dayOffCount: number;
};

type EmployeeCalendarTone = 'present' | 'late' | 'incomplete' | 'absent' | 'dayOff' | 'leave' | 'ot';

type EmployeeCalendarNote = {
  label: string;
  tone: EmployeeCalendarTone;
};

type EmployeeCalendarCell = {
  day: number | null;
  tone?: EmployeeCalendarTone;
  notes?: EmployeeCalendarNote[];
  details?: string[];
};

type DailyEmployeeRecord = {
  employeeId: number;
  name: string;
  position: string;
  status: string;
  inTime?: string;
  outTime?: string;
  logCount: number;
  isLate: boolean;
  isIncomplete: boolean;
};

type AttendanceReportsBoardProps = {
  audienceLabel?: string;
  logsUrl?: string;
  rosterUrl?: string;
  leavesUrl?: string;
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const BASE_LEGEND_ITEMS: Array<{ label: string; tone: EmployeeCalendarTone }> = [
  { label: 'Present', tone: 'present' },
  { label: 'Late', tone: 'late' },
  { label: 'Incomplete', tone: 'incomplete' },
  { label: 'Absent', tone: 'absent' },
  { label: 'Day Off', tone: 'dayOff' },
];
const FOCUS_LEGEND_ITEMS: Array<{ label: string; tone: EmployeeCalendarTone }> = [
  ...BASE_LEGEND_ITEMS,
  { label: 'On Leave', tone: 'leave' },
  { label: 'OT', tone: 'ot' },
];
const DEFAULT_WORKING_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const LATE_GRACE_MINUTES = 15;
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function localDateKey(value?: string) {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function localTimeLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isEmployeeScheduledOnDate(employee: EmployeeRow | undefined, dateKey?: string) {
  if (!employee || !dateKey) return false;

  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return true;

  if (!employee.shiftSchedules.length) {
    return DEFAULT_WORKING_DAYS.has(date.getDay());
  }

  const targetDay = DAY_NAMES[date.getDay()];
  return employee.shiftSchedules.some((item) => String(item.dayOfWeek ?? '').toUpperCase() === targetDay);
}

function resolveScheduledStartMinutes(employee: EmployeeRow | undefined, dateKey?: string) {
  if (!employee || !dateKey) return null;

  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return null;

  const targetDay = DAY_NAMES[date.getDay()];
  const schedule = employee.shiftSchedules.find((item) => String(item.dayOfWeek ?? '').toUpperCase() === targetDay);
  return parseTimeToMinutes(schedule?.startTime);
}

function longDateLabel(dateKey: string) {
  if (!dateKey) return '';
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function humanizeEnum(value?: string) {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveDepartmentLabel(employee: EmployeeRow) {
  const value = String(employee.department ?? '').trim();
  if (value) return value;

  switch (employee.position.toUpperCase()) {
    case 'HR':
      return 'HR';
    case 'ACCOUNTING':
      return 'Accounting';
    case 'MANAGER':
    case 'MANAGEMENT':
      return 'Management';
    default:
      return 'Unassigned';
  }
}

function dateKeysBetween(startKey: string, endKey: string) {
  const start = new Date(`${startKey}T12:00:00`);
  const end = new Date(`${endKey}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [] as string[];

  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(`${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatAttendanceWindow(record?: DailyEmployeeRecord) {
  if (!record) return '';
  if (record.inTime && record.outTime) return `${record.inTime} - ${record.outTime}`;
  if (record.inTime) return `In ${record.inTime}`;
  if (record.outTime) return `Out ${record.outTime}`;
  if (record.logCount > 0) return `${record.logCount} log${record.logCount === 1 ? '' : 's'} recorded`;
  return '';
}

function formatLeaveDetail(leave: LeaveRequest) {
  const leaveType = humanizeEnum(leave.leaveType) || 'Leave';
  const payLabel = leave.isPaid === false ? 'Unpaid' : leave.isPaid === true ? 'Paid' : '';
  return payLabel ? `${leaveType} | ${payLabel}` : leaveType;
}

function formatOvertimeDetail(request: OvertimeRequest) {
  const overtimeType = humanizeEnum(request.overtimeType) || 'Overtime';
  const start = localTimeLabel(request.startTime);
  const end = localTimeLabel(request.endTime);
  if (start && end) return `${overtimeType} | ${start} - ${end}`;
  if (start) return `${overtimeType} | Starts ${start}`;
  if (end) return `${overtimeType} | Until ${end}`;
  return overtimeType;
}

function isInDirection(direction?: string) {
  const value = (direction ?? '').toUpperCase();
  return value.includes('IN') || value.includes('LATE');
}

function isOutDirection(direction?: string) {
  return (direction ?? '').toUpperCase().includes('OUT');
}

function isLateDirection(direction?: string) {
  return (direction ?? '').toUpperCase().includes('LATE');
}

function isLateAfterGrace(timestamp?: string, employee?: EmployeeRow, dateKey?: string, direction?: string) {
  if (!timestamp || !employee || !dateKey) return isLateDirection(direction);
  if (!isEmployeeScheduledOnDate(employee, dateKey)) return false;

  const scheduledStartMinutes = resolveScheduledStartMinutes(employee, dateKey);
  if (scheduledStartMinutes === null) {
    return isLateDirection(direction);
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return isLateDirection(direction);

  const graceMinutes = Math.max(employee.gracePeriodMinutes ?? LATE_GRACE_MINUTES, 0);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes > scheduledStartMinutes + graceMinutes;
}

function monthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBased = first.getDay();
  const cells: DayCell[] = [];

  for (let i = 0; i < sundayBased; i++) {
    cells.push({ day: null, presentCount: 0, lateCount: 0, incompleteCount: 0, absentCount: null, dayOffCount: 0 });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, presentCount: 0, lateCount: 0, incompleteCount: 0, absentCount: null, dayOffCount: 0 });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null, presentCount: 0, lateCount: 0, incompleteCount: 0, absentCount: null, dayOffCount: 0 });
  }

  return cells;
}

function employeeName(employee: EmployeeRow | undefined, employeeId: number) {
  return employee?.name || `Employee #${employeeId}`;
}

function buildDailyRecords(logs: AttendanceLog[], employeeById: Map<number, EmployeeRow>, dateKey?: string) {
  const grouped = new Map<number, AttendanceLog[]>();

  for (const log of logs) {
    if (typeof log.employeeId !== 'number') continue;
    const current = grouped.get(log.employeeId) ?? [];
    current.push(log);
    grouped.set(log.employeeId, current);
  }

  return [...grouped.entries()]
    .map(([employeeId, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
        const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
        return at - bt;
      });
      const firstIn = sorted.find((row) => isInDirection(row.direction));
      const lastOut = [...sorted].reverse().find((row) => isOutDirection(row.direction));
      const employee = employeeById.get(employeeId);
      const isLate = firstIn
        ? isLateAfterGrace(firstIn.timestamp, employee, dateKey, firstIn.direction)
        : false;
      const hasIn = sorted.some((row) => isInDirection(row.direction));
      const hasOut = sorted.some((row) => isOutDirection(row.direction));

      return {
        employeeId,
        name: employeeName(employee, employeeId),
        position: employee?.position || '-',
        status: employee?.status || '-',
        inTime: localTimeLabel(firstIn?.timestamp),
        outTime: localTimeLabel(lastOut?.timestamp),
        logCount: sorted.length,
        isLate,
        isIncomplete: !(hasIn && hasOut),
      } satisfies DailyEmployeeRecord;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function withParams(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${query}`;
}

function rosterRows(payload: unknown) {
  return toArray<Record<string, unknown>>(payload).map((row, idx) => ({
    id: Number(row.employeeId ?? row.id ?? idx + 1),
    name:
      [row.firstName, row.middleName, row.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ') || `Employee #${row.employeeId ?? row.id ?? idx + 1}`,
    status: String(row.employmentStatus ?? '-'),
    position: String(row.position ?? '-'),
    department: typeof row.department === 'string' ? row.department.trim() : '',
    shiftSchedules: toArray<Record<string, unknown>>(row.shiftSchedules).map((schedule) => ({
      shiftId: typeof schedule.shiftId === 'number' ? schedule.shiftId : undefined,
      employeeId: typeof schedule.employeeId === 'number' ? schedule.employeeId : undefined,
      startTime: typeof schedule.startTime === 'string' ? schedule.startTime : undefined,
      endTime: typeof schedule.endTime === 'string' ? schedule.endTime : undefined,
      dayOfWeek: typeof schedule.dayOfWeek === 'string' ? schedule.dayOfWeek : undefined,
    })),
    gracePeriodMinutes:
      typeof row.gracePeriodMinutes === 'number'
        ? row.gracePeriodMinutes
        : typeof row.gracePeriodMinutes === 'string'
          ? Number(row.gracePeriodMinutes)
          : undefined,
  }));
}

export default function HrAttendanceReports() {
  return <AttendanceReportsBoard audienceLabel="HR" />;
}

export function AttendanceReportsBoard({
  audienceLabel = 'HR',
  logsUrl = '/api/logs/attendance',
  rosterUrl = '/api/employees',
  leavesUrl = '/api/leave/request',
}: AttendanceReportsBoardProps) {
  const today = useMemo(() => new Date(), []);
  const todayYear = today.getFullYear();
  const todayMonthIndex = today.getMonth();
  const todayDateKey = toISODate(todayYear, todayMonthIndex, today.getDate());
  const [year, setYear] = useState(todayYear);
  const [monthIndex, setMonthIndex] = useState(todayMonthIndex);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const [monthValue, setMonthValue] = useState(
    new Date(todayYear, todayMonthIndex, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  );
  const monthStartKey = useMemo(() => toISODate(year, monthIndex, 1), [monthIndex, year]);
  const monthEndKey = useMemo(
    () => toISODate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate()),
    [monthIndex, year]
  );
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [hasFullRoster, setHasFullRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [focusOvertime, setFocusOvertime] = useState<OvertimeRequest[]>([]);
  const [isFocusDataLoading, setIsFocusDataLoading] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useRegisterPageRefresh(handlePageRefresh);

  useEffect(() => {
    if (detailOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [detailOpen]);

  useEffect(() => {
    if (!filterOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [filterOpen]);

  useEffect(() => {
    setMonthValue(
      new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [monthIndex, year]);

  useEffect(() => {
    if (year === todayYear && monthIndex === todayMonthIndex) {
      setSelectedDateKey(todayDateKey);
    } else {
      setSelectedDateKey('');
    }
  }, [monthIndex, todayDateKey, todayMonthIndex, todayYear, year]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setIsLoading(true);
      setLoadError('');
      try {
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        const logResponse = await apiFetchJson<unknown>(
          withParams(logsUrl, {
            page: '0',
            size: '5000',
            timestampAfter: start.toISOString(),
            timestampBefore: end.toISOString(),
          })
        );
        if (cancelled) return;

        const nextLogs = toArray<AttendanceLog>(logResponse);
        setLogs(nextLogs);

        const [employeeResult, leaveResult] = await Promise.allSettled([
          apiFetchJson<unknown>(withParams(rosterUrl, { page: '0', size: '500' })),
          apiFetchJson<unknown>(
            withParams(leavesUrl, {
              page: '0',
              size: '2000',
              requestStatus: 'APPROVED',
            })
          ),
        ]);
        if (cancelled) return;

        if (employeeResult.status === 'fulfilled') {
          setEmployees(rosterRows(employeeResult.value).filter((row) => Number.isFinite(row.id)));
          setHasFullRoster(true);
          setRosterMessage('');
        } else {
          const ids = new Set<number>();
          for (const log of nextLogs) {
            if (typeof log.employeeId === 'number') ids.add(log.employeeId);
          }
          setEmployees(
            [...ids]
              .sort((a, b) => a - b)
              .map((id) => ({
                id,
                name: `Employee #${id}`,
                status: 'Unknown',
                position: '-',
                department: '',
                shiftSchedules: [],
                gracePeriodMinutes: undefined,
              }))
          );
          setHasFullRoster(false);
          setRosterMessage(
            `${audienceLabel} can load attendance logs, but full employee roster access is restricted.`
          );
        }

        const nextApprovedLeaves =
          leaveResult.status === 'fulfilled'
            ? toArray<LeaveRequest>(leaveResult.value).filter((request) => {
                const startKey = localDateKey(request.startDateTime);
                const endKey = localDateKey(request.endDateTime);
                return (
                  Boolean(startKey) &&
                  Boolean(endKey) &&
                  startKey <= monthEndKey &&
                  endKey >= monthStartKey &&
                  String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
                );
              })
            : [];
        setApprovedLeaves(nextApprovedLeaves);
      } catch (error) {
        if (cancelled) return;
        setLogs([]);
        setEmployees([]);
        setApprovedLeaves([]);
        setHasFullRoster(false);
        setRosterMessage('');
        setLoadError(error instanceof Error ? error.message : 'Failed to load attendance data.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPageData();
    return () => {
      cancelled = true;
    };
  }, [audienceLabel, leavesUrl, logsUrl, monthEndKey, monthIndex, monthStartKey, refreshTick, rosterUrl, year]);

  const reportableEmployees = useMemo(() => {
    return employees.filter((employee) => employee.status.toUpperCase() !== 'TERMINATED');
  }, [employees]);

  const departmentOptions = useMemo(() => {
    return [...new Set(reportableEmployees.map((employee) => resolveDepartmentLabel(employee)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [reportableEmployees]);

  const normalizedSearchValue = searchValue.trim().toLowerCase();

  const filteredEmployees = useMemo(() => {
    return reportableEmployees.filter((employee) => {
      const matchesDepartment =
        departmentFilter === 'all' || resolveDepartmentLabel(employee) === departmentFilter;

      if (!matchesDepartment) return false;
      if (!normalizedSearchValue) return true;

      const haystack = [
        employee.name,
        String(employee.id),
        employee.position,
        resolveDepartmentLabel(employee),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearchValue);
    });
  }, [departmentFilter, normalizedSearchValue, reportableEmployees]);

  const filteredEmployeeById = useMemo(() => {
    const map = new Map<number, EmployeeRow>();
    for (const employee of filteredEmployees) {
      map.set(employee.id, employee);
    }
    return map;
  }, [filteredEmployees]);

  const filteredEmployeeIdSet = useMemo(() => {
    return new Set(filteredEmployees.map((employee) => employee.id));
  }, [filteredEmployees]);

  const activeEmployees = useMemo(() => {
    return filteredEmployees.filter((employee) => employee.status.toUpperCase() !== 'TERMINATED');
  }, [filteredEmployees]);

  const logsByDate = useMemo(() => {
    const grouped = new Map<string, AttendanceLog[]>();
    for (const log of logs) {
      if (typeof log.employeeId !== 'number' || !filteredEmployeeIdSet.has(log.employeeId)) continue;
      const key = localDateKey(log.timestamp);
      if (!key) continue;
      const current = grouped.get(key) ?? [];
      current.push(log);
      grouped.set(key, current);
    }
    return grouped;
  }, [filteredEmployeeIdSet, logs]);

  const approvedLeaveEmployeeIdsByDate = useMemo(() => {
    const grouped = new Map<string, Set<number>>();

    for (const request of approvedLeaves) {
      const employeeId = Number(request.empId);
      const startKey = localDateKey(request.startDateTime);
      const endKey = localDateKey(request.endDateTime);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !startKey || !endKey) continue;

      const rangeStart = startKey > monthStartKey ? startKey : monthStartKey;
      const rangeEnd = endKey < monthEndKey ? endKey : monthEndKey;
      for (const dateKey of dateKeysBetween(rangeStart, rangeEnd)) {
        const current = grouped.get(dateKey) ?? new Set<number>();
        current.add(employeeId);
        grouped.set(dateKey, current);
      }
    }

    return grouped;
  }, [approvedLeaves, filteredEmployeeIdSet, monthEndKey, monthStartKey]);

  const focusedEmployee = filteredEmployees.length === 1 ? filteredEmployees[0] : null;
  const focusedDepartment = focusedEmployee ? resolveDepartmentLabel(focusedEmployee) : '';
  const activeFilterCount = departmentFilter === 'all' ? 0 : 1;
  const noEmployeeMatches = !isLoading && !loadError && reportableEmployees.length > 0 && filteredEmployees.length === 0;
  const selectedDateLabel = selectedDateKey ? longDateLabel(selectedDateKey) : 'Selected date';
  const focusLeaves = useMemo(() => {
    if (!focusedEmployee) return [] as LeaveRequest[];
    return approvedLeaves.filter((request) => Number(request.empId) === focusedEmployee.id);
  }, [approvedLeaves, focusedEmployee]);

  useEffect(() => {
    let cancelled = false;

    async function loadFocusedEmployeeData() {
      if (!focusedEmployee || audienceLabel !== 'HR') {
        setFocusOvertime([]);
        setIsFocusDataLoading(false);
        return;
      }

      setIsFocusDataLoading(true);
      const overtimeResult = await apiFetchJson<unknown>(
        withParams('/api/overtime/all', {
          page: '0',
          size: '400',
          employeeId: String(focusedEmployee.id),
          requestStatus: 'APPROVED',
        })
      ).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason) => ({ status: 'rejected' as const, reason })
      );

      if (cancelled) return;

      const approvedOvertime =
        overtimeResult.status === 'fulfilled'
          ? toArray<OvertimeRequest>(overtimeResult.value).filter((request) => {
              const employeeId = Number(request.employeeId);
              const workDateKey = localDateKey(request.workDate);
              return (
                Number.isFinite(employeeId) &&
                employeeId === focusedEmployee.id &&
                Boolean(workDateKey) &&
                workDateKey >= monthStartKey &&
                workDateKey <= monthEndKey &&
                String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
              );
            })
          : [];

      setFocusOvertime(approvedOvertime);
      setIsFocusDataLoading(false);
    }

    void loadFocusedEmployeeData();
    return () => {
      cancelled = true;
    };
  }, [audienceLabel, focusedEmployee, monthEndKey, monthStartKey]);

  const focusLeavesByDate = useMemo(() => {
    const grouped = new Map<string, LeaveRequest[]>();

    for (const request of focusLeaves) {
      const startKey = localDateKey(request.startDateTime);
      const endKey = localDateKey(request.endDateTime);
      if (!startKey || !endKey) continue;

      const rangeStart = startKey > monthStartKey ? startKey : monthStartKey;
      const rangeEnd = endKey < monthEndKey ? endKey : monthEndKey;

      for (const dateKey of dateKeysBetween(rangeStart, rangeEnd)) {
        const current = grouped.get(dateKey) ?? [];
        current.push(request);
        grouped.set(dateKey, current);
      }
    }

    return grouped;
  }, [focusLeaves, monthEndKey, monthStartKey]);

  const focusOvertimeByDate = useMemo(() => {
    const grouped = new Map<string, OvertimeRequest[]>();
    for (const request of focusOvertime) {
      const dateKey = localDateKey(request.workDate);
      if (!dateKey) continue;
      const current = grouped.get(dateKey) ?? [];
      current.push(request);
      grouped.set(dateKey, current);
    }
    return grouped;
  }, [focusOvertime]);

  const focusRecordByDate = useMemo(() => {
    const grouped = new Map<string, DailyEmployeeRecord>();
    if (!focusedEmployee) return grouped;

    for (const [dateKey, dayLogs] of logsByDate.entries()) {
      const records = buildDailyRecords(dayLogs, filteredEmployeeById, dateKey);
      const record = records.find((item) => item.employeeId === focusedEmployee.id);
      if (record) grouped.set(dateKey, record);
    }

    return grouped;
  }, [filteredEmployeeById, focusedEmployee, logsByDate]);

  const aggregateCalendarCells = useMemo(() => {
    const cells = monthCells(year, monthIndex);
    return cells.map((cell) => {
      if (cell.day === null) return cell;
      const dateKey = toISODate(year, monthIndex, cell.day);
      const isFutureDate = dateKey > todayDateKey;
      const records = buildDailyRecords(logsByDate.get(dateKey) ?? [], filteredEmployeeById, dateKey);
      const presentCount = records.length;
      const lateCount = records.filter((record) => record.isLate).length;
      const incompleteCount = records.filter((record) => record.isIncomplete).length;
      const leaveEmployeeIds = approvedLeaveEmployeeIdsByDate.get(dateKey) ?? new Set<number>();
      const presentIds = new Set(records.map((record) => record.employeeId));
      const absentCount =
        hasFullRoster && !isFutureDate
          ? activeEmployees.filter((employee) => isEmployeeScheduledOnDate(employee, dateKey))
              .filter((employee) => !presentIds.has(employee.id))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;
      const dayOffCount =
        hasFullRoster && !isFutureDate
          ? activeEmployees.filter((employee) => !isEmployeeScheduledOnDate(employee, dateKey))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;

      return {
        day: cell.day,
        presentCount,
        lateCount,
        incompleteCount,
        absentCount,
        dayOffCount,
      } satisfies DayCell;
    });
  }, [
    activeEmployees,
    approvedLeaveEmployeeIdsByDate,
    filteredEmployeeById,
    hasFullRoster,
    logsByDate,
    monthIndex,
    todayDateKey,
    year,
  ]);

  const focusCalendarCells = useMemo(() => {
    if (!focusedEmployee) return [] as EmployeeCalendarCell[];

    return monthCells(year, monthIndex).map((cell) => {
      if (cell.day === null) return { day: null } satisfies EmployeeCalendarCell;

      const dateKey = toISODate(year, monthIndex, cell.day);
      const isFutureDate = dateKey > todayDateKey;
      const isWorkingDay = isEmployeeScheduledOnDate(focusedEmployee, dateKey);
      const record = focusRecordByDate.get(dateKey);
      const leaveRequests = focusLeavesByDate.get(dateKey) ?? [];
      const overtimeRequests = focusOvertimeByDate.get(dateKey) ?? [];
      const notes: EmployeeCalendarNote[] = [];
      const details: string[] = [];
      let tone: EmployeeCalendarTone | undefined;

      if (leaveRequests.length > 0) {
        notes.push({
          label: leaveRequests.some((request) => request.isPaid === false) ? 'Unpaid Leave' : 'On Leave',
          tone: 'leave',
        });
        tone = 'leave';
        details.push(formatLeaveDetail(leaveRequests[0]));
      }

      if (record) {
        if (record.isLate) {
          notes.push({ label: 'Late', tone: 'late' });
          tone ??= 'late';
        } else if (record.isIncomplete) {
          notes.push({ label: 'Incomplete', tone: 'incomplete' });
          tone ??= 'incomplete';
        } else {
          notes.push({ label: 'Present', tone: 'present' });
          tone ??= 'present';
        }

        const attendanceWindow = formatAttendanceWindow(record);
        if (attendanceWindow) details.push(attendanceWindow);
      } else if (!isFutureDate && leaveRequests.length === 0) {
        notes.push({ label: isWorkingDay ? 'Absent' : 'Day Off', tone: isWorkingDay ? 'absent' : 'dayOff' });
        tone ??= isWorkingDay ? 'absent' : 'dayOff';
      }

      if (overtimeRequests.length > 0) {
        notes.push({ label: 'OT', tone: 'ot' });
        tone ??= 'ot';
        details.push(formatOvertimeDetail(overtimeRequests[0]));
      }

      return {
        day: cell.day,
        tone,
        notes: notes.length > 0 ? notes.slice(0, 3) : undefined,
        details: details.length > 0 ? details.slice(0, 2) : undefined,
      } satisfies EmployeeCalendarCell;
    });
  }, [focusLeavesByDate, focusOvertimeByDate, focusRecordByDate, focusedEmployee, monthIndex, todayDateKey, year]);

  const selectedRecords = useMemo(() => {
    if (!selectedDateKey) return [];
    return buildDailyRecords(logsByDate.get(selectedDateKey) ?? [], filteredEmployeeById, selectedDateKey);
  }, [filteredEmployeeById, logsByDate, selectedDateKey]);

  const selectedIsFuture = useMemo(() => {
    return Boolean(selectedDateKey) && selectedDateKey > todayDateKey;
  }, [selectedDateKey, todayDateKey]);

  const selectedIsWorkingDay = useMemo(() => {
    return selectedDateKey ? activeEmployees.some((employee) => isEmployeeScheduledOnDate(employee, selectedDateKey)) : true;
  }, [activeEmployees, selectedDateKey]);

  const focusedSelectedLeaves = useMemo(() => {
    if (!selectedDateKey) return [] as LeaveRequest[];
    return focusLeavesByDate.get(selectedDateKey) ?? [];
  }, [focusLeavesByDate, selectedDateKey]);

  const selectedAbsent = useMemo(() => {
    if (!hasFullRoster || selectedIsFuture || !selectedIsWorkingDay) return [];
    const presentIds = new Set(selectedRecords.map((record) => record.employeeId));
    const leaveEmployeeIds = selectedDateKey ? approvedLeaveEmployeeIdsByDate.get(selectedDateKey) ?? new Set<number>() : new Set<number>();
    return activeEmployees
      .filter((employee) => isEmployeeScheduledOnDate(employee, selectedDateKey))
      .filter((employee) => !presentIds.has(employee.id))
      .filter((employee) => !leaveEmployeeIds.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    activeEmployees,
    approvedLeaveEmployeeIdsByDate,
    hasFullRoster,
    selectedDateKey,
    selectedIsFuture,
    selectedIsWorkingDay,
    selectedRecords,
  ]);

  const selectedSummary = useMemo(() => {
    const late = selectedRecords.filter((record) => record.isLate).length;
    const incomplete = selectedRecords.filter((record) => record.isIncomplete).length;
    const leaveEmployeeIds = selectedDateKey ? approvedLeaveEmployeeIdsByDate.get(selectedDateKey) ?? new Set<number>() : new Set<number>();
    const dayOffCount =
      hasFullRoster && !selectedIsFuture && selectedDateKey
        ? activeEmployees.filter((employee) => !isEmployeeScheduledOnDate(employee, selectedDateKey))
            .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
        : 0;
    return {
      present: selectedRecords.length,
      late,
      incomplete,
      absent: hasFullRoster && !selectedIsFuture && selectedIsWorkingDay ? selectedAbsent.length : 0,
      dayOff: !selectedIsWorkingDay ? dayOffCount : 0,
      totalLogs: (logsByDate.get(selectedDateKey) ?? []).length,
    };
  }, [
    activeEmployees,
    approvedLeaveEmployeeIdsByDate,
    hasFullRoster,
    logsByDate,
    selectedAbsent.length,
    selectedDateKey,
    selectedIsFuture,
    selectedIsWorkingDay,
    selectedRecords,
  ]);

  const monthOptions = useMemo(() => {
    const startYear = Math.min(todayYear, year) - 5;
    const endYear = Math.max(todayYear, year) + 5;
    const totalMonths = (endYear - startYear + 1) * 12;

    return Array.from({ length: totalMonths }, (_, index) =>
      new Date(startYear, index, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [todayYear, year]);

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBasedStart = new Date(year, monthIndex, 1).getDay();
  const calendarWeekRows = Math.ceil((sundayBasedStart + daysInMonth) / 7);
  const calendarGridStyle = { '--calendar-week-rows': calendarWeekRows } as CSSProperties;
  const legendItems = focusedEmployee ? FOCUS_LEGEND_ITEMS : BASE_LEGEND_ITEMS;

  function parseMonthValue(value: string) {
    const parsed = new Date(`1 ${value}`);
    if (Number.isNaN(parsed.getTime())) return;
    setMonthIndex(parsed.getMonth());
    setYear(parsed.getFullYear());
  }

  function shiftCalendarMonth(offset: number) {
    const next = new Date(year, monthIndex + offset, 1);
    setMonthIndex(next.getMonth());
    setYear(next.getFullYear());
  }

  function openDayDetails(day: number) {
    const key = toISODate(year, monthIndex, day);
    setSelectedDateKey(key);
    setDetailOpen(true);
  }

  function clearFilters() {
    setDepartmentFilter('all');
  }

  const attendanceReportDescription =
    audienceLabel === 'Manager'
      ? undefined
      : 'Review daily attendance activity, late entries, incomplete logs, and gaps in one monthly calendar.';

  useErrorDialogEffect(loadError, 'Attendance report could not be loaded');
  useEscapeDismiss(detailOpen, () => setDetailOpen(false), 10);

  return (
    <div className="hrAtt">
      <div className="hrAtt__head">
        <PageHeader title="Attendance Report" description={attendanceReportDescription} />

        <div className="hrAtt__controls">
          <div className="hrAtt__monthSelectWrap">
            <select
              className="hrAtt__monthSelect"
              value={monthValue}
              onChange={(event) => {
                setMonthValue(event.target.value);
                parseMonthValue(event.target.value);
              }}
            >
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="hrAtt__toolbar">
        <label className="hrAttSearch" aria-label="Search employees">
          <FiSearch />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search employee, role, or department"
          />
          {searchValue && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
              <FiXCircle />
            </button>
          )}
        </label>

        <div className="hrAttFilter" ref={filterRef}>
          <button
            type="button"
            className={`hrAttFilter__toggle ${filterOpen ? 'is-open' : ''} ${
              activeFilterCount > 0 ? 'is-active' : ''
            }`}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <FiFilter />
            <span>Filter</span>
            {activeFilterCount > 0 && <span className="hrAttFilter__count">{activeFilterCount}</span>}
          </button>

          {filterOpen && (
            <div className="hrAttFilter__panel">
              <label className="hrAttFilter__field">
                <span>Department</span>
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                  <option value="all">All Departments</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="hrAttFilter__actions">
                <button type="button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading && <p className="hrAtt__hint">Loading attendance data...</p>}
      {!isLoading && !loadError && rosterMessage && <p className="hrAtt__hint">{rosterMessage}</p>}

      <section className="hrAttCard">
        <div
          className="hrAttCalendarShell"
          aria-label={focusedEmployee ? 'Employee attendance timeline' : 'Attendance report calendar'}
        >
          <div className="hrAttCalendarShell__top">
            <button
              type="button"
              className="hrAttCalendarShell__navBtn"
              onClick={() => shiftCalendarMonth(-1)}
              aria-label="Previous month"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <strong className="hrAttCalendarShell__month">{monthLabel}</strong>
            <button
              type="button"
              className="hrAttCalendarShell__navBtn"
              onClick={() => shiftCalendarMonth(1)}
              aria-label="Next month"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          {focusedEmployee && (
            <div className="hrAttCalendarShell__focus">
              <div className="hrAttCalendarShell__focusName">{focusedEmployee.name}</div>
              <div className="hrAttCalendarShell__focusMeta">
                <span>{focusedEmployee.position}</span>
                <span>{focusedDepartment}</span>
                {isFocusDataLoading && audienceLabel === 'HR' ? <span>Loading leave and OT markers...</span> : null}
              </div>
            </div>
          )}

          <div className="hrAttCalendarShell__legend" aria-hidden="true">
            {legendItems.map((item) => (
              <span key={item.label} className="hrAttCalendarShell__legendItem">
                <span
                  className={`hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--${item.tone}`}
                />
                {item.label}
              </span>
            ))}
          </div>

          {noEmployeeMatches ? (
            <div className="hrAttCalendarShell__empty">
              <div className="hrAttCalendarShell__emptyTitle">No employees matched this view.</div>
              <p className="hrAttCalendarShell__emptyText">
                Try clearing the employee search or switching the department filter back to all departments.
              </p>
            </div>
          ) : (
            <div className="hrCal" style={calendarGridStyle}>
              {DAYS.map((day) => (
                <div key={day} className="hrCal__dow">
                  {day}
                </div>
              ))}

              {focusedEmployee
                ? focusCalendarCells.map((cell, index) => {
                    if (cell.day === null) {
                      return (
                        <div
                          key={`focus-empty-${index}`}
                          className="hrCal__cell hrCal__cell--disabled"
                          aria-hidden="true"
                        />
                      );
                    }

                    const dateKey = toISODate(year, monthIndex, cell.day);
                    const isToday = dateKey === todayDateKey;
                    const isSelected = dateKey === selectedDateKey;
                    const cellClass = [
                      'hrCal__cell',
                      'hrCal__cell--click',
                      'hrCal__cell--focus',
                      isToday ? 'hrCal__cell--today' : '',
                      isSelected ? 'hrCal__cell--selected' : '',
                      cell.tone ? `hrCal__cell--${cell.tone}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className={cellClass}
                        onClick={() => openDayDetails(cell.day as number)}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={`Attendance details for ${dateKey}`}
                      >
                        <div className="hrCal__cellTop">
                          <div className="hrCal__day">{cell.day}</div>
                        </div>

                        {cell.notes && (
                          <div className="hrCal__statusNotes">
                            {cell.notes.map((note, noteIndex) => (
                              <span
                                key={`${dateKey}-${note.label}-${noteIndex}`}
                                className={`hrCal__note hrCal__note--${note.tone}`}
                              >
                                {note.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {cell.details && (
                          <div className="hrCal__detailNotes">
                            {cell.details.map((detail, detailIndex) => (
                              <span key={`${dateKey}-${detailIndex}`} className="hrCal__detail">
                                {detail}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                : aggregateCalendarCells.map((cell, index) => {
                    if (cell.day === null) {
                      return (
                        <div key={`empty-${index}`} className="hrCal__cell hrCal__cell--disabled" aria-hidden="true" />
                      );
                    }

                    const day = cell.day;
                    const dateKey = toISODate(year, monthIndex, day);
                    const isFutureDate = dateKey > todayDateKey;
                    const isToday = dateKey === todayDateKey;
                    const isSelected = dateKey === selectedDateKey;
                    const showIndicators = !isFutureDate;
                    const hasAttention =
                      showIndicators &&
                      (cell.lateCount > 0 || cell.incompleteCount > 0 || (cell.absentCount ?? 0) > 0);
                    const cellClass = [
                      'hrCal__cell',
                      'hrCal__cell--click',
                      isToday ? 'hrCal__cell--today' : '',
                      isSelected ? 'hrCal__cell--selected' : '',
                      hasAttention ? 'hrCal__cell--attention' : '',
                      showIndicators && cell.presentCount > 0 ? 'hrCal__cell--active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        className={cellClass}
                        onClick={() => openDayDetails(day)}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={`Attendance details for ${dateKey}`}
                      >
                        <div className="hrCal__cellTop">
                          <div className="hrCal__day">{day}</div>
                        </div>
                        {showIndicators && (
                          <div className="hrCal__stats">
                            {cell.presentCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--present">
                                <span>Present</span>
                                <strong>{cell.presentCount}</strong>
                              </div>
                            )}
                            {cell.lateCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--late">
                                <span>Late</span>
                                <strong>{cell.lateCount}</strong>
                              </div>
                            )}
                            {cell.incompleteCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--incomplete">
                                <span>Incomplete</span>
                                <strong>{cell.incompleteCount}</strong>
                              </div>
                            )}
                            {hasFullRoster && (cell.absentCount ?? 0) > 0 && (
                              <div className="hrCal__stat hrCal__stat--absent">
                                <span>Absent</span>
                                <strong>{cell.absentCount ?? 0}</strong>
                              </div>
                            )}
                            {hasFullRoster && cell.dayOffCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--dayOff">
                                <span>Day Off</span>
                                <strong>{cell.dayOffCount}</strong>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
            </div>
          )}
        </div>
      </section>

      {detailOpen && (
        <div className="hrAttModalBackdrop" role="dialog" aria-modal="true" aria-label="Attendance breakdown">
          <div className="hrAttModal">
            <div className="hrAttModal__top">
              <div>
                <div className="hrAttModal__eyebrow">Daily Attendance Breakdown</div>
                <div className="hrAttModal__title">{selectedDateLabel}</div>
                <p className="hrAttModal__subtitle">
                  Inspect the daily attendance summary, present employees, and missing logs for the selected date.
                </p>
              </div>
              <button className="hrAttModal__close" type="button" onClick={() => setDetailOpen(false)} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="hrAttModal__rule" />

            <div className="hrAttSummary">
              <article className="hrAttSummary__card">
                <span>Present</span>
                <strong>{selectedSummary.present}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>Late</span>
                <strong>{selectedSummary.late}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>Incomplete</span>
                <strong>{selectedSummary.incomplete}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>{hasFullRoster ? (selectedIsWorkingDay ? 'Absent' : 'Day Off') : 'Total Logs'}</span>
                <strong>
                  {hasFullRoster ? (selectedIsWorkingDay ? selectedSummary.absent ?? '-' : selectedSummary.dayOff) : selectedSummary.totalLogs}
                </strong>
              </article>
            </div>

            <div className="hrAttBreakdown">
              <section className="hrAttBreakdown__section">
                <div className="hrAttBreakdown__title">
                  <FiUsers />
                  Present Employees
                </div>

                <div className="hrAttBreakdown__list">
                  {selectedRecords.length > 0 ? (
                    selectedRecords.map((record) => (
                      <article key={`${selectedDateKey}-${record.employeeId}`} className="hrAttPerson">
                        <div className="hrAttPerson__avatar" aria-hidden="true">
                          {record.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="hrAttPerson__body">
                          <div className="hrAttPerson__topLine">
                            <div className="hrAttPerson__name">{record.name}</div>
                            <div
                              className={`hrAttPerson__badge ${
                                record.isIncomplete ? 'is-incomplete' : record.isLate ? 'is-late' : 'is-on-time'
                              }`}
                            >
                              {record.isIncomplete ? 'Incomplete' : record.isLate ? 'Late' : 'On Time'}
                            </div>
                          </div>
                          <div className="hrAttPerson__meta">
                            Employee #{record.employeeId} - {record.position} - {record.status}
                          </div>
                          <div className="hrAttPerson__times">
                            <span>Time In: {record.inTime ?? 'N/A'}</span>
                            <span>Time Out: {record.outTime ?? 'N/A'}</span>
                            <span>Logs: {record.logCount}</span>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : selectedIsFuture ? (
                    <div className="hrAttBreakdown__empty">This date has not happened yet.</div>
                  ) : (
                    <div className="hrAttBreakdown__empty">No attendance logs recorded for this day.</div>
                  )}
                </div>
              </section>

              {hasFullRoster && (
                <section className="hrAttBreakdown__section">
                  <div className="hrAttBreakdown__title">
                    <FiCalendar />
                    No Logs Recorded
                  </div>

                  <div className="hrAttBreakdown__list">
                    {selectedAbsent.length > 0 ? (
                      selectedAbsent.map((employee) => (
                        <article key={`absent-${selectedDateKey}-${employee.id}`} className="hrAttPerson hrAttPerson--soft">
                          <div className="hrAttPerson__avatar" aria-hidden="true">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="hrAttPerson__body">
                            <div className="hrAttPerson__topLine">
                              <div className="hrAttPerson__name">{employee.name}</div>
                              <div className="hrAttPerson__badge is-muted">No Logs</div>
                            </div>
                            <div className="hrAttPerson__meta">
                              Employee #{employee.id} - {employee.position} - {employee.status}
                            </div>
                          </div>
                        </article>
                      ))
                    ) : selectedIsFuture ? (
                      <div className="hrAttBreakdown__empty">Absent employees will only be shown after this date passes.</div>
                    ) : focusedEmployee && focusedSelectedLeaves.length > 0 ? (
                      <div className="hrAttBreakdown__empty">
                        {focusedEmployee.name} is covered by an approved leave request for this day.
                      </div>
                    ) : !selectedIsWorkingDay ? (
                      <div className="hrAttBreakdown__empty">This date is treated as a scheduled day off.</div>
                    ) : (
                      <div className="hrAttBreakdown__empty">All active employees recorded attendance for this day.</div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="hrAttModal__actions">
              <button className="hrAtt__actionBtn hrAtt__actionBtn--ghost" type="button" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
