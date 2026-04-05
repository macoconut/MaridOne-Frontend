import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountSecuritySection from '../../../components/account/AccountSecuritySection';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import {
  beginTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  sendEmailVerification,
  type TwoFactorSetupResponse,
} from '../../../lib/accountSecurity';
import { apiFetchJson, toArray } from '../../../lib/api';
import { mapNotificationItem } from '../../../lib/notificationRouting';
import { getAuthToken, getUserEmail } from '../../../lib/session';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import '../../self-service/dashboard/Dashboard.css';
import './Dashboard.css';

type UserDetails = {
  username?: string;
  employeeId?: number;
  twoFactorEnabled?: boolean;
  employee?: {
    employeeId?: number;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    contactNumber?: string;
    phoneNumber?: string;
    email?: string;
    isVerified?: boolean | string;
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
  startDate?: string;
};

type AttendanceLog = {
  employeeId?: number;
  timestamp?: string;
};

type EmployeeRow = {
  id: number;
  name: string;
};

type LeaveRequest = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
};

type OvertimeRequest = {
  overtimeId?: number;
  requestStatus?: string;
};

function createEditDraft(source: UserDetails['employee'] | null | undefined) {
  const rawAddress =
    source && typeof source.address === 'object' && source.address
      ? (source.address as Record<string, unknown>)
      : {};

  return {
    email: typeof source?.email === 'string' ? source.email : '',
    phoneNumber:
      typeof source?.phoneNumber === 'string'
        ? source.phoneNumber
        : typeof source?.contactNumber === 'string'
          ? source.contactNumber
          : '',
    permanentAddress: typeof rawAddress.permanentAddress === 'string' ? rawAddress.permanentAddress : '',
    temporaryAddress: typeof rawAddress.temporaryAddress === 'string' ? rawAddress.temporaryAddress : '',
    city: typeof rawAddress.city === 'string' ? rawAddress.city : '',
    state: typeof rawAddress.state === 'string' ? rawAddress.state : '',
    country: typeof rawAddress.country === 'string' ? rawAddress.country : '',
    zipCode: typeof rawAddress.zipCode === 'string' ? rawAddress.zipCode : '',
  };
}

function isEmailVerified(value: UserDetails['employee'] | null | undefined) {
  const rawValue = value?.isVerified;

  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'verified') return true;
    if (normalized === 'false' || normalized === 'unverified') return false;
  }

  return false;
}

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

function localDateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { showSuccess } = useUiDialog();
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
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [startingTwoFactor, setStartingTwoFactor] = useState(false);
  const [confirmingTwoFactor, setConfirmingTwoFactor] = useState(false);
  const [disablingTwoFactor, setDisablingTwoFactor] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [teamEmployees, setTeamEmployees] = useState<EmployeeRow[]>([]);
  const [teamLogs, setTeamLogs] = useState<AttendanceLog[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRequest[]>([]);
  const [teamOvertime, setTeamOvertime] = useState<OvertimeRequest[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
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
  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useErrorDialogEffect(editError, 'Profile changes could not be saved');
  useErrorDialogEffect(securityError, 'Security action could not be completed');
  useEscapeDismiss(editOpen && !savingEdit, closeEditModal, 10);
  useEscapeDismiss(
    securityOpen && !(sendingVerification || startingTwoFactor || confirmingTwoFactor || disablingTwoFactor),
    closeSecurityModal,
    10
  );

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    setLastLoginLabel(formatJwtIssuedAt(getAuthToken()));
  }, []);

  useEffect(() => {
    if (editOpen || securityOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [editOpen, securityOpen]);

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
          setEditDraft(createEditDraft(fromUser));
        } else if (resolvedEmpId) {
          const selfEmployee = await apiFetchJson<UserDetails['employee']>(`/api/employees/${resolvedEmpId}`);
          setEmployee(selfEmployee);
          setEditDraft(createEditDraft(selfEmployee));
        }

        if (resolvedEmpId) {
          try {
            const attendance = await apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=1`);
            const first = toArray<AttendanceLog>(attendance)[0];
            if (first?.timestamp) setLastAttendanceLabel(new Date(first.timestamp).toLocaleString());
            else setLastAttendanceLabel('Not available');
          } catch {
            setLastAttendanceLabel('Not available');
          }
        }
      } catch {
        setProfile(null);
        setEmployee(null);
        setLastAttendanceLabel('Not available');
      }
    })();
  }, [refreshTick]);

  useEffect(() => {
    const month = calendarMonthIndex + 1;
    const year = calendarYear;
    const start = new Date(year, calendarMonthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, calendarMonthIndex + 1, 0, 23, 59, 59, 999);

    void (async () => {
      const [eventsResponse, notificationsResponse, employeesResponse, logsResponse, leavesResponse, overtimeResponse] = await Promise.allSettled([
        apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${year}`),
        apiFetchJson<unknown>('/api/notifications?page=0&size=8'),
        apiFetchJson<unknown>('/api/employees/team'),
        apiFetchJson<unknown>(
          `/api/logs/attendance/team?page=0&size=500&timestampAfter=${encodeURIComponent(start.toISOString())}&timestampBefore=${encodeURIComponent(end.toISOString())}`
        ),
        apiFetchJson<unknown>('/api/leave/request/team?page=0&size=100'),
        apiFetchJson<unknown>('/api/overtime/team?page=0&size=100'),
      ]);

      if (eventsResponse.status === 'fulfilled') {
        const eventRows = toArray<CalendarEvent>(eventsResponse.value);
        setEventDays(
          eventRows
            .map((item) => item.day ?? (item.startDate ? new Date(item.startDate).getDate() : undefined))
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
            .map((item) => mapNotificationItem('manager', item).title.trim())
            .filter((message) => message.length > 0)
            .slice(0, 3)
        );
      } else {
        setUpdateItems([]);
      }

      if (employeesResponse.status === 'fulfilled') {
        setTeamEmployees(
          toArray<Record<string, unknown>>(employeesResponse.value)
            .map((row, idx) => ({
              id: Number(row.employeeId ?? row.id ?? idx + 1),
              name:
                [row.firstName, row.middleName, row.lastName]
                  .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
                  .join(' ') || `Employee #${row.employeeId ?? row.id ?? idx + 1}`,
            }))
            .filter((row) => Number.isFinite(row.id))
        );
      } else {
        setTeamEmployees([]);
      }

      if (logsResponse.status === 'fulfilled') setTeamLogs(toArray<AttendanceLog>(logsResponse.value));
      else setTeamLogs([]);

      if (leavesResponse.status === 'fulfilled') setTeamLeaves(toArray<LeaveRequest>(leavesResponse.value));
      else setTeamLeaves([]);

      if (overtimeResponse.status === 'fulfilled') setTeamOvertime(toArray<OvertimeRequest>(overtimeResponse.value));
      else setTeamOvertime([]);
    })();
  }, [calendarMonthIndex, calendarYear, refreshTick]);

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
    return emp?.fullName || fromParts || 'Manager Name';
  }, [employee]);

  const todayKey = localDateKey(new Date().toISOString());
  const activeToday = useMemo(() => {
    return new Set(
      teamLogs
        .filter((log) => localDateKey(log.timestamp) === todayKey)
        .map((log) => log.employeeId)
        .filter((id): id is number => typeof id === 'number')
    ).size;
  }, [teamLogs, todayKey]);

  const onLeaveToday = useMemo(() => {
    return teamLeaves.filter((request) => String(request.requestStatus ?? '').toUpperCase() === 'APPROVED')
      .filter((request) => isTodayWithin(request.startDateTime, request.endDateTime))
      .length;
  }, [teamLeaves]);

  const pendingLeaveCount = useMemo(
    () => teamLeaves.filter((request) => String(request.requestStatus ?? '').toUpperCase() === 'PENDING').length,
    [teamLeaves]
  );

  const pendingOvertimeCount = useMemo(
    () => teamOvertime.filter((request) => String(request.requestStatus ?? '').toUpperCase() === 'PENDING').length,
    [teamOvertime]
  );
  const savedEmailNormalized = employee?.email?.trim().toLowerCase() ?? '';
  const draftEmailNormalized = editDraft.email.trim().toLowerCase();
  const emailDirty = (employee?.email || '').trim() !== editDraft.email.trim();
  const emailChanged = Boolean(draftEmailNormalized && draftEmailNormalized !== savedEmailNormalized);
  const emailVerified = isEmailVerified(employee);
  const emailVerificationWillReset = emailVerified && emailChanged;

  function shiftCalendarMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonthIndex + offset, 1);
    setCalendarYear(next.getFullYear());
    setCalendarMonthIndex(next.getMonth());
  }

  function openEditModal() {
    setEditError('');
    setEditDraft(createEditDraft(employee));
    setEditOpen(true);
  }

  function openSecurityModal() {
    setSecurityError('');
    setSecurityMessage('');
    setSecurityOpen(true);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditOpen(false);
    setEditError('');
    setEditDraft(createEditDraft(employee));
  }

  function closeSecurityModal() {
    if (sendingVerification || startingTwoFactor || confirmingTwoFactor || disablingTwoFactor) return;
    setSecurityOpen(false);
    clearSecurityFeedback();
    if (!profile?.twoFactorEnabled) {
      setTwoFactorSetup(null);
    }
    setTwoFactorCode('');
  }

  function setEditField<K extends keyof typeof editDraft>(key: K, value: (typeof editDraft)[K]) {
    setEditDraft((prev) => ({ ...prev, [key]: value }));
  }

  function clearSecurityFeedback() {
    setSecurityError('');
    setSecurityMessage('');
  }

  async function submitEditInfo() {
    if (!employeeId) {
      setEditError('Employee profile cannot be updated right now.');
      return;
    }

    if (emailVerificationWillReset) {
      const shouldContinue = window.confirm(
        'Changing your verified email will remove its verified status until you verify the new address. Continue?'
      );
      if (!shouldContinue) return;
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
      setEditDraft(createEditDraft(refreshed));
      if (emailChanged) {
        setEditOpen(false);
        setSecurityError('');
        setSecurityMessage(
          emailVerified
            ? 'Profile updated. Your email is now unverified because the address changed. Send a new verification email for your saved address.'
            : 'Profile updated. Send a new verification email for your saved address.'
        );
        setSecurityOpen(true);
      } else {
        setEditOpen(false);
      }
    } catch (error) {
      setEditError(getFriendlyErrorMessage(error, 'profile-update'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSendEmailVerification() {
    clearSecurityFeedback();
    setSendingVerification(true);
    try {
      await sendEmailVerification();
      setSecurityOpen(false);
      setTwoFactorCode('');
      showSuccess(
        'Verification email sent. Check your inbox and open the link to finish.',
        'Verification Email Sent'
      );
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleStartTwoFactorSetup() {
    clearSecurityFeedback();
    setStartingTwoFactor(true);
    try {
      const setup = await beginTwoFactorSetup();
      setTwoFactorSetup(setup);
      setTwoFactorCode('');
      setSecurityMessage('Scan the QR code, then enter the current 6-digit code to finish enabling 2FA.');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setStartingTwoFactor(false);
    }
  }

  async function handleConfirmTwoFactor() {
    const code = twoFactorCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setSecurityMessage('');
      setSecurityError('Enter the current 6-digit code from your authenticator app.');
      return;
    }

    clearSecurityFeedback();
    setConfirmingTwoFactor(true);
    try {
      const message = await confirmTwoFactorSetup(code);
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setProfile((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));
      setSecurityOpen(false);
      showSuccess(message || 'Two-factor authentication successfully enabled.', 'Two-Factor Enabled');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setConfirmingTwoFactor(false);
    }
  }

  async function handleDisableTwoFactor() {
    clearSecurityFeedback();
    setDisablingTwoFactor(true);
    try {
      await disableTwoFactor();
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setProfile((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));
      setSecurityOpen(false);
      showSuccess('Two-factor authentication has been disabled.', 'Two-Factor Disabled');
    } catch (error) {
      setSecurityError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setDisablingTwoFactor(false);
    }
  }

  return (
    <div className="dashPage">
      <PageHeader
        title="Manager Dashboard"
      />

      <section className="infoCardX">
        <div className="infoCardX__header">
          <div className="infoCardX__title">Your Information</div>
          <div className="infoCardX__headerActions">
            <button className="infoCardX__edit infoCardX__edit--secondary" type="button" onClick={openSecurityModal}>
              Security
            </button>
            <button className="infoCardX__edit" type="button" onClick={openEditModal} disabled={savingEdit}>
              Edit Info
            </button>
          </div>
        </div>

        <div className="infoCardX__grid">
          <div className="infoCardX__left">
            <div className="infoCardX__photo" aria-hidden="true" />
            <div className="infoCardX__name">
              {employeeName}
            </div>
          </div>

          <div className="infoCardX__divider" />

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

      <section className="actionRowX">
        <button className="actionBtnX" type="button" onClick={() => navigate('/manager/attendance-dashboard')}>
          <span>Attendance Dashboard</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button" onClick={() => navigate('/manager/attendance-reports')}>
          <span>Attendance Reports</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button" onClick={() => navigate('/manager/pending-approvals')}>
          <span>Review Approvals</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
      </section>

      <section className="lowerGridX">
        <div className="lowerColX">
          <div className="cardX">
            <div className="cardX__title">Latest Team Updates & Events</div>

            <div className="miniFolders">
              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">{updateItems[0] || 'No manager notifications yet.'}</div>
                  <ul>
                    {(updateItems.length > 1 ? updateItems.slice(1) : ['New notifications will appear here when the backend sends them.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">{eventHighlights[0] || 'No company events scheduled this month.'}</div>
                  <ul>
                    {(eventHighlights.length > 1 ? eventHighlights.slice(1) : ['Company events from the shared calendar will appear here.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button className="miniFolder__btn" type="button" onClick={() => shiftCalendarMonth(0)}>
                    View Events
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="cardX">
            <div className="cardX__title">Team Snapshot</div>

            <div className="handbookRow">
              <div className="handbookRow__icon" />
              <div className="handbookRow__body">
                <div className="handbookRow__name">Live team totals from your manager endpoints</div>
                <ul className="mgrDashSummaryList">
                  <li>Managed team members: {teamEmployees.length}</li>
                  <li>Active today: {activeToday}</li>
                  <li>On leave today: {onLeaveToday}</li>
                  <li>Pending leave approvals: {pendingLeaveCount}</li>
                  <li>Pending overtime approvals: {pendingOvertimeCount}</li>
                </ul>

                <div className="handbookRow__actions">
                  <button className="handbookBtn" type="button" onClick={() => navigate('/manager/attendance-dashboard')}>
                    View Attendance
                  </button>
                  <button className="handbookBtn" type="button" onClick={() => navigate('/manager/pending-approvals')}>
                    View Approvals
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                  <div key={i} className={`calCell ${typeof value === 'number' && eventDays.includes(value) ? 'is-event' : ''}`}>
                    {value}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {editOpen && (
        <div className="dashModalBackdrop" role="dialog" aria-modal="true" aria-label="Edit manager info">
          <div className="dashModal">
            <div className="dashModal__top">
              <div className="dashModal__title">EDIT INFO</div>
              <ModalCloseButton className="dashModal__close" onClick={closeEditModal} disabled={savingEdit} />
            </div>

            <div className="dashModal__rule" />

            <div className="dashModal__grid">
              <label className="dashModal__field">
                <span>Email</span>
                <input
                  value={editDraft.email}
                  placeholder="Optional email address"
                  onChange={(e) => setEditField('email', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Phone Number</span>
                <input
                  value={editDraft.phoneNumber}
                  placeholder="Optional phone number"
                  onChange={(e) => setEditField('phoneNumber', e.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Permanent Address</span>
                <input
                  value={editDraft.permanentAddress}
                  placeholder="Optional permanent address"
                  onChange={(e) => setEditField('permanentAddress', e.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Temporary Address</span>
                <input
                  value={editDraft.temporaryAddress}
                  placeholder="Optional temporary address"
                  onChange={(e) => setEditField('temporaryAddress', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>City</span>
                <input
                  value={editDraft.city}
                  placeholder="Optional city"
                  onChange={(e) => setEditField('city', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>State</span>
                <input
                  value={editDraft.state}
                  placeholder="Optional state"
                  onChange={(e) => setEditField('state', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Country</span>
                <input
                  value={editDraft.country}
                  placeholder="Optional country"
                  onChange={(e) => setEditField('country', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Zip Code</span>
                <input
                  value={editDraft.zipCode}
                  placeholder="Optional ZIP code"
                  onChange={(e) => setEditField('zipCode', e.target.value)}
                />
              </label>
            </div>

            {emailVerificationWillReset && (
              <div className="dashModal__helper dashModal__helper--warning">
                Changing this verified email will reset its verification status until the new address is verified.
              </div>
            )}

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

      {securityOpen && (
        <div className="dashModalBackdrop" role="dialog" aria-modal="true" aria-label="Account security">
          <div className="dashModal dashModal--security">
            <div className="dashModal__top">
              <div>
                <div className="dashModal__title">ACCOUNT SECURITY</div>
                <div className="dashModal__subtitle">Manage email verification and two-factor authentication.</div>
              </div>
              <ModalCloseButton
                className="dashModal__close"
                onClick={closeSecurityModal}
                disabled={sendingVerification || startingTwoFactor || confirmingTwoFactor || disablingTwoFactor}
              />
            </div>

            <div className="dashModal__rule" />

            <AccountSecuritySection
              savedEmail={employee?.email || ''}
              emailDirty={emailDirty}
              emailVerified={emailVerified}
              twoFactorEnabled={Boolean(profile?.twoFactorEnabled)}
              twoFactorCode={twoFactorCode}
              setup={twoFactorSetup}
              statusMessage={securityMessage}
              sendingVerification={sendingVerification}
              startingTwoFactor={startingTwoFactor}
              confirmingTwoFactor={confirmingTwoFactor}
              disablingTwoFactor={disablingTwoFactor}
              onTwoFactorCodeChange={(value) => setTwoFactorCode(value.replace(/\D/g, '').slice(0, 6))}
              onSendVerification={() => void handleSendEmailVerification()}
              onStartTwoFactor={() => void handleStartTwoFactorSetup()}
              onConfirmTwoFactor={() => void handleConfirmTwoFactor()}
              onDisableTwoFactor={() => void handleDisableTwoFactor()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
