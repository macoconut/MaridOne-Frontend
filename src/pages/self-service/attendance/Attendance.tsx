import { useLoading } from '../../../context/useLoading';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import './Attendance.css';
import { FiCalendar, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiDownload, FiPlusSquare, FiPrinter, FiXCircle } from 'react-icons/fi';
import ActionButton from '../../../components/button/ActionButton';
import FileUploadField from '../../../components/form/FileUploadField';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import LargePopup from '../../../components/dialog/LargePopup';
import { useUiDialog } from '../../../components/dialog/useUiDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { useUnsavedChangesPrompt } from '../../../hooks/useUnsavedChangesPrompt';
import { ApiError, apiFetchJson, apiFetchRaw, toArray } from '../../../lib/api';
import { uploadDocument } from '../../../lib/documentUpload';
import { sanitizeFileNamePart } from '../../../lib/fileNames';
import { getUserEmail, getUserRole } from '../../../lib/session';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import { getManilaNow } from '../../../lib/manilaTime';

type LeaveType =
  | 'SICK_LEAVE'
  | 'VACATION_LEAVE'
  | 'MATERNITY_LEAVE'
  | 'PATERNITY_LEAVE'
  | 'SOLO_PARENT_LEAVE'
  | 'MAGNA_CARTA'
  | 'RA9262'
  | 'EMERGENCY_LEAVE';
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

type DailyShiftRow = {
  dailyShiftId?: number;
  workDate?: string;
  startDateTime?: string;
  endDateTime?: string;
  dayOff?: boolean;
};

type DayCell = {
  day: number | null;
  statusNotes?: string[];
  detailNotes?: string[];
  variant?: 'leave' | 'ot';
  clickable?: boolean;
};

type AttendanceLog = {
  attendanceId?: number;
  timestamp?: string;
  direction?: string;
};

type EmployeeDetails = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  managerName?: string;
};

type TimecardMode = 'calendar' | 'timecard';

type TimecardSession = {
  inAt: Date;
  outAt: Date;
};

type TimecardRange = {
  from: string;
  to: string;
};

type TimecardRow = {
  dateKey: string;
  label: string;
  timeIn: string;
  timeOut: string;
  breakHours: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
};

type AttendanceSession = {
  in?: string;
  out?: string;
};

type AttendanceHistory = {
  sessionsByDate: Record<string, AttendanceSession[]>;
  latestDirection: 'IN' | 'OUT' | null;
};

const MAX_VISIBLE_CALENDAR_LOGS = 3;

type LeaveBalanceRow = {
  leaveId?: number;
  balanceHours?: number | string | null;
  leaveType?: LeaveType | string;
};

type LeaveShiftWindow = {
  start: Date;
  end: Date;
};

const LEAVE_UPLOAD_SUBDIR = 'leave-request';
const OVERTIME_UPLOAD_SUBDIR = 'overtime-request';
const NON_SICK_LEAVE_NOTICE_DAYS = 7;

const LEAVE_TYPE_OPTIONS: Array<{ label: string; value: LeaveType }> = [
  { label: 'Sick Leave', value: 'SICK_LEAVE' },
  { label: 'Vacation Leave', value: 'VACATION_LEAVE' },
  { label: 'Maternity Leave', value: 'MATERNITY_LEAVE' },
  { label: 'Paternity Leave', value: 'PATERNITY_LEAVE' },
  { label: 'Solo Parent Leave', value: 'SOLO_PARENT_LEAVE' },
  { label: 'Magna Carta', value: 'MAGNA_CARTA' },
  { label: 'RA 9262', value: 'RA9262' },
  { label: 'Emergency Leave', value: 'EMERGENCY_LEAVE' },
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
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimecardRowDate(value?: string) {
  if (!value) return '-';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimecardPayPeriod(from?: string, to?: string) {
  if (!from || !to) return '-';
  return `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`;
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

function subtractDays(dateValue: string, days: number) {
  return addDays(dateValue, -days);
}

function startOfWeekMonday(dateValue: string) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toISODate(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildWeekDateKeys(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function buildDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function normalizeTimeValue(value?: string) {
  if (!value) return '';
  const match = value.match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? value;
}

function buildTemplateShiftWindow(dateKey: string, schedule: ShiftScheduleRow) {
  const startTime = normalizeTimeValue(schedule.startTime);
  const endTime = normalizeTimeValue(schedule.endTime);
  if (!startTime || !endTime) return null;

  const start = buildDateTime(dateKey, startTime);
  const end = buildDateTime(endTime > startTime ? dateKey : addDays(dateKey, 1), endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  return { start, end } satisfies LeaveShiftWindow;
}

function buildDailyShiftWindow(shift: DailyShiftRow) {
  if (!shift.startDateTime || !shift.endDateTime) return null;

  const start = new Date(shift.startDateTime);
  const end = new Date(shift.endDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  return { start, end } satisfies LeaveShiftWindow;
}

function resolveEffectiveLeaveShiftWindows(
  dateKey: string,
  shiftScheduleByDayOfWeek: Map<string, ShiftScheduleRow>,
  dailyShiftScheduleByDate: Map<string, DailyShiftRow[]>
) {
  const dailyRows = dailyShiftScheduleByDate.get(dateKey) ?? [];
  if (dailyRows.length > 0) {
    if (dailyRows.some((shift) => shift.dayOff)) {
      return [] as LeaveShiftWindow[];
    }

    return dailyRows
      .map((shift) => buildDailyShiftWindow(shift))
      .filter((window): window is LeaveShiftWindow => window !== null)
      .sort((left, right) => left.start.getTime() - right.start.getTime());
  }

  const templateShift = shiftScheduleByDayOfWeek.get(resolveDayOfWeek(dateKey));
  if (!templateShift) return [] as LeaveShiftWindow[];

  const templateWindow = buildTemplateShiftWindow(dateKey, templateShift);
  return templateWindow ? [templateWindow] : [];
}

function calculateShiftAwareLeaveHours(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  shiftScheduleByDayOfWeek: Map<string, ShiftScheduleRow>,
  dailyShiftScheduleByDate: Map<string, DailyShiftRow[]>
) {
  if (!startDate || !startTime || !endDate || !endTime) return 0;

  const requestStart = buildDateTime(startDate, startTime);
  const requestEnd = buildDateTime(endDate, endTime);
  if (Number.isNaN(requestStart.getTime()) || Number.isNaN(requestEnd.getTime()) || requestEnd <= requestStart) {
    return 0;
  }

  return dateKeysBetween(startDate, endDate).reduce((sum, dateKey) => {
    const overlappedHours = resolveEffectiveLeaveShiftWindows(dateKey, shiftScheduleByDayOfWeek, dailyShiftScheduleByDate)
      .reduce((daySum, window) => {
        const overlapStart = new Date(Math.max(window.start.getTime(), requestStart.getTime()));
        const overlapEnd = new Date(Math.min(window.end.getTime(), requestEnd.getTime()));
        if (overlapEnd <= overlapStart) {
          return daySum;
        }

        const rawHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
        return daySum + (rawHours > 5 ? rawHours - 1 : rawHours);
      }, 0);

    return sum + overlappedHours;
  }, 0);
}

function requiresAdvanceLeaveNotice(leaveType: LeaveType | string) {
  return leaveType !== 'SICK_LEAVE' && leaveType !== 'EMERGENCY_LEAVE';
}

function isAdvanceBookingRestricted(leaveType: LeaveType | string) {
  return (
    leaveType === 'SICK_LEAVE' ||
    leaveType === 'EMERGENCY_LEAVE' ||
    leaveType === 'MAGNA_CARTA' ||
    leaveType === 'SOLO_PARENT_LEAVE' ||
    leaveType === 'RA9262'
  );
}

function resolveDayOfWeek(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()] ?? '';
}

function formatLongMonthDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
}

function formatWeekOptionLabel(weekStart: string, index: number) {
  const weekEnd = addDays(weekStart, 6);
  const dateRange = `${formatLongMonthDate(weekStart)} - ${formatLongMonthDate(weekEnd)}`;
  return index === 0 ? `This Week (${dateRange})` : dateRange;
}

function formatWeekdayDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function toManilaDateParts(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;

  if (!year || !month || !day || !hour || !minute) return null;

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    dateKey: `${year}-${month}-${day}`,
  };
}

function formatManilaTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

function resolveDefaultTimecardRange(now = getManilaNow()): TimecardRange {
  const currentMonthIndex = now.month - 1;
  const currentDateKey = toISODate(now.year, currentMonthIndex, now.day);

  if (now.day >= 11 && now.day <= 25) {
    return {
      from: toISODate(now.year, currentMonthIndex, 11),
      to: toISODate(now.year, currentMonthIndex, 25),
    };
  }

  if (now.day >= 26) {
    const nextMonthDate = addDays(currentDateKey, 20);
    const nextMonth = new Date(`${nextMonthDate}T12:00:00`);
    return {
      from: toISODate(now.year, currentMonthIndex, 26),
      to: toISODate(nextMonth.getFullYear(), nextMonth.getMonth(), 10),
    };
  }

  const previousMonthDate = subtractDays(currentDateKey, 20);
  const previousMonth = new Date(`${previousMonthDate}T12:00:00`);
  return {
    from: toISODate(previousMonth.getFullYear(), previousMonth.getMonth(), 26),
    to: toISODate(now.year, currentMonthIndex, 10),
  };
}

function calculateSessionHours(session: TimecardSession) {
  return (session.outAt.getTime() - session.inAt.getTime()) / (1000 * 60 * 60);
}

function deductUnpaidLunchHour(rawHours: number) {
  if (!Number.isFinite(rawHours) || rawHours <= 0) return 0;
  if (rawHours <= 5) return Number(rawHours.toFixed(2));
  return Number(Math.max(0, rawHours - 1).toFixed(2));
}

function calculateWorkedHoursWithinWindow(
  sessions: TimecardSession[],
  windowStart: Date,
  windowEnd: Date
) {
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime()) || windowEnd <= windowStart) {
    return 0;
  }

  return Number(
    sessions.reduce((sum, session) => {
      const overlapStart = Math.max(session.inAt.getTime(), windowStart.getTime());
      const overlapEnd = Math.min(session.outAt.getTime(), windowEnd.getTime());
      if (overlapEnd <= overlapStart) return sum;
      return sum + (overlapEnd - overlapStart) / (1000 * 60 * 60);
    }, 0).toFixed(2)
  );
}

function resolveTimecardSessionsForDate(logs: AttendanceLog[], workDate: string) {
  if (!workDate) return [] as TimecardSession[];

  const nextDate = addDays(workDate, 1);
  const relevantLogs = toArray<AttendanceLog>(logs)
    .map((log) => {
      if (typeof log.timestamp !== 'string') return null;
      const date = new Date(log.timestamp);
      if (Number.isNaN(date.getTime())) return null;
      const manilaParts = toManilaDateParts(date);
      if (!manilaParts) return null;

      return {
        date,
        direction: String(log.direction ?? '').toUpperCase(),
        manilaDateKey: manilaParts.dateKey,
        manilaHour: manilaParts.hour,
        manilaMinute: manilaParts.minute,
      };
    })
    .filter(
      (
        item
      ): item is { date: Date; direction: string; manilaDateKey: string; manilaHour: number; manilaMinute: number } =>
        item !== null
    )
    .filter((item) => {
      if (item.manilaDateKey === workDate) return true;
      if (item.manilaDateKey !== nextDate) return false;
      return item.manilaHour < 6 || (item.manilaHour === 6 && item.manilaMinute === 0);
    })
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  const sessions: TimecardSession[] = [];
  let currentIn: Date | null = null;

  for (const log of relevantLogs) {
    if (log.direction === 'IN') {
      if (currentIn === null && log.manilaDateKey === workDate) {
        currentIn = log.date;
      }
      continue;
    }

    if (log.direction === 'OUT' && currentIn && log.date.getTime() > currentIn.getTime()) {
      sessions.push({ inAt: currentIn, outAt: log.date });
      currentIn = null;
    }
  }

  return sessions;
}

function parseContentDispositionFileName(value?: string | null) {
  if (!value) return null;

  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return utfMatch[1].trim().replace(/^"|"$/g, '');
    }
  }

  const basicMatch = value.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1]?.trim() || null;
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

