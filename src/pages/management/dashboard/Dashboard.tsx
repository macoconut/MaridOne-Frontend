import { FiHome, FiMail, FiPhone, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { useRegisterPageRefresh } from '../../../lib/pageRefresh';
import { getAuthToken, getUserEmail } from '../../../lib/session';
import { mapNotificationItem, type NotificationItem } from '../../../lib/notificationRouting';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './Dashboard.css';

type UserDetails = {
  username?: string;
  employeeId?: number;
  employee?: {
    employeeId?: number;
  };
};

type EmployeeDetails = {
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  employmentDateStart?: string;
  email?: string;
  phoneNumber?: string;
  position?: string;
  employmentStatus?: string;
  userAccountName?: string;
  address?: string | Record<string, unknown>;
};

type CalendarEvent = {
  day?: number;
  title?: string;
};

type AttendanceLog = {
  timestamp?: string;
};

function formatAddress(value: unknown) {
  if (typeof value === 'string') return value.trim() || 'Address not available';
  if (!value || typeof value !== 'object') return 'Address not available';

  const data = value as Record<string, unknown>;
  const parts = [
    data.permanentAddress,
    data.temporaryAddress,
    data.city,
    data.state,
    data.country,
    data.zipCode,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

function formatJwtIssuedAt(token: string | null) {
  if (!token || token === 'authenticated-session') return 'Not available';
  const parts = token.split('.');
  if (parts.length < 2) return 'Not available';

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    if (typeof payload.iat !== 'number') return 'Not available';
    return new Date(payload.iat * 1000).toLocaleString();
  } catch {
    return 'Not available';
  }
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ManagementDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserDetails | null>(null);
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [lastLoginLabel, setLastLoginLabel] = useState<string>('Not available');
  const [lastAttendanceLabel, setLastAttendanceLabel] = useState<string>('Not available');
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [refreshTick, setRefreshTick] = useState(0);
  const [loadError, setLoadError] = useState('');
  useErrorDialogEffect(loadError, 'Management dashboard could not be loaded');
  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useRegisterPageRefresh(handlePageRefresh);

  useEffect(() => {
    setLastLoginLabel(formatJwtIssuedAt(getAuthToken()));
  }, []);

  useEffect(() => {
    const username = getUserEmail();
    if (!username) {
      setProfile(null);
      setEmployee(null);
      setEmployeeId(null);
      setLastAttendanceLabel('Not available');
      return;
    }

    let cancelled = false;
    const safeUsername = username;

    async function loadProfile() {
      try {
        setLoadError('');
        const details = await apiFetchJson<UserDetails>(`/api/user/details/${encodeURIComponent(safeUsername)}`);
        if (cancelled) return;

        setProfile(details);
        const resolvedEmpId =
          typeof details.employeeId === 'number'
            ? details.employeeId
            : typeof details.employee?.employeeId === 'number'
              ? details.employee.employeeId
              : null;

        setEmployeeId(resolvedEmpId ?? null);

        if (!resolvedEmpId) {
          setEmployee(null);
          setLastAttendanceLabel('Not available');
          return;
        }

        const [employeeDetails, attendanceResponse] = await Promise.all([
          apiFetchJson<EmployeeDetails>(`/api/employees/${resolvedEmpId}`),
          apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=1`),
        ]);
        if (cancelled) return;

        setEmployee(employeeDetails);
        const latestAttendance = toArray<AttendanceLog>(attendanceResponse)[0];
        setLastAttendanceLabel(
          latestAttendance?.timestamp ? new Date(latestAttendance.timestamp).toLocaleString() : 'Not available'
        );
      } catch (error) {
        if (cancelled) return;
        setProfile(null);
        setEmployee(null);
        setEmployeeId(null);
        setLastAttendanceLabel('Not available');
        setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendarAndNotifications() {
      const month = calendarMonthIndex + 1;
      const year = calendarYear;

      const [eventsResponse, notificationsResponse] = await Promise.allSettled([
        apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${year}`),
        apiFetchJson<unknown>('/api/notifications?page=0&size=8'),
      ]);

      if (!cancelled) {
        if (eventsResponse.status === 'fulfilled') {
          setCalendarEvents(toArray<CalendarEvent>(eventsResponse.value));
        } else {
          setCalendarEvents([]);
        }

        if (notificationsResponse.status === 'fulfilled') {
          const nextNotifications = toArray<Record<string, unknown>>(notificationsResponse.value).map((row) =>
            mapNotificationItem('management', row)
          );
          setNotifications(nextNotifications);
        } else {
          setNotifications([]);
        }
      }
    }

    void loadCalendarAndNotifications();
    return () => {
      cancelled = true;
    };
  }, [calendarMonthIndex, calendarYear, refreshTick]);

  const monthLabel = new Date(calendarYear, calendarMonthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const year = calendarYear;
  const monthIndex = calendarMonthIndex;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayBasedStart = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayBasedStart + daysInMonth) / 7) * 7;

  const employeeName = useMemo(() => {
    const fullName = [employee?.firstName, employee?.middleName, employee?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');

    if (fullName) return fullName;
    if (profile?.username) return profile.username;
    return 'Management User';
  }, [employee?.firstName, employee?.lastName, employee?.middleName, profile?.username]);

  const highlightedDays = useMemo(
    () =>
      calendarEvents
        .map((event) => event.day)
        .filter((day): day is number => typeof day === 'number'),
    [calendarEvents]
  );

  const topNotifications = useMemo(() => notifications.slice(0, 3), [notifications]);

  const topEvents = useMemo(
    () =>
      calendarEvents
        .filter((event) => typeof event.title === 'string' && event.title.trim().length > 0)
        .slice(0, 3),
    [calendarEvents]
  );

  function shiftCalendarMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonthIndex + offset, 1);
    setCalendarYear(next.getFullYear());
    setCalendarMonthIndex(next.getMonth());
  }

  return (
    <section className="mDash">
      {loadError && <p className="mDash__status is-error">{loadError}</p>}

      <section className="mPanel mInfo">
        <div className="mPanel__head mPanel__head--inline">
          <span>Your Information</span>
        </div>

        <div className="mInfo__body">
          <div className="mInfo__identity">
            <div className="mInfo__avatar" />
            <h2>{employeeName}</h2>
          </div>

          <div className="mInfo__contacts">
            <p>
              <FiHome /> {formatAddress(employee?.address)}
            </p>
            <p>
              <FiMail /> {employee?.email || profile?.username || 'Email not available'}
            </p>
            <p>
              <FiPhone /> {employee?.phoneNumber || 'Phone not available'}
            </p>
          </div>

          <div className="mInfo__meta">
            <p>
              <strong>Part of Marid since:</strong>
              <span>{formatDate(employee?.employmentDateStart)}</span>
            </p>
            <p>
              <strong>Last Login:</strong>
              <span>{lastLoginLabel}</span>
            </p>
            <p>
              <strong>Last attendance:</strong>
              <span>{lastAttendanceLabel}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="mQuickGrid">
        <button type="button" className="mQuickCard" onClick={() => navigate('/management/attendance')}>
          <span>Attendance Dashboard</span>
          <i aria-hidden="true" />
        </button>
        <button type="button" className="mQuickCard" onClick={() => navigate('/management/payroll-dashboard')}>
          <span>Payroll Dashboard</span>
          <i aria-hidden="true" />
        </button>
        <button type="button" className="mQuickCard" onClick={() => navigate('/management/pay-run-reporting')}>
          <span>Pay Run Reporting</span>
          <i aria-hidden="true" />
        </button>
      </div>

      <div className="mDash__grid">
        <div className="mDash__left">
          <section className="mPanel">
            <div className="mPanel__head">Latest Notifications</div>
            <div className="mPanel__body">
              {topNotifications.length > 0 ? (
                topNotifications.map((item) => (
                  <article key={item.id} className="mMaterial">
                    <div className="mMaterial__thumb" aria-hidden="true" />
                    <div>
                      <h4>{item.title}</h4>
                      <ul>
                        <li>{item.description || 'Management notification'}</li>
                        <li>{item.time}</li>
                      </ul>
                      <div className="mMaterial__actions">
                        <button type="button" onClick={() => navigate(item.destination)}>
                          Open
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <article className="mMaterial">
                  <div className="mMaterial__thumb" aria-hidden="true" />
                  <div>
                    <h4>No new notifications</h4>
                    <ul>
                      <li>Your latest payroll and company alerts will appear here.</li>
                    </ul>
                  </div>
                </article>
              )}
            </div>
          </section>

          <section className="mPanel">
            <div className="mPanel__head">Management Snapshot</div>
            <div className="mPanel__body">
              <article className="mMaterial">
                <div className="mMaterial__thumb" aria-hidden="true" />
                <div>
                  <h4>{employeeName}</h4>
                  <ul>
                    <li>Position: {employee?.position || 'Not available'}</li>
                    <li>Employment Status: {employee?.employmentStatus || 'Not available'}</li>
                    <li>Account Username: {employee?.userAccountName || profile?.username || 'Not available'}</li>
                    <li>Employee ID: {employeeId ?? 'Not available'}</li>
                  </ul>
                  <div className="mMaterial__actions">
                    <button type="button" onClick={() => navigate('/management/attendance')}>
                      View Attendance
                    </button>
                    <button type="button" onClick={() => navigate('/management/pay-run-reporting')}>
                      View Reports
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div className="mDash__right">
          <section className="mPanel">
            <div className="mPanel__head">Company Announcements and Events</div>
            <div className="mCal">
              <div className="mCal__toolbar">
                <button type="button" className="mCal__navBtn" onClick={() => shiftCalendarMonth(-1)} aria-label="Previous month">
                  <FiChevronLeft />
                </button>
                <span>{monthLabel}</span>
                <button type="button" className="mCal__navBtn" onClick={() => shiftCalendarMonth(1)} aria-label="Next month">
                  <FiChevronRight />
                </button>
              </div>
              <div className="mCal__grid">
                {Array.from({ length: totalCells }).map((_, index) => {
                  const dayNumber = index - mondayBasedStart + 1;
                  const value = dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : '';
                  return (
                    <div
                      key={index}
                      className={`mCal__cell${typeof value === 'number' && highlightedDays.includes(value) ? ' is-marked' : ''}`}
                    >
                      {value}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mPanel">
            <div className="mPanel__head">This Month, {monthLabel}:</div>
            <div className="mAnnounceGrid">
              {topEvents.length > 0 ? (
                topEvents.map((event, index) => (
                  <article key={`${event.title ?? 'event'}-${index}`} className="mAnnounce">
                    <h4>{event.title ?? 'Company event'}</h4>
                    <p>
                      {typeof event.day === 'number'
                        ? `Scheduled on day ${event.day} of the selected month.`
                        : 'Scheduled this month.'}
                    </p>
                  </article>
                ))
              ) : (
                <article className="mAnnounce">
                  <h4>No company events scheduled</h4>
                  <p>Calendar events for the selected month will appear here when HR updates the company calendar.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
