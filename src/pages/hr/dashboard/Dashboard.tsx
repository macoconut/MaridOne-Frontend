import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar } from 'react-icons/fi';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import './Dashboard.css';

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
  isPaid?: boolean;
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
};

type FeedItem = {
  id: string;
  name: string;
  directionLabel: string;
  directionTone: 'in' | 'out' | 'late' | 'neutral';
  position: string;
  time: string;
};

type LeaveCardItem = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  period: string;
};

type DepartmentBreakdownItem = {
  id: string;
  name: string;
  headcount: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  dayOff: number;
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

type HolidayLookupPayload = {
  holidayDates?: string[];
  regularHolidayDates?: string[];
};

type WeeklyAttendanceItem = {
  id: string;
  dateKey: string;
  dayLabel: string;
  dateLabel: string;
  summary: AttendanceStatusSummary;
};

type AttendanceOverviewDashboardProps = {
  audience?: string;
  logsUrl?: string;
  leavesUrl?: string;
  rosterUrl?: string;
  feedWindowDays?: number;
  primaryPanelMode?: 'department' | 'weekly';
  feedScope?: 'window' | 'selected-date';
  feedTitleOverride?: string;
  feedTimeDisplay?: 'auto' | 'time-only';
  descriptionOverride?: string;
  weeklyWindowAnchor?: 'today' | 'selected-date';
  weeklyWindowIncludesSelectedDate?: boolean;
};

type AttendanceStatusKey = 'present' | 'late' | 'absent' | 'onLeave' | 'dayOff';

type AttendanceStatusTone = 't1' | 't2' | 't3' | 't4' | 't5';

type AttendanceStatusSummary = Record<AttendanceStatusKey, number> & {
  headcount: number;
};

type DonutPoint = {
  key: AttendanceStatusKey;
  label: string;
  value: number;
  share: number;
  tone: AttendanceStatusTone;
};

const STATUS_CONFIG: Record<
  AttendanceStatusKey,
  { label: string; tone: AttendanceStatusTone; color: string }
> = {
  present: { label: 'Present', tone: 't1', color: '#b83573' },
  late: { label: 'Late', tone: 't2', color: '#ef6b9c' },
  absent: { label: 'Absent', tone: 't3', color: '#f2a6a8' },
  onLeave: { label: 'On Leave', tone: 't4', color: '#deb0ba' },
  dayOff: { label: 'Day Off', tone: 't5', color: '#e5d8de' },
};

const DEFAULT_WORKING_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const DEPARTMENTS_PER_PAGE = 2;
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function localDateKey(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(
    2,
    '0'
  )}`;
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

function formatLongDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDateLabel(date: Date) {
  const month = date.toLocaleDateString(undefined, { month: 'short' }).replace(/\.$/, '');
  return `${month}. ${date.getDate()}`;
}

function formatFeedTimestamp(value?: string, includeDate = false) {
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

function formatPeriodLabel(start?: string, end?: string) {
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

function isTodayWithin(start?: string, end?: string, today = new Date()) {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

  return startDate.getTime() <= dayEnd && endDate.getTime() >= dayStart;
}

function withPaging(path: string, page: number, size: number) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&size=${size}`;
}

