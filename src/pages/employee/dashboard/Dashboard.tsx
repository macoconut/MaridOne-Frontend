import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getAuthToken, getUserEmail } from '../../../lib/session';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './Dashboard.css';

type UserDetails = {
  username?: string;
  employeeId?: number;
  employee?: {
    employeeId?: number;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    contactNumber?: string;
    phoneNumber?: string;
    email?: string;
    address?: string | Record<string, unknown>;
    employmentDateStart?: string;
    employmentDate?: string;
    dateHired?: string;
    position?: string;
    employmentStatus?: string;
  };
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
    const issuedAt = new Date(payload.iat * 1000);
    return issuedAt.toLocaleString();
  } catch {
    return 'Not available';
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserDetails | null>(null);
  const [employee, setEmployee] = useState<UserDetails['employee'] | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [eventDays, setEventDays] = useState<number[]>([]);
  const [updateItems, setUpdateItems] = useState<string[]>([]);
  const [eventHighlights, setEventHighlights] = useState<string[]>([]);
  const [lastLoginLabel, setLastLoginLabel] = useState<string>('Not available');
  const [lastAttendanceLabel, setLastAttendanceLabel] = useState<string>('Not available');
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    email: '',
    phoneNumber: '',
    permanentAddress: '',
    temporaryAddress: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
  });

  useEffect(() => {
    setLastLoginLabel(formatJwtIssuedAt(getAuthToken()));
  }, []);

  useEffect(() => {
    if (editOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [editOpen]);

  useEffect(() => {
    const username = getUserEmail();
    if (!username) return;

    void (async () => {
      try {
        const details = await apiFetchJson<UserDetails>(`/api/user/details/${encodeURIComponent(username)}`);
        setProfile(details);

        const fromUser =
          details.employee && typeof details.employee === 'object' ? details.employee : null;
        const resolvedEmpId =
          typeof details.employeeId === 'number'
            ? details.employeeId
            : typeof fromUser?.employeeId === 'number'
              ? fromUser.employeeId
              : null;
        setEmployeeId(resolvedEmpId ?? null);

        if (fromUser) {
          setEmployee(fromUser);
          setEditDraft({
            email: typeof fromUser.email === 'string' ? fromUser.email : '',
            phoneNumber:
              typeof fromUser.phoneNumber === 'string'
                ? fromUser.phoneNumber
                : typeof fromUser.contactNumber === 'string'
                  ? fromUser.contactNumber
                  : '',
            permanentAddress: '',
            temporaryAddress: '',
            city: '',
            state: '',
            country: '',
            zipCode: '',
          });
          const empId = typeof fromUser.employeeId === 'number' ? fromUser.employeeId : resolvedEmpId;
          if (empId) {
            try {
              const attendance = await apiFetchJson<unknown>(`/api/logs/attendance/self/${empId}?page=0&size=1`);
              const first = toArray<AttendanceLog>(attendance)[0];
              if (first?.timestamp) {
                setLastAttendanceLabel(new Date(first.timestamp).toLocaleString());
              } else {
                setLastAttendanceLabel('Not available');
              }
            } catch {
              setLastAttendanceLabel('Not available');
            }
          }
          return;
        }

        if (resolvedEmpId) {
          const selfEmployee = await apiFetchJson<UserDetails['employee']>(
            `/api/employees/${resolvedEmpId}`
          );
          setEmployee(selfEmployee);
          const rawAddress =
            selfEmployee && typeof selfEmployee.address === 'object' && selfEmployee.address
              ? (selfEmployee.address as Record<string, unknown>)
              : {};
          setEditDraft({
            email: typeof selfEmployee?.email === 'string' ? selfEmployee.email : '',
            phoneNumber:
              typeof selfEmployee?.phoneNumber === 'string'
                ? selfEmployee.phoneNumber
                : typeof selfEmployee?.contactNumber === 'string'
                  ? selfEmployee.contactNumber
                  : '',
            permanentAddress: typeof rawAddress.permanentAddress === 'string' ? rawAddress.permanentAddress : '',
            temporaryAddress: typeof rawAddress.temporaryAddress === 'string' ? rawAddress.temporaryAddress : '',
            city: typeof rawAddress.city === 'string' ? rawAddress.city : '',
            state: typeof rawAddress.state === 'string' ? rawAddress.state : '',
            country: typeof rawAddress.country === 'string' ? rawAddress.country : '',
            zipCode: typeof rawAddress.zipCode === 'string' ? rawAddress.zipCode : '',
          });
          try {
            const attendance = await apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=1`);
            const first = toArray<AttendanceLog>(attendance)[0];
            if (first?.timestamp) {
              setLastAttendanceLabel(new Date(first.timestamp).toLocaleString());
            } else {
              setLastAttendanceLabel('Not available');
            }
          } catch {
            setLastAttendanceLabel('Not available');
          }
          return;
        }

        setEmployee(null);
      } catch {
        setProfile(null);
        setEmployee(null);
        setLastAttendanceLabel('Not available');
      }
    })();
  }, []);

  useEffect(() => {
    const month = calendarMonthIndex + 1;
    const year = calendarYear;
    void (async () => {
      const [eventsResponse, notificationsResponse] = await Promise.allSettled([
        apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${year}`),
        apiFetchJson<unknown>('/api/notifications?page=0&size=8'),
      ]);

      if (eventsResponse.status === 'fulfilled') {
        const eventRows = toArray<CalendarEvent>(eventsResponse.value);
        setEventDays(
          eventRows
            .map((item) => item.day)
            .filter((day): day is number => typeof day === 'number')
        );
        setEventHighlights(
          eventRows
            .map((item) => String(item.title ?? '').trim())
            .filter((title) => title.length > 0)
            .slice(0, 3)
        );
      } else {
        setEventDays([]);
        setEventHighlights([]);
      }

      if (notificationsResponse.status === 'fulfilled') {
        setUpdateItems(
          toArray<Record<string, unknown>>(notificationsResponse.value)
            .map((item) => String(item.message ?? '').trim())
            .filter((message) => message.length > 0)
            .slice(0, 3)
        );
      } else {
        setUpdateItems([]);
      }
    })();
  }, [calendarMonthIndex, calendarYear]);

  const monthLabel = new Date(calendarYear, calendarMonthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const year = calendarYear;
  const monthIndex = calendarMonthIndex;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBasedStart = firstDay.getDay();
  const totalCells = Math.ceil((sundayBasedStart + daysInMonth) / 7) * 7;

  const employeeName = useMemo(() => {
    const emp = employee;
    const fromParts = [emp?.firstName, emp?.middleName, emp?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    return emp?.fullName || fromParts || 'Employee Name';
  }, [employee]);

  function shiftCalendarMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonthIndex + offset, 1);
    setCalendarYear(next.getFullYear());
    setCalendarMonthIndex(next.getMonth());
  }

  function openEditModal() {
    setEditError('');
    setEditOpen(true);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditOpen(false);
    setEditError('');
  }

  function setEditField<K extends keyof typeof editDraft>(key: K, value: (typeof editDraft)[K]) {
    setEditDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function submitEditInfo() {
    if (!employeeId) {
      setEditError('Employee profile cannot be updated right now.');
      return;
    }

    setEditError('');
    setSavingEdit(true);
    try {
      await apiFetchJson(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: editDraft.email.trim() || undefined,
          phoneNumber: editDraft.phoneNumber.trim() || undefined,
          address: {
            permanentAddress: editDraft.permanentAddress.trim() || undefined,
            temporaryAddress: editDraft.temporaryAddress.trim() || undefined,
            city: editDraft.city.trim() || undefined,
            state: editDraft.state.trim() || undefined,
            country: editDraft.country.trim() || undefined,
            zipCode: editDraft.zipCode.trim() || undefined,
          },
        }),
      });
      const refreshed = await apiFetchJson<UserDetails['employee']>(`/api/employees/${employeeId}`);
      setEmployee(refreshed);
      setEditOpen(false);
    } catch (error) {
      setEditError(getFriendlyErrorMessage(error, 'profile-update'));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="dashPage">
      {/* INFO CARD */}
      <section className="infoCardX">
        <div className="infoCardX__header">
          <div className="infoCardX__title">Your Information</div>
          <button className="infoCardX__edit" type="button" onClick={openEditModal} disabled={savingEdit}>
            Edit Info
          </button>
        </div>

        <div className="infoCardX__grid">
          {/* left */}
          <div className="infoCardX__left">
            <div className="infoCardX__photo" aria-hidden="true" />
            <div className="infoCardX__name">
              {employeeName}
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* middle */}
          <div className="infoCardX__mid">
            <div className="infoRow">
              <span className="infoRow__icon">⌂</span>
              <span>{formatAddress(employee?.address)}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span className="infoRow__link">{employee?.email || profile?.username || 'Email not available'}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">☎</span>
              <span>{employee?.phoneNumber || employee?.contactNumber || 'Phone not available'}</span>
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* right */}
          <div className="infoCardX__right">
            <div className="statBlock">
              <div className="statBlock__label">Part of Marid since:</div>
              <div className="statBlock__value">
                {employee?.employmentDateStart || employee?.employmentDate || employee?.dateHired || 'Not available'}
              </div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last Login:</div>
              <div className="statBlock__value">{lastLoginLabel}</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last attendance:</div>
              <div className="statBlock__value">{lastAttendanceLabel}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <section className="actionRowX">
        <button className="actionBtnX" type="button" onClick={() => navigate('/employee/payslip')}>
          <span>View Payslip</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button" onClick={() => navigate('/employee/attendance')}>
          <span>View Attendance</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button" onClick={() => navigate('/employee/attendance')}>
          <span>Request OT</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button" onClick={() => navigate('/employee/attendance')}>
          <span>Request Leave</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
      </section>

      {/* LOWER */}
      <section className="lowerGridX">
        {/* left column */}
        <div className="lowerColX">
          {/* training */}
          <div className="cardX">
            <div className="cardX__title">Latest HR Updates & Events</div>

            <div className="miniFolders">
              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">{updateItems[0] || 'No HR updates in your notification feed yet.'}</div>
                  <ul>
                    {(updateItems.length > 1 ? updateItems.slice(1) : ['Check your notifications to see the latest HR announcements.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button className="miniFolder__btn" type="button" onClick={() => navigate('/employee/training')}>
                    View Updates
                  </button>
                </div>
              </div>

              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">{eventHighlights[0] || 'No company events scheduled this month.'}</div>
                  <ul>
                    {(eventHighlights.length > 1 ? eventHighlights.slice(1) : ['Upcoming company events will appear here when the calendar is updated.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button className="miniFolder__btn" type="button" onClick={() => navigate('/employee/training')}>
                    View Events
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* handbook */}
          <div className="cardX">
            <div className="cardX__title">Employee Snapshot</div>

            <div className="handbookRow">
              <div className="handbookRow__icon" />
              <div className="handbookRow__body">
                <div className="handbookRow__name">Your current work profile</div>
                <ul>
                  <li>Position: {employee?.position || 'Not available'}</li>
                  <li>Employment Status: {employee?.employmentStatus || 'Not available'}</li>
                </ul>

                <div className="handbookRow__actions">
                  <button className="handbookBtn" type="button" onClick={() => navigate('/employee/payslip')}>
                    View Payslip
                  </button>
                  <button className="handbookBtn" type="button" onClick={() => navigate('/employee/attendance')}>
                    View Attendance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* right calendar */}
        <div className="cardX cardX--calendar">
          <div className="cardX__title">Company Events</div>
          <div className="calendarShell" aria-label="Company events calendar">
            <div className="calendarShell__top">
              <button type="button" className="calendarShell__navBtn" onClick={() => shiftCalendarMonth(-1)} aria-label="Previous month">‹</button>
              <strong>{monthLabel}</strong>
              <button type="button" className="calendarShell__navBtn" onClick={() => shiftCalendarMonth(1)} aria-label="Next month">›</button>
            </div>

            <div className="calendarGrid">
              <div className="calHead">SU</div><div className="calHead">MO</div><div className="calHead">TU</div>
              <div className="calHead">WE</div><div className="calHead">TH</div><div className="calHead">FR</div><div className="calHead">SA</div>

              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNumber = i - sundayBasedStart + 1;
                const value = dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : '';

                return (
                  <div key={i} className="calCell">
                    {value}
                    {typeof value === 'number' && eventDays.includes(value) ? ' *' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {editError && <p className="dashEditError">{editError}</p>}

      {editOpen && (
        <div className="dashModalBackdrop" role="dialog" aria-modal="true" aria-label="Edit employee info">
          <div className="dashModal">
            <div className="dashModal__top">
              <div className="dashModal__title">EDIT INFO</div>
              <button type="button" className="dashModal__close" onClick={closeEditModal} disabled={savingEdit}>
                x
              </button>
            </div>

            <div className="dashModal__rule" />

            <div className="dashModal__grid">
              <label className="dashModal__field">
                <span>Email</span>
                <input value={editDraft.email} onChange={(e) => setEditField('email', e.target.value)} />
              </label>
              <label className="dashModal__field">
                <span>Phone Number</span>
                <input value={editDraft.phoneNumber} onChange={(e) => setEditField('phoneNumber', e.target.value)} />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Permanent Address</span>
                <input
                  value={editDraft.permanentAddress}
                  onChange={(e) => setEditField('permanentAddress', e.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Temporary Address</span>
                <input
                  value={editDraft.temporaryAddress}
                  onChange={(e) => setEditField('temporaryAddress', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>City</span>
                <input value={editDraft.city} onChange={(e) => setEditField('city', e.target.value)} />
              </label>
              <label className="dashModal__field">
                <span>State</span>
                <input value={editDraft.state} onChange={(e) => setEditField('state', e.target.value)} />
              </label>
              <label className="dashModal__field">
                <span>Country</span>
                <input value={editDraft.country} onChange={(e) => setEditField('country', e.target.value)} />
              </label>
              <label className="dashModal__field">
                <span>Zip Code</span>
                <input value={editDraft.zipCode} onChange={(e) => setEditField('zipCode', e.target.value)} />
              </label>
            </div>

            {editError && <div className="dashModal__error">{editError}</div>}

            <div className="dashModal__actions">
              <button
                type="button"
                className="dashModal__btn dashModal__btn--ghost"
                onClick={closeEditModal}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dashModal__btn"
                onClick={() => void submitEditInfo()}
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
