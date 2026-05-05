import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiUpload,
  FiUsers,
} from 'react-icons/fi';
import LargePopup from '@/components/dialog/LargePopup';
import FileUploadField from '@/components/form/FileUploadField';
import PageHeader from '@/components/layout/PageHeader';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '@/lib/api/api';
import { getFriendlyErrorMessage } from '@/lib/uiErrors';
import { getManilaNow } from '@/lib/manilaTime';
import { evaluateDailyAttendanceCoverage } from '@/lib/attendance/dailyAttendanceEvaluator';
import { useAttendanceReportFilters, type AttendanceStatusFilter } from './hooks/useAttendanceReportFilters';
import AttendanceReportToolbar from './sections/AttendanceReportToolbar';
import type {
  AttendanceEmployeeRow as EmployeeRow,
  AttendanceLeaveRequest as LeaveRequest,
  AttendanceLog,
  AttendanceOvertimeRequest as OvertimeRequest,
  DailyShift,
  HolidayLookupPayload,
} from '@/lib/types/attendance';
import './AttendanceReports.css';

type DayCell = {
  day: number | null;
  presentCount: number;
  lateCount: number;
  incompleteCount: number;
  outsideScheduleCount: number;
  holidayCount: number;
  absentCount: number | null;
  dayOffCount: number;
};

type EmployeeCalendarTone =
  | 'present'
  | 'late'
  | 'incomplete'
  | 'outside'
  | 'absent'
  | 'dayOff'
  | 'holiday'
  | 'leave'
  | 'ot';

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
  status: AttendanceExportStatus;
  inTime?: string;
  outTime?: string;
  logCount: number;
  isLate: boolean;
  isEarlyOut: boolean;
  lateMinutes: number;
  earlyOutMinutes: number;
  isIncomplete: boolean;
  logs: Array<{
    attendanceId: number | string;
    time: string;
    direction: string;
    directionLabel: string;
  }>;
};

type AttendanceExportRow = {
  employeeId: string;
  employeeName: string;
  date: string;
  timeIn: string;
  timeOut: string;
  department: string;
  position: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AttendanceExportStatus;
  late: string;
  earlyOut: string;
  lateMinutes: string;
  earlyOutMinutes: string;
};

type AttendanceExportStatus = 'PRESENT' | 'INCOMPLETE' | 'ABSENT' | 'OUTSIDE_SCHEDULE';

type AttendanceExportSummaryRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  evaluatedDays: number;
  presentDays: number;
  lateDays: number;
  earlyOutDays: number;
  incompleteDays: number;
  absentDays: number;
  outsideScheduleDays: number;
  totalLateMinutes: number;
  totalEarlyOutMinutes: number;
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

type AttendanceReportsBoardProps = {
  audienceLabel?: string;
  logsUrl?: string;
  rosterUrl?: string;
  leavesUrl?: string;
  overtimeUrl?: string;
  descriptionOverride?: string;
  showDepartmentFilter?: boolean;
};

type OvernightShiftWindow = {
  workDateKey: string;
  cutoffTime: number;
};

type DailyShiftExportIndexes = {
  dailyShiftDateKeysByEmployee: Map<number, Set<string>>;
  explicitDayOffDateKeysByEmployee: Map<number, Set<string>>;
  dailyShiftCoverageByEmployee: Map<number, { startDateKey: string; endDateKey: string }>;
  dailyShiftsByEmployeeAndDate: Map<string, DailyShift[]>;
};

type TimeWindow = {
  startMs: number;
  endMs: number;
};

