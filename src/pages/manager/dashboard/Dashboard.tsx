import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getAuthToken, getUserEmail } from '../../../lib/session';
import './Dashboard.css';

type UserSummary = { username?: string; employeeId?: number; accountStatus?: string };
type EmployeeDetails = {
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  employmentDateStart?: string;
  employmentStatus?: string;
  position?: string;
  address?: string | Record<string, unknown>;
};
type CalendarEvent = { calendarId?: number; title?: string; startDate?: string; isActive?: boolean };
type AttendanceLog = { employeeId?: number; timestamp?: string; direction?: string };

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function localDateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatAddress(value: unknown) {
  if (typeof value === 'string') return value.trim() || 'Address not available';
  if (!value || typeof value !== 'object') return 'Address not available';
  const data = value as Record<string, unknown>;
  const parts = [data.permanentAddress, data.temporaryAddress, data.city, data.state, data.country, data.zipCode]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString();
}

function formatJwtIssuedAt(token: string | null) {
  if (!token || token === 'authenticated-session') return 'Not available';
  const parts = token.split('.');
  if (parts.length < 2) return 'Not available';
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
    return typeof payload.iat === 'number' ? new Date(payload.iat * 1000).toLocaleString() : 'Not available';
  } catch {
    return 'Not available';
  }
}

