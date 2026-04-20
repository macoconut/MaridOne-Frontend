import type { CSSProperties } from 'react';
import { toArray } from '../../../lib/api';
import { getManilaNow } from '../../../lib/manilaTime';
import { evaluateDailyAttendanceCoverage } from '../../../lib/attendance/dailyAttendanceEvaluator';
import type {
  AttendanceEmployeeRow as EmployeeRow,
  AttendanceLeaveRequest as LeaveRequest,
  AttendanceLog,
  AttendanceOvertimeRequest as OvertimeRequest,
  DailyShift,
  HolidayLookupPayload,
} from '../../../lib/types/attendance';

export type FeedItem = {
  id: string;
  name: string;
  directionLabel: string;
  directionTone: 'in' | 'out' | 'late' | 'neutral';
  position: string;
  time: string;
};

export type LeaveCardItem = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  period: string;
};

export type DepartmentBreakdownItem = {
  id: string;
  name: string;
  headcount: number;
  present: number;
  late: number;
  outsideSchedule: number;
  absent: number;
  onLeave: number;
  dayOff: number;
  upcoming: number;
};

export type DailyEmployeeRecord = {
  employeeId: number;
  name: string;
  position: string;
  attendanceStatus: 'PRESENT' | 'INCOMPLETE' | 'ABSENT' | 'OUTSIDE_SCHEDULE';
  inTime?: string;
  outTime?: string;
  logCount: number;
  isLate: boolean;
  isIncomplete: boolean;
};

export type WeeklyAttendanceItem = {
  id: string;
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  summary: AttendanceStatusSummary;
};

export type AttendanceOverviewDashboardProps = {
  audience?: string;
  logsUrl?: string;
  leavesUrl?: string;
  rosterUrl?: string;
  overtimeUrl?: string;
  feedWindowDays?: number;
  primaryPanelMode?: 'department' | 'weekly';
  feedScope?: 'window' | 'selected-date';
  feedTitleOverride?: string;
  feedTimeDisplay?: 'auto' | 'time-only';
  descriptionOverride?: string;
  weeklyWindowAnchor?: 'today' | 'selected-date';
  weeklyWindowIncludesSelectedDate?: boolean;
};

export type AttendanceStatusKey = 'present' | 'late' | 'outsideSchedule' | 'absent' | 'onLeave' | 'dayOff' | 'upcoming';

export type AttendanceStatusTone = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7';

export type AttendanceStatusSummary = Record<AttendanceStatusKey, number> & {
  headcount: number;
};

export type DonutPoint = {
  key: AttendanceStatusKey;
  label: string;
  value: number;
  share: number;
  tone: AttendanceStatusTone;
};

export type MetricCard = {
  key: AttendanceStatusKey;
  label: string;
  value: number;
  helper: string;
  ringStyle?: CSSProperties;
};

export const STATUS_CONFIG: Record<
  AttendanceStatusKey,
  { label: string; tone: AttendanceStatusTone; color: string }
> = {
  present: { label: 'Present', tone: 't1', color: '#b83573' },
  late: { label: 'Late', tone: 't2', color: '#ef6b9c' },
  outsideSchedule: { label: 'Outside Schedule', tone: 't3', color: '#4b79c8' },
  absent: { label: 'Absent', tone: 't4', color: '#f2a6a8' },
  onLeave: { label: 'On Leave', tone: 't5', color: '#deb0ba' },
  dayOff: { label: 'Day Off', tone: 't6', color: '#e5d8de' },
  upcoming: { label: 'Upcoming', tone: 't7', color: '#93a5d1' },
};

export const METRIC_CARD_ROWS: AttendanceStatusKey[][] = [
  ['present', 'late', 'absent', 'dayOff'],
  ['upcoming', 'onLeave', 'outsideSchedule'],
];

export const DEFAULT_WORKING_DAYS = new Set([1, 2, 3, 4, 5, 6]);
export const DEPARTMENTS_PER_PAGE = 2;
export const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export type TimeWindow = {
  startMs: number;
  endMs: number;
};

export type AttendanceScheduleWindow = Pick<DailyShift, 'startDateTime' | 'endDateTime' | 'dayOff'>;