type AttendanceScheduleWindow = Pick<DailyShift, 'startDateTime' | 'endDateTime' | 'dayOff'>;

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const BASE_LEGEND_ITEMS: Array<{ label: string; tone: EmployeeCalendarTone }> = [
  { label: 'Present', tone: 'present' },
  { label: 'Late', tone: 'late' },
  { label: 'Incomplete', tone: 'incomplete' },
  { label: 'Outside Schedule', tone: 'outside' },
  { label: 'Absent', tone: 'absent' },
  { label: 'Day Off', tone: 'dayOff' },
  { label: 'Holiday', tone: 'holiday' },
];
const FOCUS_LEGEND_ITEMS: Array<{ label: string; tone: EmployeeCalendarTone }> = [
  ...BASE_LEGEND_ITEMS,
  { label: 'On Leave', tone: 'leave' },
  { label: 'OT', tone: 'ot' },
];
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const NIGHT_SHIFT_REPORT_CUTOFF_HOUR = 6;
const ATTENDANCE_SUMMARY_MARKER = 'Attendance Summary Report';

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
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function parseTimeToMinutes(value?: string) {
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

function parseDateTimeToMinutes(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function formatLocalDateTime(dateKey: string, totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${dateKey}T${pad2(hours)}:${pad2(minutes)}:00`;
}

function isEmployeeScheduledOnDate(employee: EmployeeRow | undefined, dateKey?: string) {
  if (!employee || !dateKey) return false;

  const date = dateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return true;

  if (!employee.shiftSchedules.length) return false;

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

function groupOvertimeByEmployee(requests: OvertimeRequest[]) {
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

function resolveOutsideScheduleStatus(
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
  if (value) return value.replace(/\s+Department$/i, '');

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

function formatEmployeeMetaLine(position?: string, department?: string) {
  const parts = [String(position ?? '').trim(), String(department ?? '').trim()].filter(
    (part) => part.length > 0 && part !== '-' && part.toUpperCase() !== 'UNASSIGNED'
  );
  const uniqueParts = parts.filter(
    (part, index) => parts.findIndex((candidate) => candidate.toUpperCase() === part.toUpperCase()) === index
  );
  return uniqueParts.join(' • ');
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

function parseTimestampMs(value?: string) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeTimeWindow(startValue?: string, endValue?: string) {
  const startMs = parseTimestampMs(startValue);
  const rawEndMs = parseTimestampMs(endValue);
  if (startMs == null || rawEndMs == null) return null;
  const endMs = rawEndMs <= startMs ? rawEndMs + 24 * 60 * 60 * 1000 : rawEndMs;
  return endMs > startMs ? ({ startMs, endMs } satisfies TimeWindow) : null;
}

function buildAttendanceSessions(logs: AttendanceLog[]) {
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

function buildDailyShiftWindows(shifts: AttendanceScheduleWindow[]) {
  return shifts
    .filter((shift) => shift.dayOff !== true)
    .map((shift) => normalizeTimeWindow(shift.startDateTime, shift.endDateTime))
    .filter((window): window is TimeWindow => window !== null);
}

function overlapsWindow(left: TimeWindow, right: TimeWindow) {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

function hasWindowOverlap(sessions: TimeWindow[], windows: TimeWindow[]) {
  return sessions.some((session) => windows.some((window) => overlapsWindow(session, window)));
}

function attendanceBadgeForRecord(record: DailyEmployeeRecord) {
  if (record.status === 'INCOMPLETE') return { label: 'Incomplete Logs', toneClass: 'is-incomplete' };
  if (record.status === 'ABSENT') return { label: 'Absent', toneClass: 'is-absent' };
  if (record.status === 'OUTSIDE_SCHEDULE') return { label: 'Outside Schedule', toneClass: 'is-outside' };
  
  const labels: string[] = ['Present'];
  if (record.isLate) labels.push('Late');
  if (record.isEarlyOut) labels.push('Early Out');
  
  return { 
    label: labels.join(' + '), 
    toneClass: record.isLate || record.isEarlyOut ? 'is-late' : 'is-on-time' 
  };
}

function matchesRecordStatusFilter(record: DailyEmployeeRecord, filter: AttendanceStatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'present') return record.status === 'PRESENT' && !record.isLate;
  if (filter === 'late') return record.status === 'PRESENT' && record.isLate;
  if (filter === 'incomplete') return record.status === 'INCOMPLETE';
  if (filter === 'outside') return record.status === 'OUTSIDE_SCHEDULE';
  if (filter === 'absent') return record.status === 'ABSENT';
  return false;
}

function matchesCountStatusFilter(filter: AttendanceStatusFilter, status: Exclude<AttendanceStatusFilter, 'all'>) {
  return filter === 'all' || filter === status;
}

function isInDirection(direction?: string) {
  const value = (direction ?? '').toUpperCase();
  return value.includes('IN') || value.includes('LATE');
}

function isOutDirection(direction?: string) {
  return (direction ?? '').toUpperCase().includes('OUT');
}

function attendanceLogDirectionLabel(direction?: string) {
  if (isOutDirection(direction)) return 'Out';
  if (isInDirection(direction)) return 'In';
  return humanizeEnum(direction) || 'Log';
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
  const holidayNames = Array.isArray(object.holidays)
    ? object.holidays.reduce<Record<string, string>>((names, holiday) => {
        const dateKey = localDateKey(holiday?.date);
        const name = typeof holiday?.name === 'string' ? holiday.name.trim() : '';
        if (!dateKey || !name) return names;
        names[dateKey] = name;
        return names;
      }, {})
    : {};

  return { holidayDates, regularHolidayDates, holidayNames };
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
      outsideScheduleCount: 0,
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
      outsideScheduleCount: 0,
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
      outsideScheduleCount: 0,
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

function buildDailyShiftExportIndexes(
  dailyShifts: DailyShift[],
  eligibleEmployeeIds: Set<number>
) {
  const dailyShiftDateKeysByEmployee = new Map<number, Set<string>>();
  const explicitDayOffDateKeysByEmployee = new Map<number, Set<string>>();
  const dailyShiftCoverageByEmployee = new Map<number, { startDateKey: string; endDateKey: string }>();
  const dailyShiftsByEmployeeAndDate = new Map<string, DailyShift[]>();

  for (const shift of dailyShifts) {
    const employeeId = Number(shift.employeeId);
    const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
    if (!Number.isFinite(employeeId) || !eligibleEmployeeIds.has(employeeId) || !workDateKey) continue;

    if (shift.dayOff === true) {
      const current = explicitDayOffDateKeysByEmployee.get(employeeId) ?? new Set<string>();
      current.add(workDateKey);
      explicitDayOffDateKeysByEmployee.set(employeeId, current);
      continue;
    }

    const dateKeys = dailyShiftDateKeysByEmployee.get(employeeId) ?? new Set<string>();
    dateKeys.add(workDateKey);
    dailyShiftDateKeysByEmployee.set(employeeId, dateKeys);

    const key = `${employeeId}:${workDateKey}`;
    const currentShifts = dailyShiftsByEmployeeAndDate.get(key) ?? [];
    currentShifts.push(shift);
    dailyShiftsByEmployeeAndDate.set(key, currentShifts);
  }

  for (const [employeeId, dateKeys] of dailyShiftDateKeysByEmployee.entries()) {
    const sorted = [...dateKeys].sort((a, b) => a.localeCompare(b));
    if (sorted.length === 0) continue;
    dailyShiftCoverageByEmployee.set(employeeId, {
      startDateKey: sorted[0],
      endDateKey: sorted[sorted.length - 1],
    });
  }

  return {
    dailyShiftDateKeysByEmployee,
    explicitDayOffDateKeysByEmployee,
    dailyShiftCoverageByEmployee,
    dailyShiftsByEmployeeAndDate,
  } satisfies DailyShiftExportIndexes;
}

function buildOvertimeExportIndex(requests: OvertimeRequest[], eligibleEmployeeIds: Set<number>) {
  const approvedOvertimeByEmployeeAndDate = new Map<string, OvertimeRequest[]>();

  for (const request of requests) {
    const employeeId = Number(request.employeeId);
    const dateKey = localDateKey(request.workDate);
    if (!Number.isFinite(employeeId) || !eligibleEmployeeIds.has(employeeId) || !dateKey) continue;

    const key = `${employeeId}:${dateKey}`;
    const current = approvedOvertimeByEmployeeAndDate.get(key) ?? [];
    current.push(request);
    approvedOvertimeByEmployeeAndDate.set(key, current);
  }

  return { approvedOvertimeByEmployeeAndDate };
}

function hasApprovedOvertimeOnDateForExport(
  overtimeIndex: ReturnType<typeof buildOvertimeExportIndex>,
  employeeId: number,
  dateKey: string
) {
  return (overtimeIndex.approvedOvertimeByEmployeeAndDate.get(`${employeeId}:${dateKey}`)?.length ?? 0) > 0;
}

function hasDailyShiftOnDateForExport(
  indexes: DailyShiftExportIndexes,
  employee: EmployeeRow | undefined,
  dateKey?: string
) {
  if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
  return indexes.dailyShiftDateKeysByEmployee.get(employee.id)?.has(dateKey) ?? false;
}

function isKnownDayOffOnDateForExport(
  indexes: DailyShiftExportIndexes,
  employee: EmployeeRow | undefined,
  dateKey?: string
) {
  if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
  if (indexes.explicitDayOffDateKeysByEmployee.get(employee.id)?.has(dateKey)) return true;
  if (hasDailyShiftOnDateForExport(indexes, employee, dateKey)) return false;

  const coverage = indexes.dailyShiftCoverageByEmployee.get(employee.id);
  if (!coverage) return false;
  if (dateKey < coverage.startDateKey || dateKey > coverage.endDateKey) return false;

  return !isEmployeeScheduledOnDate(employee, dateKey);
}

function resolveScheduledWindowForExport(
  indexes: DailyShiftExportIndexes,
  employeeId: number,
  dateKey: string
) {
  const shifts = indexes.dailyShiftsByEmployeeAndDate.get(`${employeeId}:${dateKey}`) ?? [];
  if (shifts.length === 0) {
    return { start: '', end: '' };
  }

  const sorted = [...shifts].sort((left, right) => {
    const leftTime = left.startDateTime ? Date.parse(left.startDateTime) : Number.POSITIVE_INFINITY;
    const rightTime = right.startDateTime ? Date.parse(right.startDateTime) : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  });
  const first = sorted[0];
  const last = [...sorted].sort((left, right) => {
    const leftTime = left.endDateTime ? Date.parse(left.endDateTime) : Number.NEGATIVE_INFINITY;
    const rightTime = right.endDateTime ? Date.parse(right.endDateTime) : Number.NEGATIVE_INFINITY;
    return rightTime - leftTime;
  })[0];

  return {
    start: localTimeLabel(first?.startDateTime) ?? '',
    end: localTimeLabel(last?.endDateTime) ?? '',
  };
}

function resolveOvertimeWindowForExport(
  overtimeIndex: ReturnType<typeof buildOvertimeExportIndex>,
  employeeId: number,
  dateKey: string
) {
  const requests = overtimeIndex.approvedOvertimeByEmployeeAndDate.get(`${employeeId}:${dateKey}`) ?? [];
  if (requests.length === 0) {
    return { start: '', end: '' };
  }

  const first = [...requests].sort((left, right) => {
    const leftTime = left.startTime ? Date.parse(left.startTime) : Number.POSITIVE_INFINITY;
    const rightTime = right.startTime ? Date.parse(right.startTime) : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  })[0];
  const last = [...requests].sort((left, right) => {
    const leftTime = left.endTime ? Date.parse(left.endTime) : Number.NEGATIVE_INFINITY;
    const rightTime = right.endTime ? Date.parse(right.endTime) : Number.NEGATIVE_INFINITY;
    return rightTime - leftTime;
  })[0];

  return {
    start: localTimeLabel(first?.startTime) ?? '',
    end: localTimeLabel(last?.endTime) ?? '',
  };
}

function hasScheduledShiftStartedForExport(
  indexes: DailyShiftExportIndexes,
  employeeId: number,
  dateKey: string,
  todayDateKey: string
) {
  if (dateKey < todayDateKey) return true;
  if (dateKey > todayDateKey) return false;

  const shifts = indexes.dailyShiftsByEmployeeAndDate.get(`${employeeId}:${dateKey}`) ?? [];
  const startMinutes = shifts
    .map((shift) => parseDateTimeToMinutes(shift.startDateTime))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)[0];

  if (startMinutes == null) return false;
  return getManilaNow().totalMinutes >= startMinutes;
}

function classifyAttendanceExportStatus(record?: DailyEmployeeRecord): AttendanceExportStatus {
  if (!record) return 'ABSENT';
  if (record.status === 'OUTSIDE_SCHEDULE') return 'OUTSIDE_SCHEDULE';
  if (record.status === 'PRESENT') return 'PRESENT';
  if (record.status === 'INCOMPLETE') return 'INCOMPLETE';
  return 'ABSENT';
}

function employeeName(employee: EmployeeRow | undefined, employeeId: number) {
  return employee?.name || `Employee #${employeeId}`;
}

function resolveTemplateScheduleWindows(employee: EmployeeRow | undefined, dateKey?: string): AttendanceScheduleWindow[] {
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

function resolveAttendanceScheduleWindows(
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

function buildDailyRecords(
  logs: AttendanceLog[],
  employeeById: Map<number, EmployeeRow>,
  dateKey?: string,
  scheduledShiftsByEmployeeAndDate: Map<string, DailyShift[]> = new Map<string, DailyShift[]>(),
  overtimeRequestsByEmployeeId: Map<number, OvertimeRequest[]> = new Map<number, OvertimeRequest[]>(),
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
      const isHoliday = dateKey ? holidayDateKeys.has(dateKey) : false;
      const scheduledShifts = resolveAttendanceScheduleWindows(employee, dateKey, scheduledShiftsByEmployeeAndDate);
      const overtimeRequests = overtimeRequestsByEmployeeId.get(employeeId) ?? [];
      const evaluation = evaluateDailyAttendanceCoverage({ logs: sorted, scheduledShifts });
      const status = resolveOutsideScheduleStatus(sorted, scheduledShifts, overtimeRequests, evaluation) ?? evaluation.status;
      const isLate = !isHoliday && evaluation.isLate;
      const isEarlyOut = !isHoliday && evaluation.isEarlyOut;
      const lateMinutes = isLate ? evaluation.lateMinutes : 0;
      const earlyOutMinutes = isEarlyOut ? evaluation.earlyOutMinutes : 0;
      const isIncomplete = status === 'INCOMPLETE';

      return {
        employeeId,
        name: employeeName(employee, employeeId),
        position: employee?.position || '-',
        status,
        inTime: localTimeLabel(firstIn?.timestamp),
        outTime: localTimeLabel(lastOut?.timestamp),
        logCount: sorted.length,
        isLate,
        isEarlyOut,
        lateMinutes,
        earlyOutMinutes,
        isIncomplete,
        logs: sorted.map((row, index) => ({
          attendanceId: row.attendanceId ?? `${employeeId}-${index}`,
          time: localTimeLabel(row.timestamp) || 'N/A',
          direction: String(row.direction ?? '').trim().toUpperCase(),
          directionLabel: attendanceLogDirectionLabel(row.direction),
        })),
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
      shift.dayOff === true ||
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
    employmentDateStart:
      typeof row.employmentDateStart === 'string'
        ? row.employmentDateStart
        : undefined,
  }));
}

function isEmployeeScheduledToHaveStartedByNow(
  employee: EmployeeRow | undefined,
  dateKey: string,
  todayDateKey: string,
  leaveRequests: LeaveRequest[] = []
) {
  if (dateKey < todayDateKey) return true;
  if (dateKey > todayDateKey) return false;

  const scheduledStartMinutes = resolveEffectiveScheduledStartMinutes(employee, dateKey, leaveRequests);
  if (scheduledStartMinutes === null) return true;

  const manila = getManilaNow();
  return manila.totalMinutes >= scheduledStartMinutes;
}

export default function HrAttendanceReports() {
  return <AttendanceReportsBoard audienceLabel="HR" />;
}

export function AttendanceReportsBoard({
  audienceLabel = 'HR',
  logsUrl = '/api/logs/attendance',
  rosterUrl = '/api/employees',
  leavesUrl = '/api/leave/request',
  overtimeUrl,
  descriptionOverride,
  showDepartmentFilter,
}: AttendanceReportsBoardProps) {
  const todayDateKey = useMemo(() => getManilaNow().dateKey, []);
  const todayYear = useMemo(() => getManilaNow().year, []);
  const todayMonthIndex = useMemo(() => getManilaNow().month - 1, []);
  const {
    actionMenuOpen,
    attendanceStatusFilter,
    clearFilters,
    departmentFilter,
    detailOpen,
    filterOpen,
    monthIndex,
    monthLabel,
    monthValue,
    openDayDetails,
    parseMonthValue,
    searchValue,
    selectedDateKey,
    setActionMenuOpen,
    setAttendanceStatusFilter,
    setDepartmentFilter,
    setDetailOpen,
    setFilterOpen,
    setMonthValue,
    setSearchValue,
    setSelectedDateKey,
    shiftCalendarMonth,
    year,
  } = useAttendanceReportFilters({
    todayDateKey,
    todayMonthIndex,
    todayYear,
  });
  const monthStartKey = useMemo(() => toISODate(year, monthIndex, 1), [monthIndex, year]);
  const monthEndKey = useMemo(
    () => toISODate(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate()),
    [monthIndex, year]
  );
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [approvedOvertime, setApprovedOvertime] = useState<OvertimeRequest[]>([]);
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [holidayDateKeys, setHolidayDateKeys] = useState<string[]>([]);
  const [regularHolidayDateKeys, setRegularHolidayDateKeys] = useState<string[]>([]);
  const [holidayNamesByDate, setHolidayNamesByDate] = useState<Record<string, string>>({});
  const [hasFullRoster, setHasFullRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');

  useEffect(() => {
    setExportFromDate(monthStartKey);
    setExportToDate(monthEndKey);
  }, [monthStartKey, monthEndKey]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<AttendanceImportSummary | null>(null);
  const [importSubmitAttempted, setImportSubmitAttempted] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const silentRefreshRef = useRef(false);
  const overtimeEndpoint = overtimeUrl ?? (audienceLabel === 'Manager' ? '/api/overtime/team' : '/api/overtime/all');
  const shouldShowDepartmentFilter = showDepartmentFilter ?? audienceLabel !== 'Manager';

  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    if (detailOpen || importDialogOpen || exportDialogOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [detailOpen, exportDialogOpen, importDialogOpen]);

  useEffect(() => {
    if (!filterOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [filterOpen, setFilterOpen]);

  useEffect(() => {
    if (!actionMenuOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [actionMenuOpen, setActionMenuOpen]);

  useEffect(() => {
    setMonthValue(
      new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [monthIndex, setMonthValue, year]);

  useEffect(() => {
    if (year === todayYear && monthIndex === todayMonthIndex) {
      setSelectedDateKey(todayDateKey);
    } else {
      setSelectedDateKey('');
    }
  }, [monthIndex, setSelectedDateKey, todayDateKey, todayMonthIndex, todayYear, year]);

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

        const [employeeResult, leaveResult, holidayResult, dailyShiftResult, overtimeResult] = await Promise.allSettled([
          apiFetchJson<unknown>(withParams(rosterUrl, { page: '0', size: '500' })),
          apiFetchJson<unknown>(
            withParams(leavesUrl, {
              page: '0',
              size: '2000',
              requestStatus: 'APPROVED',
              sort: 'requestId,desc',
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
          apiFetchJson<unknown>(
            withParams(overtimeEndpoint, {
              page: '0',
              size: '4000',
              requestStatus: 'APPROVED',
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

        if (overtimeResult.status === 'fulfilled') {
          const nextApprovedOvertime = toArray<OvertimeRequest>(overtimeResult.value).filter((request) => {
            const employeeId = Number(request.employeeId);
            const workDateKey = localDateKey(request.workDate);
            return (
              Number.isFinite(employeeId) &&
              Boolean(workDateKey) &&
              workDateKey >= monthStartKey &&
              workDateKey <= monthEndKey &&
              String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
            );
          });
          setApprovedOvertime(nextApprovedOvertime);
        } else if (!isSilentRefresh) {
          setApprovedOvertime([]);
        }

        setLogs(nextLogs);

        if (holidayResult.status === 'fulfilled') {
          const parsed = parseHolidayLookup(holidayResult.value);
          setHolidayDateKeys(parsed.holidayDates);
          setRegularHolidayDateKeys(parsed.regularHolidayDates);
          setHolidayNamesByDate(parsed.holidayNames);
        } else if (!isSilentRefresh) {
          setHolidayDateKeys([]);
          setRegularHolidayDateKeys([]);
          setHolidayNamesByDate({});
        }
        setLoadError('');
      } catch (error) {
        if (cancelled) return;
        if (!isSilentRefresh) {
          setLogs([]);
          setEmployees([]);
          setApprovedLeaves([]);
          setApprovedOvertime([]);
          setDailyShifts([]);
          setHolidayDateKeys([]);
          setRegularHolidayDateKeys([]);
          setHolidayNamesByDate({});
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
  }, [audienceLabel, leavesUrl, logsUrl, monthEndKey, monthIndex, monthStartKey, overtimeEndpoint, refreshTick, rosterUrl, year]);

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
  const selectedHolidayName = selectedDateKey ? holidayNamesByDate[selectedDateKey] ?? 'Holiday' : 'Holiday';

  const dailyShiftDateKeysByEmployee = useMemo(() => {
    const grouped = new Map<number, Set<string>>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !workDateKey || shift.dayOff === true) continue;

      const current = grouped.get(employeeId) ?? new Set<string>();
      current.add(workDateKey);
      grouped.set(employeeId, current);
    }

    return grouped;
  }, [dailyShifts, filteredEmployeeIdSet]);

  const explicitDayOffDateKeysByEmployee = useMemo(() => {
    const grouped = new Map<number, Set<string>>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !workDateKey || shift.dayOff !== true) continue;

      const current = grouped.get(employeeId) ?? new Set<string>();
      current.add(workDateKey);
      grouped.set(employeeId, current);
    }

    return grouped;
  }, [dailyShifts, filteredEmployeeIdSet]);

  const scheduledShiftsByEmployeeAndDate = useMemo(() => {
    const grouped = new Map<string, DailyShift[]>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !workDateKey) continue;
      if (shift.dayOff === true) continue;

      const key = `${employeeId}:${workDateKey}`;
      const current = grouped.get(key) ?? [];
      current.push(shift);
      grouped.set(key, current);
    }

    return grouped;
  }, [dailyShifts, filteredEmployeeIdSet]);

  const hasDailyShiftOnDate = useCallback(
    (employee: EmployeeRow | undefined, dateKey?: string) => {
      if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
      return dailyShiftDateKeysByEmployee.get(employee.id)?.has(dateKey) ?? false;
    },
    [dailyShiftDateKeysByEmployee]
  );

  const hasScheduledWorkOnDate = useCallback(
    (employee: EmployeeRow | undefined, dateKey?: string) => {
      if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
      if (explicitDayOffDateKeysByEmployee.get(employee.id)?.has(dateKey)) return false;
      if (hasDailyShiftOnDate(employee, dateKey)) return true;
      return isEmployeeScheduledOnDate(employee, dateKey);
    },
    [explicitDayOffDateKeysByEmployee, hasDailyShiftOnDate]
  );

  const isKnownDayOffOnDate = useCallback(
    (employee: EmployeeRow | undefined, dateKey?: string) => {
      if (!employee || !dateKey || !isEmployeeActiveOnDate(employee, dateKey)) return false;
      if (explicitDayOffDateKeysByEmployee.get(employee.id)?.has(dateKey)) return true;
      if (hasDailyShiftOnDate(employee, dateKey)) return false;
      return !isEmployeeScheduledOnDate(employee, dateKey);
    },
    [explicitDayOffDateKeysByEmployee, hasDailyShiftOnDate]
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

  const approvedOvertimeByDate = useMemo(() => {
    const grouped = new Map<string, OvertimeRequest[]>();

    for (const request of approvedOvertime) {
      const employeeId = Number(request.employeeId);
      const dateKey = localDateKey(request.workDate);
      if (!Number.isFinite(employeeId) || !filteredEmployeeIdSet.has(employeeId) || !dateKey) continue;

      const current = grouped.get(dateKey) ?? [];
      current.push(request);
      grouped.set(dateKey, current);
    }

    return grouped;
  }, [approvedOvertime, filteredEmployeeIdSet]);

  const focusedEmployee = filteredEmployees.length === 1 ? filteredEmployees[0] : null;
  const focusedDepartment = focusedEmployee ? resolveDepartmentLabel(focusedEmployee) : '';
  const activeFilterCount = [departmentFilter !== 'all', attendanceStatusFilter !== 'all'].filter(Boolean).length;
  const noEmployeeMatches = !isLoading && !loadError && reportableEmployees.length > 0 && filteredEmployees.length === 0;
  const selectedDateLabel = selectedDateKey ? longDateLabel(selectedDateKey) : 'Selected date';
  const focusLeaves = useMemo(() => {
    if (!focusedEmployee) return [] as LeaveRequest[];
    return approvedLeaves.filter((request) => Number(request.empId) === focusedEmployee.id);
  }, [approvedLeaves, focusedEmployee]);

  const focusOvertime = useMemo(() => {
    if (!focusedEmployee) return [] as OvertimeRequest[];
    return approvedOvertime.filter((request) => Number(request.employeeId) === focusedEmployee.id);
  }, [approvedOvertime, focusedEmployee]);

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
        scheduledShiftsByEmployeeAndDate,
        groupOvertimeByEmployee(approvedOvertimeByDate.get(dateKey) ?? []),
        holidayDateSet
      );
      const record = records.find((item) => item.employeeId === focusedEmployee.id);
      if (record) grouped.set(dateKey, record);
    }

    return grouped;
  }, [approvedOvertimeByDate, filteredEmployeeById, focusedEmployee, holidayDateSet, logsByDate, scheduledShiftsByEmployeeAndDate]);

  const aggregateCalendarCells = useMemo(() => {
    const cells = monthCells(year, monthIndex);
    return cells.map((cell) => {
      if (cell.day === null) return cell;
      const dateKey = toISODate(year, monthIndex, cell.day);
      const isFutureDate = dateKey > todayDateKey;
      const records = buildDailyRecords(
        logsByDate.get(dateKey) ?? [],
        filteredEmployeeById,
        dateKey,
        scheduledShiftsByEmployeeAndDate,
        groupOvertimeByEmployee(approvedOvertimeByDate.get(dateKey) ?? []),
        holidayDateSet
      );
      const isHoliday = holidayDateSet.has(dateKey);
      const incompleteCount = matchesCountStatusFilter(attendanceStatusFilter, 'incomplete')
        ? records.filter((record) => record.status === 'INCOMPLETE').length
        : 0;
      const lateCount = matchesCountStatusFilter(attendanceStatusFilter, 'late')
        ? records.filter((record) => record.status === 'PRESENT' && record.isLate).length
        : 0;
      const presentCount = matchesCountStatusFilter(attendanceStatusFilter, 'present')
        ? records.filter((record) => record.status === 'PRESENT' && !record.isLate).length
        : 0;
      const outsideScheduleCount = matchesCountStatusFilter(attendanceStatusFilter, 'outside')
        ? records.filter((record) => record.status === 'OUTSIDE_SCHEDULE').length
        : 0;
      const leaveEmployeeIds = approvedLeaveEmployeeIdsByDate.get(dateKey) ?? new Set<number>();
      const loggedEmployeeIds = new Set(records.map((record) => record.employeeId));
      const absentLoggedEmployeeIds = new Set(
        records.filter((record) => record.status === 'ABSENT').map((record) => record.employeeId)
      );
      const holidayCount =
        matchesCountStatusFilter(attendanceStatusFilter, 'holiday') &&
        hasFullRoster && !isFutureDate && isHoliday
          ? activeEmployees.filter((employee) => !loggedEmployeeIds.has(employee.id))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;
      const missingLogsAbsentCount =
        hasFullRoster && !isFutureDate && !isHoliday
          ? activeEmployees.filter((employee) => hasScheduledWorkOnDate(employee, dateKey))
              .filter((employee) => isEmployeeScheduledToHaveStartedByNow(employee, dateKey, todayDateKey, approvedLeavesByDate.get(dateKey) || []))
              .filter((employee) => !loggedEmployeeIds.has(employee.id))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;
      const absentFromLogsCount =
        hasFullRoster && !isFutureDate && !isHoliday
          ? activeEmployees.filter((employee) => hasScheduledWorkOnDate(employee, dateKey))
              .filter((employee) => isEmployeeScheduledToHaveStartedByNow(employee, dateKey, todayDateKey, approvedLeavesByDate.get(dateKey) || []))
              .filter((employee) => absentLoggedEmployeeIds.has(employee.id))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;
      const absentCount = matchesCountStatusFilter(attendanceStatusFilter, 'absent')
        ? missingLogsAbsentCount + absentFromLogsCount
        : 0;
      const dayOffCount =
        matchesCountStatusFilter(attendanceStatusFilter, 'dayOff') &&
        hasFullRoster && !isFutureDate && !isHoliday
          ? activeEmployees.filter((employee) => isKnownDayOffOnDate(employee, dateKey))
              .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
          : 0;

      return {
        day: cell.day,
        presentCount,
        lateCount,
        incompleteCount,
        outsideScheduleCount,
        holidayCount,
        absentCount,
        dayOffCount,
      } satisfies DayCell;
    });
  }, [
    activeEmployees,
    approvedLeavesByDate,
    approvedLeaveEmployeeIdsByDate,
    approvedOvertimeByDate,
    filteredEmployeeById,
    hasFullRoster,
    hasScheduledWorkOnDate,
    holidayDateSet,
    isKnownDayOffOnDate,
    logsByDate,
    monthIndex,
    scheduledShiftsByEmployeeAndDate,
    attendanceStatusFilter,
    todayDateKey,
    year,
  ]);

  const focusCalendarCells = useMemo(() => {
    if (!focusedEmployee) return [] as EmployeeCalendarCell[];

    return monthCells(year, monthIndex).map((cell) => {
      if (cell.day === null) return { day: null } satisfies EmployeeCalendarCell;

      const dateKey = toISODate(year, monthIndex, cell.day);
      const isFutureDate = dateKey > todayDateKey;
      const hasScheduledWork = hasScheduledWorkOnDate(focusedEmployee, dateKey);
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

      if (isHoliday && matchesCountStatusFilter(attendanceStatusFilter, 'holiday')) {
        notes.push({
          label: holidayNamesByDate[dateKey] ?? (isRegularHoliday ? 'Regular Holiday' : 'Holiday'),
          tone: 'holiday',
        });
        tone ??= 'holiday';
      }

      if (record && matchesRecordStatusFilter(record, attendanceStatusFilter)) {
        if (record.status === 'INCOMPLETE') {
          notes.push({ label: 'Incomplete', tone: 'incomplete' });
          tone ??= 'incomplete';
        } else if (record.status === 'ABSENT') {
          notes.push({ label: 'Absent', tone: 'absent' });
          tone ??= 'absent';
        } else if (record.status === 'OUTSIDE_SCHEDULE') {
          notes.push({ label: 'Outside Schedule', tone: 'outside' });
          tone ??= 'outside';
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
        if (matchesCountStatusFilter(attendanceStatusFilter, 'absent') && hasScheduledWork) {
          notes.push({ label: 'Absent', tone: 'absent' });
          tone ??= 'absent';
        } else if (matchesCountStatusFilter(attendanceStatusFilter, 'dayOff') && isKnownDayOff) {
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
    holidayDateSet,
    holidayNamesByDate,
    hasScheduledWorkOnDate,
    isKnownDayOffOnDate,
    monthIndex,
    attendanceStatusFilter,
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
      scheduledShiftsByEmployeeAndDate,
      groupOvertimeByEmployee(approvedOvertimeByDate.get(selectedDateKey) ?? []),
      holidayDateSet
    );
  }, [approvedOvertimeByDate, filteredEmployeeById, holidayDateSet, logsByDate, scheduledShiftsByEmployeeAndDate, selectedDateKey]);

  const visibleSelectedRecords = useMemo(
    () => selectedRecords.filter((record) => matchesRecordStatusFilter(record, attendanceStatusFilter)),
    [attendanceStatusFilter, selectedRecords]
  );

  const selectedIsFuture = useMemo(() => {
    return Boolean(selectedDateKey) && selectedDateKey > todayDateKey;
  }, [selectedDateKey, todayDateKey]);

  const selectedIsHoliday = useMemo(() => {
    return Boolean(selectedDateKey) && holidayDateSet.has(selectedDateKey);
  }, [holidayDateSet, selectedDateKey]);

  const selectedIsWorkingDay = useMemo(() => {
    return selectedDateKey ? activeEmployees.some((employee) => hasScheduledWorkOnDate(employee, selectedDateKey)) : true;
  }, [activeEmployees, hasScheduledWorkOnDate, selectedDateKey]);

  const selectedHasKnownDayOffs = useMemo(() => {
    return selectedDateKey ? activeEmployees.some((employee) => isKnownDayOffOnDate(employee, selectedDateKey)) : false;
  }, [activeEmployees, isKnownDayOffOnDate, selectedDateKey]);

  const focusedSelectedLeaves = useMemo(() => {
    if (!selectedDateKey) return [] as LeaveRequest[];
    return focusLeavesByDate.get(selectedDateKey) ?? [];
  }, [focusLeavesByDate, selectedDateKey]);

  const selectedAbsent = useMemo(() => {
    if (!hasFullRoster || selectedIsFuture || !selectedIsWorkingDay || selectedIsHoliday) return [];
    const recordByEmployeeId = new Map(selectedRecords.map((record) => [record.employeeId, record] as const));
    const leaveEmployeeIds = selectedDateKey ? approvedLeaveEmployeeIdsByDate.get(selectedDateKey) ?? new Set<number>() : new Set<number>();
    const absentEmployees = activeEmployees
      .filter((employee) => hasScheduledWorkOnDate(employee, selectedDateKey))
      .filter((employee) => isEmployeeScheduledToHaveStartedByNow(employee, selectedDateKey, todayDateKey, focusLeavesByDate.get(selectedDateKey) || []))
      .filter((employee) => {
        const record = recordByEmployeeId.get(employee.id);
        if (!record) return true;
        return record.status === 'ABSENT';
      })
      .filter((employee) => !leaveEmployeeIds.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    return matchesCountStatusFilter(attendanceStatusFilter, 'absent') ? absentEmployees : [];
  }, [
    activeEmployees,
    attendanceStatusFilter,
    hasScheduledWorkOnDate,
    todayDateKey,
    focusLeavesByDate,
    approvedLeaveEmployeeIdsByDate,
    hasFullRoster,
    selectedDateKey,
    selectedIsFuture,
    selectedIsHoliday,
    selectedIsWorkingDay,
    selectedRecords,
  ]);

  const selectedSummary = useMemo(() => {
    const incomplete = matchesCountStatusFilter(attendanceStatusFilter, 'incomplete')
      ? selectedRecords.filter((record) => record.status === 'INCOMPLETE').length
      : 0;
    const late = matchesCountStatusFilter(attendanceStatusFilter, 'late')
      ? selectedRecords.filter((record) => record.status === 'PRESENT' && record.isLate).length
      : 0;
    const present = matchesCountStatusFilter(attendanceStatusFilter, 'present')
      ? selectedRecords.filter((record) => record.status === 'PRESENT' && !record.isLate).length
      : 0;
    const outsideSchedule = matchesCountStatusFilter(attendanceStatusFilter, 'outside')
      ? selectedRecords.filter((record) => record.status === 'OUTSIDE_SCHEDULE').length
      : 0;
    const leaveEmployeeIds = selectedDateKey ? approvedLeaveEmployeeIdsByDate.get(selectedDateKey) ?? new Set<number>() : new Set<number>();
    const loggedEmployeeIds = new Set(selectedRecords.map((record) => record.employeeId));
    const holidayCount =
      matchesCountStatusFilter(attendanceStatusFilter, 'holiday') &&
      hasFullRoster && !selectedIsFuture && selectedDateKey && selectedIsHoliday
        ? activeEmployees.filter((employee) => !loggedEmployeeIds.has(employee.id))
            .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
        : 0;
    const dayOffCount =
      matchesCountStatusFilter(attendanceStatusFilter, 'dayOff') &&
      hasFullRoster && !selectedIsFuture && selectedDateKey && !selectedIsHoliday
        ? activeEmployees.filter((employee) => isKnownDayOffOnDate(employee, selectedDateKey))
            .filter((employee) => !leaveEmployeeIds.has(employee.id)).length
        : 0;
    return {
      present,
      late,
      incomplete,
      outsideSchedule,
      holiday: holidayCount,
      absent:
        matchesCountStatusFilter(attendanceStatusFilter, 'absent') &&
        hasFullRoster &&
        !selectedIsFuture &&
        selectedIsWorkingDay &&
        !selectedIsHoliday
          ? selectedAbsent.length
          : 0,
      dayOff: !selectedIsWorkingDay ? dayOffCount : 0,
      totalLogs: (logsByDate.get(selectedDateKey) ?? []).length,
    };
  }, [
    activeEmployees,
    attendanceStatusFilter,
    approvedLeaveEmployeeIdsByDate,
    hasFullRoster,
    isKnownDayOffOnDate,
    logsByDate,
    selectedAbsent.length,
    selectedDateKey,
    selectedIsFuture,
    selectedIsHoliday,
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

  async function downloadAttendanceReportInRange() {
    setActionError('');
    setIsExporting(true);

    try {
      const fromDate = new Date(`${exportFromDate}T00:00:00`);
      const toDate = new Date(`${exportToDate}T23:59:59`);

      if (fromDate > toDate) {
        throw new Error('From date cannot be after To date.');
      }

      const exportStart = new Date(exportFromDate);
      exportStart.setDate(exportStart.getDate() - 1);
      const exportDailyShiftStartKey = toISODate(
        exportStart.getFullYear(),
        exportStart.getMonth(),
        exportStart.getDate()
      );
      const exportLogEnd = new Date(`${exportToDate}T00:00:00`);
      exportLogEnd.setDate(exportLogEnd.getDate() + 1);
      exportLogEnd.setHours(NIGHT_SHIFT_REPORT_CUTOFF_HOUR, 0, 0, 0);

      const [logResponse, leaveResponse, holidayResponse, dailyShiftResponse, overtimeResponse] = await Promise.all([
        apiFetchJson<unknown>(
          withParams(logsUrl, {
            page: '0',
            size: '10000',
            timestampAfter: fromDate.toISOString(),
            timestampBefore: exportLogEnd.toISOString(),
          })
        ),
        apiFetchJson<unknown>(
          withParams(leavesUrl, {
            page: '0',
            size: '4000',
            requestStatus: 'APPROVED',
            sort: 'requestId,desc',
          })
        ),
        apiFetchJson<unknown>(
          withParams('/api/holidays', {
            startDate: exportFromDate,
            endDate: exportToDate,
          })
        ),
        apiFetchJson<unknown>(
          withParams('/api/employee/schedule/daily', {
            startDate: exportDailyShiftStartKey,
            endDate: exportToDate,
          })
        ),
        apiFetchJson<unknown>(
          withParams(overtimeEndpoint, {
            page: '0',
            size: '4000',
            requestStatus: 'APPROVED',
          })
        ),
      ]);

      const exportLogs = toArray<AttendanceLog>(logResponse);
      const exportApprovedLeaves = toArray<LeaveRequest>(leaveResponse).filter((request) => {
        const employeeId = Number(request.empId);
        const startKey = localDateKey(request.startDateTime);
        const endKey = localDateKey(request.endDateTime);
        return (
          Number.isFinite(employeeId) &&
          filteredEmployeeIdSet.has(employeeId) &&
          Boolean(startKey) &&
          Boolean(endKey) &&
          startKey <= exportToDate &&
          endKey >= exportFromDate &&
          String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
        );
      });
      const exportHolidays = parseHolidayLookup(holidayResponse);
      const exportHolidayDateSet = new Set(exportHolidays.holidayDates);
      const exportDailyShifts = toArray<DailyShift>(dailyShiftResponse);
      const exportApprovedOvertime = toArray<OvertimeRequest>(overtimeResponse).filter((request) => {
        const employeeId = Number(request.employeeId);
        const workDateKey = localDateKey(request.workDate);
        return (
          Number.isFinite(employeeId) &&
          filteredEmployeeIdSet.has(employeeId) &&
          Boolean(workDateKey) &&
          workDateKey >= exportFromDate &&
          workDateKey <= exportToDate &&
          String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
        );
      });
      const overnightWindows = buildOvernightShiftWindows(exportDailyShifts, filteredEmployeeIdSet);
      const exportShiftIndexes = buildDailyShiftExportIndexes(exportDailyShifts, filteredEmployeeIdSet);
      const exportOvertimeIndex = buildOvertimeExportIndex(exportApprovedOvertime, filteredEmployeeIdSet);
      const exportLogsByDate = new Map<string, AttendanceLog[]>();
      const exportApprovedLeavesByDate = new Map<string, LeaveRequest[]>();
      const exportApprovedOvertimeByDate = new Map<string, OvertimeRequest[]>();
      const exportApprovedLeaveEmployeeIdsByDate = new Map<string, Set<number>>();

      for (const log of exportLogs) {
        if (typeof log.employeeId !== 'number' || !filteredEmployeeIdSet.has(log.employeeId)) continue;
        const key = resolveAttendanceReportDateKey(log, overnightWindows);
        if (!key || key < exportFromDate || key > exportToDate) continue;
        const current = exportLogsByDate.get(key) ?? [];
        current.push(log);
        exportLogsByDate.set(key, current);
      }

      for (const request of exportApprovedLeaves) {
        const employeeId = Number(request.empId);
        const startKey = localDateKey(request.startDateTime);
        const endKey = localDateKey(request.endDateTime);
        if (!Number.isFinite(employeeId) || !startKey || !endKey) continue;

        const rangeStart = startKey > exportFromDate ? startKey : exportFromDate;
        const rangeEnd = endKey < exportToDate ? endKey : exportToDate;
        for (const dateKey of dateKeysBetween(rangeStart, rangeEnd)) {
          const current = exportApprovedLeavesByDate.get(dateKey) ?? [];
          current.push(request);
          exportApprovedLeavesByDate.set(dateKey, current);
        }
      }

      for (const [dateKey, requests] of exportApprovedLeavesByDate.entries()) {
        exportApprovedLeaveEmployeeIdsByDate.set(
          dateKey,
          new Set(
            requests
              .map((request) => Number(request.empId))
              .filter((employeeId) => Number.isFinite(employeeId))
          )
        );
      }

      for (const request of exportApprovedOvertime) {
        const dateKey = localDateKey(request.workDate);
        if (!dateKey) continue;
        const current = exportApprovedOvertimeByDate.get(dateKey) ?? [];
        current.push(request);
        exportApprovedOvertimeByDate.set(dateKey, current);
      }

      const exportRecordsByDate = new Map<string, Map<number, DailyEmployeeRecord>>();
      for (const dateKey of dateKeysBetween(exportFromDate, exportToDate)) {
        const records = buildDailyRecords(
          exportLogsByDate.get(dateKey) ?? [],
          filteredEmployeeById,
          dateKey,
          exportShiftIndexes.dailyShiftsByEmployeeAndDate,
          groupOvertimeByEmployee(exportApprovedOvertimeByDate.get(dateKey) ?? []),
          exportHolidayDateSet
        );
        exportRecordsByDate.set(
          dateKey,
          new Map(records.map((record) => [record.employeeId, record]))
        );
      }

      const detailRows: AttendanceExportRow[] = [];

      for (const employee of activeEmployees) {
        for (const dateKey of dateKeysBetween(exportFromDate, exportToDate)) {
          if (!isEmployeeActiveOnDate(employee, dateKey)) continue;
          if (exportHolidayDateSet.has(dateKey)) continue;
          if (exportApprovedLeaveEmployeeIdsByDate.get(dateKey)?.has(employee.id)) continue;
          const hasScheduledShift = hasDailyShiftOnDateForExport(exportShiftIndexes, employee, dateKey);
          const hasApprovedOvertime = hasApprovedOvertimeOnDateForExport(exportOvertimeIndex, employee.id, dateKey);
          if (isKnownDayOffOnDateForExport(exportShiftIndexes, employee, dateKey) && !hasApprovedOvertime) continue;
          if (!hasScheduledShift && !hasApprovedOvertime) continue;

          const record = exportRecordsByDate.get(dateKey)?.get(employee.id);
          if (
            !record &&
            hasScheduledShift &&
            !hasScheduledShiftStartedForExport(exportShiftIndexes, employee.id, dateKey, todayDateKey)
          ) {
            continue;
          }

          const status = classifyAttendanceExportStatus(record);
          const scheduledWindow = hasScheduledShift
            ? resolveScheduledWindowForExport(exportShiftIndexes, employee.id, dateKey)
            : resolveOvertimeWindowForExport(exportOvertimeIndex, employee.id, dateKey);
          detailRows.push({
            employeeId: String(employee.id),
            employeeName: employee.name,
            date: dateKey,
            timeIn: record?.inTime ?? '',
            timeOut: record?.outTime ?? '',
            department: resolveDepartmentLabel(employee),
            position: employee.position,
            scheduledStart: scheduledWindow.start,
            scheduledEnd: scheduledWindow.end,
            status,
            late: record?.isLate ? 'YES' : 'NO',
            earlyOut: record?.isEarlyOut ? 'YES' : 'NO',
            lateMinutes: String(record?.lateMinutes ?? 0),
            earlyOutMinutes: String(record?.earlyOutMinutes ?? 0),
          });
        }
      }

      detailRows.sort((a, b) => {
        const aId = Number(a.employeeId);
        const bId = Number(b.employeeId);
        if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return aId - bId;
        const idDiff = a.employeeId.localeCompare(b.employeeId);
        if (idDiff !== 0) return idDiff;
        return a.date.localeCompare(b.date);
      });

      const summaryByEmployee = new Map<string, AttendanceExportSummaryRow>();
      for (const row of detailRows) {
        const current = summaryByEmployee.get(row.employeeId) ?? {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          department: row.department,
          position: row.position,
          evaluatedDays: 0,
          presentDays: 0,
          lateDays: 0,
          earlyOutDays: 0,
          incompleteDays: 0,
          absentDays: 0,
          outsideScheduleDays: 0,
          totalLateMinutes: 0,
          totalEarlyOutMinutes: 0,
        };

        current.evaluatedDays += 1;
        if (row.status === 'PRESENT') {
          current.presentDays += 1;
          if (row.late === 'YES') current.lateDays += 1;
          if (row.earlyOut === 'YES') current.earlyOutDays += 1;
          current.totalLateMinutes += Number(row.lateMinutes) || 0;
          current.totalEarlyOutMinutes += Number(row.earlyOutMinutes) || 0;
        } else if (row.status === 'INCOMPLETE') {
          current.incompleteDays += 1;
        } else if (row.status === 'ABSENT') {
          current.absentDays += 1;
        } else if (row.status === 'OUTSIDE_SCHEDULE') {
          current.outsideScheduleDays += 1;
        }
        summaryByEmployee.set(row.employeeId, current);
      }

      const summaryRows = [...summaryByEmployee.values()].sort((a, b) => {
        const aId = Number(a.employeeId);
        const bId = Number(b.employeeId);
        if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return aId - bId;
        return a.employeeName.localeCompare(b.employeeName);
      });

      const totals = summaryRows.reduce(
        (current, row) => ({
          evaluatedDays: current.evaluatedDays + row.evaluatedDays,
          presentDays: current.presentDays + row.presentDays,
          lateDays: current.lateDays + row.lateDays,
          earlyOutDays: current.earlyOutDays + row.earlyOutDays,
          incompleteDays: current.incompleteDays + row.incompleteDays,
          absentDays: current.absentDays + row.absentDays,
          outsideScheduleDays: current.outsideScheduleDays + row.outsideScheduleDays,
          totalLateMinutes: current.totalLateMinutes + row.totalLateMinutes,
          totalEarlyOutMinutes: current.totalEarlyOutMinutes + row.totalEarlyOutMinutes,
        }),
        {
          evaluatedDays: 0,
          presentDays: 0,
          lateDays: 0,
          earlyOutDays: 0,
          incompleteDays: 0,
          absentDays: 0,
          outsideScheduleDays: 0,
          totalLateMinutes: 0,
          totalEarlyOutMinutes: 0,
        }
      );

      const csv = buildCsvContent([
        [ATTENDANCE_SUMMARY_MARKER],
        [
          'Employee ID',
          'Employee Name',
          'Department',
          'Position',
          'Evaluated Days',
          'Present Days',
          'Late Days',
          'Early Out Days',
          'Incomplete Days',
          'Absent Days',
          'Outside Schedule Days',
          'Total Late Minutes',
          'Total Early Out Minutes',
        ],
        ...summaryRows.map((row) => [
          row.employeeId,
          row.employeeName,
          row.department,
          row.position,
          String(row.evaluatedDays),
          String(row.presentDays),
          String(row.lateDays),
          String(row.earlyOutDays),
          String(row.incompleteDays),
          String(row.absentDays),
          String(row.outsideScheduleDays),
          String(row.totalLateMinutes),
          String(row.totalEarlyOutMinutes),
        ]),
        [
          'TOTAL',
          '',
          '',
          '',
          String(totals.evaluatedDays),
          String(totals.presentDays),
          String(totals.lateDays),
          String(totals.earlyOutDays),
          String(totals.incompleteDays),
          String(totals.absentDays),
          String(totals.outsideScheduleDays),
          String(totals.totalLateMinutes),
          String(totals.totalEarlyOutMinutes),
        ],
        [],
        [
          'Employee ID',
          'Employee Name',
          'Date',
          'Time In',
          'Time Out',
          'Department',
          'Position',
          'Scheduled Start',
          'Scheduled End',
          'Status',
          'Late',
          'Early Out',
          'Late Minutes',
          'Early Out Minutes',
        ],
        ...detailRows.map((row) => [
          row.employeeId,
          row.employeeName,
          row.date,
          row.timeIn,
          row.timeOut,
          row.department,
          row.position,
          row.scheduledStart,
          row.scheduledEnd,
          row.status,
          row.late,
          row.earlyOut,
          row.lateMinutes,
          row.earlyOutMinutes,
        ]),
      ]);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-report-${exportFromDate}-to-${exportToDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  const attendanceReportDescription =
    descriptionOverride ?? (
      audienceLabel === 'Manager'
        ? undefined
        : 'Review daily attendance activity, late entries, incomplete logs, and gaps in one monthly calendar.'
    );
  const canImport = audienceLabel === 'HR';
  const importIssues = toArray<AttendanceImportIssue>(importSummary?.issues);
  const selectedDetailSubtitle = selectedIsHoliday
    ? `${selectedHolidayName} is observed on this date, so employees without logs are not counted as absent or day off.`
    : !selectedIsWorkingDay && !selectedHasKnownDayOffs
      ? 'This date has no scheduled work, so absences are not evaluated.'
      : 'Inspect the daily attendance summary, logged employees, and missing logs for the selected date.';

  useErrorDialogEffect(loadError, 'Attendance report could not be loaded');
  useErrorDialogEffect(actionError, 'Attendance report action could not be completed');
  useEscapeDismiss(detailOpen, () => setDetailOpen(false), 10);
  useEscapeDismiss(importDialogOpen, closeImportDialog, 11);
  useEscapeDismiss(actionMenuOpen, () => setActionMenuOpen(false), 12);
  useEscapeDismiss(exportDialogOpen, () => setExportDialogOpen(false), 13);

  return (
    <div className="hrAtt">
      <div className="hrAtt__head">
        <PageHeader title="Attendance Report" description={attendanceReportDescription} />
      </div>

      <AttendanceReportToolbar
        actionMenuOpen={actionMenuOpen}
        actionMenuRef={actionMenuRef}
        activeFilterCount={activeFilterCount}
        attendanceStatusFilter={attendanceStatusFilter}
        canImport={canImport}
        departmentFilter={departmentFilter}
        departmentOptions={departmentOptions}
        exportDisabled={isLoading || isExporting || Boolean(loadError)}
        exportLoading={isExporting}
        filterOpen={filterOpen}
        filterRef={filterRef}
        importDisabled={isLoading || isImporting}
        importLoading={isImporting}
        onClearFilters={clearFilters}
        onClearSearch={() => setSearchValue('')}
        onAttendanceStatusFilterChange={setAttendanceStatusFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        onOpenExport={() => {
          setActionMenuOpen(false);
          setExportDialogOpen(true);
        }}
        onOpenImport={() => {
          setActionError('');
          setImportSubmitAttempted(false);
          setImportDialogOpen(true);
          setActionMenuOpen(false);
        }}
        onSearchChange={setSearchValue}
        onToggleActionMenu={() => {
          setActionMenuOpen((open) => !open);
          setFilterOpen(false);
        }}
        onToggleFilter={() => {
          setFilterOpen((open) => !open);
          setActionMenuOpen(false);
        }}
        searchValue={searchValue}
        shouldShowDepartmentFilter={shouldShowDepartmentFilter}
      />

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

            <div className="uCalendarMonthPicker uCalendarMonthPicker--minimal">
              <span>{monthLabel}</span>
              <FiChevronRight style={{ transform: 'rotate(90deg)' }} />
              <select
                value={monthValue}
                onChange={(e) => {
                  setMonthValue(e.target.value);
                  parseMonthValue(e.target.value);
                }}
              >
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

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
            <div className="uEmptyState">
              No employees matched this view. Try clearing the employee search or switching the department filter back to all departments.
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
                    const showHolidayIndicator = isHoliday && matchesCountStatusFilter(attendanceStatusFilter, 'holiday');
                    const showIndicators = showAttendanceIndicators || showHolidayIndicator;
                    const hasAttention =
                      showAttendanceIndicators &&
                      (
                        cell.lateCount > 0 ||
                        cell.incompleteCount > 0 ||
                        cell.outsideScheduleCount > 0 ||
                        (cell.absentCount ?? 0) > 0
                      );
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
                            {showAttendanceIndicators && cell.outsideScheduleCount > 0 && (
                              <div className="hrCal__stat hrCal__stat--outside">
                                <span>Outside Schedule</span>
                                <strong>{cell.outsideScheduleCount}</strong>
                              </div>
                            )}
                            {showHolidayIndicator && (
                              <div className="hrCal__stat hrCal__stat--holiday">
                                <span>{holidayNamesByDate[dateKey] ?? 'Holiday'}</span>
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
      {importDialogOpen && (
        <LargePopup
          open
          ariaLabel="Import attendance CSV"
          title="Import Attendance CSV"
          subtitle="Upload a CSV exported from this attendance report. The import expects Employee ID, Employee Name, Date, Time In, Time Out as the leading columns, allows extra export columns, and ignores the trailing summary section."
          size="lg"
          onClose={closeImportDialog}
          footer={(
            <>
              <button type="button" className="btn btn--ghost" onClick={closeImportDialog} disabled={isImporting}>
                Close
              </button>
              <button type="button" className="btn" onClick={() => void importAttendanceReport()} disabled={isImporting}>
                <FiUpload aria-hidden="true" />
                <span>{isImporting ? 'Importing CSV...' : 'Import Attendance (CSV)'}</span>
              </button>
            </>
          )}
        >
          <div className="hrAttModal hrAttModal--import">
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
        </LargePopup>
      )}

      {detailOpen && (
        <LargePopup
          open
          ariaLabel="Attendance breakdown"
          title={selectedDateLabel}
          subtitle={selectedDetailSubtitle}
          size="lg"
          onClose={() => setDetailOpen(false)}
          footer={(
            <button type="button" className="btn btn--ghost" onClick={() => setDetailOpen(false)}>
              Close
            </button>
          )}
        >
          <>
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
                <span>Outside Schedule</span>
                <strong>{selectedSummary.outsideSchedule}</strong>
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
                <div className="hrAttBreakdown__head">
                  <div className="hrAttBreakdown__title">
                    <FiUsers />
                    Logged Employees
                  </div>
                  <span className="hrAttBreakdown__count">{visibleSelectedRecords.length}</span>
                </div>

                <div className="hrAttBreakdown__list">
                  {visibleSelectedRecords.length > 0 ? (
                    visibleSelectedRecords.map((record) => {
                      const badge = attendanceBadgeForRecord(record);
                      const employee = filteredEmployeeById.get(record.employeeId);
                      const metaLine = formatEmployeeMetaLine(
                        record.position,
                        employee ? resolveDepartmentLabel(employee) : ''
                      );

                      return (
                        <article key={`${selectedDateKey}-${record.employeeId}`} className="hrAttPerson">
                          <div className="hrAttPerson__avatar" aria-hidden="true">
                            {record.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="hrAttPerson__body">
                            <div className="hrAttPerson__topLine">
                              <div className="hrAttPerson__identity">
                                <div className="hrAttPerson__name">{record.name}</div>
                                {metaLine ? <div className="hrAttPerson__meta">{metaLine}</div> : null}
                              </div>
                              <div className="hrAttPerson__badgeWrap">
                                <div className={`hrAttPerson__badge ${badge.toneClass}`}>{badge.label}</div>
                              </div>
                            </div>

                            {record.logs.length > 0 && (
                              <div className="hrAttPerson__logs">
                                <div className="hrAttPerson__logList">
                                  {record.logs.map((log, index) => (
                                    <div
                                      key={`${selectedDateKey}-${record.employeeId}-${String(log.attendanceId)}-${index}`}
                                      className="hrAttPerson__logItem"
                                    >
                                      <span>{log.directionLabel}</span>
                                      <strong>{log.time}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : selectedIsFuture ? (
                    <div className="hrAttBreakdown__empty">This date has not happened yet.</div>
                  ) : attendanceStatusFilter !== 'all' ? (
                    <div className="hrAttBreakdown__empty">No attendance entries matched the selected status filter for this day.</div>
                  ) : (
                    <div className="hrAttBreakdown__empty">No attendance logs recorded for this day.</div>
                  )}
                </div>
              </section>

              {hasFullRoster && (
                <section className="hrAttBreakdown__section">
                  <div className="hrAttBreakdown__head">
                    <div className="hrAttBreakdown__title">
                      <FiCalendar />
                      No Logs Recorded
                    </div>
                    <span className="hrAttBreakdown__count">{selectedAbsent.length}</span>
                  </div>

                  <div className="hrAttBreakdown__list">
                    {selectedAbsent.length > 0 ? (
                      selectedAbsent.map((employee) => (
                        <article key={`absent-${selectedDateKey}-${employee.id}`} className="hrAttPerson hrAttPerson--soft">
                          <div className="hrAttPerson__avatar" aria-hidden="true">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="hrAttPerson__body">
                            <div className="hrAttPerson__identity">
                              <div className="hrAttPerson__name">{employee.name}</div>
                              <div className="hrAttPerson__meta">
                                {formatEmployeeMetaLine(employee.position, resolveDepartmentLabel(employee))}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : selectedIsFuture ? (
                      <div className="hrAttBreakdown__empty">Absent employees will only be shown after this date passes.</div>
                    ) : attendanceStatusFilter !== 'all' && attendanceStatusFilter !== 'absent' ? (
                      <div className="hrAttBreakdown__empty">Switch the status filter to Absent to review employees with no logs for this day.</div>
                    ) : focusedEmployee && focusedSelectedLeaves.length > 0 ? (
                      <div className="hrAttBreakdown__empty">
                        {focusedEmployee.name} is covered by an approved leave request for this day.
                      </div>
                    ) : selectedIsHoliday ? (
                      <div className="hrAttBreakdown__empty">{`${selectedHolidayName} is observed on this date, so no absences are expected.`}</div>
                    ) : selectedHasKnownDayOffs ? (
                      <div className="hrAttBreakdown__empty">This date is treated as a scheduled day off.</div>
                    ) : !selectedIsWorkingDay ? (
                      <div className="hrAttBreakdown__empty">
                        No scheduled work applies to this date, so absences are not evaluated.
                      </div>
                    ) : (
                      <div className="hrAttBreakdown__empty">All active employees recorded attendance for this day.</div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </>
        </LargePopup>
      )}

      {exportDialogOpen && (
        <LargePopup
          open
          ariaLabel="Export attendance CSV"
          title="Export Attendance"
          subtitle="Select a date range to export the attendance summary for all currently filtered employees."
          size="lg"
          onClose={() => setExportDialogOpen(false)}
          dismissOnBackdrop
          footer={(
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void downloadAttendanceReportInRange()}
                disabled={isExporting}
              >
                <FiDownload aria-hidden="true" />
                <span>{isExporting ? 'Preparing CSV...' : 'Download CSV'}</span>
              </button>
            </>
          )}
        >
          <div className="hrAttModal hrAttModal--export">
            <div className="hrAttExportForm">
              <div className="hrAttExportForm__grid">
                <label className="hrAttExportForm__field">
                  <span>From Date</span>
                  <input
                    type="date"
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                  />
                </label>
                <label className="hrAttExportForm__field">
                  <span>To Date</span>
                  <input
                    type="date"
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
        </LargePopup>
      )}
    </div>
  );
}
