import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import './Attendance.css';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiPlusSquare } from 'react-icons/fi';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import FileUploadField from '../../../components/form/FileUploadField';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { ApiError, apiFetchJson, apiFetchRaw, toArray } from '../../../lib/api';
import { uploadDocument } from '../../../lib/documentUpload';
import { getUserEmail, getUserRole } from '../../../lib/session';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';

type LeaveType =
  | 'SICK_LEAVE'
  | 'VACATION_LEAVE'
  | 'MATERNITY_LEAVE'
  | 'PATERNITY_LEAVE'
  | 'SOLO_PARENT_LEAVE'
  | 'MAGNA_CARTA'
  | 'RA9262';
type OvertimeType = 'OVERTIME' | 'DOUBLE_OVERTIME' | 'TRIPLE_OVERTIME' | 'HOLIDAY';

type RequestEntry = {
  id: string;
  kind: 'LEAVE' | 'OT';
  dateKey: string;
  status: string;
  reason: string;
  leaveType?: string;
  paid?: boolean;
  overtimeType?: OvertimeType | string;
  startTime?: string;
  endTime?: string;
};

type LeaveRequestRow = {
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  leaveType?: string;
  paid?: boolean;
};

type OvertimeRequestRow = {
  overtimeId?: number;
  workDate?: string;
  startTime?: string;
  endTime?: string;
  requestStatus?: string;
  reason?: string;
  overtimeType?: string;
};

type ShiftScheduleRow = {
  shiftId?: number;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string;
};

type DayCell = {
  day: number | null;
  statusNotes?: string[];
  detailNotes?: string[];
  variant?: 'leave' | 'ot';
  clickable?: boolean;
};

type AttendanceLog = {
  timestamp?: string;
  direction?: string;
};

type AttendanceSession = {
  in?: string;
  out?: string;
};

type AttendanceHistory = {
  sessionsByDate: Record<string, AttendanceSession[]>;
  latestDirection: 'IN' | 'OUT' | null;
};

type LeaveBalanceRow = {
  leaveId?: number;
  balanceHours?: number | string | null;
  leaveType?: LeaveType | string;
};

const LEAVE_UPLOAD_SUBDIR = 'leave-request';
const OVERTIME_UPLOAD_SUBDIR = 'overtime-request';