function formatHiddenAttendanceCount(count: number) {
  return `+${count} more log${count === 1 ? '' : 's'}`;
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
  const { showLoading, hideLoading } = useLoading();
  const { showSuccess } = useUiDialog();
  const todayKey = useMemo(() => getManilaNow().dateKey, []);
  const initialTimecardRange = useMemo(() => resolveDefaultTimecardRange(), []);
  const nonSickLeaveMinDate = useMemo(
    () => addDays(todayKey, NON_SICK_LEAVE_NOTICE_DAYS),
    [todayKey]
  );
  const [year, setYear] = useState(() => getManilaNow().year);
  const [monthIndex, setMonthIndex] = useState(() => getManilaNow().month - 1);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const [monthValue, setMonthValue] = useState(monthLabel);
  const monthOptions = useMemo(() => {
    const manila = getManilaNow();
    const startYear = Math.min(manila.year, year) - 5;
    const endYear = Math.max(manila.year, year) + 5;
    const totalMonths = (endYear - startYear + 1) * 12;

    return Array.from({ length: totalMonths }, (_, index) =>
      new Date(startYear, index, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [year]);

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
  const [isLeaveSubmitting, setIsLeaveSubmitting] = useState(false);
  const [isOtSubmitting, setIsOtSubmitting] = useState(false);
  const [isPreparingTimecard, setIsPreparingTimecard] = useState(false);
  const [leaveSubmitAttempted, setLeaveSubmitAttempted] = useState(false);
  const [leaveBalanceWarning, setLeaveBalanceWarning] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeDetails | null>(null);
  const [requestEntries, setRequestEntries] = useState<RequestEntry[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [attendanceByDate, setAttendanceByDate] = useState<Record<string, AttendanceSession[]>>({});
  const [shiftSchedule, setShiftSchedule] = useState<ShiftScheduleRow[]>([]);
  const [dailyShiftSchedule, setDailyShiftSchedule] = useState<DailyShiftRow[]>([]);
  const [leaveDailyShiftSchedule, setLeaveDailyShiftSchedule] = useState<DailyShiftRow[]>([]);
  const [timecardDailyShiftSchedule, setTimecardDailyShiftSchedule] = useState<DailyShiftRow[]>([]);
  const [scheduleWeekStatus, setScheduleWeekStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [leaveBalanceStatus, setLeaveBalanceStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [timecardMode, setTimecardMode] = useState<TimecardMode>('calendar');
  const [timecardFromDate, setTimecardFromDate] = useState(initialTimecardRange.from);
  const [timecardToDate, setTimecardToDate] = useState(initialTimecardRange.to);
  const [timecardActionError, setTimecardActionError] = useState('');
  const [otOpen, setOtOpen] = useState(false);
  const [otStartDate, setOtStartDate] = useState<string>('');
  const [otEndDate, setOtEndDate] = useState<string>('');
  const [otStartTime, setOtStartTime] = useState<string>('17:00');
  const [otEndTime, setOtEndTime] = useState<string>('20:00');
  const [otType, setOtType] = useState<OvertimeType>('OVERTIME');
  const [otReason, setOtReason] = useState<string>('');
  const [otFile, setOtFile] = useState<File | null>(null);
  const [otSubmitError, setOtSubmitError] = useState('');
  const [otSubmitAttempted, setOtSubmitAttempted] = useState(false);
  const [requestViewOpen, setRequestViewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [requestViewDate, setRequestViewDate] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [isClocking, setIsClocking] = useState(false);
  const [clockError, setClockError] = useState('');
  const [confirmClockAction, setConfirmClockAction] = useState<'TIME_IN' | 'TIME_OUT' | null>(null);
  const [confirmLeaveSubmit, setConfirmLeaveSubmit] = useState(false);
  const [confirmOtSubmit, setConfirmOtSubmit] = useState(false);
  const [latestAttendanceDirection, setLatestAttendanceDirection] = useState<'IN' | 'OUT' | null>(null);
  const currentScheduleWeekStart = useMemo(() => startOfWeekMonday(todayKey), [todayKey]);
  const [selectedScheduleWeekStart, setSelectedScheduleWeekStart] = useState(currentScheduleWeekStart);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestRow[]>([]);
  useErrorDialogEffect(clockError, 'Attendance action failed');
  useErrorDialogEffect(otSubmitError, 'Overtime request could not be submitted');
  useErrorDialogEffect(submitError, 'Leave request could not be submitted');
  useErrorDialogEffect(timecardActionError, 'Timecard action failed');
  useEscapeDismiss(requestViewOpen, closeRequestView, 10);
  useEscapeDismiss(scheduleOpen, closeSchedule, 10);
  useEffect(() => {
    setSelectedScheduleWeekStart(currentScheduleWeekStart);
  }, [currentScheduleWeekStart]);
  const userRole = getUserRole();
  const canRequestOvertime = !['hr', 'management', 'manager'].includes(userRole ?? '');
  const canRequestTimecardOvertime = userRole === 'employee';
  const maxOtEndDate = otStartDate ? addDays(otStartDate, 1) : '';
  const isOtNextDay = Boolean(otStartDate && otEndDate && otEndDate === maxOtEndDate);
  const isTimecardRangeInvalid = !timecardFromDate || !timecardToDate || timecardToDate < timecardFromDate;
  const minimumLeaveStartDate = requiresAdvanceLeaveNotice(leaveType) ? nonSickLeaveMinDate : todayKey;
  const minimumLeaveEndDate =
    startDate && startDate >= minimumLeaveStartDate ? startDate : minimumLeaveStartDate;
  const isLeaveStartDateInvalid = leaveSubmitAttempted && !startDate;
  const isLeaveStartTimeInvalid = leaveSubmitAttempted && !startTime;
  const isLeaveEndDateInvalid = leaveSubmitAttempted && !endDate;
  const isLeaveEndTimeInvalid = leaveSubmitAttempted && !endTime;
  const isLeaveReasonInvalid = leaveSubmitAttempted && reason.trim().length < 5;
  const isOtStartDateInvalid = otSubmitAttempted && !otStartDate;
  const isOtStartTimeInvalid = otSubmitAttempted && !otStartTime;
  const isOtEndDateInvalid = otSubmitAttempted && !otEndDate;
  const isOtEndTimeInvalid = otSubmitAttempted && !otEndTime;
  const isOtReasonInvalid = otSubmitAttempted && otReason.trim().length < 5;
  const isLeaveDirty =
    leaveOpen &&
    (leaveType !== 'SICK_LEAVE' ||
      startDate !== todayKey ||
      startTime !== '08:00' ||
      endDate !== todayKey ||
      endTime !== '17:00' ||
      reason.trim().length > 0 ||
      file !== null);
  const isOtDirty =
    otOpen &&
    (otStartDate !== todayKey ||
      otEndDate !== todayKey ||
      otStartTime !== '17:00' ||
      otEndTime !== '20:00' ||
      otType !== 'OVERTIME' ||
      otReason.trim().length > 0 ||
      otFile !== null);
  const leaveUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: leaveOpen,
    isDirty: isLeaveDirty,
    onDiscard: closeLeave,
  });
  const overtimeUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: otOpen,
    isDirty: isOtDirty,
    onDiscard: closeOt,
  });
  useEscapeDismiss(leaveOpen && !leaveUnsavedPrompt.confirmOpen, leaveUnsavedPrompt.requestClose, 10);
  useEscapeDismiss(otOpen && !overtimeUnsavedPrompt.confirmOpen, overtimeUnsavedPrompt.requestClose, 10);

  function resetAttendanceData(includeEmployeeId = false) {
    if (includeEmployeeId) {
      setEmployeeId(null);
    }
    setEmployeeInfo(null);
    setRequestEntries([]);
    setAttendanceLogs([]);
    setAttendanceByDate({});
    setShiftSchedule([]);
    setDailyShiftSchedule([]);
    setLeaveDailyShiftSchedule([]);
    setTimecardDailyShiftSchedule([]);
    setLeaveBalances([]);
    setLatestAttendanceDirection(null);
    setLeaveBalanceStatus('unavailable');
    setScheduleWeekStatus('unavailable');
    setOvertimeRequests([]);
  }

  useEffect(() => {
    if (!leaveOpen) {
      return;
    }

    const normalizedStartDate = startDate && startDate >= minimumLeaveStartDate ? startDate : minimumLeaveStartDate;
    if (normalizedStartDate !== startDate) {
      setStartDate(normalizedStartDate);
      return;
    }

    if (!endDate || endDate < normalizedStartDate) {
      setEndDate(normalizedStartDate);
    }
  }, [endDate, leaveOpen, minimumLeaveStartDate, startDate]);

  async function fetchAttendanceHistory(resolvedEmpId: number) {
    try {
      const response = await apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=500`);
      const logs = toArray<AttendanceLog>(response);
      return {
        logs,
        history: buildAttendanceHistory(logs),
      };
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
  }, [monthLabel, monthIndex]);

  useEffect(() => {
    const manila = getManilaNow();
    if (manila.year === year && manila.month - 1 === monthIndex) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey('');
    }
  }, [monthIndex, todayKey, year]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) {
          if (!cancelled) {
            resetAttendanceData(true);
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
        if (resolvedEmpId) {
          setEmployeeId(resolvedEmpId);
        } else {
          resetAttendanceData(true);
        }
      } catch {
        if (cancelled) return;
        resetAttendanceData(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!employeeId) {
        resetAttendanceData();
        return;
      }

      try {
        const [employeeResponse, scheduleResponse] = await Promise.all([
          apiFetchJson<EmployeeDetails>(`/api/employees/${employeeId}`).catch(() => null),
          apiFetchJson<unknown>(`/api/employee/schedule/${employeeId}`).catch(() => []),
        ]);

        if (cancelled) return;
        setEmployeeInfo(employeeResponse);
        setShiftSchedule(toArray<ShiftScheduleRow>(scheduleResponse));
      } catch {
        if (cancelled) return;
        setEmployeeInfo(null);
        setShiftSchedule([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!employeeId) {
        setLeaveBalances([]);
        setLeaveBalanceStatus('unavailable');
        return;
      }

      try {
        const leaveBalanceResponse = await fetchLeaveBalances(employeeId);
        if (cancelled) return;
        setLeaveBalances(leaveBalanceResponse.rows);
        setLeaveBalanceStatus(leaveBalanceResponse.status);
      } catch {
        if (cancelled) return;
        setLeaveBalances([]);
        setLeaveBalanceStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!employeeId) {
        setRequestEntries([]);
        setAttendanceLogs([]);
        setAttendanceByDate({});
        setLatestAttendanceDirection(null);
        setOvertimeRequests([]);
        return;
      }

      try {
        const [leaveResponse, overtimeResponse, attendanceHistory] = await Promise.all([
          apiFetchJson<unknown>(`/api/leave/request/${employeeId}?page=0&size=200`),
          apiFetchJson<unknown>(`/api/overtime/all/${employeeId}?page=0&size=200`),
          fetchAttendanceHistory(employeeId),
        ]);

        if (cancelled) return;
        const overtimeRows = toArray<OvertimeRequestRow>(overtimeResponse);
        setRequestEntries([
          ...mapLeaveRequestEntries(leaveResponse),
          ...mapOvertimeRequestEntries(overtimeRows),
        ]);
        setAttendanceLogs(attendanceHistory?.logs ?? []);
        setAttendanceByDate(attendanceHistory?.history.sessionsByDate ?? {});
        setLatestAttendanceDirection(attendanceHistory?.history.latestDirection ?? null);
        setOvertimeRequests(overtimeRows);
      } catch {
        if (cancelled) return;
        setRequestEntries([]);
        setAttendanceLogs([]);
        setAttendanceByDate({});
        setLatestAttendanceDirection(null);
        setOvertimeRequests([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!scheduleOpen || !employeeId) {
        setDailyShiftSchedule([]);
        setScheduleWeekStatus(scheduleOpen ? 'unavailable' : 'loading');
        return;
      }

      setScheduleWeekStatus('loading');

      try {
        const weekEnd = addDays(selectedScheduleWeekStart, 6);
        const response = await apiFetchJson<unknown>(
          `/api/employee/schedule/daily/${employeeId}?startDate=${selectedScheduleWeekStart}&endDate=${weekEnd}`
        );

        if (cancelled) return;
        setDailyShiftSchedule(toArray<DailyShiftRow>(response));
        setScheduleWeekStatus('ready');
      } catch {
        if (cancelled) return;
        setDailyShiftSchedule([]);
        setScheduleWeekStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId, scheduleOpen, selectedScheduleWeekStart]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!leaveOpen || !employeeId || !startDate || !endDate || endDate < startDate) {
        setLeaveDailyShiftSchedule([]);
        return;
      }

      try {
        const response = await apiFetchJson<unknown>(
          `/api/employee/schedule/daily/${employeeId}?startDate=${startDate}&endDate=${endDate}`
        );

        if (cancelled) return;
        setLeaveDailyShiftSchedule(toArray<DailyShiftRow>(response));
      } catch {
        if (cancelled) return;
        setLeaveDailyShiftSchedule([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId, endDate, leaveOpen, startDate]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (
        timecardMode !== 'timecard' ||
        !employeeId ||
        !timecardFromDate ||
        !timecardToDate ||
        timecardToDate < timecardFromDate
      ) {
        setTimecardDailyShiftSchedule([]);
        return;
      }

      try {
        const response = await apiFetchJson<unknown>(
          `/api/employee/schedule/daily/${employeeId}?startDate=${timecardFromDate}&endDate=${timecardToDate}`
        );

        if (cancelled) return;
        setTimecardDailyShiftSchedule(toArray<DailyShiftRow>(response));
      } catch {
        if (cancelled) return;
        setTimecardDailyShiftSchedule([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [employeeId, timecardFromDate, timecardMode, timecardToDate]);

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
    if (leaveOpen || otOpen || requestViewOpen || scheduleOpen || confirmClockAction) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [confirmClockAction, leaveOpen, otOpen, requestViewOpen, scheduleOpen]);

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

  const requestEntriesByDate = useMemo(() => {
    const next = new Map<string, RequestEntry[]>();
    for (const entry of requestEntries) {
      const current = next.get(entry.dateKey);
      if (current) {
        current.push(entry);
      } else {
        next.set(entry.dateKey, [entry]);
      }
    }
    return next;
  }, [requestEntries]);

  const shiftScheduleByDayOfWeek = useMemo(() => {
    const next = new Map<string, ShiftScheduleRow>();
    for (const schedule of shiftSchedule) {
      if (typeof schedule.dayOfWeek !== 'string' || schedule.dayOfWeek.length === 0) continue;
      if (!next.has(schedule.dayOfWeek)) {
        next.set(schedule.dayOfWeek, schedule);
      }
    }
    return next;
  }, [shiftSchedule]);

  const approvedOvertimeRequestsByDate = useMemo(() => {
    const next = new Map<string, OvertimeRequestRow[]>();
    for (const request of overtimeRequests) {
      const workDate = typeof request.workDate === 'string' ? request.workDate.slice(0, 10) : '';
      if (!workDate || String(request.requestStatus ?? '').toUpperCase() !== 'APPROVED') continue;
      const current = next.get(workDate);
      if (current) {
        current.push(request);
      } else {
        next.set(workDate, [request]);
      }
    }
    return next;
  }, [overtimeRequests]);

  const scheduleWeekOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const value = addDays(currentScheduleWeekStart, index * 7);
        return {
          value,
          label: formatWeekOptionLabel(value, index),
        };
      }),
    [currentScheduleWeekStart]
  );

  const dailyShiftScheduleByDate = useMemo(() => {
    const next = new Map<string, DailyShiftRow>();
    for (const shift of dailyShiftSchedule) {
      if (typeof shift.workDate === 'string' && shift.workDate.length > 0) {
        next.set(shift.workDate.slice(0, 10), shift);
      }
    }
    return next;
  }, [dailyShiftSchedule]);

  const leaveDailyShiftScheduleByDate = useMemo(() => {
    const next = new Map<string, DailyShiftRow[]>();
    for (const shift of leaveDailyShiftSchedule) {
      if (typeof shift.workDate !== 'string' || shift.workDate.length === 0) continue;
      const dateKey = shift.workDate.slice(0, 10);
      const current = next.get(dateKey);
      if (current) {
        current.push(shift);
      } else {
        next.set(dateKey, [shift]);
      }
    }
    return next;
  }, [leaveDailyShiftSchedule]);

  const timecardDailyShiftScheduleByDate = useMemo(() => {
    const next = new Map<string, DailyShiftRow[]>();
    for (const shift of timecardDailyShiftSchedule) {
      if (typeof shift.workDate !== 'string' || shift.workDate.length === 0) continue;
      const dateKey = shift.workDate.slice(0, 10);
      const current = next.get(dateKey);
      if (current) {
        current.push(shift);
      } else {
        next.set(dateKey, [shift]);
      }
    }
    return next;
  }, [timecardDailyShiftSchedule]);

  const weekScheduleRows = useMemo(() => {
    return buildWeekDateKeys(selectedScheduleWeekStart).map((dateKey) => {
      const dailyShift = dailyShiftScheduleByDate.get(dateKey) ?? null;
      const templateShift = shiftScheduleByDayOfWeek.get(resolveDayOfWeek(dateKey)) ?? null;

      if (dailyShift?.dayOff) {
        return {
          dateKey,
          label: formatWeekdayDateLabel(dateKey),
          detail: 'Day Off',
          variant: 'dayoff' as const,
        };
      }

      const startValue = dailyShift?.startDateTime
        ? formatDisplayTime(dailyShift.startDateTime)
        : templateShift?.startTime
          ? formatDisplayTime(templateShift.startTime)
          : '';
      const endValue = dailyShift?.endDateTime
        ? formatDisplayTime(dailyShift.endDateTime)
        : templateShift?.endTime
          ? formatDisplayTime(templateShift.endTime)
          : '';

      if (startValue && endValue) {
        return {
          dateKey,
          label: formatWeekdayDateLabel(dateKey),
          detail: `${startValue} - ${endValue}`,
          variant: 'scheduled' as const,
        };
      }

      return {
        dateKey,
        label: formatWeekdayDateLabel(dateKey),
        detail: 'Day Off',
        variant: 'dayoff' as const,
      };
    });
  }, [dailyShiftScheduleByDate, selectedScheduleWeekStart, shiftScheduleByDayOfWeek]);

  const selectedLeaveBalance = leaveBalancesByType.get(leaveType) ?? null;
  const selectedLeaveBalanceLabel =
    leaveBalanceStatus === 'loading'
      ? 'Loading...'
      : leaveBalanceStatus === 'unavailable'
        ? 'Unavailable'
        : leaveType === 'EMERGENCY_LEAVE'
          ? 'No balance'
          : selectedLeaveBalance
            ? formatBalanceHoursLabel(selectedLeaveBalance.balanceHours)
            : 'Not assigned yet';
  const selectedLeaveBalanceNote =
    leaveBalanceStatus === 'loading'
      ? 'Checking your available leave balance.'
      : leaveBalanceStatus === 'unavailable'
        ? 'Your leave balances could not be loaded right now.'
        : leaveType === 'EMERGENCY_LEAVE'
          ? 'This leave type does not require a balance. HR can override if this will be paid or unpaid.'
          : selectedLeaveBalance
            ? ''
            : 'HR has not assigned this leave balance to your account yet.';

  const timecardRows = useMemo(() => {
    if (timecardMode !== 'timecard' || !timecardFromDate || !timecardToDate || timecardToDate < timecardFromDate) {
      return [] as TimecardRow[];
    }

    return dateKeysBetween(timecardFromDate, timecardToDate).map((dateKey) => {
      const sessions = resolveTimecardSessionsForDate(attendanceLogs, dateKey);
      const rawHours = sessions.reduce((sum, session) => sum + calculateSessionHours(session), 0);
      const adjustedRawHours = deductUnpaidLunchHour(rawHours);
      const breakHours = Number(Math.max(0, rawHours - adjustedRawHours).toFixed(2));

      const approvedOvertimeHours = (approvedOvertimeRequestsByDate.get(dateKey) ?? [])
        .reduce((sum, request) => {
          if (!request.startTime || !request.endTime) return sum;
          const start = new Date(request.startTime);
          const end = new Date(request.endTime);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sum;
          return sum + calculateWorkedHoursWithinWindow(sessions, start, end);
        }, 0);
      const overtimeHours = Number(approvedOvertimeHours.toFixed(2));

      const effectiveWindows = resolveEffectiveLeaveShiftWindows(
        dateKey,
        shiftScheduleByDayOfWeek,
        timecardDailyShiftScheduleByDate
      );
      const regularRawHours = effectiveWindows.reduce(
        (sum, window) => sum + calculateWorkedHoursWithinWindow(sessions, window.start, window.end),
        0
      );
      const regularHours = Number(
        (
          effectiveWindows.length > 0
            ? deductUnpaidLunchHour(regularRawHours)
            : Math.max(0, adjustedRawHours - overtimeHours)
        ).toFixed(2)
      );
      const totalHours = Number((regularHours + overtimeHours).toFixed(2));
      const timeIn = sessions[0] ? formatManilaTime(sessions[0].inAt) : '-';
      const timeOut = sessions.length > 0 ? formatManilaTime(sessions[sessions.length - 1].outAt) : '-';

      return {
        dateKey,
        label: formatTimecardRowDate(dateKey),
        timeIn,
        timeOut,
        breakHours,
        regularHours,
        overtimeHours,
        totalHours,
      } satisfies TimecardRow;
    });
  }, [approvedOvertimeRequestsByDate, attendanceLogs, shiftScheduleByDayOfWeek, timecardDailyShiftScheduleByDate, timecardFromDate, timecardMode, timecardToDate]);

  const timecardTotals = useMemo(() => {
    return timecardRows.reduce(
      (totals, row) => ({
        breakHours: Number((totals.breakHours + row.breakHours).toFixed(2)),
        regularHours: Number((totals.regularHours + row.regularHours).toFixed(2)),
        overtimeHours: Number((totals.overtimeHours + row.overtimeHours).toFixed(2)),
        totalHours: Number((totals.totalHours + row.totalHours).toFixed(2)),
      }),
      {
        breakHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        totalHours: 0,
      }
    );
  }, [timecardRows]);

  const employeeName = useMemo(() => {
    const parts = [employeeInfo?.firstName, employeeInfo?.middleName, employeeInfo?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    return parts || '-';
  }, [employeeInfo]);

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
    if (timecardMode !== 'calendar') {
      return [] as DayCell[];
    }

    // Build a Sunday-first calendar (SU..SA)
    const cells: DayCell[] = [];
    // leading blanks
    for (let i = 0; i < sundayBasedStart; i++) cells.push({ day: null });

    // actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toISODate(year, monthIndex, d);
      const dayRequests = requestEntriesByDate.get(dateKey) ?? [];
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
  }, [attendanceByDate, daysInMonth, monthIndex, requestEntriesByDate, sundayBasedStart, timecardMode, year]);

  
  const resolveShiftTimes = (dateKey: string) => {
    const dailyShift = dailyShiftScheduleByDate.get(dateKey);
    const shiftEnd = (dailyShift && !dailyShift.dayOff && dailyShift.endDateTime)
      ? dailyShift.endDateTime.slice(11, 16)
      : (shiftScheduleByDayOfWeek.get(resolveDayOfWeek(dateKey))?.endTime ?? '17:00');

    const [h, m] = shiftEnd.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m);
    const end = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    
    return {
      start: shiftEnd,
      end: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    };
  };

  function openLeaveForToday() {
    const manila = getManilaNow();
    const iso = manila.dateKey;
    const dailyShift = dailyShiftScheduleByDate.get(iso);
    const times = (dailyShift && !dailyShift.dayOff && dailyShift.startDateTime && dailyShift.endDateTime)
      ? { start: dailyShift.startDateTime.slice(11, 16), end: dailyShift.endDateTime.slice(11, 16) }
      : { start: '08:00', end: '17:00' };

    setStartDate(iso);
    setStartTime(times.start);
    setEndDate(iso);
    setEndTime(times.end);
    setLeaveType('SICK_LEAVE');
    setReason('');
    setFile(null);
    setSubmitError('');
    setLeaveSubmitAttempted(false);
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
    setConfirmLeaveSubmit(false);
    setFile(null);
    setSubmitError('');
    setLeaveSubmitAttempted(false);
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

  function openSchedule() {
    setSelectedScheduleWeekStart(currentScheduleWeekStart);
    setScheduleOpen(true);
  }

  function closeSchedule() {
    setScheduleOpen(false);
  }

  function openOtForToday() {
    if (!canRequestOvertime) return;
    const manila = getManilaNow();
    const iso = manila.dateKey;
    const times = resolveShiftTimes(iso);
    setOtStartDate(iso);
    setOtEndDate(iso);
    setOtStartTime(times.start);
    setOtEndTime(times.end);
    setOtType('OVERTIME');
    setOtReason('');
    setOtFile(null);
    setOtSubmitError('');
    setOtSubmitAttempted(false);
    setOtOpen(true);
  }

  function closeOt() {
    setConfirmOtSubmit(false);
    setOtFile(null);
    setOtSubmitError('');
    setOtSubmitAttempted(false);
    setOtOpen(false);
  }

  function requestAttendanceConfirmation() {
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

    const action = confirmClockAction;
    setIsClocking(true);
    showLoading();
    try {
      const response = await apiFetchRaw(`/api/logs/attendance/${employeeId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(response.status, text || `Attendance log failed (${response.status})`);
      }

      const updatedHistory = await fetchAttendanceHistory(employeeId);
      if (updatedHistory) {
        setAttendanceLogs(updatedHistory.logs);
        setAttendanceByDate(updatedHistory.history.sessionsByDate);
        setLatestAttendanceDirection(updatedHistory.history.latestDirection);
      } else {
        const manila = getManilaNow();
        const dateKey = manila.dateKey;
        const timeLabel = `${String(manila.hour).padStart(2, '0')}:${String(manila.minute).padStart(2, '0')}`;
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

      setConfirmClockAction(null);
      showSuccess(
        action === 'TIME_OUT'
          ? 'Your time out was recorded successfully.'
          : 'Your time in was recorded successfully.',
        action === 'TIME_OUT' ? 'Time Out Recorded' : 'Time In Recorded'
      );
    } catch (error) {
      setClockError(getFriendlyErrorMessage(error, 'attendance'));
    } finally {
      setIsClocking(false);
      hideLoading();
    }
  }

  function validateOtForm() {
    setOtSubmitAttempted(true);
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
    console.log('OT Validation Debug:', { 
      otStartDate, otStartTime, otEndDate, otEndTime, 
      requestStart: requestStart.toISOString(), 
      requestEnd: requestEnd.toISOString(),
      isBefore: requestEnd < requestStart 
    });
    if (Number.isNaN(requestStart.getTime()) || Number.isNaN(requestEnd.getTime()) || requestEnd < requestStart) {
      setOtSubmitError('End date and time must be later than the start date and time.');
      return false;
    }

    const scheduleForDay = shiftScheduleByDayOfWeek.get(resolveDayOfWeek(otStartDate));
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
    setIsOtSubmitting(true);
    showLoading();

    const startDateTime = `${otStartDate}T${otStartTime}`;
    const endDateTime = `${otEndDate}T${otEndTime}`;

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
    } finally {
      setIsOtSubmitting(false);
      hideLoading();
    }
  }

  function validateLeaveForm() {
    setLeaveSubmitAttempted(true);
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

    if (requiresAdvanceLeaveNotice(leaveType) && startDate < nonSickLeaveMinDate) {
      setSubmitError(
        `Non-sick leave requests must be filed at least ${NON_SICK_LEAVE_NOTICE_DAYS} days before the leave date.`
      );
      return false;
    }

    if (isAdvanceBookingRestricted(leaveType) && startDate >= addDays(todayKey, 60)) {
      setSubmitError('Leave requests cannot be filed 2 or more months in advance for this leave type.');
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

  useEffect(() => {
    if (!leaveOpen || !selectedLeaveBalance) {
      setLeaveBalanceWarning(null);
      return;
    }

    const requestedHours = calculateShiftAwareLeaveHours(
      startDate,
      startTime,
      endDate,
      endTime,
      shiftScheduleByDayOfWeek,
      leaveDailyShiftScheduleByDate
    );
    const availableHours = parseBalanceHours(selectedLeaveBalance.balanceHours) ?? 0;

    if (requestedHours > availableHours) {
      setLeaveBalanceWarning(
        `Warning: The requested duration of ${requestedHours.toFixed(1)} hours exceeds your available balance of ${availableHours.toFixed(1)} hours.`
      );
    } else {
      setLeaveBalanceWarning(null);
    }
  }, [endDate, endTime, leaveDailyShiftScheduleByDate, leaveOpen, selectedLeaveBalance, shiftScheduleByDayOfWeek, startDate, startTime]);

  function requestLeaveConfirmation() {
    if (!validateLeaveForm()) return;
    setConfirmLeaveSubmit(true);
  }

  async function submitLeave() {
    if (!validateLeaveForm()) {
      return;
    }
    setConfirmLeaveSubmit(false);
    setIsLeaveSubmitting(true);
    showLoading();

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
    } finally {
      setIsLeaveSubmitting(false);
      hideLoading();
    }
  }

  function buildTimecardPdfName() {
    const employeeSegment = sanitizeFileNamePart(employeeName) || `employee-${employeeId ?? 'timecard'}`;
    return `timecard_${employeeSegment}_${timecardFromDate || 'from'}_to_${timecardToDate || 'to'}.pdf`;
  }

  async function loadSelectedTimecardPdf() {
    if (!employeeId) {
      throw new Error('No employee selected.');
    }
    if (isTimecardRangeInvalid) {
      throw new Error('Choose a valid timecard date range first.');
    }

    const response = await apiFetchRaw(
      `/api/logs/attendance/self/${employeeId}/timecard/pdf?from=${encodeURIComponent(timecardFromDate)}&to=${encodeURIComponent(timecardToDate)}`,
      { method: 'GET' }
    );
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to generate the timecard (${response.status}).`;

      if (errorText) {
        try {
          const parsed = JSON.parse(errorText) as { error?: string; message?: string };
          errorMessage = parsed.error?.trim() || parsed.message?.trim() || errorMessage;
        } catch {
          errorMessage = errorText.trim() || errorMessage;
        }
      }

      throw new ApiError(response.status, errorMessage, errorMessage);
    }

    const pdfBlob = await response.blob();
    const fileName =
      parseContentDispositionFileName(response.headers.get('Content-Disposition')) || buildTimecardPdfName();
    const pdfFile = new File([pdfBlob], fileName, {
      type: pdfBlob.type || 'application/pdf',
    });

    return { file: pdfFile, fileName };
  }

  async function handleDownloadTimecard() {
    setTimecardActionError('');
    setIsPreparingTimecard(true);

    try {
      const { file, fileName } = await loadSelectedTimecardPdf();
      const downloadUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (error) {
      if (error instanceof ApiError) {
        setTimecardActionError(error.rawMessage || `Failed to download the timecard (${error.status}).`);
      } else {
        setTimecardActionError(error instanceof Error ? error.message : 'Failed to download the timecard.');
      }
    } finally {
      setIsPreparingTimecard(false);
    }
  }

  async function handlePrintTimecard() {
    setTimecardActionError('');
    setIsPreparingTimecard(true);

    try {
      const { file } = await loadSelectedTimecardPdf();
      const documentUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = documentUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
    } catch (error) {
      if (error instanceof ApiError) {
        setTimecardActionError(error.rawMessage || `Failed to open the timecard (${error.status}).`);
      } else {
        setTimecardActionError(error instanceof Error ? error.message : 'Failed to open the timecard.');
      }
    } finally {
      setIsPreparingTimecard(false);
    }
  }

  return (
    <div className="att">
      {/* Title row */}
      <div className="att__head">
        <PageHeader
          title="Attendance"
          description="Review your work logs through the monthly calendar or a downloadable timecard."
        />
        <div className="att__controls">
          <label className="attModeSelect attModeSelect--view" aria-label="Attendance view">
            <select value={timecardMode} onChange={(event) => setTimecardMode(event.target.value as TimecardMode)}>
              <option value="calendar">By Calendar</option>
              <option value="timecard">By Timecard</option>
            </select>
          </label>
          <button className="attClockBtn attClockBtn--schedule" type="button" onClick={openSchedule} title="View My Schedule">
            <span>My Schedule</span>
            <span className="attClockBtn__icon">
              <FiCalendar />
            </span>
          </button>
          <button
            className="attClockBtn"
            type="button"
            onClick={requestAttendanceConfirmation}
            disabled={isClocking}
            title={isClocking ? 'Submitting attendance' : isClockOutAction ? 'Time Out' : 'Time In'}
          >
            <span>{isClocking ? 'Submitting...' : isClockOutAction ? 'Time Out' : 'Time In'}</span>
            <span className="attClockBtn__icon">
              <FiPlusSquare />
            </span>
          </button>
        </div>
      </div>
      <section className="attBalanceCard" aria-labelledby="att-leave-balances-title">
        <div className="attBalanceCard__header">
          <div className="attBalanceCard__copy">
            <h2 className="attBalanceCard__title" id="att-leave-balances-title">
              Leave Balances
            </h2>
          </div>
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

      {timecardMode === 'calendar' ? (
        <>
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
                  const isToday = c.day !== null && dateKey === todayKey;
                  const isSelected = c.day !== null && dateKey === selectedDateKey;
                  const hasRequest = c.day !== null && approvedRequestDateKeys.has(dateKey);
                  const clickable = c.day !== null;
                  const hasContent = Boolean((c.statusNotes?.length ?? 0) || (c.detailNotes?.length ?? 0));
                  const detailNotes = c.detailNotes ?? [];
                  const visibleDetailNotes =
                    detailNotes.length > MAX_VISIBLE_CALENDAR_LOGS
                      ? detailNotes.slice(-MAX_VISIBLE_CALENDAR_LOGS)
                      : detailNotes;
                  const hiddenDetailCount = Math.max(0, detailNotes.length - visibleDetailNotes.length);
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
                          {visibleDetailNotes.map((line, lineIdx) => (
                            <span key={`${line}-${lineIdx}`} className="cal__detail">
                              {line}
                            </span>
                          ))}
                          {hiddenDetailCount > 0 && (
                            <span className="cal__detail cal__detail--more">
                              {formatHiddenAttendanceCount(hiddenDetailCount)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="attActions">
            <button className="attBtn" type="button" onClick={openLeaveForToday} title="Request Leave">
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
                title="Request Overtime"
              >
                <span>Request Overtime</span>
                <span className="attBtn__icon">
                  <FiPlusSquare />
                </span>
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <section className="attTimecardCard" aria-label="Employee timecard">
            <div className="attTimecardToolbar">
              <div className="attTimecardFilters__field attTimecardFilters__field--dates">
                <label>DATE RANGE:</label>
                <div className="attTimecardFilters__dateGroup">
                  <div className="attTimecardDateInput">
                    <FiCalendar />
                    <span className="attTimecardDateInput__value">{formatDisplayDate(timecardFromDate)}</span>
                    <input
                      type="date"
                      value={timecardFromDate}
                      onChange={(event) => setTimecardFromDate(event.target.value)}
                      aria-label="From date"
                    />
                  </div>
                  <span className="attTimecardFilters__dateSeparator">to</span>
                  <div className="attTimecardDateInput">
                    <FiCalendar />
                    <span className="attTimecardDateInput__value">{formatDisplayDate(timecardToDate)}</span>
                    <input
                      type="date"
                      value={timecardToDate}
                      min={timecardFromDate || undefined}
                      onChange={(event) => setTimecardToDate(event.target.value)}
                      aria-label="To date"
                    />
                  </div>
                </div>
              </div>
            </div>

            {isTimecardRangeInvalid && (
              <p className="field__error">Choose a valid date range where the end date is not earlier than the start date.</p>
            )}

            <section className="attTimecardSheet">
              <div className="attTimecardSheet__header">
                <div className="attTimecardSheet__brand">
                  <img className="attTimecardSheet__logo" src="/images/marid-logo-transparent.png" alt="Marid Industries logo" />
                  <div className="attTimecardSheet__companyCopy">
                    <div className="attTimecardSheet__companyName">Marid Industries Corporation</div>
                    <div className="attTimecardSheet__companyMeta">Address</div>
                    <div className="attTimecardSheet__companyMeta">marid@marid.com</div>
                  </div>
                </div>
                <div className="attTimecardSheet__title">EMPLOYEE TIMECARD</div>
              </div>

              <div className="attTimecardSheet__rule" />

              <div className="attTimecardInfo">
                <div className="attTimecardInfo__row">
                  <span className="attTimecardInfo__label">Employee Name</span>
                  <span className="attTimecardInfo__line">{employeeName}</span>
                  <span className="attTimecardInfo__label">Manager</span>
                  <span className="attTimecardInfo__line">{employeeInfo?.managerName ?? '-'}</span>
                </div>
                <div className="attTimecardInfo__row">
                  <span className="attTimecardInfo__label">Department</span>
                  <span className="attTimecardInfo__line">{employeeInfo?.department ?? '-'}</span>
                  <span className="attTimecardInfo__label">Dates</span>
                  <span className="attTimecardInfo__line">{formatTimecardPayPeriod(timecardFromDate, timecardToDate)}</span>
                </div>
                <div className="attTimecardInfo__row">
                  <span className="attTimecardInfo__label">Designation</span>
                  <span className="attTimecardInfo__line">{employeeInfo?.position ?? '-'}</span>
                  <span className="attTimecardInfo__label attTimecardInfo__label--empty" aria-hidden="true"></span>
                  <span className="attTimecardInfo__line attTimecardInfo__line--empty" aria-hidden="true"></span>
                </div>
              </div>

              <div className="attTimecardTable">
                <div className="attTimecardTable__head">
                  <span className="attTimecardTable__cell">Date</span>
                  <span className="attTimecardTable__cell">In</span>
                  <span className="attTimecardTable__cell">Out</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">Breaks</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">Reg. Hours</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">OT Hours</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">Total Hours</span>
                </div>

                <div className="attTimecardTable__body">
                  {timecardRows.length > 0 ? (
                    timecardRows.map((row) => (
                      <div key={row.dateKey} className="attTimecardTable__row">
                        <span className="attTimecardTable__cell">{row.label}</span>
                        <span className="attTimecardTable__cell">{row.timeIn}</span>
                        <span className="attTimecardTable__cell">{row.timeOut}</span>
                        <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{row.breakHours.toFixed(2)}</span>
                        <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{row.regularHours.toFixed(2)}</span>
                        <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{row.overtimeHours.toFixed(2)}</span>
                        <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{row.totalHours.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="attTimecardTable__empty">No timecard rows are available for the selected range.</div>
                  )}
                </div>

                <div className="attTimecardTable__total">
                  <span className="attTimecardTable__cell">Total</span>
                  <span className="attTimecardTable__cell" aria-hidden="true"></span>
                  <span className="attTimecardTable__cell" aria-hidden="true"></span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{timecardTotals.breakHours.toFixed(2)}</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{timecardTotals.regularHours.toFixed(2)}</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{timecardTotals.overtimeHours.toFixed(2)}</span>
                  <span className="attTimecardTable__cell attTimecardTable__cell--numeric">{timecardTotals.totalHours.toFixed(2)}</span>
                </div>
              </div>

              <div className="attTimecardSheet__rule attTimecardSheet__rule--thin" />

              <div className="attTimecardSign">
                <div className="attTimecardSign__line">
                  <span>Employee Signature over Printed Name</span>
                </div>
                <div className="attTimecardSign__line">
                  <span>Date</span>
                </div>
              </div>
            </section>
          </section>

          <div className="attTimecardActions">
            <ActionButton
              className="attTimecardAction"
              size="lg"
              icon={<FiDownload />}
              type="button"
              onClick={() => void handleDownloadTimecard()}
              disabled={isPreparingTimecard || isTimecardRangeInvalid || !employeeId}
            >
              {isPreparingTimecard ? 'Preparing Timecard...' : 'Download Timecard'}
            </ActionButton>
            <ActionButton
              className="attTimecardAction"
              size="lg"
              icon={<FiPrinter />}
              type="button"
              onClick={() => void handlePrintTimecard()}
              disabled={isPreparingTimecard || isTimecardRangeInvalid || !employeeId}
            >
              {isPreparingTimecard ? 'Opening Timecard...' : 'Print Timecard'}
            </ActionButton>
            <ActionButton className="attTimecardAction" size="lg" type="button" icon={<FiPlusSquare />} onClick={openLeaveForToday}>
              Request Leave
            </ActionButton>
            {canRequestTimecardOvertime && (
              <ActionButton className="attTimecardAction" size="lg" type="button" icon={<FiPlusSquare />} onClick={openOtForToday}>
                Request Overtime
              </ActionButton>
            )}
          </div>
        </>
      )}

      {/* Leave Modal */}
      <LargePopup
        open={leaveOpen}
        ariaLabel="Leave Application Form"
        title="Leave Application Form"
        subtitle="Submit the coverage window, leave type, and any supporting details for approval."
        size="lg"
        onClose={leaveUnsavedPrompt.requestClose}
        closeDisabled={isLeaveSubmitting}
        footer={(
          <>
            <ActionButton
              className="payModal__cancel"
              variant="ghost"
              type="button"
              icon={<FiXCircle />}
              onClick={leaveUnsavedPrompt.requestClose}
              disabled={isLeaveSubmitting}
            >
              Cancel
            </ActionButton>
            <ActionButton type="button" icon={<FiCheckCircle />} onClick={requestLeaveConfirmation} disabled={isLeaveSubmitting}>
              {isLeaveSubmitting ? 'Submitting...' : 'Submit'}
            </ActionButton>
          </>
        )}
      >
        <div className="requestForm">
                {submitError && <p className="field__error">{submitError}</p>}
                <div className="payModal__row">
                  <label>Type of Leave Requested</label>
                  <p className="requestField__help">
                    Choose the leave category that applies to this request.
                  </p>
                  
                  {/* Unified Restriction Hint */}
                  {(isAdvanceBookingRestricted(leaveType) || requiresAdvanceLeaveNotice(leaveType)) && (
                    <div className="requestField__callout requestField__callout--warning">
                      {isAdvanceBookingRestricted(leaveType) && (
                        <p>• This leave type cannot be filed 2 or more months in advance.</p>
                      )}
                      {requiresAdvanceLeaveNotice(leaveType) && (
                        <p>• This leave type needs at least {NON_SICK_LEAVE_NOTICE_DAYS} days of advance notice.</p>
                      )}
                    </div>
                  )}

                  <div className="requestField__group">
                    <select
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
                      className={`requestField__balancePill${
                        leaveBalanceStatus === 'ready' && selectedLeaveBalance ? '' : ' requestField__balancePill--muted'
                      }`}
                    >
                      <span className="requestField__balanceLabel">
                        {formatLeaveTypeLabel(leaveType)} balance
                      </span>
                      <strong className="requestField__balanceValue">{selectedLeaveBalanceLabel}</strong>
                    </div>
                  </div>
                  <span className="requestField__balanceNote">{selectedLeaveBalanceNote}</span>
                </div>

                <div className="payModal__row">
                  <label>Start Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        type="date"
                        value={startDate}
                        min={minimumLeaveStartDate}
                        max={isAdvanceBookingRestricted(leaveType) ? addDays(todayKey, 60) : undefined}
                        aria-invalid={isLeaveStartDateInvalid ? 'true' : undefined}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <FiCalendar className="inputIcon__icon" />
                    </div>
                    <div className="inputIcon">
                      <input
                        type="time"
                        value={startTime}
                        aria-invalid={isLeaveStartTimeInvalid ? 'true' : undefined}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                      <FiClock className="inputIcon__icon" />
                    </div>
                  </div>
                </div>

                <div className="payModal__row">
                  <label>End Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        type="date"
                        value={endDate}
                        min={minimumLeaveEndDate}
                        aria-invalid={isLeaveEndDateInvalid ? 'true' : undefined}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                      <FiCalendar className="inputIcon__icon" />
                    </div>
                    <div className="inputIcon">
                      <input
                        type="time"
                        value={endTime}
                        aria-invalid={isLeaveEndTimeInvalid ? 'true' : undefined}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                      <FiClock className="inputIcon__icon" />
                    </div>
                  </div>
                </div>

                <div className="payModal__row">
                  <label>Reason for Leave</label>
                  <textarea
                    placeholder="Describe why you need this leave request."
                    value={reason}
                    aria-invalid={isLeaveReasonInvalid ? 'true' : undefined}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="payModal__row">
                  <FileUploadField
                    label="Supporting Documents (Optional)"
                    hint="Add medical certificates, screenshots, or other files only when they help validate this leave request."
                    file={file}
                    onChange={setFile}
                    emptyLabel="Optional attachment"
                  />
                </div>

        </div>
      </LargePopup>

      <LargePopup
        open={otOpen}
        ariaLabel="Overtime Application Form"
        title="Overtime Application Form"
        subtitle="Request overtime coverage with the exact date, time window, and reason for the additional work."
        size="lg"
        onClose={overtimeUnsavedPrompt.requestClose}
        closeDisabled={isOtSubmitting}
        footer={(
          <>
            <ActionButton
              className="payModal__cancel"
              variant="ghost"
              type="button"
              icon={<FiXCircle />}
              disabled={isOtSubmitting}
              onClick={overtimeUnsavedPrompt.requestClose}
            >
              Cancel
            </ActionButton>
            <ActionButton type="button" icon={<FiCheckCircle />} disabled={isOtSubmitting} onClick={requestOtConfirmation}>
              {isOtSubmitting ? 'Submitting...' : 'Submit'}
            </ActionButton>
          </>
        )}
      >
        <div className="requestForm">
                <div className="payModal__row">
                  <label>Type of Overtime Requested</label>
                  <select
                    className="input"
                    value={otType}
                    disabled={isOtSubmitting}
                    onChange={(e) => setOtType(e.target.value as OvertimeType)}
                  >
                    <option value="OVERTIME">Overtime</option>
                    <option value="DOUBLE_OVERTIME">Double Overtime</option>
                    <option value="TRIPLE_OVERTIME">Triple Overtime</option>
                    <option value="HOLIDAY">Holiday</option>
                  </select>
                  {isOtNextDay && (
                    <p className="requestField__callout">
                      Overnight overtime can end the next day, but the latest allowed end time is 6:00 AM.
                    </p>
                  )}
                </div>

                <div className="payModal__row">
                  <label>Start Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        type="date"
                        value={otStartDate}
                        min={todayKey}
                        disabled={isOtSubmitting}
                        aria-invalid={isOtStartDateInvalid ? 'true' : undefined}
                        onChange={(e) => {
                          setOtStartDate(e.target.value);
                          const times = resolveShiftTimes(e.target.value);
                          setOtStartTime(times.start);
                          setOtEndTime(times.end);
                        }}                      />
                      <FiCalendar className="inputIcon__icon" />
                    </div>
                    <div className="inputIcon">
                      <input
                        type="time"
                        value={otStartTime}
                        disabled={isOtSubmitting}
                        aria-invalid={isOtStartTimeInvalid ? 'true' : undefined}
                        onChange={(e) => {
                          setOtStartTime(e.target.value);
                          const [h, m] = e.target.value.split(':').map(Number);
                          const date = new Date();
                          date.setHours(h + 3, m);
                          setOtEndTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
                        }}                      />
                      <FiClock className="inputIcon__icon" />
                    </div>
                  </div>
                </div>

                <div className="payModal__row">
                  <label>End Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        type="date"
                        value={otEndDate}
                        min={otStartDate || todayKey}
                        max={maxOtEndDate || undefined}
                        disabled={isOtSubmitting}
                        aria-invalid={isOtEndDateInvalid ? 'true' : undefined}
                        onChange={(e) => setOtEndDate(e.target.value)}
                      />
                      <FiCalendar className="inputIcon__icon" />
                    </div>
                    <div className="inputIcon">
                      <input
                        type="time"
                        value={otEndTime}
                        max={isOtNextDay ? '06:00' : undefined}
                        disabled={isOtSubmitting}
                        aria-invalid={isOtEndTimeInvalid ? 'true' : undefined}
                        onChange={(e) => setOtEndTime(e.target.value)}
                      />
                      <FiClock className="inputIcon__icon" />
                    </div>
                  </div>
                </div>

                <div className="payModal__row">
                  <label>Reason for Overtime</label>
                  <textarea
                    placeholder="Describe the work that requires overtime."
                    value={otReason}
                    disabled={isOtSubmitting}
                    aria-invalid={isOtReasonInvalid ? 'true' : undefined}
                    onChange={(e) => setOtReason(e.target.value)}
                  />
                </div>

                <div className="payModal__row">
                  <FileUploadField
                    label="Supporting Documents (Optional)"
                    hint="Attach schedules, work orders, or supporting proof only when they help explain this overtime request."
                    file={otFile}
                    disabled={isOtSubmitting}
                    onChange={setOtFile}
                    emptyLabel="Optional attachment"
                  />
                </div>

        </div>
      </LargePopup>

      <LargePopup
        open={requestViewOpen}
        ariaLabel="Request Details"
        title="Request Details"
        subtitle="Review the request notes, coverage, and status recorded for the selected date."
        size="md"
        onClose={closeRequestView}
        footer={(
          <button className="btn btn--ghost" type="button" onClick={closeRequestView}>
            Close
          </button>
        )}
      >
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
        </div>
      </LargePopup>

      <LargePopup
        open={scheduleOpen}
        ariaLabel="My Schedule"
        title="My Schedule"
        subtitle="Review your assigned work hours for the selected week."
        size="lg"
        onClose={closeSchedule}
        footer={(
          <ActionButton variant="ghost" type="button" icon={<FiXCircle />} onClick={closeSchedule}>
            Close
          </ActionButton>
        )}
      >
        <div className="attScheduleModal">
                <div className="attScheduleModal__toolbar">
                  <label className="attScheduleCard__selectWrap attScheduleCard__selectWrap--modal">
                    <span className="attScheduleCard__selectLabel">Week</span>
                    <select
                      className="attScheduleCard__select"
                      value={selectedScheduleWeekStart}
                      onChange={(event) => setSelectedScheduleWeekStart(event.target.value)}
                    >
                      {scheduleWeekOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="attScheduleModal__notice">If this schedule looks wrong, please contact your manager.</p>

                {scheduleWeekStatus === 'loading' ? (
                  <div className="attScheduleState" role="status">
                    Loading your schedule...
                  </div>
                ) : scheduleWeekStatus === 'unavailable' ? (
                  <div className="attScheduleState attScheduleState--muted">Your schedule is unavailable right now.</div>
                ) : (
                  <div className="attScheduleGrid">
                    {weekScheduleRows.map((row) => (
                      <article key={row.dateKey} className={`attScheduleDay attScheduleDay--${row.variant}`}>
                        <span className="attScheduleDay__label">{row.label}</span>
                        <span className={`attScheduleDay__detail attScheduleDay__detail--${row.variant}`}>{row.detail}</span>
                      </article>
                    ))}
                  </div>
                )}

        </div>
      </LargePopup>

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
        title={leaveBalanceWarning ? "Insufficient Balance" : "Confirm Leave Request"}
        message={`${
          leaveBalanceWarning ? `${leaveBalanceWarning} Are you sure you want to proceed? ` : `Submit this ${leaveType.replaceAll('_', ' ').toLowerCase()} request from ${formatDisplayDate(
          startDate
        )} ${formatDisplayTime(startTime)} to ${formatDisplayDate(endDate)} ${formatDisplayTime(endTime)}?`
        }`}
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
      <ConfirmDialog
        open={leaveUnsavedPrompt.confirmOpen}
        title="Discard Leave Request?"
        message="You have unsaved changes in this leave request. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={leaveUnsavedPrompt.discardAndClose}
        onCancel={leaveUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={overtimeUnsavedPrompt.confirmOpen}
        title="Discard Overtime Request?"
        message="You have unsaved changes in this overtime request. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={overtimeUnsavedPrompt.discardAndClose}
        onCancel={overtimeUnsavedPrompt.keepEditing}
      />
    </div>
  );
}