function withParams(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${query}`;
}

function employeeName(employee: EmployeeRow | undefined) {
  return employee?.name || 'Employee record unavailable';
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

function isInDirection(direction?: string) {
  const value = String(direction ?? '').toUpperCase();
  return value.includes('IN') || value.includes('LATE');
}

function isLateDirection(direction?: string) {
  return String(direction ?? '')
    .toUpperCase()
    .includes('LATE');
}

function isLateForSchedule(
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

function isOutDirection(direction?: string) {
  return String(direction ?? '').toUpperCase().includes('OUT');
}

function localTimeLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        ? isLateForSchedule(
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
        name: employeeName(employee),
        position: employee?.position || 'Position unavailable',
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

function directionIndicator(direction?: string): FeedItem['directionLabel'] {
  const value = String(direction ?? '').toUpperCase();
  if (value.includes('OUT')) return 'OUT';
  if (value.includes('LATE')) return 'LATE';
  if (value.includes('IN')) return 'IN';
  return 'LOG';
}

function directionIndicatorTone(direction?: string): FeedItem['directionTone'] {
  const value = String(direction ?? '').toUpperCase();
  if (value.includes('OUT')) return 'out';
  if (value.includes('LATE')) return 'late';
  if (value.includes('IN')) return 'in';
  return 'neutral';
}

function rosterDisplayName(row: Record<string, unknown>) {
  const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : '';
  const middleName = typeof row.middleName === 'string' ? row.middleName.trim() : '';
  const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
  const givenNames = [firstName, middleName].filter((part) => part.length > 0).join(' ');
  const label = [lastName, givenNames].filter((part) => part.length > 0).join(', ');
  return label || 'Employee record unavailable';
}

function rosterRows(payload: unknown) {
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

function resolveDepartmentLabel(employee: EmployeeRow) {
  const value = String(employee.department ?? '').trim();
  if (value) return value;

  switch (employee.position.toUpperCase()) {
    case 'HR':
      return 'HR';
    case 'ACCOUNTING':
      return 'Accounting';
    case 'MANAGEMENT':
      return 'Management';
    default:
      return 'Unassigned';
  }
}

function buildAttendanceSummary(
  employeeIds: number[],
  presentSet: Set<number>,
  lateSet: Set<number>,
  onLeaveSet: Set<number>,
  employeeById: Map<number, EmployeeRow>,
  dateKey: string,
  isHoliday: boolean
) {
  const summary: AttendanceStatusSummary = {
    headcount: employeeIds.length,
    present: 0,
    late: 0,
    absent: 0,
    onLeave: 0,
    dayOff: 0,
  };

  for (const employeeId of employeeIds) {
    const employee = employeeById.get(employeeId);
    const isScheduled = isEmployeeScheduledOnDate(employee, dateKey);

    if (lateSet.has(employeeId)) {
      summary.late += 1;
      continue;
    }

    if (presentSet.has(employeeId)) {
      summary.present += 1;
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

    if (!isScheduled) {
      summary.dayOff += 1;
      continue;
    }

    summary.absent += 1;
  }

  return summary;
}

function buildOnLeaveSetForDate(leaveRequests: LeaveRequest[], date: Date) {
  const ids = new Set<number>();

  for (const request of leaveRequests) {
    if (typeof request.empId !== 'number') continue;
    if (String(request.requestStatus ?? '').toUpperCase() !== 'APPROVED') continue;
    if (!isTodayWithin(request.startDateTime, request.endDateTime, date)) continue;
    ids.add(request.empId);
  }

  return ids;
}

function donutPoints(summary: AttendanceStatusSummary) {
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

function buildDonutBackground(points: DonutPoint[]) {
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

export default function HrDashboard() {
  return <AttendanceOverviewDashboard audience="HR" />;
}

export function AttendanceOverviewDashboard({
  audience = 'HR',
  logsUrl = '/api/logs/attendance',
  leavesUrl = '/api/leave/request',
  rosterUrl = '/api/employees',
  feedWindowDays = 1,
  primaryPanelMode = 'department',
  feedScope = 'window',
  feedTitleOverride,
  feedTimeDisplay = 'auto',
  descriptionOverride,
  weeklyWindowAnchor = 'today',
  weeklyWindowIncludesSelectedDate = true,
}: AttendanceOverviewDashboardProps) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const todayDate = useMemo(() => dateFromKey(todayKey), [todayKey]);
  const includeWeeklyFeed = feedWindowDays > 1;
  const isWeeklyPrimaryPanel = primaryPanelMode === 'weekly';
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [feedLogs, setFeedLogs] = useState<AttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [holidayDateKeys, setHolidayDateKeys] = useState<string[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  useErrorDialogEffect(loadError, 'HR dashboard attendance logs could not be loaded');
  const [deptPage, setDeptPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [feedPanelHeight, setFeedPanelHeight] = useState<number | null>(null);
  const mainColRef = useRef<HTMLDivElement | null>(null);
  const silentRefreshRef = useRef(false);
  const effectiveSelectedDateKey = selectedDateKey && selectedDateKey <= todayKey ? selectedDateKey : todayKey;
  const selectedDate = useMemo(() => dateFromKey(effectiveSelectedDateKey), [effectiveSelectedDateKey]);
  const isSelectedDateToday = effectiveSelectedDateKey === todayKey;
  const selectedDateHeading = useMemo(() => formatLongDateLabel(selectedDate), [selectedDate]);
  const selectedDateShortLabel = useMemo(() => formatShortDateLabel(selectedDate), [selectedDate]);
  const weeklyWindowAnchorDate = useMemo(() => {
    if (!includeWeeklyFeed) return selectedDate;
    return weeklyWindowAnchor === 'selected-date' ? selectedDate : todayDate;
  }, [includeWeeklyFeed, selectedDate, todayDate, weeklyWindowAnchor]);
  const feedStartDate = useMemo(() => {
    if (!includeWeeklyFeed) {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    const start = new Date(weeklyWindowAnchorDate);
    if (!weeklyWindowIncludesSelectedDate) {
      start.setDate(start.getDate() - 1);
    }
    start.setDate(start.getDate() - Math.max(feedWindowDays - 1, 0));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [
    feedWindowDays,
    includeWeeklyFeed,
    selectedDate,
    weeklyWindowAnchorDate,
    weeklyWindowIncludesSelectedDate,
  ]);
  const feedEndDate = useMemo(() => {
    if (!includeWeeklyFeed) {
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return end;
    }

    const end = new Date(weeklyWindowAnchorDate);
    if (!weeklyWindowIncludesSelectedDate) {
      end.setDate(end.getDate() - 1);
    }
    end.setHours(23, 59, 59, 999);
    return end;
  }, [includeWeeklyFeed, selectedDate, weeklyWindowAnchorDate, weeklyWindowIncludesSelectedDate]);
  const feedStartDateKey = useMemo(() => toDateKey(feedStartDate), [feedStartDate]);
  const feedEndDateKey = useMemo(() => toDateKey(feedEndDate), [feedEndDate]);
  const holidayLookupStartKey = useMemo(
    () => (feedStartDateKey < effectiveSelectedDateKey ? feedStartDateKey : effectiveSelectedDateKey),
    [effectiveSelectedDateKey, feedStartDateKey]
  );
  const holidayLookupEndKey = useMemo(
    () => (feedEndDateKey > effectiveSelectedDateKey ? feedEndDateKey : effectiveSelectedDateKey),
    [effectiveSelectedDateKey, feedEndDateKey]
  );
  const feedRangeLabel = useMemo(() => {
    if (!includeWeeklyFeed) return formatLongDateLabel(selectedDate);
    return `${formatDateLabel(feedStartDate.toISOString())} to ${formatDateLabel(feedEndDate.toISOString())}`;
  }, [feedEndDate, feedStartDate, includeWeeklyFeed, selectedDate]);
  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  function shiftSelectedDate(days: number) {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
      next.getDate()
    ).padStart(2, '0')}`;
    if (nextKey > todayKey) return;
    setSelectedDateKey(nextKey);
  }

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    const element = mainColRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateHeight = () => {
      setFeedPanelHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      const isSilentRefresh = silentRefreshRef.current;
      if (!isSilentRefresh) {
        setLoadError(null);
      }

      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      const [logsResult, feedLogsResult, leavesResult, rosterResult, holidayResult] = await Promise.allSettled([
        apiFetchJson<unknown>(
          withParams(logsUrl, {
            page: '0',
            size: '5000',
            timestampAfter: dayStart.toISOString(),
            timestampBefore: dayEnd.toISOString(),
          })
        ),
        apiFetchJson<unknown>(
          withParams(logsUrl, {
            page: '0',
            size: '5000',
            timestampAfter: feedStartDate.toISOString(),
            timestampBefore: feedEndDate.toISOString(),
          })
        ),
        apiFetchJson<unknown>(withPaging(leavesUrl, 0, 200)),
        rosterUrl ? apiFetchJson<unknown>(withPaging(rosterUrl, 0, 500)) : Promise.resolve([]),
        apiFetchJson<unknown>(
          withParams('/api/holidays', {
            startDate: holidayLookupStartKey,
            endDate: holidayLookupEndKey,
          })
        ),
      ]);

      if (cancelled) return;

      if (logsResult.status === 'fulfilled') {
        setLogs(toArray<AttendanceLog>(logsResult.value));
        setLoadError(null);
      } else if (!isSilentRefresh) {
        setLogs([]);
        setLoadError(logsResult.reason instanceof Error ? logsResult.reason.message : 'Failed to load attendance logs.');
      }

      if (feedLogsResult.status === 'fulfilled') {
        setFeedLogs(toArray<AttendanceLog>(feedLogsResult.value));
      } else if (!isSilentRefresh) {
        setFeedLogs([]);
      }

      if (leavesResult.status === 'fulfilled') {
        setLeaveRequests(toArray<LeaveRequest>(leavesResult.value));
      } else if (!isSilentRefresh) {
        setLeaveRequests([]);
      }

      if (rosterResult.status === 'fulfilled') {
        setEmployees(rosterRows(rosterResult.value).filter((row) => Number.isFinite(row.id)));
      } else if (!isSilentRefresh) {
        setEmployees([]);
      }

      if (holidayResult.status === 'fulfilled') {
        setHolidayDateKeys(parseHolidayLookup(holidayResult.value).holidayDates);
      } else if (!isSilentRefresh) {
        setHolidayDateKeys([]);
      }

      silentRefreshRef.current = false;
    }

    void fetchDashboardData();

    return () => {
      cancelled = true;
      silentRefreshRef.current = false;
    };
  }, [
    effectiveSelectedDateKey,
    feedEndDate,
    feedStartDate,
    holidayLookupEndKey,
    holidayLookupStartKey,
    leavesUrl,
    logsUrl,
    refreshTick,
    rosterUrl,
    selectedDate,
  ]);

  const employeeById = useMemo(() => {
    const map = new Map<number, EmployeeRow>();
    for (const employee of employees) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employees]);

  const holidayDateSet = useMemo(() => new Set(holidayDateKeys), [holidayDateKeys]);
  const selectedIsHoliday = holidayDateSet.has(effectiveSelectedDateKey);

  const selectedDateLogs = useMemo(() => {
    return logs.filter((log) => {
      if (localDateKey(log.timestamp) !== effectiveSelectedDateKey) return false;
      const employee = employeeById.get(log.employeeId ?? -1);
      return String(employee?.status ?? '').toUpperCase() !== 'TERMINATED';
    });
  }, [effectiveSelectedDateKey, employeeById, logs]);

  const selectedApprovedLeaves = useMemo(() => {
    return leaveRequests.filter((request) => {
      if (String(request.requestStatus ?? '').toUpperCase() !== 'APPROVED') return false;
      return isTodayWithin(request.startDateTime, request.endDateTime, selectedDate);
    });
  }, [leaveRequests, selectedDate]);

  const selectedLeaveRequestsByEmployee = useMemo(
    () => groupLeavesByEmployee(selectedApprovedLeaves),
    [selectedApprovedLeaves]
  );

  const dailyRecords = useMemo(
    () =>
      buildDailyRecords(
        selectedDateLogs,
        employeeById,
        effectiveSelectedDateKey,
        selectedLeaveRequestsByEmployee,
        holidayDateSet
      ),
    [effectiveSelectedDateKey, employeeById, holidayDateSet, selectedDateLogs, selectedLeaveRequestsByEmployee]
  );

  const loggedEmployeeIds = useMemo(() => new Set(dailyRecords.map((record) => record.employeeId)), [dailyRecords]);

  const lateSet = useMemo(
    () =>
      new Set(
        dailyRecords
          .filter((record) => record.isLate)
          .map((record) => record.employeeId)
      ),
    [dailyRecords]
  );

  const presentSet = useMemo(
    () =>
      new Set(
        dailyRecords
          .filter((record) => !record.isLate)
          .map((record) => record.employeeId)
      ),
    [dailyRecords]
  );

  const lateClockInByEmployee = useMemo(
    () =>
      new Map(
        dailyRecords
          .filter((record) => record.isLate)
          .map((record) => [record.employeeId, record.inTime || 'Late clock-in logged'])
      ),
    [dailyRecords]
  );

  const activeEmployees = useMemo(() => {
    return employees.filter((employee) => employee.status.toUpperCase() !== 'TERMINATED');
  }, [employees]);

  const activeEmployeeIds = useMemo(() => activeEmployees.map((employee) => employee.id), [activeEmployees]);
  const scheduledEmployeeCountSelected = useMemo(
    () =>
      selectedIsHoliday
        ? 0
        : activeEmployees.filter((employee) => isEmployeeScheduledOnDate(employee, effectiveSelectedDateKey)).length,
    [activeEmployees, effectiveSelectedDateKey, selectedIsHoliday]
  );

  const attendanceFeed: FeedItem[] = useMemo(() => {
    const feedSourceLogs = feedScope === 'selected-date' ? selectedDateLogs : feedLogs;

    return [...feedSourceLogs]
      .sort((a, b) => {
        const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
        const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
        return bt - at;
      })
      .filter((log) => {
        const employee = employeeById.get(log.employeeId ?? -1);
        return String(employee?.status ?? '').toUpperCase() !== 'TERMINATED';
      })
      .map((log, idx) => {
        const employee = employeeById.get(log.employeeId ?? -1);
        const logDateKey = localDateKey(log.timestamp);
        const derivedLate =
          isInDirection(log.direction) &&
          isLateForSchedule(log.timestamp, employee, logDateKey, log.direction);
        return {
          id: String(log.attendanceId ?? idx),
          name: employeeName(employee),
          directionLabel: derivedLate ? 'LATE' : directionIndicator(log.direction),
          directionTone: derivedLate ? 'late' : directionIndicatorTone(log.direction),
          position: employee?.position || 'Position unavailable',
          time: formatFeedTimestamp(log.timestamp, feedTimeDisplay === 'time-only' ? false : includeWeeklyFeed),
        };
      });
  }, [employeeById, feedLogs, feedScope, feedTimeDisplay, includeWeeklyFeed, selectedDateLogs]);

  const onLeave: LeaveCardItem[] = useMemo(() => {
    return selectedApprovedLeaves.map((request, idx) => {
        const employee = employeeById.get(request.empId ?? -1);
        return {
          id: String(request.requestId ?? idx),
          name: employeeName(employee),
          summary: request.isPaid ? 'Paid leave' : 'Unpaid leave',
          detail: request.reason?.trim() || 'Approved leave request',
          period: formatPeriodLabel(request.startDateTime, request.endDateTime),
        };
      });
  }, [employeeById, selectedApprovedLeaves]);

  const employeesOnLeaveToday = useMemo(() => {
    const ids = new Set<number>();
    for (const request of selectedApprovedLeaves) {
      if (typeof request.empId !== 'number') continue;
      ids.add(request.empId);
    }
    return ids;
  }, [selectedApprovedLeaves]);

  const absentToday = useMemo(() => {
    if (selectedIsHoliday) return [];
    return activeEmployees
      .filter((employee) => isEmployeeScheduledOnDate(employee, effectiveSelectedDateKey))
      .filter((employee) => !loggedEmployeeIds.has(employee.id))
      .filter((employee) => !employeesOnLeaveToday.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((employee) => ({
        id: String(employee.id),
        name: employee.name,
        summary: employee.position || 'No position assigned',
        detail: resolveDepartmentLabel(employee),
      }));
  }, [activeEmployees, effectiveSelectedDateKey, employeesOnLeaveToday, loggedEmployeeIds, selectedIsHoliday]);

  const lateToday = useMemo(() => {
    return activeEmployees
      .filter((employee) => lateSet.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((employee) => ({
        id: String(employee.id),
        name: employee.name,
        summary: employee.position || 'No position assigned',
        detail: resolveDepartmentLabel(employee),
        timeIn: lateClockInByEmployee.get(employee.id) || 'Late clock-in logged',
      }));
  }, [activeEmployees, lateClockInByEmployee, lateSet]);

  const overallSummary = useMemo(
    () =>
      buildAttendanceSummary(
        activeEmployeeIds,
        presentSet,
        lateSet,
        employeesOnLeaveToday,
        employeeById,
        effectiveSelectedDateKey,
        selectedIsHoliday
      ),
    [
      activeEmployeeIds,
      effectiveSelectedDateKey,
      employeeById,
      employeesOnLeaveToday,
      lateSet,
      presentSet,
      selectedIsHoliday,
    ]
  );

  const metricCards = useMemo(
    () =>
      (Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => {
        const total = overallSummary.headcount;
        const value = overallSummary[key];
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        const ringStyle =
          total > 0
            ? ({
                '--ring-fill': `${Math.max((value / total) * 360, value > 0 ? 18 : 0)}deg`,
                '--ring-color': STATUS_CONFIG[key].color,
              } as CSSProperties)
            : undefined;

        return {
          key,
          label: STATUS_CONFIG[key].label,
          value,
          helper: `${percent}% of ${total} active`,
          ringStyle,
        };
      }),
    [overallSummary]
  );

  const departmentBreakdown = useMemo(() => {
    const grouped = new Map<string, DepartmentBreakdownItem>();

    for (const employee of activeEmployees) {
      const label = resolveDepartmentLabel(employee);
      const current = grouped.get(label) ?? {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: label,
        headcount: 0,
        present: 0,
        late: 0,
        absent: 0,
        onLeave: 0,
        dayOff: 0,
      };

      current.headcount += 1;

      const employeeSummary = buildAttendanceSummary(
        [employee.id],
        presentSet,
        lateSet,
        employeesOnLeaveToday,
        employeeById,
        effectiveSelectedDateKey,
        selectedIsHoliday
      );

      current.present += employeeSummary.present;
      current.late += employeeSummary.late;
      current.absent += employeeSummary.absent;
      current.onLeave += employeeSummary.onLeave;
      current.dayOff += employeeSummary.dayOff;
      grouped.set(label, current);
    }

    return [...grouped.values()].sort(
      (a, b) =>
        b.headcount - a.headcount ||
        b.present + b.late - (a.present + a.late) ||
        a.name.localeCompare(b.name)
    );
  }, [
    activeEmployees,
    effectiveSelectedDateKey,
    employeeById,
    employeesOnLeaveToday,
    lateSet,
    presentSet,
    selectedIsHoliday,
  ]);

  const weeklyAttendance = useMemo(() => {
    if (!isWeeklyPrimaryPanel) return [] as WeeklyAttendanceItem[];

    const logsByDate = new Map<string, AttendanceLog[]>();
    const approvedLeaveRequests = leaveRequests.filter(
      (request) => String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
    );
    const approvedLeavesByEmployee = groupLeavesByEmployee(approvedLeaveRequests);

    for (const log of feedLogs) {
      const dateKey = localDateKey(log.timestamp);
      if (!dateKey) continue;

      const employee = employeeById.get(log.employeeId ?? -1);
      if (String(employee?.status ?? '').toUpperCase() === 'TERMINATED') continue;

      const current = logsByDate.get(dateKey) ?? [];
      current.push(log);
      logsByDate.set(dateKey, current);
    }

    const items: WeeklyAttendanceItem[] = [];
    const cursor = new Date(feedStartDate);

    while (cursor.getTime() <= feedEndDate.getTime()) {
      const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate()
      ).padStart(2, '0')}`;
      const dayLogs = logsByDate.get(dateKey) ?? [];
      const dayIsHoliday = holidayDateSet.has(dateKey);
      const dayDailyRecords = buildDailyRecords(dayLogs, employeeById, dateKey, approvedLeavesByEmployee, holidayDateSet);
      const dayLateSet = new Set(
        dayDailyRecords
          .filter((record) => record.isLate)
          .map((record) => record.employeeId)
      );
      const dayPresentSet = new Set(
        dayDailyRecords
          .filter((record) => !record.isLate)
          .map((record) => record.employeeId)
      );
      const dayOnLeaveSet = buildOnLeaveSetForDate(approvedLeaveRequests, cursor);

      items.push({
        id: dateKey,
        dateKey,
        dayLabel: cursor.toLocaleDateString(undefined, { weekday: 'short' }),
        dateLabel: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        summary: buildAttendanceSummary(
          activeEmployeeIds,
          dayPresentSet,
          dayLateSet,
          dayOnLeaveSet,
          employeeById,
          dateKey,
          dayIsHoliday
        ),
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return items;
  }, [activeEmployeeIds, employeeById, feedEndDate, feedLogs, feedStartDate, holidayDateSet, isWeeklyPrimaryPanel, leaveRequests]);

  const totalDeptPages = Math.max(Math.ceil(departmentBreakdown.length / DEPARTMENTS_PER_PAGE), 1);
  const activeDeptPage = Math.min(deptPage, totalDeptPages - 1);
  const visibleDepartments = departmentBreakdown.slice(
    activeDeptPage * DEPARTMENTS_PER_PAGE,
    (activeDeptPage + 1) * DEPARTMENTS_PER_PAGE
  );
  const showDepartmentNav = totalDeptPages > 1;
  const totalWeekPages = Math.max(Math.ceil(weeklyAttendance.length / DEPARTMENTS_PER_PAGE), 1);
  const activeWeekPage = Math.min(deptPage, totalWeekPages - 1);
  const visibleWeeklyAttendance = weeklyAttendance.slice(
    activeWeekPage * DEPARTMENTS_PER_PAGE,
    (activeWeekPage + 1) * DEPARTMENTS_PER_PAGE
  );
  const showWeeklyNav = totalWeekPages > 1;
  const attendanceDashboardDescription =
    descriptionOverride ?? (
      audience.toLowerCase() === 'manager'
        ? undefined
        : 'Track attendance activity, late logs, and department trends from the latest records.'
    );
  const centerPanelTitle = isWeeklyPrimaryPanel ? 'Weekly Attendance' : 'Attendance by Department';
  const selectedDateFeedTitle = isSelectedDateToday ? 'Attendance Today' : `Attendance on ${selectedDateShortLabel}`;
  const feedPanelTitle =
    feedScope === 'selected-date'
      ? selectedDateFeedTitle
      : isWeeklyPrimaryPanel
        ? 'Attendance Activity'
        : includeWeeklyFeed
          ? 'Weekly Attendance'
          : selectedDateFeedTitle;
  const resolvedFeedPanelTitle = feedTitleOverride ?? feedPanelTitle;
  const feedEmptyStateLabel =
    feedScope === 'selected-date'
      ? selectedDateHeading
      : includeWeeklyFeed
        ? feedRangeLabel
        : selectedDateHeading;

  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <PageHeader
          title="Attendance Dashboard"
          description={attendanceDashboardDescription}
        />
        <div className="hrDash__topActions">
          <div className="hrDash__dateFilter">
            <div className="hrDash__dateNav">
              <button
                className="hrDash__dateArrow"
                type="button"
                aria-label="Previous date"
                onClick={() => shiftSelectedDate(-1)}
              >
                <FiChevronLeft />
              </button>
              <div className="hrDash__dateLabel">
                <strong>{selectedDateHeading}</strong>
              </div>
              <label className="hrDash__calendarTrigger" aria-label="Select a specific date">
                <FiCalendar />
              <input
                type="date"
                value={effectiveSelectedDateKey}
                max={todayKey}
                onChange={(event) => setSelectedDateKey(event.target.value || todayKey)}
              />
              </label>
              <button
                className="hrDash__dateArrow"
                type="button"
                aria-label="Next date"
                onClick={() => shiftSelectedDate(1)}
                disabled={isSelectedDateToday}
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="hrDash__grid">
        <div className="hrDash__mainCol" ref={mainColRef}>
          <section className="hrStatRow">
            {metricCards.map((card) => (
              <article key={card.key} className="hrStatCard">
                <div className="hrStatCard__ring" style={card.ringStyle} />
                <div className="hrStatCard__body">
                  <div className="hrStatCard__label">{card.label}</div>
                  <div className="hrStatCard__value">{card.value}</div>
                  <div className="hrStatCard__helper">{card.helper}</div>
                </div>
              </article>
            ))}
          </section>

          <section className="hrPanel">
            <div className="hrPanel__header">{centerPanelTitle}</div>
            {isWeeklyPrimaryPanel ? (
              weeklyAttendance.length > 0 ? (
                <>
                  <div className={`hrDept${showWeeklyNav ? '' : ' hrDept--single'}`}>
                    {showWeeklyNav ? (
                      <button
                        className="hrCircleBtn"
                        type="button"
                        aria-label="Previous weekly attendance page"
                        onClick={() => setDeptPage((page) => Math.max(0, page - 1))}
                        disabled={activeWeekPage === 0}
                      >
                        <FiChevronLeft />
                      </button>
                    ) : null}

                    <div className={`hrDeptGrid${visibleWeeklyAttendance.length === 1 ? ' hrDeptGrid--single' : ''}`}>
                      {visibleWeeklyAttendance.map((item) => {
                        const chartPoints = donutPoints(item.summary);
                        const donutBackground = buildDonutBackground(chartPoints);
                        const donutStyle = donutBackground
                          ? ({ background: donutBackground } as CSSProperties)
                          : undefined;

                        return (
                          <article key={item.id} className="hrDeptCard hrWeekDeptCard">
                            <div className="hrDeptCard__name hrWeekDeptCard__name">
                              <span>{item.dayLabel}</span>
                              <small>{item.dateLabel}</small>
                            </div>
                            <div className="hrDeptCard__body">
                              <div className="hrDeptCard__chartWrap">
                                <div
                                  className={`hrDeptDonut${chartPoints.length === 0 ? ' hrDeptDonut--empty' : ''}`}
                                  style={donutStyle}
                                  aria-hidden="true"
                                >
                                  <div className="hrDeptDonut__center">
                                    <strong>{item.summary.headcount}</strong>
                                  </div>
                                </div>
                              </div>
                              <div className="hrDeptCard__stats">
                                {(Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => (
                                  <div
                                    key={`${item.id}-${key}`}
                                    className="hrDeptStatRow"
                                    aria-label={`${STATUS_CONFIG[key].label}: ${item.summary[key]}`}
                                    title={STATUS_CONFIG[key].label}
                                  >
                                    <span className={`hrDeptStatRow__dot hrDeptStatRow__dot--${key}`} />
                                    <strong className="hrDeptStatRow__value">{item.summary[key]}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {showWeeklyNav ? (
                      <button
                        className="hrCircleBtn"
                        type="button"
                        aria-label="Next weekly attendance page"
                        onClick={() => setDeptPage((page) => (page + 1 < totalWeekPages ? page + 1 : page))}
                        disabled={activeWeekPage + 1 >= totalWeekPages}
                      >
                        <FiChevronRight />
                      </button>
                    ) : null}
                  </div>

                  {totalWeekPages > 1 && (
                    <div className="hrPager" aria-hidden="true">
                      {Array.from({ length: totalWeekPages }).map((_, index) => (
                        <span key={`week-page-${index}`} className={index === activeWeekPage ? 'is-active' : ''} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="hrDeptGrid">
                  <div className="hrDeptCard hrDeptCard--empty">
                    <div className="hrDeptCard__name">No weekly attendance data yet.</div>
                  </div>
                </div>
              )
            ) : departmentBreakdown.length > 0 ? (
              <>
                <div className={`hrDept${showDepartmentNav ? '' : ' hrDept--single'}`}>
                  {showDepartmentNav ? (
                    <button
                      className="hrCircleBtn"
                      type="button"
                      aria-label="Previous department page"
                      onClick={() => setDeptPage((page) => Math.max(0, page - 1))}
                      disabled={activeDeptPage === 0}
                    >
                      <FiChevronLeft />
                    </button>
                  ) : null}

                  <div className={`hrDeptGrid${visibleDepartments.length === 1 ? ' hrDeptGrid--single' : ''}`}>
                    {visibleDepartments.map((department) => {
                      const summary: AttendanceStatusSummary = {
                        headcount: department.headcount,
                        present: department.present,
                        late: department.late,
                        absent: department.absent,
                        onLeave: department.onLeave,
                        dayOff: department.dayOff,
                      };
                      const chartPoints = donutPoints(summary);
                      const donutBackground = buildDonutBackground(chartPoints);
                      const donutStyle = donutBackground
                        ? ({ background: donutBackground } as CSSProperties)
                        : undefined;

                      return (
                        <article key={department.id} className="hrDeptCard">
                          <div className="hrDeptCard__name">{department.name}</div>
                          <div className="hrDeptCard__body">
                            <div className="hrDeptCard__chartWrap">
                              <div
                                className={`hrDeptDonut${chartPoints.length === 0 ? ' hrDeptDonut--empty' : ''}`}
                                style={donutStyle}
                                aria-hidden="true"
                              >
                                <div className="hrDeptDonut__center">
                                  <strong>{department.headcount}</strong>
                                </div>
                              </div>
                            </div>
                            <div className="hrDeptCard__stats">
                              {(Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => (
                                <div
                                  key={`${department.id}-${key}`}
                                  className="hrDeptStatRow"
                                  aria-label={`${STATUS_CONFIG[key].label}: ${summary[key]}`}
                                  title={STATUS_CONFIG[key].label}
                                >
                                  <span className={`hrDeptStatRow__dot hrDeptStatRow__dot--${key}`} />
                                  <strong className="hrDeptStatRow__value">{summary[key]}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {showDepartmentNav ? (
                    <button
                      className="hrCircleBtn"
                      type="button"
                      aria-label="Next department page"
                      onClick={() => setDeptPage((page) => (page + 1 < totalDeptPages ? page + 1 : page))}
                      disabled={activeDeptPage + 1 >= totalDeptPages}
                    >
                      <FiChevronRight />
                    </button>
                  ) : null}
                </div>

                {totalDeptPages > 1 && (
                  <div className="hrPager" aria-hidden="true">
                    {Array.from({ length: totalDeptPages }).map((_, index) => (
                      <span key={`dept-page-${index}`} className={index === activeDeptPage ? 'is-active' : ''} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="hrDeptGrid">
                <div className="hrDeptCard hrDeptCard--empty">
                  <div className="hrDeptCard__name">No department attendance data yet.</div>
                </div>
              </div>
            )}
            <div className="hrLegend hrLegend--note">
              {(Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => (
                <span key={key} className={`hrLegend__item hrLegend__item--${key}`}>
                  {STATUS_CONFIG[key].label}
                </span>
              ))}
            </div>
          </section>

          <div className="hrDash__bottomRow">
            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header hrPanel__header--split">
                <span>{isSelectedDateToday ? 'Absent Today' : `Absent on ${selectedDateShortLabel}`}</span>
                <span className="hrPanel__badge">{absentToday.length}</span>
              </div>
              <div className="hrPeopleList">
                {absentToday.length > 0 ? (
                  absentToday.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__body">
                        <div className="hrPerson__name">{item.name}</div>
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="hrEmptyState">
                    <div className="hrEmptyState__title">
                      {selectedIsHoliday
                        ? 'No absences on holiday.'
                        : scheduledEmployeeCountSelected > 0
                        ? 'Everyone is accounted for.'
                        : 'No absences on scheduled day off.'}
                    </div>
                    <div className="hrEmptyState__note">
                      {selectedIsHoliday
                        ? `${selectedDateHeading} is treated as a holiday in the dashboard.`
                        : scheduledEmployeeCountSelected > 0
                        ? `No absences were recorded for ${selectedDateHeading}.`
                        : `${selectedDateHeading} is treated as a day off in the dashboard schedule.`}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header hrPanel__header--split">
                <span>{isSelectedDateToday ? 'Late Today' : `Late on ${selectedDateShortLabel}`}</span>
                <span className="hrPanel__badge">{lateToday.length}</span>
              </div>
              <div className="hrPeopleList">
                {lateToday.length > 0 ? (
                  lateToday.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__body">
                        <div className="hrPerson__topLine">
                          <div className="hrPerson__name">{item.name}</div>
                          <div className="hrPerson__time hrPerson__time--panel">{item.timeIn}</div>
                        </div>
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="hrEmptyState">
                    <div className="hrEmptyState__title">No late arrivals logged.</div>
                    <div className="hrEmptyState__note">
                      Everyone who checked in for {selectedDateHeading} arrived on time.
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header hrPanel__header--split">
                <span>{isSelectedDateToday ? 'On Leave Today' : `On Leave on ${selectedDateShortLabel}`}</span>
                <span className="hrPanel__badge">{onLeave.length}</span>
              </div>
              <div className="hrPeopleList">
                {onLeave.length > 0 ? (
                  onLeave.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__body">
                        <div className="hrPerson__name">{item.name}</div>
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
                        <div className="hrPerson__infoRow">
                          <span>
                            <FiCalendar /> {item.period}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="hrEmptyState">
                    <div className="hrEmptyState__title">No approved leave on file.</div>
                    <div className="hrEmptyState__note">
                      No paid or unpaid leave request covers {selectedDateHeading}.
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
        <section
          className="hrPanel hrFeedPanel"
          style={feedPanelHeight ? ({ height: `${feedPanelHeight}px` } as CSSProperties) : undefined}
        >
          <div className="hrPanel__header">{resolvedFeedPanelTitle}</div>
          <div className="hrPeopleList">
            {attendanceFeed.length > 0 ? (
              attendanceFeed.map((item) => (
                <article key={item.id} className="hrPerson hrPerson--feed">
                  <div className="hrPerson__feedTop">
                    <div className="hrPerson__name">{item.name}</div>
                    <div className="hrPerson__time">{item.time}</div>
                  </div>
                  <div className="hrPerson__feedBottom">
                    <div className="hrPerson__meta">{item.position}</div>
                    <span className={`hrPerson__indicator hrPerson__indicator--${item.directionTone}`}>
                      {item.directionLabel}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="hrEmptyState">
                <div className="hrEmptyState__title">No attendance activity yet.</div>
                <div className="hrEmptyState__note">
                  {selectedIsHoliday && feedScope === 'selected-date'
                    ? `${selectedDateHeading} is a holiday, so no logs are expected unless someone worked.`
                    : `There are no attendance logs for ${feedEmptyStateLabel}.`}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