const LEAVE_TYPE_OPTIONS: Array<{ label: string; value: LeaveType }> = [
  { label: 'Sick Leave', value: 'SICK_LEAVE' },
  { label: 'Vacation Leave', value: 'VACATION_LEAVE' },
  { label: 'Maternity Leave', value: 'MATERNITY_LEAVE' },
  { label: 'Paternity Leave', value: 'PATERNITY_LEAVE' },
  { label: 'Solo Parent Leave', value: 'SOLO_PARENT_LEAVE' },
  { label: 'Magna Carta', value: 'MAGNA_CARTA' },
  { label: 'RA 9262', value: 'RA9262' },
];
const HOURS_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODate(year: number, monthIndex: number, day: number) {
  // monthIndex: 0-based
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function dateKeysBetween(start: string, end: string) {
  const out: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return out;

  const min = startDate <= endDate ? startDate : endDate;
  const max = startDate <= endDate ? endDate : startDate;
  const cursor = new Date(min);
  while (cursor <= max) {
    out.push(`${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatDisplayDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDisplayTime(value?: string) {
  if (!value) return '-';

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [hoursText, minutesText] = value.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function addDays(dateValue: string, days: number) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return toISODate(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

function normalizeTimeValue(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? value;
}

function resolveDayOfWeek(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()] ?? '';
}

function mapLeaveRequestEntries(rows: unknown): RequestEntry[] {
  return toArray<LeaveRequestRow>(rows).flatMap((row, index) => {
    const startDate = typeof row.startDateTime === 'string' ? row.startDateTime.slice(0, 10) : '';
    const endDate =
      typeof row.endDateTime === 'string' ? row.endDateTime.slice(0, 10) : startDate;
    if (!startDate || !endDate) return [];

    const rawStatus = String(row.requestStatus ?? 'PENDING').toUpperCase();
    if (['REJECTED', 'DENIED', 'CANCELLED'].includes(rawStatus)) return [];

    return dateKeysBetween(startDate, endDate).map((dateKey, offset) => ({
      id: `leave-${String(row.requestId ?? index)}-${offset}`,
      kind: 'LEAVE' as const,
      dateKey,
      status: rawStatus,
      reason: String(row.reason ?? ''),
      leaveType: typeof row.leaveType === 'string' ? row.leaveType : '',
      paid: row.paid,
    }));
  });
}

function mapOvertimeRequestEntries(rows: unknown): RequestEntry[] {
  return toArray<OvertimeRequestRow>(rows)
    .map((row, index): RequestEntry | null => {
      const dateKey =
        typeof row.workDate === 'string'
          ? row.workDate.slice(0, 10)
          : typeof row.startTime === 'string'
            ? row.startTime.slice(0, 10)
            : '';
      if (!dateKey) return null;

      const rawStatus = String(row.requestStatus ?? 'PENDING').toUpperCase();
      if (['REJECTED', 'DENIED', 'CANCELLED'].includes(rawStatus)) return null;

      return {
        id: `ot-${String(row.overtimeId ?? index)}`,
        kind: 'OT' as const,
        dateKey,
        status: rawStatus,
        reason: String(row.reason ?? ''),
        overtimeType: String(row.overtimeType ?? ''),
        startTime: formatDisplayTime(row.startTime),
        endTime: formatDisplayTime(row.endTime),
      };
    })
    .filter((item): item is RequestEntry => item !== null);
}

function formatAttendanceSession(session: AttendanceSession) {
  if (session.in && session.out) return `${session.in} - ${session.out}`;
  if (session.in) return `In ${session.in}`;
  if (session.out) return `Out ${session.out}`;
  return 'Attendance logged';
}

function formatLeaveTypeLabel(value?: string) {
  if (!value) return 'Leave';
  const option = LEAVE_TYPE_OPTIONS.find((entry) => entry.value === value);
  if (option) return option.label;

  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseBalanceHours(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatBalanceHoursLabel(value?: number | string | null) {
  const parsed = parseBalanceHours(value);
  if (parsed !== null) {
    return `${HOURS_FORMATTER.format(parsed)} hour${Math.abs(parsed - 1) < 0.00001 ? '' : 's'}`;
  }

  return '0 hours';
}

function buildAttendanceHistory(logs: unknown): AttendanceHistory {
  const parsedLogs = toArray<AttendanceLog>(logs)
    .map((row) => {
      if (typeof row.timestamp !== 'string') return null;
      const date = new Date(row.timestamp);
      if (Number.isNaN(date.getTime())) return null;

      return {
        date,
        direction: String(row.direction ?? '').toUpperCase(),
      };
    })
    .filter(
      (entry): entry is { date: Date; direction: string } =>
        entry !== null
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const next: Record<string, AttendanceSession[]> = {};
  const latestDirection = parsedLogs[parsedLogs.length - 1]?.direction;
  for (const entry of parsedLogs) {
    const dateKey = `${entry.date.getFullYear()}-${pad2(entry.date.getMonth() + 1)}-${pad2(entry.date.getDate())}`;
    const timeLabel = entry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const current = next[dateKey] ?? [];
    const lastSession = current[current.length - 1];

    if (entry.direction.includes('IN')) {
      next[dateKey] = [...current, { in: timeLabel }];
      continue;
    }

    if (entry.direction.includes('OUT')) {
      if (lastSession && lastSession.in && !lastSession.out) {
        next[dateKey] = [
          ...current.slice(0, -1),
          {
            ...lastSession,
            out: timeLabel,
          },
        ];
      } else {
        next[dateKey] = [...current, { out: timeLabel }];
      }
    }
  }

  return {
    sessionsByDate: next,
    latestDirection: latestDirection === 'IN' || latestDirection === 'OUT' ? latestDirection : null,
  };
}

export default function Attendance() {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(
    () => `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`,
    [today]
  );
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const [monthValue, setMonthValue] = useState(monthLabel);
  const monthOptions = useMemo(() => {
    const startYear = Math.min(today.getFullYear(), year) - 5;
    const endYear = Math.max(today.getFullYear(), year) + 5;
    const totalMonths = (endYear - startYear + 1) * 12;

    return Array.from({ length: totalMonths }, (_, index) =>
      new Date(startYear, index, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [today, year]);

  // Leave modal state
  const [leaveOpen, setLeaveOpen] = useState(false);

  const [leaveType, setLeaveType] = useState<LeaveType>('SICK_LEAVE');
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [reason, setReason] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [requestEntries, setRequestEntries] = useState<RequestEntry[]>([]);
  const [attendanceByDate, setAttendanceByDate] = useState<Record<string, AttendanceSession[]>>({});
  const [shiftSchedule, setShiftSchedule] = useState<ShiftScheduleRow[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [leaveBalanceStatus, setLeaveBalanceStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [otOpen, setOtOpen] = useState(false);
  const [otStartDate, setOtStartDate] = useState<string>('');
  const [otEndDate, setOtEndDate] = useState<string>('');
  const [otStartTime, setOtStartTime] = useState<string>('17:00');
  const [otEndTime, setOtEndTime] = useState<string>('20:00');
  const [otType, setOtType] = useState<OvertimeType>('OVERTIME');
  const [otReason, setOtReason] = useState<string>('');
  const [otFile, setOtFile] = useState<File | null>(null);
  const [otSubmitError, setOtSubmitError] = useState('');
  const [requestViewOpen, setRequestViewOpen] = useState(false);
  const [requestViewDate, setRequestViewDate] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [isClocking, setIsClocking] = useState(false);
  const [clockMessage, setClockMessage] = useState('');
  const [clockError, setClockError] = useState('');
  const [confirmClockAction, setConfirmClockAction] = useState<'TIME_IN' | 'TIME_OUT' | null>(null);
  const [confirmLeaveSubmit, setConfirmLeaveSubmit] = useState(false);
  const [confirmOtSubmit, setConfirmOtSubmit] = useState(false);
  const [latestAttendanceDirection, setLatestAttendanceDirection] = useState<'IN' | 'OUT' | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  useErrorDialogEffect(clockError, 'Attendance action failed');
  useErrorDialogEffect(otSubmitError, 'Overtime request could not be submitted');
  useErrorDialogEffect(submitError, 'Leave request could not be submitted');
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useEscapeDismiss(leaveOpen, closeLeave, 10);
  useEscapeDismiss(otOpen, closeOt, 10);
  useEscapeDismiss(requestViewOpen, closeRequestView, 10);
  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled: !leaveOpen && !otOpen && !requestViewOpen && !confirmClockAction && !isClocking,
  });
  const userRole = getUserRole();
  const canRequestOvertime = !['hr', 'management', 'manager'].includes(userRole ?? '');
  const maxOtEndDate = otStartDate ? addDays(otStartDate, 1) : '';
  const isOtNextDay = Boolean(otStartDate && otEndDate && otEndDate === maxOtEndDate);

  async function fetchAttendanceHistory(resolvedEmpId: number) {
    try {
      const logs = await apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=500`);
      return buildAttendanceHistory(logs);
    } catch {
      return null;
    }
  }

  async function fetchLeaveBalances(resolvedEmpId: number) {
    try {
      const response = await apiFetchJson<unknown>(`/api/leave/balance/${resolvedEmpId}`);
      return {
        rows: toArray<LeaveBalanceRow>(response),
        status: 'ready' as const,
      };
    } catch {
      return {
        rows: [],
        status: 'unavailable' as const,
      };
    }
  }

  useEffect(() => {
    setMonthValue(monthLabel);
  }, [monthLabel]);

  useEffect(() => {
    if (today.getFullYear() === year && today.getMonth() === monthIndex) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey('');
    }
  }, [monthIndex, today, todayKey, year]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) {
          if (!cancelled) {
            setEmployeeId(null);
            setRequestEntries([]);
            setAttendanceByDate({});
            setShiftSchedule([]);
            setLeaveBalances([]);
            setLatestAttendanceDirection(null);
            setLeaveBalanceStatus('unavailable');
          }
          return;
        }
        const userDetails = await apiFetchJson<Record<string, unknown>>(
          `/api/user/details/${encodeURIComponent(username)}`
        );
        const selfEmployee =
          userDetails.employee && typeof userDetails.employee === 'object'
            ? (userDetails.employee as Record<string, unknown>)
            : null;

        const resolvedEmpId =
          typeof userDetails.employeeId === 'number'
            ? userDetails.employeeId
            : typeof selfEmployee?.employeeId === 'number'
              ? selfEmployee.employeeId
              : typeof selfEmployee?.id === 'number'
                ? selfEmployee.id
                : null;

        if (cancelled) return;
        setEmployeeId(resolvedEmpId);

        if (resolvedEmpId) {
          const [leaveResponse, overtimeResponse, attendanceHistory, scheduleResponse, leaveBalanceResponse] = await Promise.all([
            apiFetchJson<unknown>(`/api/leave/request/${resolvedEmpId}?page=0&size=200`),
            apiFetchJson<unknown>(`/api/overtime/all/${resolvedEmpId}?page=0&size=200`),
            fetchAttendanceHistory(resolvedEmpId),
            apiFetchJson<unknown>(`/api/employee/schedule/${resolvedEmpId}`).catch(() => []),
            fetchLeaveBalances(resolvedEmpId),
          ]);

          if (cancelled) return;
          setRequestEntries([
            ...mapLeaveRequestEntries(leaveResponse),
            ...mapOvertimeRequestEntries(overtimeResponse),
          ]);
          setShiftSchedule(toArray<ShiftScheduleRow>(scheduleResponse));
          setAttendanceByDate(attendanceHistory?.sessionsByDate ?? {});
          setLatestAttendanceDirection(attendanceHistory?.latestDirection ?? null);
          setLeaveBalances(leaveBalanceResponse.rows);
          setLeaveBalanceStatus(leaveBalanceResponse.status);
        } else {
          setLeaveBalances([]);
          setLeaveBalanceStatus('unavailable');
        }
      } catch {
        if (cancelled) return;
        setEmployeeId(null);
        setRequestEntries([]);
        setAttendanceByDate({});
        setShiftSchedule([]);
        setLeaveBalances([]);
        setLatestAttendanceDirection(null);
        setLeaveBalanceStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [monthIndex, refreshTick, year]);

  useEffect(() => {
    if (!otStartDate) return;

    if (!otEndDate || otEndDate < otStartDate || (maxOtEndDate && otEndDate > maxOtEndDate)) {
      setOtEndDate(otStartDate);
      return;
    }

    if (otEndDate === maxOtEndDate && otEndTime > '06:00') {
      setOtEndTime('06:00');
    }
  }, [maxOtEndDate, otEndDate, otEndTime, otStartDate]);

  useEffect(() => {
    if (leaveOpen || otOpen || requestViewOpen || confirmClockAction) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [confirmClockAction, leaveOpen, otOpen, requestViewOpen]);

  const approvedRequestDateKeys = useMemo(() => {
    return new Set(
      requestEntries
        .filter((entry) => entry.status.toUpperCase() === 'APPROVED')
        .map((entry) => entry.dateKey)
    );
  }, [requestEntries]);

  const leaveBalancesByType = useMemo(() => {
    const next = new Map<string, LeaveBalanceRow>();
    for (const balance of leaveBalances) {
      if (typeof balance.leaveType !== 'string' || balance.leaveType.length === 0) continue;
      next.set(balance.leaveType, balance);
    }
    return next;
  }, [leaveBalances]);

  const orderedLeaveBalances = useMemo(() => {
    const knownTypes = new Set<string>(LEAVE_TYPE_OPTIONS.map((option) => option.value));
    const known = LEAVE_TYPE_OPTIONS.map((option) => ({
      key: option.value,
      label: option.label,
      balance: leaveBalancesByType.get(option.value) ?? null,
    }));
    const extras = leaveBalances
      .filter(
        (balance): balance is LeaveBalanceRow & { leaveType: string } =>
          typeof balance.leaveType === 'string' &&
          balance.leaveType.length > 0 &&
          !knownTypes.has(balance.leaveType)
      )
      .map((balance, index) => ({
        key: `${balance.leaveType}-${String(balance.leaveId ?? index)}`,
        label: formatLeaveTypeLabel(balance.leaveType),
        balance,
      }));

    return [...known, ...extras];
  }, [leaveBalances, leaveBalancesByType]);

  const selectedLeaveBalance = leaveBalancesByType.get(leaveType) ?? null;
  const selectedLeaveBalanceLabel =
    leaveBalanceStatus === 'loading'
      ? 'Loading...'
      : leaveBalanceStatus === 'unavailable'
        ? 'Unavailable'
        : selectedLeaveBalance
          ? formatBalanceHoursLabel(selectedLeaveBalance.balanceHours)
          : 'Not assigned yet';
  const selectedLeaveBalanceNote =
    leaveBalanceStatus === 'loading'
      ? 'Checking your available leave balance.'
      : leaveBalanceStatus === 'unavailable'
        ? 'Your leave balances could not be loaded right now.'
        : selectedLeaveBalance
          ? 'Pending requests may not yet be deducted.'
          : 'HR has not assigned this leave balance to your account yet.';

  const hasApprovedTodayLeave = useMemo(() => {
    return requestEntries.some(
      (entry) =>
        entry.dateKey === todayKey &&
        entry.kind === 'LEAVE' &&
        entry.status.toUpperCase() === 'APPROVED'
    );
  }, [requestEntries, todayKey]);

  const isClockOutAction = latestAttendanceDirection === 'IN';
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBasedStart = firstDay.getDay();
  const calendarWeekRows = Math.ceil((sundayBasedStart + daysInMonth) / 7);
  const calendarGridStyle = { '--calendar-week-rows': calendarWeekRows } as CSSProperties;

  const calendarCells = useMemo(() => {
    // Build a Sunday-first calendar (SU..SA)
    const cells: DayCell[] = [];
    // leading blanks
    for (let i = 0; i < sundayBasedStart; i++) cells.push({ day: null });

    // actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toISODate(year, monthIndex, d);
      const dayRequests = requestEntries.filter((entry) => entry.dateKey === dateKey);
      const approvedDayRequests = dayRequests.filter((entry) => entry.status.toUpperCase() === 'APPROVED');
      const attendance = attendanceByDate[dateKey] ?? [];
      const statusNotes: string[] = [];
      const detailNotes: string[] = [];
      let variant: DayCell['variant'] | undefined;
      let clickable = false;

      if (approvedDayRequests.length > 0) {
        variant = approvedDayRequests.some((entry) => entry.kind === 'LEAVE') ? 'leave' : 'ot';
        for (const entry of approvedDayRequests) {
          statusNotes.push(entry.kind === 'OT' ? 'Overtime' : 'Leave');
        }
        clickable = true;
      }

      const hasApprovedLeave = approvedDayRequests.some(
        (entry) => entry.kind === 'LEAVE'
      );

      if (!hasApprovedLeave && attendance.length > 0) {
        detailNotes.push(...attendance.map((session) => formatAttendanceSession(session)));
      }

      cells.push({
        day: d,
        statusNotes: statusNotes.length > 0 ? statusNotes : undefined,
        detailNotes: detailNotes.length > 0 ? detailNotes : undefined,
        variant,
        clickable,
      });
    }

    // trailing blanks to fill full weeks
    while (cells.length % 7 !== 0) cells.push({ day: null });

    return cells;
  }, [attendanceByDate, daysInMonth, requestEntries, sundayBasedStart, year]);

  function openLeaveForToday() {
    const now = new Date();
    const iso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    setStartDate(iso);
    setStartTime('08:00');
    setEndDate(iso);
    setEndTime('17:00');
    setLeaveType('SICK_LEAVE');
    setReason('');
    setFile(null);
    setLeaveOpen(true);
  }

  function parseMonthValue(value: string) {
    const date = new Date(`1 ${value}`);
    if (Number.isNaN(date.getTime())) return;
    setMonthIndex(date.getMonth());
    setYear(date.getFullYear());
  }

  function shiftCalendarMonth(offset: number) {
    const next = new Date(year, monthIndex + offset, 1);
    setMonthIndex(next.getMonth());
    setYear(next.getFullYear());
  }

  function closeLeave() {
    setFile(null);
    setLeaveOpen(false);
  }

  function openRequestForDay(day: number) {
    const key = toISODate(year, monthIndex, day);
    setRequestViewDate(key);
    setRequestViewOpen(true);
  }

  function closeRequestView() {
    setRequestViewOpen(false);
  }

  function openOtForToday() {
    if (!canRequestOvertime) return;
    const now = new Date();
    const iso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    setOtStartDate(iso);
    setOtEndDate(iso);
    setOtStartTime('17:00');
    setOtEndTime('20:00');
    setOtType('OVERTIME');
    setOtReason('');
    setOtFile(null);
    setOtSubmitError('');
    setOtOpen(true);
  }

  function closeOt() {
    setOtFile(null);
    setOtOpen(false);
  }

  function requestAttendanceConfirmation() {
    setClockMessage('');
    setClockError('');
    if (!employeeId) {
      setClockError('Employee record could not be resolved.');
      return false;
    }
    if (hasApprovedTodayLeave) {
      setClockError('Clock in/out is blocked today because there is an approved leave request.');
      return false;
    }
    setConfirmClockAction(isClockOutAction ? 'TIME_OUT' : 'TIME_IN');
    return true;
  }

  function closeClockConfirmation() {
    if (isClocking) return;
    setConfirmClockAction(null);
  }

  async function recordAttendance() {
    if (!employeeId || !confirmClockAction) return;

    setIsClocking(true);
    try {
      const attemptedAction = confirmClockAction === 'TIME_OUT' ? 'Time out' : 'Time in';
      const response = await apiFetchRaw(`/api/logs/attendance/${employeeId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(response.status, text || `Attendance log failed (${response.status})`);
      }

      const updatedHistory = await fetchAttendanceHistory(employeeId);
      if (updatedHistory) {
        setAttendanceByDate(updatedHistory.sessionsByDate);
        setLatestAttendanceDirection(updatedHistory.latestDirection);
      } else {
        const now = new Date();
        const dateKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
        const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setAttendanceByDate((prev) => {
          const current = prev[dateKey] ?? [];
          const lastSession = current[current.length - 1];
          const nextSessions =
            lastSession?.in && !lastSession.out
              ? [
                  ...current.slice(0, -1),
                  {
                    ...lastSession,
                    out: timeLabel,
                  },
                ]
              : [...current, { in: timeLabel }];
          return { ...prev, [dateKey]: nextSessions };
        });
        setLatestAttendanceDirection((prev) => (prev === 'IN' ? 'OUT' : 'IN'));
      }

      setClockMessage(`${attemptedAction} submitted.`);
      setConfirmClockAction(null);
    } catch (error) {
      setClockError(getFriendlyErrorMessage(error, 'attendance'));
    } finally {
      setIsClocking(false);
    }
  }

  function validateOtForm() {
    setOtSubmitError('');
    if (!canRequestOvertime) {
      setOtSubmitError('Overtime requests are not available for your role.');
      return false;
    }

    if (!otStartDate) {
      setOtSubmitError('Start date is required.');
      return false;
    }

    if (!otEndDate) {
      setOtSubmitError('End date is required.');
      return false;
    }

    if (otStartDate < todayKey) {
      setOtSubmitError('Start date cannot be earlier than today.');
      return false;
    }

    if (otEndDate < otStartDate) {
      setOtSubmitError('End date cannot be earlier than the start date.');
      return false;
    }

    if (maxOtEndDate && otEndDate > maxOtEndDate) {
      setOtSubmitError('End date can only be up to the day after the selected start date.');
      return false;
    }

    if (!otStartTime || !otEndTime) {
      setOtSubmitError('Start and end time are required.');
      return false;
    }

    if (isOtNextDay && otEndTime > '06:00') {
      setOtSubmitError('If the overtime ends the next day, the latest allowed end time is 6:00 AM.');
      return false;
    }

    if (otReason.trim().length < 5) {
      setOtSubmitError('Reason must be at least 5 characters.');
      return false;
    }

    const requestStart = buildDateTime(otStartDate, otStartTime);
    const requestEnd = buildDateTime(otEndDate, otEndTime);
    if (Number.isNaN(requestStart.getTime()) || Number.isNaN(requestEnd.getTime()) || requestEnd <= requestStart) {
      setOtSubmitError('End date and time must be later than the start date and time.');
      return false;
    }

    const scheduleForDay = shiftSchedule.find((schedule) => schedule.dayOfWeek === resolveDayOfWeek(otStartDate));
    if (!scheduleForDay) {
      setOtSubmitError('Your work schedule is not set up yet, so overtime cannot be filed.');
      return false;
    }

    const shiftStartTime = normalizeTimeValue(scheduleForDay.startTime);
    const shiftEndTime = normalizeTimeValue(scheduleForDay.endTime);
    const shiftStart = buildDateTime(otStartDate, shiftStartTime);
    const shiftEnd = buildDateTime(
      shiftEndTime > shiftStartTime || shiftEndTime === shiftStartTime ? otStartDate : addDays(otStartDate, 1),
      shiftEndTime
    );
    const isOutsideShift = requestEnd <= shiftStart || requestStart >= shiftEnd;
    if (!isOutsideShift) {
      setOtSubmitError('Overtime can only be filed outside your scheduled shift hours.');
      return false;
    }

    return true;
  }

  function requestOtConfirmation() {
    if (!validateOtForm()) return;
    setConfirmOtSubmit(true);
  }

  async function submitOt() {
    if (!validateOtForm()) {
      return;
    }
    setConfirmOtSubmit(false);

    const startDateTime = `${otStartDate}T${otStartTime}:00`;
    const endDateTime = `${otEndDate}T${otEndTime}:00`;

    try {
      let attachmentRef: number | null = null;
      if (otFile) {
        attachmentRef = await uploadDocument(otFile, OVERTIME_UPLOAD_SUBDIR);
      }

      await apiFetchJson('/api/overtime/create', {
        method: 'POST',
        body: JSON.stringify({
          workDate: otStartDate,
          startTime: startDateTime,
          endTime: endDateTime,
          overtimeType: otType,
          reason: [
            otReason.trim(),
            attachmentRef ? `(Attachment ID: ${attachmentRef})` : '',
          ]
            .filter(Boolean)
            .join(' '),
        }),
      });
      setOtOpen(false);
      setRequestEntries((prev) => [
        ...prev,
        {
          id: `ot-local-${Date.now()}`,
          kind: 'OT',
          dateKey: otStartDate,
          status: 'PENDING',
          reason: otReason.trim(),
          overtimeType: otType,
          startTime: formatDisplayTime(otStartTime),
          endTime: formatDisplayTime(otEndTime),
        },
      ]);
    } catch (error) {
      setOtSubmitError(getFriendlyErrorMessage(error, 'overtime-request'));
    }
  }

  function validateLeaveForm() {
    setSubmitError('');
    if (!employeeId) {
      setSubmitError('Unable to resolve employee account.');
      return false;
    }

    if (!startDate) {
      setSubmitError('Start date is required.');
      return false;
    }

    if (!endDate) {
      setSubmitError('End date is required.');
      return false;
    }

    if (!startTime) {
      setSubmitError('Start time is required.');
      return false;
    }

    if (!endTime) {
      setSubmitError('End time is required.');
      return false;
    }

    if (startDate < todayKey) {
      setSubmitError('Start date cannot be earlier than today.');
      return false;
    }

    if (endDate < startDate) {
      setSubmitError('End date cannot be earlier than the start date.');
      return false;
    }

    const startDateTime = `${startDate}T${startTime}:00`;
    const endDateTime = `${endDate}T${endTime}:00`;

    if (endDateTime <= startDateTime) {
      setSubmitError('End date and time must be later than the start date and time.');
      return false;
    }

    if (reason.trim().length < 5) {
      setSubmitError('Reason must be at least 5 characters.');
      return false;
    }

    return true;
  }

  function requestLeaveConfirmation() {
    if (!validateLeaveForm()) return;
    setConfirmLeaveSubmit(true);
  }

  async function submitLeave() {
    if (!validateLeaveForm()) {
      return;
    }
    setConfirmLeaveSubmit(false);

    const startDateTime = `${startDate}T${startTime}:00`;
    const endDateTime = `${endDate}T${endTime}:00`;

    try {
      let attachmentRef: number | null = null;
      if (file) {
        attachmentRef = await uploadDocument(file, LEAVE_UPLOAD_SUBDIR);
      }

      const payload = {
        startDateTime,
        endDateTime,
        leaveType,
        reason: [
          reason.trim(),
          attachmentRef ? `(Attachment ID: ${attachmentRef})` : '',
        ]
          .filter(Boolean)
          .join(' '),
      };

      const response = await apiFetchRaw(`/api/leave/create/${employeeId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(response.status, text || `Request failed (${response.status})`);
      }

      const createdRequests = (await response.json()) as unknown;
      setLeaveOpen(false);
      setRequestEntries((prev) => [...prev, ...mapLeaveRequestEntries(createdRequests)]);
    } catch (error) {
      setSubmitError(getFriendlyErrorMessage(error, 'leave-request'));
    }
  }

  return (
    <div className="att">
      {/* Title row */}
      <div className="att__head">
        <PageHeader
          title="Attendance"
          description="Review your work logs, requests, shifts, and events in one monthly calendar."
        />
        <div className="att__controls">
          <div className="att__monthSelectWrap">
            <select
              className="att__monthSelect"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                parseMonthValue(e.target.value);
              }}
            >
              {monthOptions.map((label) => {
                return (
                  <option key={label} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            className="attClockBtn"
            type="button"
            onClick={requestAttendanceConfirmation}
            disabled={isClocking}
          >
            <span>{isClocking ? 'Submitting...' : isClockOutAction ? 'Time Out' : 'Time In'}</span>
            <span className="attClockBtn__icon">
              <FiPlusSquare />
            </span>
          </button>
        </div>
      </div>
      {clockMessage && <p className="field__ok">{clockMessage}</p>}

      <section className="attBalanceCard" aria-labelledby="att-leave-balances-title">
        <div className="attBalanceCard__header">
          <div className="attBalanceCard__copy">
            <h2 className="attBalanceCard__title" id="att-leave-balances-title">
              Leave Balances
            </h2>
            <p className="attBalanceCard__subtitle">
              Review your available leave in hours before filing a new request.
            </p>
          </div>
          <p className="attBalanceCard__note">Pending requests may not yet be deducted.</p>
        </div>

        {leaveBalanceStatus === 'loading' ? (
          <p className="attBalanceCard__loading">Loading leave balances...</p>
        ) : leaveBalanceStatus === 'unavailable' ? (
          <p className="attBalanceCard__loading">Your leave balances are unavailable right now.</p>
        ) : (
          <div className="attBalanceGrid">
            {orderedLeaveBalances.map((item) => (
              <div
                key={item.key}
                className={`attBalancePill${item.balance ? '' : ' attBalancePill--empty'}`}
              >
                <span className="attBalancePill__label">{item.label}</span>
                <strong className="attBalancePill__value">
                  {item.balance ? formatBalanceHoursLabel(item.balance.balanceHours) : 'Not assigned'}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Calendar card */}
      <section className="attCard">
        <div className="attCalendarShell" aria-label="Attendance calendar">
          <div className="attCalendarShell__top">
            <button
              type="button"
              className="attCalendarShell__navBtn"
              onClick={() => shiftCalendarMonth(-1)}
              aria-label="Previous month"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <strong className="attCalendarShell__month">{monthLabel}</strong>
            <button
              type="button"
              className="attCalendarShell__navBtn"
              onClick={() => shiftCalendarMonth(1)}
              aria-label="Next month"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="attCalendarShell__legend" aria-hidden="true">
            <span className="attCalendarShell__legendItem">
              <span className="attCalendarShell__legendSwatch attCalendarShell__legendSwatch--leave" />
              Leave
            </span>
            <span className="attCalendarShell__legendItem">
              <span className="attCalendarShell__legendSwatch attCalendarShell__legendSwatch--ot" />
              Overtime
            </span>
          </div>

          <div className="cal" style={calendarGridStyle}>
            <div className="cal__dow">SU</div>
            <div className="cal__dow">MO</div>
            <div className="cal__dow">TU</div>
            <div className="cal__dow">WE</div>
            <div className="cal__dow">TH</div>
            <div className="cal__dow">FR</div>
            <div className="cal__dow">SA</div>

            {calendarCells.map((c, idx) => {
              const dateKey = c.day ? toISODate(year, monthIndex, c.day) : '';
              const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
              const isToday = c.day !== null && dateKey === todayKey;
              const isSelected = c.day !== null && dateKey === selectedDateKey;
              const hasRequest = c.day !== null && approvedRequestDateKeys.has(dateKey);
              const clickable = c.day !== null;
              const hasContent = Boolean((c.statusNotes?.length ?? 0) || (c.detailNotes?.length ?? 0));
              const cellTitle = [...(c.statusNotes ?? []), ...(c.detailNotes ?? [])].join(' | ');
              const cls = [
                'cal__cell',
                clickable ? 'cal__cell--click' : 'cal__cell--disabled',
                hasContent ? 'cal__cell--active' : '',
                isToday ? 'cal__cell--today' : '',
                isSelected ? 'cal__cell--selected' : '',
                c.variant ? `cal__cell--${c.variant}` : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={idx}
                  type="button"
                  className={cls}
                  disabled={c.day === null}
                  title={cellTitle || undefined}
                  onClick={() => {
                    if (!c.day) return;
                    setSelectedDateKey(dateKey);
                    if (hasRequest) openRequestForDay(c.day);
                  }}
                  aria-label={c.day ? `Date ${monthLabel} ${c.day}${isToday ? ', today' : ''}` : 'Empty'}
                  aria-current={isToday ? 'date' : undefined}
                >
                  {c.day ? (
                    <div className="cal__cellTop">
                      <div className="cal__day">{c.day}</div>
                    </div>
                  ) : null}
                  {c.statusNotes && (
                    <div className="cal__statusNotes">
                      {c.statusNotes.slice(0, 2).map((line, lineIdx) => (
                        <span
                          key={`${line}-${lineIdx}`}
                          className={`cal__note ${
                            line.toLowerCase().includes('leave')
                              ? 'cal__note--leave'
                              : line.toLowerCase().includes('ot')
                                ? 'cal__note--ot'
                                  : ''
                          }`}
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.detailNotes && (
                    <div className="cal__detailNotes">
                      {c.detailNotes.map((line, lineIdx) => (
                        <span key={`${line}-${lineIdx}`} className="cal__detail">
                          {line}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom buttons like figma */}
      <div className="attActions">
        <button className="attBtn" type="button" onClick={openLeaveForToday}>
          <span>Request Leave</span>
          <span className="attBtn__icon">
            <FiPlusSquare />
          </span>
        </button>

        {canRequestOvertime && (
          <button
            className="attBtn"
            type="button"
            onClick={openOtForToday}
          >
            <span>Request Overtime</span>
            <span className="attBtn__icon">
              <FiPlusSquare />
            </span>
          </button>
        )}
      </div>

      {/* Leave Modal */}
      {leaveOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Leave Application Form">
          <div className="modal modal--request">
            <div className="modal__top modal__top--request">
              <div className="modal__meta">
                <div className="modal__title">Leave Application Form</div>
                <p className="modal__subtitle">
                  Submit the coverage window, leave type, and any supporting details for approval.
                </p>
              </div>
              <ModalCloseButton className="modal__close" onClick={closeLeave} />
            </div>

            <div className="modal__rule modal__rule--request" />

            <div className="requestForm">
              <div className="requestForm__grid">
                <div className="requestField requestField--span2">
                  <label className="label">Type of Leave Requested</label>
                  <p className="requestField__help">Choose the leave category that applies to this request.</p>
                  <select
                    className="input"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  >
                    {LEAVE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div
                    className={`requestField__balanceHint${
                      leaveBalanceStatus === 'ready' && selectedLeaveBalance ? '' : ' requestField__balanceHint--muted'
                    }`}
                  >
                    <span className="requestField__balanceLabel">
                      {formatLeaveTypeLabel(leaveType)} balance
                    </span>
                    <strong className="requestField__balanceValue">{selectedLeaveBalanceLabel}</strong>
                    <span className="requestField__balanceNote">{selectedLeaveBalanceNote}</span>
                  </div>
                </div>

                <div className="requestField">
                  <label className="label">Start Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        className="input"
                        type="date"
                        value={startDate}
                        min={todayKey}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <FiCalendar className="inputIcon__icon" />
                    </div>
                    <input
                      className="input"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="requestField">
                  <label className="label">End Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        className="input"
                        type="date"
                        value={endDate}
                        min={startDate || todayKey}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                      <FiCalendar className="inputIcon__icon" />
                    </div>
                    <input
                      className="input"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="requestField requestField--span2">
                  <label className="label">Reason for Leave</label>
                  <textarea
                    className="textarea"
                    placeholder="Describe why you need this leave request."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="requestField requestField--span2">
                  <FileUploadField
                    label="Supporting Documents (Optional)"
                    hint="Add medical certificates, screenshots, or other files only when they help validate this leave request. Maximum file size: 10 MB."
                    file={file}
                    onChange={setFile}
                    emptyLabel="Optional attachment"
                  />
                </div>
              </div>

              <div className="requestActions">
                <button className="btn btn--ghost" type="button" onClick={closeLeave}>
                  Cancel
                </button>
                <button className="btn" type="button" onClick={requestLeaveConfirmation}>
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {otOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Overtime Application Form">
          <div className="modal modal--request">
            <div className="modal__top modal__top--request">
              <div className="modal__meta">
                <div className="modal__title">Overtime Application Form</div>
                <p className="modal__subtitle">
                  Request overtime coverage with the exact date, time window, and reason for the additional work.
                </p>
              </div>
              <ModalCloseButton className="modal__close" onClick={closeOt} />
            </div>

            <div className="modal__rule modal__rule--request" />

            <div className="requestForm">
              <div className="requestForm__grid">
                <div className="requestField requestField--span2">
                  <label className="label">Type of Overtime Requested</label>
                  <p className="requestField__help">Pick the overtime category that matches this work period.</p>
                  <select
                    className="input"
                    value={otType}
                    onChange={(e) => setOtType(e.target.value as OvertimeType)}
                  >
                    <option value="OVERTIME">Overtime</option>
                    <option value="DOUBLE_OVERTIME">Double Overtime</option>
                    <option value="TRIPLE_OVERTIME">Triple Overtime</option>
                    <option value="HOLIDAY">Holiday</option>
                  </select>
                </div>

                <div className="requestField">
                  <label className="label">Start Date</label>
                  <div className="inputIcon">
                    <input
                      className="input"
                      type="date"
                      value={otStartDate}
                      min={todayKey}
                      onChange={(e) => setOtStartDate(e.target.value)}
                    />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>

                <div className="requestField">
                  <label className="label">Start Time</label>
                  <input
                    className="input"
                    type="time"
                    value={otStartTime}
                    onChange={(e) => setOtStartTime(e.target.value)}
                  />
                </div>

                <div className="requestField">
                  <label className="label">End Date</label>
                  <div className="inputIcon">
                    <input
                      className="input"
                      type="date"
                      value={otEndDate}
                      min={otStartDate || todayKey}
                      max={maxOtEndDate || undefined}
                      onChange={(e) => setOtEndDate(e.target.value)}
                    />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>

                <div className="requestField">
                  <label className="label">End Time</label>
                  <input
                    className="input"
                    type="time"
                    value={otEndTime}
                    max={isOtNextDay ? '06:00' : undefined}
                    onChange={(e) => setOtEndTime(e.target.value)}
                  />
                </div>

                <div className="requestField requestField--span2">
                  <label className="label">Reason for Overtime</label>
                  <textarea
                    className="textarea"
                    placeholder="Describe the work that requires overtime."
                    value={otReason}
                    onChange={(e) => setOtReason(e.target.value)}
                  />
                </div>

                <div className="requestField requestField--span2">
                  <FileUploadField
                    label="Supporting Documents (Optional)"
                    hint="Attach schedules, work orders, or supporting proof only when they help explain this overtime request. Maximum file size: 10 MB."
                    file={otFile}
                    onChange={setOtFile}
                    emptyLabel="Optional attachment"
                  />
                </div>
              </div>

              <div className="requestActions">
                <button className="btn btn--ghost" type="button" onClick={closeOt}>
                  Cancel
                </button>
                <button className="btn" type="button" onClick={requestOtConfirmation}>
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {requestViewOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Request Details">
          <div className="modal">
            <div className="modal__top">
              <div className="modal__title">REQUEST DETAILS</div>
              <ModalCloseButton className="modal__close" onClick={closeRequestView} />
            </div>
            <div className="modal__rule" />
            <div className="form">
              <div className="formRow">
                <label className="label">Date:</label>
                <input className="input" value={formatDisplayDate(requestViewDate)} readOnly />
              </div>
              {(requestEntries.filter((entry) => entry.dateKey === requestViewDate)).map((entry) => (
                <div key={entry.id} className="formRow">
                  <label className="label">
                    {entry.kind} ({entry.status}):
                  </label>
                  <div>
                    <input
                      className="input"
                      value={
                        entry.kind === 'OT'
                          ? `${entry.overtimeType ?? 'OT'} ${entry.startTime ?? ''}-${entry.endTime ?? ''}`.trim()
                          : `${formatLeaveTypeLabel(entry.leaveType)} - ${entry.paid === false ? 'Unpaid' : 'Paid'}`
                      }
                      readOnly
                    />
                    <textarea className="textarea" value={entry.reason || 'No reason provided.'} readOnly />
                  </div>
                </div>
              ))}
              <div className="modalActions">
                <button className="btn btn--ghost" type="button" onClick={closeRequestView}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClockAction !== null}
        title={confirmClockAction === 'TIME_OUT' ? 'Confirm Time Out' : 'Confirm Time In'}
        message={`Are you sure you want to ${confirmClockAction === 'TIME_OUT' ? 'time out' : 'time in'}?`}
        confirmLabel={confirmClockAction === 'TIME_OUT' ? 'Time Out' : 'Time In'}
        cancelLabel="Go Back"
        isBusy={isClocking}
        onConfirm={() => void recordAttendance()}
        onCancel={closeClockConfirmation}
      />
      <ConfirmDialog
        open={confirmLeaveSubmit}
        title="Confirm Leave Request"
        message={`Submit this ${leaveType.replaceAll('_', ' ').toLowerCase()} request from ${formatDisplayDate(
          startDate
        )} ${formatDisplayTime(startTime)} to ${formatDisplayDate(endDate)} ${formatDisplayTime(endTime)}?`}
        confirmLabel="Submit Leave Request"
        cancelLabel="Go Back"
        onConfirm={() => void submitLeave()}
        onCancel={() => setConfirmLeaveSubmit(false)}
      />
      <ConfirmDialog
        open={confirmOtSubmit}
        title="Confirm Overtime Request"
        message={`Submit this ${otType.replaceAll('_', ' ').toLowerCase()} request from ${formatDisplayDate(
          otStartDate
        )} ${formatDisplayTime(otStartTime)} to ${formatDisplayDate(otEndDate)} ${formatDisplayTime(otEndTime)}?`}
        confirmLabel="Submit Overtime Request"
        cancelLabel="Go Back"
        onConfirm={() => void submitOt()}
        onCancel={() => setConfirmOtSubmit(false)}
      />
    </div>
  );
}
