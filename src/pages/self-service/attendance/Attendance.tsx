import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import './Attendance.css';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiPlusSquare, FiUpload, FiX } from 'react-icons/fi';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import { ApiError, apiFetchJson, apiFetchRaw, toArray } from '../../../lib/api';
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
  overtimeType?: OvertimeType | string;
  startTime?: string;
  endTime?: string;
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

const LEAVE_CACHE_PREFIX = 'employee-leave-requests';
const LEAVE_TYPE_OPTIONS: Array<{ label: string; value: LeaveType }> = [
  { label: 'Sick Leave', value: 'SICK_LEAVE' },
  { label: 'Vacation Leave', value: 'VACATION_LEAVE' },
  { label: 'Maternity Leave', value: 'MATERNITY_LEAVE' },
  { label: 'Paternity Leave', value: 'PATERNITY_LEAVE' },
  { label: 'Solo Parent Leave', value: 'SOLO_PARENT_LEAVE' },
  { label: 'Magna Carta', value: 'MAGNA_CARTA' },
  { label: 'RA 9262', value: 'RA9262' },
];

function readCachedLeaveRequests(empId: number): RequestEntry[] {
  try {
    const raw = window.localStorage.getItem(`${LEAVE_CACHE_PREFIX}-${empId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is RequestEntry => {
      if (!row || typeof row !== 'object') return false;
      const rec = row as Record<string, unknown>;
      return (
        rec.kind === 'LEAVE' &&
        typeof rec.id === 'string' &&
        typeof rec.dateKey === 'string' &&
        typeof rec.status === 'string' &&
        typeof rec.reason === 'string'
      );
    });
  } catch {
    return [];
  }
}

function writeCachedLeaveRequests(empId: number, entries: RequestEntry[]) {
  const leaveOnly = entries.filter(
    (entry) =>
      entry.kind === 'LEAVE' &&
      !['REJECTED', 'DENIED', 'CANCELLED'].includes(entry.status.toUpperCase())
  );
  window.localStorage.setItem(`${LEAVE_CACHE_PREFIX}-${empId}`, JSON.stringify(leaveOnly));
}

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

function formatAttendanceSession(session: AttendanceSession) {
  if (session.in && session.out) return `${session.in} - ${session.out}`;
  if (session.in) return `In ${session.in}`;
  if (session.out) return `Out ${session.out}`;
  return 'Attendance logged';
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
  const today = new Date();
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
  }, [today.getFullYear(), year]);

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
  const [otOpen, setOtOpen] = useState(false);
  const [otDate, setOtDate] = useState<string>('');
  const [otStartTime, setOtStartTime] = useState<string>('18:00');
  const [otEndTime, setOtEndTime] = useState<string>('20:00');
  const [otType, setOtType] = useState<OvertimeType>('OVERTIME');
  const [otReason, setOtReason] = useState<string>('');
  const [otSubmitError, setOtSubmitError] = useState('');
  const [requestViewOpen, setRequestViewOpen] = useState(false);
  const [requestViewDate, setRequestViewDate] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('');
  const [isClocking, setIsClocking] = useState(false);
  const [clockMessage, setClockMessage] = useState('');
  const [clockError, setClockError] = useState('');
  const [confirmClockAction, setConfirmClockAction] = useState<'TIME_IN' | 'TIME_OUT' | null>(null);
  const [latestAttendanceDirection, setLatestAttendanceDirection] = useState<'IN' | 'OUT' | null>(null);
  const userRole = getUserRole();
  const canRequestOvertime = !['hr', 'management', 'manager'].includes(userRole ?? '');

  async function fetchAttendanceHistory(resolvedEmpId: number) {
    try {
      const logs = await apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=500`);
      return buildAttendanceHistory(logs);
    } catch {
      return null;
    }
  }

  useEffect(() => {
    setMonthValue(monthLabel);
  }, [monthLabel]);

  useEffect(() => {
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    if (today.getFullYear() === year && today.getMonth() === monthIndex) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey('');
    }
  }, [monthIndex, today, year]);

  useEffect(() => {
    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) return;
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

        setEmployeeId(resolvedEmpId);

        if (resolvedEmpId) {
          const cachedLeaveEntries = readCachedLeaveRequests(resolvedEmpId);
          const myOt = await apiFetchJson<unknown>(`/api/overtime/all/${resolvedEmpId}?page=0&size=200`);
          const otEntries = toArray<Record<string, unknown>>(myOt)
            .map((row) => {
              const dateKey = typeof row.workDate === 'string' ? row.workDate.slice(0, 10) : '';
              if (!dateKey) return null;
              const rawStatus = String(row.requestStatus ?? 'PENDING').toUpperCase();
              if (['REJECTED', 'DENIED', 'CANCELLED'].includes(rawStatus)) return null;
              return {
                id: `ot-${String(row.overtimeId ?? crypto.randomUUID())}`,
                kind: 'OT' as const,
                dateKey,
                status: rawStatus,
                reason: String(row.reason ?? ''),
                overtimeType: String(row.overtimeType ?? ''),
                startTime:
                  typeof row.startTime === 'string'
                    ? new Date(row.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : undefined,
                endTime:
                  typeof row.endTime === 'string'
                    ? new Date(row.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : undefined,
              } as RequestEntry;
            })
            .filter((item): item is RequestEntry => item !== null);
          setRequestEntries([...otEntries, ...cachedLeaveEntries]);

          const attendanceHistory = await fetchAttendanceHistory(resolvedEmpId);
          setAttendanceByDate(attendanceHistory?.sessionsByDate ?? {});
          setLatestAttendanceDirection(attendanceHistory?.latestDirection ?? null);
        }
      } catch {
        setEmployeeId(null);
        setRequestEntries([]);
        setAttendanceByDate({});
        setLatestAttendanceDirection(null);
      }
    })();
  }, [monthIndex, year]);

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

  const hasApprovedTodayLeave = useMemo(() => {
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    return requestEntries.some(
      (entry) =>
        entry.dateKey === todayKey &&
        entry.kind === 'LEAVE' &&
        entry.status.toUpperCase() === 'APPROVED'
    );
  }, [requestEntries, today]);

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
    setOtDate(iso);
    setOtStartTime('18:00');
    setOtEndTime('20:00');
    setOtType('OVERTIME');
    setOtReason('');
    setOtSubmitError('');
    setOtOpen(true);
  }

  function closeOt() {
    setOtOpen(false);
  }

  function requestAttendanceConfirmation() {
    setClockMessage('');
    setClockError('');
    if (!employeeId) {
      setClockError('Employee ID not found.');
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

  async function submitOt() {
    setOtSubmitError('');
    if (!canRequestOvertime) {
      setOtSubmitError('Overtime requests are not available for your role.');
      return;
    }

    if (!otDate) {
      setOtSubmitError('OT date is required.');
      return;
    }

    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    if (otDate < todayKey) {
      setOtSubmitError('OT date cannot be in the past.');
      return;
    }

    if (!otStartTime || !otEndTime) {
      setOtSubmitError('Start and end time are required.');
      return;
    }

    if (otEndTime <= otStartTime) {
      setOtSubmitError('End time must be later than start time.');
      return;
    }

    if (otReason.trim().length < 5) {
      setOtSubmitError('Reason must be at least 5 characters.');
      return;
    }

    const startDateTime = `${otDate}T${otStartTime}:00`;
    const endDateTime = `${otDate}T${otEndTime}:00`;

    try {
      await apiFetchJson('/api/overtime/create', {
        method: 'POST',
        body: JSON.stringify({
          workDate: otDate,
          startTime: startDateTime,
          endTime: endDateTime,
          overtimeType: otType,
          reason: otReason.trim(),
        }),
      });
      setOtOpen(false);
      setRequestEntries((prev) => [
        ...prev,
        {
          id: `ot-local-${Date.now()}`,
          kind: 'OT',
          dateKey: otDate,
          status: 'PENDING',
          reason: otReason.trim(),
          overtimeType: otType,
          startTime: otStartTime,
          endTime: otEndTime,
        },
      ]);
    } catch (error) {
      setOtSubmitError(getFriendlyErrorMessage(error, 'overtime-request'));
    }
  }

  async function submitLeave() {
    setSubmitError('');
    if (!employeeId) {
      setSubmitError('Unable to resolve employee account.');
      return;
    }

    if (!startDate) {
      setSubmitError('Start date is required.');
      return;
    }

    if (!endDate) {
      setSubmitError('End date is required.');
      return;
    }

    if (!startTime) {
      setSubmitError('Start time is required.');
      return;
    }

    if (!endTime) {
      setSubmitError('End time is required.');
      return;
    }

    const startDateTime = `${startDate}T${startTime}:00`;
    const endDateTime = `${endDate}T${endTime}:00`;

    if (endDateTime <= startDateTime) {
      setSubmitError('End date and time must be later than the start date and time.');
      return;
    }

    if (reason.trim().length < 5) {
      setSubmitError('Reason must be at least 5 characters.');
      return;
    }

    try {
      let attachmentRef: number | null = null;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploadResponse = await apiFetchRaw('/api/document/upload', {
          method: 'POST',
          body: form,
        });
        if (!uploadResponse.ok) {
          throw new ApiError(
            uploadResponse.status,
            uploadResponse.status === 404
              ? 'Document upload endpoint is not enabled in current backend profile.'
              : `Document upload failed (${uploadResponse.status}).`
          );
        }
        const uploadPayload = (await uploadResponse.json()) as Record<string, unknown>;
        attachmentRef = typeof uploadPayload.pathId === 'number' ? uploadPayload.pathId : null;
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

      setLeaveOpen(false);
      const keys = dateKeysBetween(startDate, endDate || startDate);
      const newLeaveEntries = keys.map((k, idx) => ({
          id: `leave-local-${Date.now()}-${idx}`,
          kind: 'LEAVE' as const,
          dateKey: k,
          status: 'PENDING',
          reason: reason.trim(),
        }));
      setRequestEntries((prev) => {
        const next = [...prev, ...newLeaveEntries];
        if (employeeId) writeCachedLeaveRequests(employeeId, next);
        return next;
      });
    } catch (error) {
      setSubmitError(getFriendlyErrorMessage(error, 'leave-request'));
    }
  }

  return (
    <div className="att">
      {/* Title row */}
      <div className="att__head">
        <div className="att__titleWrap">
          <h1 className="att__title">Attendance</h1>
          <p className="att__subtitle">Review your work logs, requests, shifts, and events in one monthly calendar.</p>
        </div>
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
      {clockError && <p className="field__error">{clockError}</p>}

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
              <button className="modal__close" type="button" onClick={closeLeave} aria-label="Close">
                <FiX />
              </button>
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
                </div>

                <div className="requestField">
                  <label className="label">Start Date and Time</label>
                  <div className="requestField__group">
                    <div className="inputIcon">
                      <input
                        className="input"
                        type="date"
                        value={startDate}
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
                  <label className="label">Supporting Documents</label>
                  <div className="requestUpload">
                    <label className="requestUpload__button">
                      <FiUpload />
                      <span>{file ? 'Replace File' : 'Upload File'}</span>
                      <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <span className="requestUpload__name">{file ? file.name : 'No file selected'}</span>
                  </div>
                </div>
              </div>

              <div className="requestActions">
                <button className="btn btn--ghost" type="button" onClick={closeLeave}>
                  Cancel
                </button>
                <button className="btn" type="button" onClick={submitLeave}>
                  Submit
                </button>
              </div>
              {submitError && <p className="field__error">{submitError}</p>}
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
              <button className="modal__close" type="button" onClick={closeOt} aria-label="Close">
                <FiX />
              </button>
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
                  <label className="label">OT Date</label>
                  <div className="inputIcon">
                    <input className="input" type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>

                <div className="requestField">
                  <label className="label">Start Time</label>
                  <input className="input" type="time" value={otStartTime} onChange={(e) => setOtStartTime(e.target.value)} />
                </div>

                <div className="requestField requestField--span2">
                  <label className="label">End Time</label>
                  <input className="input" type="time" value={otEndTime} onChange={(e) => setOtEndTime(e.target.value)} />
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
              </div>

              <div className="requestActions">
                <button className="btn btn--ghost" type="button" onClick={closeOt}>
                  Cancel
                </button>
                <button className="btn" type="button" onClick={submitOt}>
                  Submit
                </button>
              </div>
              {otSubmitError && <p className="field__error">{otSubmitError}</p>}
            </div>
          </div>
        </div>
      )}

      {requestViewOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Request Details">
          <div className="modal">
            <div className="modal__top">
              <div className="modal__title">REQUEST DETAILS</div>
              <button className="modal__close" type="button" onClick={closeRequestView} aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="modal__rule" />
            <div className="form">
              <div className="formRow">
                <label className="label">Date:</label>
                <input className="input" value={requestViewDate} readOnly />
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
                          : 'Leave request'
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
    </div>
  );
}