function fullName(employee: EmployeeDetails | null) {
  return [employee?.firstName, employee?.middleName, employee?.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ') || 'Manager profile';
}

function isOut(direction?: string) {
  return (direction ?? '').toUpperCase().includes('OUT');
}

function directionLabel(direction?: string) {
  const value = (direction ?? '').toUpperCase();
  if (value.includes('OUT')) return 'Time Out';
  if (value.includes('LATE')) return 'Late Time In';
  if (value.includes('IN')) return 'Time In';
  return value || 'Unknown';
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const today = new Date();
  const [profile, setProfile] = useState<UserSummary | null>(null);
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [lastAttendance, setLastAttendance] = useState('Not available');
  const [teamLogs, setTeamLogs] = useState<AttendanceLog[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamError, setTeamError] = useState('');
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const username = getUserEmail();
    if (!username) {
      setLoading(false);
      setError('Signed-in manager account was not found.');
      return;
    }

    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      setError('');
      try {
        const safeUsername = username ?? '';
        const user = await apiFetchJson<UserSummary>(`/api/user/details/${encodeURIComponent(safeUsername)}`);
        if (cancelled) return;
        setProfile(user);
        if (typeof user.employeeId !== 'number') {
          setEmployee(null);
          setLastAttendance('Not available');
          return;
        }
        const [self, attendance] = await Promise.all([
          apiFetchJson<EmployeeDetails>(`/api/employees/${user.employeeId}`),
          apiFetchJson<unknown>(`/api/logs/attendance/self/${user.employeeId}?page=0&size=1`),
        ]);
        if (cancelled) return;
        setEmployee(self);
        const first = toArray<AttendanceLog>(attendance)[0];
        setLastAttendance(formatDateTime(first?.timestamp));
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Failed to load manager profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    let cancelled = false;

    async function loadTeamLogs() {
      setTeamError('');
      try {
        const response = await apiFetchJson<unknown>(
          `/api/logs/attendance/team?page=0&size=5000&timestampAfter=${encodeURIComponent(start.toISOString())}&timestampBefore=${encodeURIComponent(end.toISOString())}`
        );
        if (!cancelled) setTeamLogs(toArray<AttendanceLog>(response));
      } catch (nextError) {
        if (!cancelled) {
          setTeamLogs([]);
          setTeamError(nextError instanceof Error ? nextError.message : 'Team attendance is not available right now.');
        }
      }
    }

    void loadTeamLogs();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      try {
        const response = await apiFetchJson<unknown>(`/api/calendar/events?month=${monthIndex + 1}&year=${year}`);
        if (!cancelled) {
          setEvents(
            toArray<CalendarEvent>(response)
              .filter((event) => event.isActive !== false)
              .sort((a, b) => Date.parse(a.startDate ?? '') - Date.parse(b.startDate ?? ''))
          );
        }
      } catch {
        if (!cancelled) setEvents([]);
      }
    }

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, [monthIndex, year]);

  const calendarLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const lastLogin = formatJwtIssuedAt(getAuthToken());
  const todayKey = localDateKey(new Date().toISOString());
  const todayLogs = useMemo(() => teamLogs.filter((log) => localDateKey(log.timestamp) === todayKey), [teamLogs, todayKey]);
  const activeToday = useMemo(() => new Set(todayLogs.map((log) => log.employeeId).filter((id): id is number => typeof id === 'number')).size, [todayLogs]);
  const openSessions = useMemo(() => {
    const latest = new Map<number, AttendanceLog>();
    for (const log of todayLogs) {
      if (typeof log.employeeId !== 'number') continue;
      const current = latest.get(log.employeeId);
      if (!current || Date.parse(log.timestamp ?? '') >= Date.parse(current.timestamp ?? '')) latest.set(log.employeeId, log);
    }
    return [...latest.values()].filter((log) => !isOut(log.direction)).length;
  }, [todayLogs]);
  const recentActivity = useMemo(
    () => [...teamLogs].filter((log) => typeof log.employeeId === 'number').sort((a, b) => Date.parse(b.timestamp ?? '') - Date.parse(a.timestamp ?? '')).slice(0, 6),
    [teamLogs]
  );
  const eventDays = useMemo(() => new Set(events.map((event) => new Date(event.startDate ?? '').getDate()).filter((day) => Number.isFinite(day))), [events]);
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayStart = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayStart + daysInMonth) / 7) * 7;

  return (
    <div className="mgrDash">
      <section className="mgrDashHero">
        <div className="mgrDashHero__top">
          <div>
            <div className="mgrDashHero__eyebrow">Manager Workspace</div>
            <h1>Your Information</h1>
          </div>
          <button type="button" className="mgrDashHero__btn" onClick={() => setRefreshTick((tick) => tick + 1)}>Refresh</button>
        </div>
        {error && <p className="mgrDash__error">{error}</p>}
        <div className="mgrDashHero__grid">
          <div className="mgrDashIdentity">
            <div className="mgrDashIdentity__avatar">{fullName(employee).charAt(0).toUpperCase()}</div>
            <div>
              <h2>{fullName(employee)}</h2>
              <p>{employee?.position ?? 'Manager'} • Employee #{profile?.employeeId ?? 'N/A'}</p>
              <div className="mgrDashBadges">
                <span>{employee?.employmentStatus ?? 'Status unavailable'}</span>
                <span>{profile?.accountStatus ?? 'Account status unavailable'}</span>
              </div>
            </div>
          </div>
          <div className="mgrDashDetails">
            <p><strong>Email:</strong> {employee?.email || profile?.username || 'Not available'}</p>
            <p><strong>Phone:</strong> {employee?.phoneNumber || 'Not available'}</p>
            <p><strong>Address:</strong> {formatAddress(employee?.address)}</p>
            <p><strong>Part of Marid Since:</strong> {formatDate(employee?.employmentDateStart)}</p>
            <p><strong>Last Login:</strong> {lastLogin}</p>
            <p><strong>Last Attendance:</strong> {lastAttendance}</p>
          </div>
        </div>
      </section>

      <section className="mgrDashActions">
        <button type="button" onClick={() => navigate('/manager/attendance-dashboard')}>Team Attendance Dashboard</button>
        <button type="button" onClick={() => navigate('/manager/attendance-reports')}>Attendance Reports</button>
        <button type="button" onClick={() => navigate('/manager/pending-approvals')}>Pending Approvals</button>
        <button type="button" onClick={() => setRefreshTick((tick) => tick + 1)}>Sync Manager View</button>
      </section>

      <div className="mgrDashGrid">
        <section className="mgrDashPanel">
          <div className="mgrDashPanel__head">
            <div>
              <div className="mgrDashPanel__eyebrow">Team Snapshot</div>
              <h3>This Month&apos;s Attendance</h3>
            </div>
          </div>
          {teamError ? <p className="mgrDash__error">{teamError}</p> : (
            <>
              <div className="mgrDashStats">
                <article><span>Active Today</span><strong>{activeToday}</strong></article>
                <article><span>Logs Today</span><strong>{todayLogs.length}</strong></article>
                <article><span>Clock Outs Today</span><strong>{todayLogs.filter((log) => isOut(log.direction)).length}</strong></article>
                <article><span>Open Sessions</span><strong>{openSessions}</strong></article>
              </div>
              <div className="mgrDashPanel__subhead">Latest Team Activity</div>
              <div className="mgrDashList">
                {recentActivity.length > 0 ? recentActivity.map((log, index) => (
                  <article key={`${log.employeeId}-${log.timestamp}-${index}`} className="mgrDashRow">
                    <div className="mgrDashRow__avatar">{log.employeeId}</div>
                    <div>
                      <div className="mgrDashRow__title">Employee #{log.employeeId}</div>
                      <div className="mgrDashRow__meta">{directionLabel(log.direction)}</div>
                    </div>
                    <div className="mgrDashRow__time">{formatDateTime(log.timestamp)}</div>
                  </article>
                )) : <div className="mgrDashList__empty">No team logs were returned for this month.</div>}
              </div>
            </>
          )}
        </section>

        <section className="mgrDashPanel">
          <div className="mgrDashPanel__head">
            <div>
              <div className="mgrDashPanel__eyebrow">Company Calendar</div>
              <h3>{calendarLabel}</h3>
            </div>
          </div>
          <div className="mgrDashCalendar__top">
            <button type="button" onClick={() => { const next = new Date(year, monthIndex - 1, 1); setYear(next.getFullYear()); setMonthIndex(next.getMonth()); }}>‹</button>
            <strong>{calendarLabel}</strong>
            <button type="button" onClick={() => { const next = new Date(year, monthIndex + 1, 1); setYear(next.getFullYear()); setMonthIndex(next.getMonth()); }}>›</button>
          </div>
          <div className="mgrDashCalendar">
            {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => <div key={day} className="mgrDashCalendar__dow">{day}</div>)}
            {Array.from({ length: totalCells }).map((_, index) => {
              const day = index - mondayStart + 1;
              const valid = day > 0 && day <= daysInMonth;
              return <div key={index} className={`mgrDashCalendar__cell ${!valid ? 'is-empty' : ''} ${valid && eventDays.has(day) ? 'is-event' : ''}`}>{valid ? day : ''}</div>;
            })}
          </div>
          <div className="mgrDashPanel__subhead">Upcoming Events</div>
          <div className="mgrDashList">
            {events.length > 0 ? events.slice(0, 5).map((event, index) => (
              <article key={`${event.calendarId ?? 'event'}-${index}`} className="mgrDashRow mgrDashRow--soft">
                <div className="mgrDashRow__avatar">{event.title?.charAt(0).toUpperCase() ?? 'E'}</div>
                <div>
                  <div className="mgrDashRow__title">{event.title || 'Untitled event'}</div>
                  <div className="mgrDashRow__meta">{formatDate(event.startDate)}</div>
                </div>
              </article>
            )) : <div className="mgrDashList__empty">No active company events were returned for this month.</div>}
          </div>
        </section>
      </div>

      <section className="mgrDashNote">
        <h3>Current Backend Coverage</h3>
        <ul>
          <li>Profile details come from the signed-in manager&apos;s own employee record.</li>
          <li>Team metrics are based on attendance logs only, so names and departments are still missing here.</li>
          <li>Company events come from the shared calendar endpoint already used across the app.</li>
        </ul>
      </section>
      {loading && <p className="mgrDash__hint">Loading manager data...</p>}
    </div>
  );
}