export function localDateKey(value?: string) {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}`;
}

export function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([AaPp][Mm]))?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'AM') {
    hours = hours === 12 ? 0 : hours;
  } else if (meridiem === 'PM') {
    hours = hours === 12 ? 12 : hours + 12;
  }

  return hours * 60 + minutes;
}

export function parseDateTimeToMinutes(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

export function formatLocalDateTime(dateKey: string, totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${dateKey}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export function formatLongDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDateLabel(date: Date) {
  const month = date.toLocaleDateString(undefined, { month: 'short' }).replace(/\.$/, '');
  return `${month}. ${date.getDate()}`;
}

export function formatFeedTimestamp(value?: string, includeDate = false) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return includeDate
    ? date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatPeriodLabel(start?: string, end?: string) {
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

export function isTodayWithin(start?: string, end?: string, today = new Date()) {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

  return startDate.getTime() <= dayEnd && endDate.getTime() >= dayStart;
}

export function withPaging(path: string, page: number, size: number) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&size=${size}`;
}

export function withParams(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${query}`;
}

export function employeeName(employee: EmployeeRow | undefined) {
  return employee?.name || 'Employee record unavailable';
}

export function isEmployeeScheduledOnDate(employee: EmployeeRow | undefined, dateKey?: string) {
  if (!employee || !dateKey) return false;

  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return true;

  if (!employee.shiftSchedules.length) {
    return DEFAULT_WORKING_DAYS.has(date.getDay());
  }

  const targetDay = DAY_NAMES[date.getDay()];
  return employee.shiftSchedules.some((item) => String(item.dayOfWeek ?? '').toUpperCase() === targetDay);
}

export function resolveScheduledStartMinutes(employee: EmployeeRow | undefined, dateKey?: string) {
  if (!employee || !dateKey) return null;

  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return null;

  const targetDay = DAY_NAMES[date.getDay()];
  const schedule = employee.shiftSchedules.find((item) => String(item.dayOfWeek ?? '').toUpperCase() === targetDay);
  return parseTimeToMinutes(schedule?.startTime);
}

export function leaveWindowForDate(request: LeaveRequest, dateKey: string) {
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

export function groupLeavesByEmployee(leaves: LeaveRequest[]) {
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

export function groupOvertimeByEmployee(requests: OvertimeRequest[]) {
  const grouped = new Map<number, OvertimeRequest[]>();

  for (const request of requests) {
    const employeeId = Number(request.employeeId);
    if (!Number.isFinite(employeeId)) continue;
    const current = grouped.get(employeeId) ?? [];
    current.push(request);
    grouped.set(employeeId, current);
  }

  return grouped;
}

export function resolveEffectiveScheduledStartMinutes(
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

export function isInDirection(direction?: string) {
  const value = String(direction ?? '').toUpperCase();
  return value.includes('IN') || value.includes('LATE');
}

export function isLateDirection(direction?: string) {
  return String(direction ?? '')
    .toUpperCase()
    .includes('LATE');
}

export function isLateForSchedule(
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

  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes > scheduledStartMinutes;
}

export function isOutDirection(direction?: string) {
  return String(direction ?? '').toUpperCase().includes('OUT');
}

export function localTimeLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function resolveTemplateScheduleWindows(employee: EmployeeRow | undefined, dateKey?: string): AttendanceScheduleWindow[] {
  if (!employee || !dateKey) return [];

  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return [];

  const targetDay = DAY_NAMES[date.getDay()];
  const windows: AttendanceScheduleWindow[] = [];

  for (const schedule of employee.shiftSchedules) {
    if (String(schedule.dayOfWeek ?? '').toUpperCase() !== targetDay) continue;

      const startMinutes = parseTimeToMinutes(schedule.startTime);
      const endMinutes = parseTimeToMinutes(schedule.endTime);
      if (startMinutes == null || endMinutes == null) continue;

      windows.push({
        startDateTime: formatLocalDateTime(dateKey, startMinutes),
        endDateTime: formatLocalDateTime(dateKey, endMinutes),
        dayOff: false,
      });
  }

  return windows;
}

export function resolveAttendanceScheduleWindows(
  employee: EmployeeRow | undefined,
  dateKey: string | undefined,
  scheduledShiftsByEmployeeAndDate: Map<string, DailyShift[]>
): AttendanceScheduleWindow[] {
  if (!dateKey) return [];

  const dailyShifts = employee ? (scheduledShiftsByEmployeeAndDate.get(`${employee.id}:${dateKey}`) ?? []) : [];
  if (dailyShifts.length > 0) {
    return dailyShifts;
  }

  return resolveTemplateScheduleWindows(employee, dateKey);
}

export function parseTimestampMs(value?: string) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function normalizeTimeWindow(startValue?: string, endValue?: string) {
  const startMs = parseTimestampMs(startValue);
  const rawEndMs = parseTimestampMs(endValue);
  if (startMs == null || rawEndMs == null) return null;
  const endMs = rawEndMs <= startMs ? rawEndMs + 24 * 60 * 60 * 1000 : rawEndMs;
  return endMs > startMs ? ({ startMs, endMs } satisfies TimeWindow) : null;
}

export function buildAttendanceSessions(logs: AttendanceLog[]) {
  const sorted = [...logs].sort((a, b) => (parseTimestampMs(a.timestamp) ?? 0) - (parseTimestampMs(b.timestamp) ?? 0));
  const sessions: TimeWindow[] = [];
  let openInMs: number | null = null;

  for (const log of sorted) {
    if (isInDirection(log.direction)) {
      openInMs = parseTimestampMs(log.timestamp);
      continue;
    }

    if (isOutDirection(log.direction) && openInMs !== null) {
      const outMs = parseTimestampMs(log.timestamp);
      if (outMs != null && outMs > openInMs) {
        sessions.push({ startMs: openInMs, endMs: outMs });
      }
      openInMs = null;
    }
  }

  return sessions;
}

export function buildDailyShiftWindows(shifts: AttendanceScheduleWindow[]) {
  return shifts
    .filter((shift) => shift.dayOff !== true)
    .map((shift) => normalizeTimeWindow(shift.startDateTime, shift.endDateTime))
    .filter((window): window is TimeWindow => window !== null);
}

export function overlapsWindow(left: TimeWindow, right: TimeWindow) {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

export function hasWindowOverlap(sessions: TimeWindow[], windows: TimeWindow[]) {
  return sessions.some((session) => windows.some((window) => overlapsWindow(session, window)));
}

export function resolveOutsideScheduleStatus(
  logs: AttendanceLog[],
  scheduledShifts: AttendanceScheduleWindow[],
  overtimeRequests: OvertimeRequest[],
  evaluation: ReturnType<typeof evaluateDailyAttendanceCoverage>
) {
  if (!evaluation.hasCompleteSession || overtimeRequests.length > 0) return null;

  const sessions = buildAttendanceSessions(logs);
  if (sessions.length === 0) return null;

  const scheduleWindows = buildDailyShiftWindows(scheduledShifts);
  if (scheduleWindows.length === 0 || hasWindowOverlap(sessions, scheduleWindows)) return null;

  return 'OUTSIDE_SCHEDULE' as const;
}

export function buildDailyRecords(
  logs: AttendanceLog[],
  employeeById: Map<number, EmployeeRow>,
  dateKey?: string,
  scheduledShiftsByEmployeeAndDate: Map<string, DailyShift[]> = new Map<string, DailyShift[]>(),
  overtimeRequestsByEmployeeId: Map<number, OvertimeRequest[]> = new Map<number, OvertimeRequest[]>()
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
      const scheduledShifts = resolveAttendanceScheduleWindows(employee, dateKey, scheduledShiftsByEmployeeAndDate);
      const overtimeRequests = overtimeRequestsByEmployeeId.get(employeeId) ?? [];
      const evaluation = evaluateDailyAttendanceCoverage({ logs: sorted, scheduledShifts });
      const outsideScheduleStatus = resolveOutsideScheduleStatus(sorted, scheduledShifts, overtimeRequests, evaluation);
      const isLate = evaluation.isLate;

      return {
        employeeId,
        name: employeeName(employee),
        position: employee?.position || 'Position unavailable',
        attendanceStatus: outsideScheduleStatus ?? evaluation.status,
        inTime: localTimeLabel(firstIn?.timestamp),
        outTime: localTimeLabel(lastOut?.timestamp),
        logCount: sorted.length,
        isLate,
        isIncomplete: (outsideScheduleStatus ?? evaluation.status) === 'INCOMPLETE',
      } satisfies DailyEmployeeRecord;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function hasScheduledWorkOnDate(
  employee: EmployeeRow | undefined,
  dateKey: string,
  dailyShiftDateKeysByEmployee: Map<number, Set<string>> = new Map<number, Set<string>>(),
  explicitDayOffDateKeysByEmployee: Map<number, Set<string>> = new Map<number, Set<string>>()
) {
  if (!employee || !dateKey) return false;
  if (explicitDayOffDateKeysByEmployee.get(employee.id)?.has(dateKey)) return false;
  if (dailyShiftDateKeysByEmployee.get(employee.id)?.has(dateKey)) return true;
  return isEmployeeScheduledOnDate(employee, dateKey);
}

export function isKnownDayOffOnDate(
  employee: EmployeeRow | undefined,
  dateKey: string,
  dailyShiftDateKeysByEmployee: Map<number, Set<string>> = new Map<number, Set<string>>(),
  explicitDayOffDateKeysByEmployee: Map<number, Set<string>> = new Map<number, Set<string>>()
) {
  if (!employee || !dateKey) return false;
  if (explicitDayOffDateKeysByEmployee.get(employee.id)?.has(dateKey)) return true;
  if (dailyShiftDateKeysByEmployee.get(employee.id)?.has(dateKey)) return false;
  return !isEmployeeScheduledOnDate(employee, dateKey);
}

export function parseHolidayLookup(payload: unknown) {
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

export function directionIndicator(direction?: string): FeedItem['directionLabel'] {
  const value = String(direction ?? '').toUpperCase();
  if (value.includes('OUT')) return 'OUT';
  if (value.includes('LATE')) return 'LATE';
  if (value.includes('IN')) return 'IN';
  return 'LOG';
}

export function directionIndicatorTone(direction?: string): FeedItem['directionTone'] {
  const value = String(direction ?? '').toUpperCase();
  if (value.includes('OUT')) return 'out';
  if (value.includes('LATE')) return 'late';
  if (value.includes('IN')) return 'in';
  return 'neutral';
}

export function rosterDisplayName(row: Record<string, unknown>) {
  const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : '';
  const middleName = typeof row.middleName === 'string' ? row.middleName.trim() : '';
  const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
  const givenNames = [firstName, middleName].filter((part) => part.length > 0).join(' ');
  const label = [lastName, givenNames].filter((part) => part.length > 0).join(', ');
  return label || 'Employee record unavailable';
}

export function rosterRows(payload: unknown) {
  return toArray<Record<string, unknown>>(payload).map((row, idx) => ({
    id: Number(row.employeeId ?? row.id ?? idx + 1),
    name: rosterDisplayName(row),
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
  }));
}

export function resolveDepartmentLabel(employee: EmployeeRow) {
  let value = String(employee.department ?? '').trim();
  if (!value) {
    switch (employee.position.toUpperCase()) {
      case 'HR':
        value = 'HR';
        break;
      case 'ACCOUNTING':
        value = 'Accounting';
        break;
      case 'MANAGEMENT':
        value = 'Management';
        break;
      default:
        value = 'Unassigned';
    }
  }

  // Strip " Department" or " department" if present
  return value.replace(/\s+Department$/i, '');
}

export function buildAttendanceSummary(
  employeeIds: number[],
  presentSet: Set<number>,
  lateSet: Set<number>,
  outsideScheduleSet: Set<number>,
  onLeaveSet: Set<number>,
  employeeById: Map<number, EmployeeRow>,
  dateKey: string,
  todayKey: string,
  isHoliday: boolean,
  leaveRequestsByEmployee: Map<number, LeaveRequest[]> = new Map(),
  scheduleOverrides?: {
    dailyShiftDateKeysByEmployee?: Map<number, Set<string>>;
    explicitDayOffDateKeysByEmployee?: Map<number, Set<string>>;
  }
) {
  const summary: AttendanceStatusSummary = {
    headcount: employeeIds.length,
    present: 0,
    late: 0,
    outsideSchedule: 0,
    absent: 0,
    onLeave: 0,
    dayOff: 0,
    upcoming: 0,
  };

  for (const employeeId of employeeIds) {
    const employee = employeeById.get(employeeId);
    const isScheduled = hasScheduledWorkOnDate(
      employee,
      dateKey,
      scheduleOverrides?.dailyShiftDateKeysByEmployee,
      scheduleOverrides?.explicitDayOffDateKeysByEmployee
    );

    if (lateSet.has(employeeId)) {
      summary.late += 1;
      continue;
    }

    if (presentSet.has(employeeId)) {
      summary.present += 1;
      continue;
    }

    if (outsideScheduleSet.has(employeeId)) {
      summary.outsideSchedule += 1;
      continue;
    }

    if (onLeaveSet.has(employeeId)) {
      summary.onLeave += 1;
      continue;
    }

    if (isHoliday) {
      summary.dayOff += 1;
      continue;
    }

    if (isKnownDayOffOnDate(
      employee,
      dateKey,
      scheduleOverrides?.dailyShiftDateKeysByEmployee,
      scheduleOverrides?.explicitDayOffDateKeysByEmployee
    )) {
      summary.dayOff += 1;
      continue;
    }

    if (!isScheduled) {
      summary.dayOff += 1;
      continue;
    }

    // Check if shift has started yet
    if (!isEmployeeScheduledToHaveStartedByNow(
      employee,
      dateKey,
      todayKey,
      leaveRequestsByEmployee.get(employeeId) || []
    )) {
      // If shift hasn't started, we don't count them as absent yet.
      // We put them in 'upcoming' for now to keep the headcount balanced.
      summary.upcoming += 1;
      continue;
    }

    summary.absent += 1;
  }

  return summary;
}

export function buildOnLeaveSetForDate(leaveRequests: LeaveRequest[], date: Date) {
  const ids = new Set<number>();

  for (const request of leaveRequests) {
    if (typeof request.empId !== 'number') continue;
    if (String(request.requestStatus ?? '').toUpperCase() !== 'APPROVED') continue;
    if (!isTodayWithin(request.startDateTime, request.endDateTime, date)) continue;
    ids.add(request.empId);
  }

  return ids;
}

export function donutPoints(summary: AttendanceStatusSummary) {
  const total = summary.headcount;
  if (total <= 0) return [] as DonutPoint[];

  return (Object.keys(STATUS_CONFIG) as AttendanceStatusKey[])
    .map((key) => ({
      key,
      label: STATUS_CONFIG[key].label,
      value: summary[key],
      share: summary[key] / total,
      tone: STATUS_CONFIG[key].tone,
    }))
    .filter((point) => point.value > 0);
}

export function buildDonutBackground(points: DonutPoint[]) {
  if (points.length === 0) return '';

  let cursor = 0;
  const segments = points.map((point) => {
    const start = cursor;
    cursor += point.share * 100;
    return `${STATUS_CONFIG[point.key].color} ${start}% ${cursor}%`;
  });

  if (cursor < 100) {
    segments.push(`#f4edf7 ${cursor}% 100%`);
  }

  return `conic-gradient(${segments.join(', ')})`;
}

export function isEmployeeScheduledToHaveStartedByNow(
  employee: EmployeeRow | undefined,
  dateKey: string,
  todayKey: string,
  leaveRequests: LeaveRequest[] = []
) {
  if (dateKey < todayKey) return true;
  if (dateKey > todayKey) return false;

  const scheduledStartMinutes = resolveEffectiveScheduledStartMinutes(employee, dateKey, leaveRequests);
  if (scheduledStartMinutes === null) return true;

  const manila = getManilaNow();
  return manila.totalMinutes >= scheduledStartMinutes;
}

