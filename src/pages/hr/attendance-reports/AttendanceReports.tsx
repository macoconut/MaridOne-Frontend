import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFilter,
  FiSearch,
  FiUpload,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import FileUploadField from '../../../components/form/FileUploadField';
import PageHeader from '../../../components/layout/PageHeader';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
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

type DailyShift = {
  dailyShiftId?: number;
  employeeId?: number;
  workDate?: string;
  startDateTime?: string;
  endDateTime?: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  status: string;
  position: string;
  department?: string;
  shiftSchedules: ShiftSchedule[];
  gracePeriodMinutes?: number;
  employmentDateStart?: string;
};

type DayCell = {
  day: number | null;
  presentCount: number;
  lateCount: number;
  incompleteCount: number;
  holidayCount: number;
  absentCount: number | null;
  dayOffCount: number;
};

type EmployeeCalendarTone = 'present' | 'late' | 'incomplete' | 'absent' | 'dayOff' | 'holiday' | 'leave' | 'ot';

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

type AttendanceExportRow = {
  employeeId: string;
  employeeName: string;
  date: string;
  timeIn: string;
  timeOut: string;
};

type AttendanceImportIssue = {
  rowNumber?: number;
  employeeId?: string;
  date?: string;
  message?: string;
};

type AttendanceImportSummary = {
  fileName?: string;
  totalRows?: number;
  importedRows?: number;
  skippedRows?: number;
  importedLogs?: number;
  issueCount?: number;
  issues?: AttendanceImportIssue[];
};

type HolidayLookupPayload = {
  holidayDates?: string[];
  regularHolidayDates?: string[];
};

type AttendanceReportsBoardProps = {
  audienceLabel?: string;
  logsUrl?: string;
  rosterUrl?: string;
  leavesUrl?: string;
};

