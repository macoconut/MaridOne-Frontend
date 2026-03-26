import { useEffect, useMemo, useState } from 'react';
import './Attendance.css';
import { FiPlusSquare, FiX, FiUpload, FiCalendar } from 'react-icons/fi';
import { ApiError, apiFetchJson, apiFetchRaw, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
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
  variant?: 'approved' | 'pending' | 'denied' | 'holiday';
  clickable?: boolean;
};

type ShiftRow = {
  dayOfWeek?: string;
};

type CalendarEvent = {
  day?: number;
};

type AttendanceLog = {
  timestamp?: string;
  direction?: string;
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

export default function Attendance() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const [monthValue, setMonthValue] = useState(monthLabel);

  // Leave modal state
  const [leaveOpen, setLeaveOpen] = useState(false);

  const [leaveType, setLeaveType] = useState<LeaveType>('SICK_LEAVE');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [shiftWeekdays, setShiftWeekdays] = useState<Set<number>>(new Set());
  const [eventDays, setEventDays] = useState<Set<number>>(new Set());
  const [requestEntries, setRequestEntries] = useState<RequestEntry[]>([]);
  const [attendanceByDate, setAttendanceByDate] = useState<Record<string, { in?: string; out?: string }>>({});
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
          const shifts = await apiFetchJson<unknown>(`/api/employee/schedule/${resolvedEmpId}`);
          const weekdayMap: Record<string, number> = {
            MONDAY: 0,
            TUESDAY: 1,
            WEDNESDAY: 2,
            THURSDAY: 3,
            FRIDAY: 4,
            SATURDAY: 5,
            SUNDAY: 6,
          };
          const days = toArray<ShiftRow>(shifts)
            .map((row) => row.dayOfWeek?.toUpperCase() ?? '')
            .map((key) => weekdayMap[key])
            .filter((n): n is number => typeof n === 'number');
          setShiftWeekdays(new Set(days));

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

          try {
            const logs = await apiFetchJson<unknown>(
              `/api/logs/attendance/self/${resolvedEmpId}?page=0&size=500`
            );
            const next: Record<string, { in?: string; out?: string }> = {};
            for (const row of toArray<AttendanceLog>(logs)) {
              if (typeof row.timestamp !== 'string') continue;
              const date = new Date(row.timestamp);
              if (Number.isNaN(date.getTime())) continue;
              const dateKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
              const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const direction = (row.direction || '').toUpperCase();
              const current = next[dateKey] ?? {};

              if (direction.includes('IN')) {
                current.in = current.in ?? timeLabel;
              } else if (direction.includes('OUT')) {
                current.out = timeLabel;
              }
              next[dateKey] = current;
            }
            setAttendanceByDate(next);
          } catch {
            setAttendanceByDate({});
          }
        }

        const month = monthIndex + 1;
        const yearValue = year;
        const events = await apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${yearValue}`);
        const eventDayNumbers = toArray<CalendarEvent>(events)
          .map((item) => item.day)
          .filter((day): day is number => typeof day === 'number');
        setEventDays(new Set(eventDayNumbers));
      } catch {
        setEmployeeId(null);
        setShiftWeekdays(new Set());
        setEventDays(new Set());
        setRequestEntries([]);
        setAttendanceByDate({});
      }
    })();
  }, [monthIndex, year]);

  useEffect(() => {
    if (leaveOpen || otOpen || requestViewOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [leaveOpen, otOpen, requestViewOpen]);

  const requestDateKeys = useMemo(() => {
    return new Set(requestEntries.map((entry) => entry.dateKey));
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

  const todayAttendance = useMemo(() => {
    const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
    return attendanceByDate[todayKey] ?? {};
  }, [attendanceByDate, today]);

  const isClockOutAction = Boolean(todayAttendance.in && !todayAttendance.out);

  const calendarCells = useMemo(() => {
    // Build a Sunday-last calendar (MO..SU) like your screenshot
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // JS getDay(): 0=Sun..6=Sat
    // We want Monday-based: MO=0..SU=6
    const jsDay = first.getDay();
    const mondayBased = (jsDay + 6) % 7; // convert so Mon=0

    const cells: DayCell[] = [];
    // leading blanks
    for (let i = 0; i < mondayBased; i++) cells.push({ day: null });

    // actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      const mondayBasedWeekday = (date.getDay() + 6) % 7;
      const hasShift = shiftWeekdays.has(mondayBasedWeekday);
      const hasEvent = eventDays.has(d);
      const dateKey = toISODate(year, monthIndex, d);
      const dayRequests = requestEntries.filter((entry) => entry.dateKey === dateKey);
      const hasRequest = dayRequests.length > 0;
      const attendance = attendanceByDate[dateKey];
      const statusNotes: string[] = [];
      const detailNotes: string[] = [];
      let variant: DayCell['variant'] | undefined;
      let clickable = false;

      if (hasRequest) {
        const statuses = dayRequests.map((entry) => entry.status.toUpperCase());
        const hasApproved = statuses.includes('APPROVED');
        const hasDenied = statuses.includes('REJECTED') || statuses.includes('DENIED');
        variant = hasApproved ? 'approved' : hasDenied ? 'denied' : 'pending';
        for (const entry of dayRequests) {
          const rawStatus = entry.status.toUpperCase();
          const status =
            rawStatus === 'APPROVED'
              ? 'Approved'
              : rawStatus === 'REJECTED' || rawStatus === 'DENIED'
                ? 'Denied'
                : 'Pending';
          if (entry.kind === 'OT') {
            statusNotes.push(`${status} OT (${String(entry.overtimeType ?? 'OT')})`);
          } else {
            statusNotes.push(`${status} Leave`);
          }
        }
        clickable = true;
      }

      const hasApprovedLeave = dayRequests.some(
        (entry) => entry.kind === 'LEAVE' && entry.status.toUpperCase() === 'APPROVED'
      );

      if (!hasApprovedLeave && (attendance?.in || attendance?.out)) {
        detailNotes.push(`Time In: ${attendance?.in ?? 'N/A'}`);
        detailNotes.push(`Time Out: ${attendance?.out ?? 'N/A'}`);
      }

      if (!hasRequest && hasShift && hasEvent) {
        detailNotes.push('Shift • Event');
      } else if (hasShift) {
        detailNotes.push('Shift');
      } else if (hasEvent) {
        detailNotes.push('Event');
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
  }, [attendanceByDate, eventDays, monthIndex, requestDateKeys, requestEntries, shiftWeekdays, year]);

  function openLeaveForToday() {
    const now = new Date();
    const iso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    setStartDate(iso);
    setEndDate(iso);
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

  async function recordAttendance() {
    setClockMessage('');
    setClockError('');
    if (!employeeId) {
      setClockError('Employee ID not found.');
      return;
    }
    if (hasApprovedTodayLeave) {
      setClockError('Clock in/out is blocked today because there is an approved leave request.');
      return;
    }
    if (isClockOutAction && !window.confirm('Are you sure you want to clock out?')) {
      return;
    }

    setIsClocking(true);
    try {
      const response = await apiFetchRaw(`/api/logs/attendance/${employeeId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new ApiError(response.status, text || `Attendance log failed (${response.status})`);
      }

      const now = new Date();
      const dateKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setAttendanceByDate((prev) => {
        const current = prev[dateKey] ?? {};
        const next =
          current.in && !current.out
            ? { ...current, out: timeLabel }
            : { ...current, in: timeLabel };
        return { ...prev, [dateKey]: next };
      });

      setClockMessage('Attendance log submitted.');
    } catch (error) {
      setClockError(getFriendlyErrorMessage(error, 'attendance'));
    } finally {
      setIsClocking(false);
    }
  }

  async function submitOt() {
    setOtSubmitError('');

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

    if (endDate < startDate) {
      setSubmitError('End date cannot be earlier than start date.');
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
        startDateTime: `${startDate}T00:00:00`,
        endDateTime: `${endDate}T23:59:59`,
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

          <div className="att__monthSelectWrap">
            <select
              className="att__monthSelect"
              value={monthValue}
              onChange={(e) => {
                setMonthValue(e.target.value);
                parseMonthValue(e.target.value);
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date(today.getFullYear(), i, 1);
                const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                return (
                  <option key={label} value={label}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar card */}
      <section className="attCard">
        <div className="attCard__monthBar">
          <div className="attCard__monthLabel">{monthValue}</div>
        </div>

        <div className="cal">
          <div className="cal__dow">MO</div>
          <div className="cal__dow">TU</div>
          <div className="cal__dow">WE</div>
          <div className="cal__dow">TH</div>
          <div className="cal__dow">FR</div>
          <div className="cal__dow">SA</div>
          <div className="cal__dow">SU</div>

          {calendarCells.map((c, idx) => {
            const dateKey = c.day ? toISODate(year, monthIndex, c.day) : '';
            const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
            const isToday = c.day !== null && dateKey === todayKey;
            const isSelected = c.day !== null && dateKey === selectedDateKey;
            const hasRequest = c.day !== null && requestDateKeys.has(dateKey);
            const clickable = c.day !== null;
            const cls = [
              'cal__cell',
              clickable ? 'cal__cell--click' : 'cal__cell--disabled',
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
                onClick={() => {
                  if (!c.day) return;
                  setSelectedDateKey(dateKey);
                  if (hasRequest) openRequestForDay(c.day);
                }}
                aria-label={c.day ? `Date ${monthValue} ${c.day}${isToday ? ', today' : ''}` : 'Empty'}
                aria-current={isToday ? 'date' : undefined}
              >
                {c.day && <div className="cal__day">{c.day}</div>}
                {c.statusNotes && (
                  <div className="cal__statusNotes">
                    {c.statusNotes.slice(0, 2).map((line, lineIdx) => (
                      <div
                        key={`${line}-${lineIdx}`}
                        className={`cal__note ${
                          line.toLowerCase().includes('approved')
                            ? 'cal__note--approved'
                            : line.toLowerCase().includes('pending')
                              ? 'cal__note--pending'
                              : line.toLowerCase().includes('denied')
                                ? 'cal__note--denied'
                                : ''
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                {c.detailNotes && (
                  <div className="cal__detailNotes">
                    {c.detailNotes.slice(0, 3).map((line, lineIdx) => (
                      <div key={`${line}-${lineIdx}`} className="cal__detail">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom buttons like figma */}
      <div className="attActions">
        <button className="attBtn" type="button" onClick={() => void recordAttendance()} disabled={isClocking}>
          <span>{isClocking ? 'Submitting...' : isClockOutAction ? 'Time Out' : 'Time In'}</span>
          <span className="attBtn__icon">
            <FiPlusSquare />
          </span>
        </button>

        <button className="attBtn" type="button" onClick={openLeaveForToday}>
          <span>Request Leave</span>
          <span className="attBtn__icon">
            <FiPlusSquare />
          </span>
        </button>

        <button
          className="attBtn"
          type="button"
          onClick={openOtForToday}
        >
          <span>Request OT</span>
          <span className="attBtn__icon">
            <FiPlusSquare />
          </span>
        </button>
      </div>
      {selectedDateKey && <p className="field__hint">Selected date: {selectedDateKey}</p>}
      {clockMessage && <p className="field__ok">{clockMessage}</p>}
      {clockError && <p className="field__error">{clockError}</p>}

      {/* Leave Modal */}
      {leaveOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Leave Application">
          <div className="modal">
            <div className="modal__top">
              <div className="modal__title">LEAVE APPLICATION FORM</div>
              <button className="modal__close" type="button" onClick={closeLeave} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="modal__rule" />

            <div className="form">
              <div className="formRow">
                <label className="label">Type of Leave Requested:</label>
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

              <div className="formRow formRow--2">
                <div className="field">
                  <label className="label">Start Date:</label>
                  <div className="inputIcon">
                    <input
                      className="input"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>

                <div className="field">
                  <label className="label">End Date:</label>
                  <div className="inputIcon">
                    <input
                      className="input"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>
              </div>

              <div className="formRow">
                <label className="label">Reason for Leave:</label>
                <textarea
                  className="textarea"
                  placeholder="Enter reason for leave"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="formRow">
                <label className="label">Supporting Documents (if any):</label>
                <div className="upload">
                  <label className="uploadBtn">
                    <FiUpload />
                    <span>{file ? file.name : 'Upload Here'}</span>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <div className="modalActions">
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
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Overtime Application">
          <div className="modal">
            <div className="modal__top">
              <div className="modal__title">OVERTIME APPLICATION FORM</div>
              <button className="modal__close" type="button" onClick={closeOt} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="modal__rule" />

            <div className="form">
              <div className="formRow">
                <label className="label">Type of OT Requested:</label>
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

              <div className="formRow formRow--2">
                <div className="field">
                  <label className="label">OT Date:</label>
                  <div className="inputIcon">
                    <input className="input" type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>

                <div className="field">
                  <label className="label">Start Time:</label>
                  <input className="input" type="time" value={otStartTime} onChange={(e) => setOtStartTime(e.target.value)} />
                </div>
              </div>

              <div className="formRow">
                <div className="field">
                  <label className="label">End Time:</label>
                  <input className="input" type="time" value={otEndTime} onChange={(e) => setOtEndTime(e.target.value)} />
                </div>
              </div>

              <div className="formRow">
                <label className="label">Reason for OT:</label>
                <textarea
                  className="textarea"
                  placeholder="Enter reason for OT"
                  value={otReason}
                  onChange={(e) => setOtReason(e.target.value)}
                />
              </div>

              <div className="modalActions">
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
    </div>
  );
}
