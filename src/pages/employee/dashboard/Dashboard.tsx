import { useEffect, useMemo, useState } from 'react';
import { apiRequest, asArray } from '../../../lib/api';
import './Dashboard.css';

type UserDetails = {
  employeeId?: number | string;
  id?: number | string;
  username?: string;
  email?: string;
  role?: string;
};

type EmployeeDetails = {
  employeeId?: number | string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  address?: string;
  email?: string;
  contactNumber?: string;
  position?: string;
  employmentDate?: string;
};

type CalendarEvent = {
  id?: number | string;
  calendarId?: number | string;
  day?: number;
  title?: string;
  isHoliday?: boolean;
};

type AttendanceLog = {
  employeeId?: number | string;
  timeIn?: string;
  createdAt?: string;
  timestamp?: string;
};

function getStorageValue(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function formatDateLabel(value?: string): string {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function getFullName(employee: EmployeeDetails): string {
  const parts = [employee.firstName, employee.middleName, employee.lastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Employee name unavailable';
}

export default function Dashboard() {
  const now = new Date();
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayBasedStart = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayBasedStart + daysInMonth) / 7) * 7;

  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [lastAttendance, setLastAttendance] = useState<string>('Not available');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setMessage('');

      const usernameOrEmail = (getStorageValue('maridone.userEmail') ?? '').trim();
      if (!usernameOrEmail) {
        if (isMounted) {
          setMessage('No active session found. Please log in again.');
          setIsLoading(false);
        }
        return;
      }

      let employeeId: string | number | undefined;

      try {
        const user = await apiRequest<UserDetails>(`/api/user/details/${encodeURIComponent(usernameOrEmail)}`);
        employeeId = user.employeeId ?? user.id;
      } catch {
        employeeId = undefined;
      }

      if (!employeeId) {
        if (isMounted) {
          setEmployeeDetails(null);
          setMessage('Unable to resolve employee profile from backend.');
          setIsLoading(false);
        }
        return;
      }

      const results = await Promise.allSettled([
        apiRequest<EmployeeDetails>(`/api/employees/${employeeId}`),
        apiRequest<unknown>(`/api/calendar/events?month=${monthIndex + 1}&year=${year}`),
        apiRequest<unknown>('/api/logs/attendance?page=0&size=200'),
      ]);

      if (!isMounted) return;

      const [employeeResult, eventsResult, attendanceResult] = results;

      if (employeeResult.status === 'fulfilled') {
        setEmployeeDetails(employeeResult.value);
      } else {
        setEmployeeDetails(null);
      }

      if (eventsResult.status === 'fulfilled') {
        setCalendarEvents(asArray<CalendarEvent>(eventsResult.value));
      } else {
        setCalendarEvents([]);
      }

      if (attendanceResult.status === 'fulfilled') {
        const logs = asArray<AttendanceLog>(attendanceResult.value).filter(
          (item) => String(item.employeeId ?? '') === String(employeeId)
        );
        const latest = logs.at(0);
        setLastAttendance(formatDateLabel(latest?.timeIn ?? latest?.createdAt ?? latest?.timestamp));
      } else {
        setLastAttendance('Not available');
      }

      if (employeeResult.status === 'rejected' || eventsResult.status === 'rejected' || attendanceResult.status === 'rejected') {
        setMessage('Some dashboard data failed to load. Check backend connection.');
      }

      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [monthIndex, year]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of calendarEvents) {
      if (!event.day) continue;
      const existing = map.get(event.day) ?? [];
      existing.push(event);
      map.set(event.day, existing);
    }
    return map;
  }, [calendarEvents]);

  const fullName = employeeDetails ? getFullName(employeeDetails) : 'Employee name unavailable';
  const address = employeeDetails?.address?.trim() || 'Address not available';
  const email = employeeDetails?.email?.trim() || 'Email not available';
  const phone = employeeDetails?.contactNumber?.trim() || 'Phone not available';
  const employedSince = formatDateLabel(employeeDetails?.employmentDate);
  const lastLogin = formatDateLabel(new Date().toISOString());

  return (
    <div className="dashPage">
      <section className="infoCardX">
        <div className="infoCardX__header">
          <div className="infoCardX__title">Your Information</div>
          <button className="infoCardX__edit" type="button">Edit Info</button>
        </div>

        <div className="infoCardX__grid">
          <div className="infoCardX__left">
            <div className="infoCardX__photo" aria-hidden="true" />
            <div className="infoCardX__name">{fullName}</div>
          </div>

          <div className="infoCardX__divider" />

          <div className="infoCardX__mid">
            <div className="infoRow">
              <span className="infoRow__icon">⌂</span>
              <span>{address}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span className="infoRow__link">{email}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">☎</span>
              <span>{phone}</span>
            </div>
          </div>

          <div className="infoCardX__divider" />

          <div className="infoCardX__right">
            <div className="statBlock">
              <div className="statBlock__label">Part of Marid since:</div>
              <div className="statBlock__value">{employedSince}</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last Login:</div>
              <div className="statBlock__value">{lastLogin}</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last attendance:</div>
              <div className="statBlock__value">{lastAttendance}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="actionRowX">
        <button className="actionBtnX" type="button">
          <span>View Payslip</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>View Attendance</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>Request OT</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>Request Leave</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
      </section>

      <section className="lowerGridX">
        <div className="lowerColX">
          <div className="cardX">
            <div className="cardX__title">Training and Onboarding Materials</div>

            <div className="miniFolders">
              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">Updated Training v1.5</div>
                  <ul>
                    <li>Revised workflow and role responsibilities</li>
                    <li>Latest internal tool usage guidelines</li>
                  </ul>
                  <button className="miniFolder__btn" type="button">View Training Materials</button>
                </div>
              </div>

              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">Updated Onboarding v1.5</div>
                  <ul>
                    <li>Updated employee account setup process</li>
                    <li>Current onboarding checkpoints and contacts</li>
                  </ul>
                  <button className="miniFolder__btn" type="button">View Onboarding Materials</button>
                </div>
              </div>
            </div>
          </div>

          <div className="cardX">
            <div className="cardX__title">Employee Handbook</div>

            <div className="handbookRow">
              <div className="handbookRow__icon" />
              <div className="handbookRow__body">
                <div className="handbookRow__name">Updated Handbook v2.1</div>
                <ul>
                  <li>Current HR policies and attendance rules.</li>
                  <li>Code of conduct and reporting procedures.</li>
                </ul>

                <div className="handbookRow__actions">
                  <button className="handbookBtn" type="button">View Handbook</button>
                  <button className="handbookBtn" type="button">Download Handbook</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="cardX cardX--calendar">
          <div className="cardX__title">Company Events</div>
          <div className="calendarShell" aria-label="Company events calendar">
            <div className="calendarShell__top">
              <span>‹</span>
              <strong>{monthLabel}</strong>
              <span>›</span>
            </div>

            <div className="calendarGrid">
              <div className="calHead">MO</div><div className="calHead">TU</div><div className="calHead">WE</div>
              <div className="calHead">TH</div><div className="calHead">FR</div><div className="calHead">SA</div><div className="calHead">SU</div>

              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNumber = i - mondayBasedStart + 1;
                const value = dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : '';
                const hasEvent = typeof value === 'number' ? (eventsByDay.get(value)?.length ?? 0) > 0 : false;

                return (
                  <div key={i} className="calCell">
                    {value}
                    {hasEvent && <div style={{ fontSize: 10, marginTop: 2 }}>• event</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {(isLoading || message) && (
        <p style={{ marginTop: 12 }}>{isLoading ? 'Loading dashboard...' : message}</p>
      )}
    </div>
  );
}