type OvernightShiftWindow = {
  workDateKey: string;
  cutoffTime: number;
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const BASE_LEGEND_ITEMS: Array<{ label: string; tone: EmployeeCalendarTone }> = [
  { label: 'Present', tone: 'present' },
  { label: 'Late', tone: 'late' },
  { label: 'Incomplete', tone: 'incomplete' },
  { label: 'Absent', tone: 'absent' },
  { label: 'Day Off', tone: 'dayOff' },
  { label: 'Holiday', tone: 'holiday' },
];
const FOCUS_LEGEND_ITEMS: Array<{ label: string; tone: EmployeeCalendarTone }> = [
  ...BASE_LEGEND_ITEMS,
  { label: 'On Leave', tone: 'leave' },
  { label: 'OT', tone: 'ot' },
];
const DEFAULT_WORKING_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const LATE_GRACE_MINUTES = 15;
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const NIGHT_SHIFT_REPORT_CUTOFF_HOUR = 6;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return toISODate(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKeyAtHour(dateKey: string, hour: number) {
  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(hour, 0, 0, 0);
  return date;
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
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseDateTimeToMinutes(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
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

function isEmployeeActiveOnDate(employee: EmployeeRow | undefined, dateKey?: string) {
  if (!employee || !dateKey) return false;
  const employmentDateStart = localDateKey(employee.employmentDateStart);
  if (!employmentDateStart) return true;
  return dateKey >= employmentDateStart;
}

function leaveWindowForDate(request: LeaveRequest, dateKey: string) {
  const startKey = localDateKey(request.startDateTime);
  const endKey = localDateKey(request.endDateTime);
  if (!startKey || !endKey || dateKey < startKey || dateKey > endKey) return null;

  const startMinutes = startKey < dateKey ? 0 : parseDateTimeToMinutes(request.startDateTime) ?? 0;
  const endMinutes = endKey > dateKey ? 24 * 60 : parseDateTimeToMinutes(request.endDateTime) ?? 24 * 60;
  return {
    startMinutes: Math.max(0, startMinutes),
    endMinutes: Math.min(24 * 60, endMinutes),
  };
}

function groupLeavesByEmployee(leaves: LeaveRequest[]) {
  const grouped = new Map<number, LeaveRequest[]>();

  for (const request of leaves) {
    const employeeId = Number(request.empId);
    if (!Number.isFinite(employeeId)) continue;
    const current = grouped.get(employeeId) ?? [];
    current.push(request);
    grouped.set(employeeId, current);
  }

  return grouped;
}

function resolveEffectiveScheduledStartMinutes(
  employee: EmployeeRow | undefined,
  dateKey?: string,
  leaveRequests: LeaveRequest[] = []
) {
  const scheduledStartMinutes = resolveScheduledStartMinutes(employee, dateKey);
  if (scheduledStartMinutes === null || !dateKey) return scheduledStartMinutes;

  let adjustedStartMinutes = scheduledStartMinutes;

  for (const request of leaveRequests) {
    const window = leaveWindowForDate(request, dateKey);
    if (!window) continue;
    if (window.startMinutes > scheduledStartMinutes) continue;
    if (window.endMinutes > adjustedStartMinutes) {
      adjustedStartMinutes = window.endMinutes;
    }
  }

  return adjustedStartMinutes;
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

function isLateAfterGrace(
  timestamp?: string,
  employee?: EmployeeRow,
  dateKey?: string,
  direction?: string,
  leaveRequests: LeaveRequest[] = [],
  isHoliday = false
) {
  if (isHoliday) return false;
  if (!timestamp || !employee || !dateKey) return isLateDirection(direction);
  if (!isEmployeeScheduledOnDate(employee, dateKey)) return false;

  const scheduledStartMinutes = resolveEffectiveScheduledStartMinutes(employee, dateKey, leaveRequests);
  if (scheduledStartMinutes === null) {
    return isLateDirection(direction);
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return isLateDirection(direction);

  const graceMinutes = Math.max(employee.gracePeriodMinutes ?? LATE_GRACE_MINUTES, 0);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes > scheduledStartMinutes + graceMinutes;
}

function parseHolidayLookup(payload: unknown) {
  const object =
    payload && typeof payload === 'object'
      ? (payload as HolidayLookupPayload)
      : ({} as HolidayLookupPayload);

  const holidayDates = Array.isArray(object.holidayDates)
    ? [...new Set(object.holidayDates.map((value) => localDateKey(value)).filter(Boolean))]
    : [];
  const regularHolidayDates = Array.isArray(object.regularHolidayDates)
    ? [...new Set(object.regularHolidayDates.map((value) => localDateKey(value)).filter(Boolean))]
    : [];

  return { holidayDates, regularHolidayDates };
}

function monthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBased = first.getDay();
  const cells: DayCell[] = [];

  for (let i = 0; i < sundayBased; i++) {
    cells.push({
      day: null,
      presentCount: 0,
      lateCount: 0,
      incompleteCount: 0,
      holidayCount: 0,
      absentCount: null,
      dayOffCount: 0,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      presentCount: 0,
      lateCount: 0,
      incompleteCount: 0,
      holidayCount: 0,
      absentCount: null,
      dayOffCount: 0,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      day: null,
      presentCount: 0,
      lateCount: 0,
      incompleteCount: 0,
      holidayCount: 0,
      absentCount: null,
      dayOffCount: 0,
    });
  }

  return cells;
}

function toCsvValue(value: unknown) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(rows: string[][]) {
  return rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n');
}

function employeeName(employee: EmployeeRow | undefined, employeeId: number) {
  return employee?.name || `Employee #${employeeId}`;
}

function buildDailyRecords(
  logs: AttendanceLog[],
  employeeById: Map<number, EmployeeRow>,
  dateKey?: string,
  leaveRequestsByEmployeeId: Map<number, LeaveRequest[]> = new Map<number, LeaveRequest[]>(),
  holidayDateKeys: Set<string> = new Set<string>()
) {
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
      const leaveRequests = leaveRequestsByEmployeeId.get(employeeId) ?? [];
      const isLate = firstIn
        ? isLateAfterGrace(
            firstIn.timestamp,
            employee,
            dateKey,
            firstIn.direction,
            leaveRequests,
            dateKey ? holidayDateKeys.has(dateKey) : false
          )
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

function buildOvernightShiftWindows(
  dailyShifts: DailyShift[],
  eligibleEmployeeIds: Set<number>
) {
  const windows = new Map<string, OvernightShiftWindow>();

  for (const shift of dailyShifts) {
    const employeeId = Number(shift.employeeId);
    const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
    const shiftStart = shift.startDateTime ? new Date(shift.startDateTime) : null;
    const shiftEnd = shift.endDateTime ? new Date(shift.endDateTime) : null;

    if (
      !Number.isFinite(employeeId) ||
      !eligibleEmployeeIds.has(employeeId) ||
      !workDateKey ||
      !shiftStart ||
      !shiftEnd ||
      Number.isNaN(shiftStart.getTime()) ||
      Number.isNaN(shiftEnd.getTime())
    ) {
      continue;
    }

    const crossesMidnight =
      localDateKey(shift.startDateTime) !== localDateKey(shift.endDateTime) ||
      shiftEnd.getTime() <= shiftStart.getTime();
    if (!crossesMidnight) continue;

    const nextDateKey = shiftDateKey(workDateKey, 1);
    const nextMorningCutoff = dateKeyAtHour(nextDateKey, NIGHT_SHIFT_REPORT_CUTOFF_HOUR);
    if (!nextDateKey || !nextMorningCutoff) continue;

    const cutoffTime = Math.max(shiftEnd.getTime(), nextMorningCutoff.getTime());
    const key = `${employeeId}:${nextDateKey}`;
    const current = windows.get(key);

    if (!current || cutoffTime > current.cutoffTime) {
      windows.set(key, { workDateKey, cutoffTime });
    }
  }

  return windows;
}

function resolveAttendanceReportDateKey(
  log: AttendanceLog,
  overnightShiftWindows: Map<string, OvernightShiftWindow>
) {
  const logDateKey = localDateKey(log.timestamp);
  if (typeof log.employeeId !== 'number' || !logDateKey || !log.timestamp) {
    return logDateKey;
  }

  const logTime = Date.parse(log.timestamp);
  if (Number.isNaN(logTime)) return logDateKey;

  const overnightWindow = overnightShiftWindows.get(`${log.employeeId}:${logDateKey}`);
  if (overnightWindow && logTime <= overnightWindow.cutoffTime) {
    return overnightWindow.workDateKey;
  }

  return logDateKey;
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
    employmentDateStart:
      typeof row.employmentDateStart === 'string'
        ? row.employmentDateStart
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
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [holidayDateKeys, setHolidayDateKeys] = useState<string[]>([]);
  const [regularHolidayDateKeys, setRegularHolidayDateKeys] = useState<string[]>([]);
  const [hasFullRoster, setHasFullRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<AttendanceImportSummary | null>(null);
  const [importSubmitAttempted, setImportSubmitAttempted] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [focusOvertime, setFocusOvertime] = useState<OvertimeRequest[]>([]);
  const [isFocusDataLoading, setIsFocusDataLoading] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const silentRefreshRef = useRef(false);

  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    if (detailOpen || importDialogOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [detailOpen, importDialogOpen]);

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
      const isSilentRefresh = silentRefreshRef.current;
      if (!isSilentRefresh) {
        setIsLoading(true);
        setLoadError('');
      }
      try {
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 1, NIGHT_SHIFT_REPORT_CUTOFF_HOUR, 0, 0, 0);
        const dailyShiftStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        dailyShiftStart.setDate(dailyShiftStart.getDate() - 1);
        const dailyShiftStartKey = toISODate(
          dailyShiftStart.getFullYear(),
          dailyShiftStart.getMonth(),
          dailyShiftStart.getDate()
        );
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

        const [employeeResult, leaveResult, holidayResult, dailyShiftResult] = await Promise.allSettled([
          apiFetchJson<unknown>(withParams(rosterUrl, { page: '0', size: '500' })),
          apiFetchJson<unknown>(
            withParams(leavesUrl, {
              page: '0',
              size: '2000',
              requestStatus: 'APPROVED',
            })
          ),
          apiFetchJson<unknown>(
            withParams('/api/holidays', {
              startDate: monthStartKey,
              endDate: monthEndKey,
            })
          ),
          apiFetchJson<unknown>(
            withParams('/api/employee/schedule/daily', {
              startDate: dailyShiftStartKey,
              endDate: monthEndKey,
            })
          ),
        ]);
        if (cancelled) return;

        if (employeeResult.status === 'fulfilled') {
          setEmployees(rosterRows(employeeResult.value).filter((row) => Number.isFinite(row.id)));
          setHasFullRoster(true);
          setRosterMessage('');
        } else if (!isSilentRefresh) {
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

        if (leaveResult.status === 'fulfilled') {
          const nextApprovedLeaves = toArray<LeaveRequest>(leaveResult.value).filter((request) => {
            const startKey = localDateKey(request.startDateTime);
            const endKey = localDateKey(request.endDateTime);
            return (
              Boolean(startKey) &&
              Boolean(endKey) &&
              startKey <= monthEndKey &&
              endKey >= monthStartKey &&
              String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
            );
          });
          setApprovedLeaves(nextApprovedLeaves);
        } else if (!isSilentRefresh) {
          setApprovedLeaves([]);
        }

        if (dailyShiftResult.status === 'fulfilled') {
          setDailyShifts(toArray<DailyShift>(dailyShiftResult.value));
        } else if (!isSilentRefresh) {
          setDailyShifts([]);
        }

        if (holidayResult.status === 'fulfilled') {
          const parsed = parseHolidayLookup(holidayResult.value);
          setHolidayDateKeys(parsed.holidayDates);
          setRegularHolidayDateKeys(parsed.regularHolidayDates);
        } else if (!isSilentRefresh) {
          setHolidayDateKeys([]);
          setRegularHolidayDateKeys([]);
        }
        setLoadError('');
      } catch (error) {
        if (cancelled) return;
        if (!isSilentRefresh) {
          setLogs([]);
          setEmployees([]);
          setApprovedLeaves([]);
          setDailyShifts([]);
          setHolidayDateKeys([]);
          setRegularHolidayDateKeys([]);
          setHasFullRoster(false);
          setRosterMessage('');
          setLoadError(error instanceof Error ? error.message : 'Failed to load attendance data.');
        }
      } finally {
        if (!cancelled) {
          if (!isSilentRefresh) setIsLoading(false);
          silentRefreshRef.current = false;
        }
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

  const holidayDateSet = useMemo(() => new Set(holidayDateKeys), [holidayDateKeys]);
  const regularHolidayDateSet = useMemo(() => new Set(regularHolidayDateKeys), [regularHolidayDateKeys]);

  const dailyShiftDateKeysByEmployee = useMemo(() => {
    const grouped = new Map<number, Set<string>>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !workDateKey) continue;

      const current = grouped.get(employeeId) ?? new Set<string>();
      current.add(workDateKey);
      grouped.set(employeeId, current);
    }

    return grouped;
  }, [dailyShifts, filteredEmployeeIdSet]);

  const dailyShiftCoverageByEmployee = useMemo(() => {
    const coverage = new Map<number, { startDateKey: string; endDateKey: string }>();

    for (const [employeeId, dateKeys] of dailyShiftDateKeysByEmployee.entries()) {
      const sorted = [...dateKeys].sort((a, b) => a.localeCompare(b));
      if (sorted.length === 0) continue;
      coverage.set(employeeId, {
        startDateKey: sorted[0],
        endDateKey: sorted[sorted.length - 1],
      });
    }

    return coverage;
  }, [dailyShiftDateKeysByEmployee]);

  const hasDailyShiftOnDate = useCallback(
    (employee: EmployeeRow | undefined, dateKey?: string) => {
      if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
      return dailyShiftDateKeysByEmployee.get(employee.id)?.has(dateKey) ?? false;
    },
    [dailyShiftDateKeysByEmployee]
  );

  const isKnownDayOffOnDate = useCallback(
    (employee: EmployeeRow | undefined, dateKey?: string) => {
      if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
      if (hasDailyShiftOnDate(employee, dateKey)) return false;

      const coverage = dailyShiftCoverageByEmployee.get(employee.id);
      if (!coverage) return false;
      if (dateKey < coverage.startDateKey || dateKey > coverage.endDateKey) return false;

      return !isEmployeeScheduledOnDate(employee, dateKey);
    },
    [dailyShiftCoverageByEmployee, hasDailyShiftOnDate]
  );

  const logsByDate = useMemo(() => {
    const grouped = new Map<string, AttendanceLog[]>();
    const overnightShiftWindows = buildOvernightShiftWindows(dailyShifts, filteredEmployeeIdSet);

    for (const log of logs) {
      if (typeof log.employeeId !== 'number' || !filteredEmployeeIdSet.has(log.employeeId)) continue;
      const key = resolveAttendanceReportDateKey(log, overnightShiftWindows);
      if (!key) continue;
      const current = grouped.get(key) ?? [];
      current.push(log);
      grouped.set(key, current);
    }
    return grouped;
  }, [dailyShifts, filteredEmployeeIdSet, logs]);

  const approvedLeavesByDate = useMemo(() => {
    const grouped = new Map<string, LeaveRequest[]>();

    for (const request of approvedLeaves) {
      const employeeId = Number(request.empId);
      const startKey = localDateKey(request.startDateTime);
      const endKey = localDateKey(request.endDateTime);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !startKey || !endKey) continue;

      const rangeStart = startKey > monthStartKey ? startKey : monthStartKey;
      const rangeEnd = endKey < monthEndKey ? endKey : monthEndKey;
      for (const dateKey of dateKeysBetween(rangeStart, rangeEnd)) {
        const current = grouped.get(dateKey) ?? [];
        current.push(request);
        grouped.set(dateKey, current);
      }
    }

    return grouped;
  }, [approvedLeaves, filteredEmployeeIdSet, monthEndKey, monthStartKey]);

  const approvedLeaveEmployeeIdsByDate = useMemo(() => {
    const grouped = new Map<string, Set<number>>();

    for (const [dateKey, requests] of approvedLeavesByDate.entries()) {
      grouped.set(
        dateKey,
        new Set(
          requests
            .map((request) => Number(request.empId))
            .filter((employeeId) => Number.isFinite(employeeId))
        )
      );
    }

    return grouped;
  }, [approvedLeavesByDate]);

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
      const records = buildDailyRecords(
        dayLogs,
        filteredEmployeeById,
        dateKey,
        groupLeavesByEmployee(approvedLeavesByDate.get(dateKey) ?? []),
        holidayDateSet
      );
      const record = records.find((item) => item.employeeId === focusedEmployee.id);
      if (record) grouped.set(dateKey, record);
    }

    return grouped;
  }, [approvedLeavesByDate, filteredEmployeeById, focusedEmployee, holidayDateSet, logsByDate]);

  const aggregateCalendarCells = useMemo(() => {
    const cells = monthCells(year, monthIndex);
    return cells.map((cell) => {
      if (cell.day === null) return cell;
      const dateKey = toISODate(year, monthIndex, cell.day);
      const isFutureDate = dateKey > todayDateKey;
      const dateLeaveRequests = approvedLeavesByDate.get(dateKey) ?? [];
      const records = buildDailyRecords(
        logsByDate.get(dateKey) ?? [],
        filteredEmployeeById,
        dateKey,
        groupLeavesByEmployee(dateLeaveRequests),
        holidayDateSet
      );
      const isHoliday = holidayDateSet.has(dateKey);
      const incompleteCount = records.filter((record) => record.isIncomplete).length;
      const lateCount = records.filter((record) => record.isLate && !record.isIncomplete).length;
      const presentCount = records.filter((record) => !record.isLate && !record.isIncomplete).length;
      const leaveEmployeeIds = approvedLeaveEmployeeIdsByDate.get(dateKey) ?? new Set<number>();
      const loggedEmployeeIds = new Set(records.map((record) => record.employeeId));
      const holidayCount =
        hasFullRoster && !isFutureDate && isHoliday
          ? activeEmployees.filter((employee) => !loggedEmployeeIds.has(employee.id))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;
      const absentCount =
        hasFullRoster && !isFutureDate && !isHoliday
          ? activeEmployees.filter((employee) => hasDailyShiftOnDate(employee, dateKey))
              .filter((employee) => !loggedEmployeeIds.has(employee.id))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;
      const dayOffCount =
        hasFullRoster && !isFutureDate && !isHoliday
          ? activeEmployees.filter((employee) => isKnownDayOffOnDate(employee, dateKey))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;

      return {
        day: cell.day,
        presentCount,
        lateCount,
        incompleteCount,
        holidayCount,
        absentCount,
        dayOffCount,
      } satisfies DayCell;
    });
  }, [
    activeEmployees,
    approvedLeavesByDate,
    approvedLeaveEmployeeIdsByDate,
    filteredEmployeeById,
    hasDailyShiftOnDate,
    hasFullRoster,
    holidayDateSet,
    isKnownDayOffOnDate,
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
      const hasDailyShift = hasDailyShiftOnDate(focusedEmployee, dateKey);
      const isKnownDayOff = isKnownDayOffOnDate(focusedEmployee, dateKey);
      const isHoliday = holidayDateSet.has(dateKey);
      const isRegularHoliday = regularHolidayDateSet.has(dateKey);
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

      if (isHoliday) {
        notes.push({
          label: isRegularHoliday ? 'Regular Holiday' : 'Holiday',
          tone: 'holiday',
        });
        tone ??= 'holiday';
      }

      if (record) {
        if (record.isIncomplete) {
          notes.push({ label: 'Incomplete', tone: 'incomplete' });
          tone ??= 'incomplete';
        } else if (record.isLate) {
          notes.push({ label: 'Late', tone: 'late' });
          tone ??= 'late';
        } else {
          notes.push({ label: 'Present', tone: 'present' });
          tone ??= 'present';
        }

        const attendanceWindow = formatAttendanceWindow(record);
        if (attendanceWindow) details.push(attendanceWindow);
      } else if (!isFutureDate && leaveRequests.length === 0 && !isHoliday) {
        if (hasDailyShift) {
          notes.push({ label: 'Absent', tone: 'absent' });
          tone ??= 'absent';
        } else if (isKnownDayOff) {
          notes.push({ label: 'Day Off', tone: 'dayOff' });
          tone ??= 'dayOff';
        }
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
  }, [
    focusLeavesByDate,
    focusOvertimeByDate,
    focusRecordByDate,
    focusedEmployee,
    hasDailyShiftOnDate,
    holidayDateSet,
    isKnownDayOffOnDate,
    monthIndex,
    regularHolidayDateSet,
    todayDateKey,
    year,
  ]);

  const selectedRecords = useMemo(() => {
    if (!selectedDateKey) return [];
    return buildDailyRecords(
      logsByDate.get(selectedDateKey) ?? [],
      filteredEmployeeById,
      selectedDateKey,
      groupLeavesByEmployee(approvedLeavesByDate.get(selectedDateKey) ?? []),
      holidayDateSet
    );
  }, [approvedLeavesByDate, filteredEmployeeById, holidayDateSet, logsByDate, selectedDateKey]);

  const selectedIsFuture = useMemo(() => {
    return Boolean(selectedDateKey) && selectedDateKey > todayDateKey;
  }, [selectedDateKey, todayDateKey]);

  const selectedIsHoliday = useMemo(() => {
    return Boolean(selectedDateKey) && holidayDateSet.has(selectedDateKey);
  }, [holidayDateSet, selectedDateKey]);

  const selectedIsWorkingDay = useMemo(() => {
    return selectedDateKey ? activeEmployees.some((employee) => hasDailyShiftOnDate(employee, selectedDateKey)) : true;
  }, [activeEmployees, hasDailyShiftOnDate, selectedDateKey]);

  const selectedHasKnownDayOffs = useMemo(() => {
    return selectedDateKey ? activeEmployees.some((employee) => isKnownDayOffOnDate(employee, selectedDateKey)) : false;
  }, [activeEmployees, isKnownDayOffOnDate, selectedDateKey]);

  const focusedSelectedLeaves = useMemo(() => {
    if (!selectedDateKey) return [] as LeaveRequest[];
    return focusLeavesByDate.get(selectedDateKey) ?? [];
  }, [focusLeavesByDate, selectedDateKey]);

  const selectedAbsent = useMemo(() => {
    if (!hasFullRoster || selectedIsFuture || !selectedIsWorkingDay || selectedIsHoliday) return [];
    const loggedEmployeeIds = new Set(selectedRecords.map((record) => record.employeeId));
    const leaveEmployeeIds = selectedDateKey ? approvedLeaveEmployeeIdsByDate.get(selectedDateKey) ?? new Set<number>() : new Set<number>();
    return activeEmployees
      .filter((employee) => hasDailyShiftOnDate(employee, selectedDateKey))
      .filter((employee) => !loggedEmployeeIds.has(employee.id))
      .filter((employee) => !leaveEmployeeIds.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    activeEmployees,
    hasDailyShiftOnDate,
    approvedLeaveEmployeeIdsByDate,
    hasFullRoster,
    selectedDateKey,
    selectedIsFuture,
    selectedIsHoliday,
    selectedIsWorkingDay,
    selectedRecords,
  ]);

  const selectedSummary = useMemo(() => {
    const incomplete = selectedRecords.filter((record) => record.isIncomplete).length;
    const late = selectedRecords.filter((record) => record.isLate && !record.isIncomplete).length;
    const present = selectedRecords.filter((record) => !record.isLate && !record.isIncomplete).length;
    const leaveEmployeeIds = selectedDateKey ? approvedLeaveEmployeeIdsByDate.get(selectedDateKey) ?? new Set<number>() : new Set<number>();
    const loggedEmployeeIds = new Set(selectedRecords.map((record) => record.employeeId));
    const holidayCount =
      hasFullRoster && !selectedIsFuture && selectedDateKey && selectedIsHoliday
        ? activeEmployees.filter((employee) => !loggedEmployeeIds.has(employee.id))
            .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
        : 0;
    const dayOffCount =
      hasFullRoster && !selectedIsFuture && selectedDateKey && !selectedIsHoliday
        ? activeEmployees.filter((employee) => isKnownDayOffOnDate(employee, selectedDateKey))
            .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
        : 0;
    return {
      present,
      late,
      incomplete,
      holiday: holidayCount,
      absent: hasFullRoster && !selectedIsFuture && selectedIsWorkingDay && !selectedIsHoliday ? selectedAbsent.length : 0,
      dayOff: !selectedIsWorkingDay ? dayOffCount : 0,
      totalLogs: (logsByDate.get(selectedDateKey) ?? []).length,
    };
  }, [
    activeEmployees,
    approvedLeaveEmployeeIdsByDate,
    hasFullRoster,
    isKnownDayOffOnDate,
    logsByDate,
    selectedAbsent.length,
    selectedHasKnownDayOffs,
    selectedDateKey,
    selectedIsFuture,
    selectedIsHoliday,
    selectedIsWorkingDay,
    selectedRecords,
  ]);

  const attendanceExportRows = useMemo(() => {
    const rows: AttendanceExportRow[] = [];

    for (const [dateKey, dayLogs] of logsByDate.entries()) {
      if (dateKey < monthStartKey || dateKey > monthEndKey) continue;

      const dailyRecords = buildDailyRecords(dayLogs, filteredEmployeeById, dateKey);
      rows.push(
        ...dailyRecords.map((record) => ({
          employeeId: String(record.employeeId),
          employeeName: record.name,
          date: dateKey,
          timeIn: record.inTime ?? '',
          timeOut: record.outTime ?? '',
        }))
      );
    }

    return rows.sort((a, b) => {
      const aId = Number(a.employeeId);
      const bId = Number(b.employeeId);
      const bothNumeric = Number.isFinite(aId) && Number.isFinite(bId);
      if (bothNumeric && aId !== bId) return aId - bId;

      const idDiff = a.employeeId.localeCompare(b.employeeId);
      if (idDiff !== 0) return idDiff;

      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;

      return a.employeeName.localeCompare(b.employeeName);
    });
  }, [filteredEmployeeById, logsByDate, monthEndKey, monthStartKey]);

  const attendanceExportCsv = useMemo(
    () =>
      buildCsvContent([
        ['Employee ID', 'Employee Name', 'Date', 'Time In', 'Time Out'],
        ...attendanceExportRows.map((row) => [row.employeeId, row.employeeName, row.date, row.timeIn, row.timeOut]),
      ]),
    [attendanceExportRows]
  );

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

  function closeImportDialog() {
    setImportDialogOpen(false);
    setImportFile(null);
    setImportSubmitAttempted(false);
  }

  async function importAttendanceReport() {
    setImportSubmitAttempted(true);
    if (!importFile) {
      setActionError('Choose an exported attendance CSV file to import.');
      return;
    }

    setActionError('');
    setIsImporting(true);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const summary = await apiFetchJson<AttendanceImportSummary>('/api/logs/attendance/import', {
        method: 'POST',
        body: formData,
      });
      setImportSummary(summary);
      setImportFile(null);
      silentRefreshRef.current = false;
      setRefreshTick((tick) => tick + 1);
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }

  async function downloadAttendanceReport() {
    setActionError('');
    setIsExporting(true);

    try {
      const blob = new Blob([attendanceExportCsv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-report-${year}-${pad2(monthIndex + 1)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  const attendanceReportDescription =
    audienceLabel === 'Manager'
      ? undefined
      : 'Review daily attendance activity, late entries, incomplete logs, and gaps in one monthly calendar.';
  const canImport = audienceLabel === 'HR';
  const importIssues = toArray<AttendanceImportIssue>(importSummary?.issues);
  const selectedDetailSubtitle = selectedIsHoliday
    ? 'This date is a holiday, so employees without logs are not counted as absent or day off.'
    : !selectedIsWorkingDay && !selectedHasKnownDayOffs
      ? 'This date has no generated daily shifts, so absences are not evaluated.'
      : 'Inspect the daily attendance summary, logged employees, and missing logs for the selected date.';

  useErrorDialogEffect(loadError, 'Attendance report could not be loaded');
  useErrorDialogEffect(actionError, 'Attendance report action could not be completed');
  useEscapeDismiss(detailOpen, () => setDetailOpen(false), 10);
  useEscapeDismiss(importDialogOpen, closeImportDialog, 11);

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
                    const isHoliday = holidayDateSet.has(dateKey);
                    const showAttendanceIndicators = !isFutureDate;
                    const showHolidayIndicator = isHoliday;
                    const showIndicators = showAttendanceIndicators || showHolidayIndicator;
                    const hasAttention =
                      showAttendanceIndicators &&
                      (cell.lateCount > 0 || cell.incompleteCount > 0 || (cell.absentCount ?? 0) > 0);
                    const cellClass = [
                      'hrCal__cell',
                      'hrCal__cell--click',
                      isToday ? 'hrCal__cell--today' : '',
                      isSelected ? 'hrCal__cell--selected' : '',
                      isHoliday ? 'hrCal__cell--holiday' : '',
                      hasAttention ? 'hrCal__cell--attention' : '',
                      showAttendanceIndicators && cell.presentCount > 0 ? 'hrCal__cell--active' : '',
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
                            {showAttendanceIndicators && cell.presentCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--present">
                                <span>Present</span>
                                <strong>{cell.presentCount}</strong>
                              </div>
                            )}
                            {showAttendanceIndicators && cell.lateCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--late">
                                <span>Late</span>
                                <strong>{cell.lateCount}</strong>
                              </div>
                            )}
                            {showAttendanceIndicators && cell.incompleteCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--incomplete">
                                <span>Incomplete</span>
                                <strong>{cell.incompleteCount}</strong>
                              </div>
                            )}
                            {showHolidayIndicator && (
                              <div className="hrCal__stat hrCal__stat--holiday">
                                <span>Holiday</span>
                              </div>
                            )}
                            {showAttendanceIndicators && hasFullRoster && (cell.absentCount ?? 0) > 0 && (
                              <div className="hrCal__stat hrCal__stat--absent">
                                <span>Absent</span>
                                <strong>{cell.absentCount ?? 0}</strong>
                              </div>
                            )}
                            {showAttendanceIndicators && hasFullRoster && cell.dayOffCount > 0 && (
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

      <div className="hrAtt__calendarActions">
        {canImport && (
          <button
            type="button"
            className="hrAtt__actionBtn hrAtt__actionBtn--centered"
            onClick={() => {
              setActionError('');
              setImportSubmitAttempted(false);
              setImportDialogOpen(true);
            }}
            disabled={isLoading || isImporting}
          >
            <FiUpload aria-hidden="true" />
            <span>{isImporting ? 'Importing CSV...' : 'Import Attendance (CSV)'}</span>
          </button>
        )}
        <button
          type="button"
          className="hrAtt__actionBtn hrAtt__actionBtn--centered"
          onClick={() => void downloadAttendanceReport()}
          disabled={isLoading || isExporting || Boolean(loadError)}
        >
          <FiDownload aria-hidden="true" />
          <span>{isExporting ? 'Preparing CSV...' : 'Export Attendance (CSV)'}</span>
        </button>
      </div>

      {importDialogOpen && (
        <div className="hrAttModalBackdrop" role="dialog" aria-modal="true" aria-label="Import attendance CSV">
          <div className="hrAttModal hrAttModal--import">
            <div className="hrAttModal__top">
              <div>
                <div className="hrAttModal__eyebrow">Attendance Migration Import</div>
                <div className="hrAttModal__title">Import Attendance CSV</div>
                <p className="hrAttModal__subtitle">
                  Upload a CSV exported from this attendance report. The import expects
                  {' '}
                  <strong>Employee ID, Employee Name, Date, Time In, Time Out</strong>
                  {' '}
                  and treats a
                  {' '}
                  <strong>Time Out</strong>
                  {' '}
                  earlier than
                  {' '}
                  <strong>Time In</strong>
                  {' '}
                  as an overnight next-day timeout.
                </p>
              </div>
              <ModalCloseButton className="hrAttModal__close" onClick={closeImportDialog} />
            </div>

            <div className="hrAttModal__rule" />

            <div className="hrAttImport">
              <FileUploadField
                label="Attendance CSV"
                hint="Use the exported attendance summary CSV from the previous system before migration."
                file={importFile}
                invalid={importSubmitAttempted && !importFile}
                onChange={(file) => {
                  setImportFile(file);
                  setImportSummary(null);
                  setActionError('');
                }}
                accept=".csv,text/csv"
                uploadLabel="Choose CSV"
                replaceLabel="Replace CSV"
                emptyLabel="No CSV selected"
              />

              <div className="hrAttImport__actions">
                <button
                  type="button"
                  className="hrAtt__actionBtn hrAtt__actionBtn--ghost"
                  onClick={closeImportDialog}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="hrAtt__actionBtn"
                  onClick={() => void importAttendanceReport()}
                  disabled={isImporting}
                >
                  <FiUpload aria-hidden="true" />
                  <span>{isImporting ? 'Importing CSV...' : 'Import Attendance (CSV)'}</span>
                </button>
              </div>

              {importSummary && (
                <section className="hrAttImportSummary" aria-label="Attendance import summary">
                  <div className="hrAttImportSummary__top">
                    <div>
                      <strong>Latest Import Summary</strong>
                      {importSummary.fileName ? <span>{importSummary.fileName}</span> : null}
                    </div>
                  </div>

                  <div className="hrAttImportSummary__grid">
                    <article className="hrAttImportSummary__card">
                      <span>Total Rows</span>
                      <strong>{importSummary.totalRows ?? 0}</strong>
                    </article>
                    <article className="hrAttImportSummary__card">
                      <span>Imported Rows</span>
                      <strong>{importSummary.importedRows ?? 0}</strong>
                    </article>
                    <article className="hrAttImportSummary__card">
                      <span>Imported Logs</span>
                      <strong>{importSummary.importedLogs ?? 0}</strong>
                    </article>
                    <article className="hrAttImportSummary__card">
                      <span>Skipped Rows</span>
                      <strong>{importSummary.skippedRows ?? 0}</strong>
                    </article>
                  </div>

                  {importIssues.length > 0 ? (
                    <div className="hrAttImportSummary__issues">
                      <div className="hrAttImportSummary__issuesTitle">
                        Row Issues ({importSummary.issueCount ?? importIssues.length})
                      </div>
                      <div className="hrAttImportSummary__issueList">
                        {importIssues.map((issue, index) => (
                          <article
                            key={`${issue.rowNumber ?? 'row'}-${issue.employeeId ?? 'employee'}-${index}`}
                            className="hrAttImportSummary__issue"
                          >
                            <strong>Row {issue.rowNumber ?? 'N/A'}</strong>
                            <span>
                              {issue.employeeId ? `Employee ${issue.employeeId}` : 'Employee unavailable'}
                              {issue.date ? ` | ${issue.date}` : ''}
                            </span>
                            <p>{issue.message ?? 'Unknown import issue.'}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="hrAttImportSummary__success">
                      All CSV rows were imported without validation issues.
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {detailOpen && (
        <div className="hrAttModalBackdrop" role="dialog" aria-modal="true" aria-label="Attendance breakdown">
          <div className="hrAttModal">
            <div className="hrAttModal__top">
              <div>
                <div className="hrAttModal__eyebrow">Daily Attendance Breakdown</div>
                <div className="hrAttModal__title">{selectedDateLabel}</div>
                <p className="hrAttModal__subtitle">{selectedDetailSubtitle}</p>
              </div>
              <ModalCloseButton className="hrAttModal__close" onClick={() => setDetailOpen(false)} />
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
                <span>
                  {hasFullRoster
                    ? selectedIsHoliday
                      ? 'Holiday'
                      : selectedIsWorkingDay
                        ? 'Absent'
                        : selectedHasKnownDayOffs
                          ? 'Day Off'
                          : 'No Schedule'
                    : 'Total Logs'}
                </span>
                <strong>
                  {hasFullRoster
                    ? selectedIsHoliday
                      ? 'Yes'
                      : selectedIsWorkingDay
                        ? selectedSummary.absent ?? '-'
                        : selectedHasKnownDayOffs
                          ? selectedSummary.dayOff
                          : 0
                    : selectedSummary.totalLogs}
                </strong>
              </article>
            </div>

            <div className="hrAttBreakdown">
              <section className="hrAttBreakdown__section">
                <div className="hrAttBreakdown__title">
                  <FiUsers />
                  Logged Employees
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
                    ) : selectedIsHoliday ? (
                      <div className="hrAttBreakdown__empty">This date is a holiday, so no absences are expected.</div>
                    ) : selectedHasKnownDayOffs ? (
                      <div className="hrAttBreakdown__empty">This date is treated as a scheduled day off.</div>
                    ) : !selectedIsWorkingDay ? (
                      <div className="hrAttBreakdown__empty">
                        No daily shifts were generated for this date, so absences are not evaluated.
                      </div>
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
