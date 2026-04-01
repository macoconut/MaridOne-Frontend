import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  FiGrid,
  FiLogOut,
  FiBell,
  FiCheckCircle,
  FiCalendar,
  FiClock,
  FiFileText,
  FiUsers,
  FiCreditCard,
} from 'react-icons/fi';
import '../../employee/layout/EmployeeLayout.css';
import '../shared/hr-theme.css';
import { getUserEmail } from '../../../lib/session';
import { BACKEND_TEST_MODE } from '../../../config/flags';
import { apiFetchRaw, expireCurrentSession, getApiBaseUrl } from '../../../lib/api';
import { mapNotificationItem, type NotificationItem } from '../../../lib/notificationRouting';
import {
  applyBodyPlaceholders,
  applyPathPlaceholders,
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../../lib/backendTest';

type BackendTestAction = {
  label: string;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const API_BASE_URL = getApiBaseUrl();

const backendActions: BackendTestAction[] = [
  {
    label: 'Create Employee',
    description: 'Create a new employee record.',
    method: 'POST',
    path: '/api/employees/create',
    body: {
      firstName: 'Test',
      middleName: 'H',
      lastName: 'Employee',
      birthDate: '1998-01-01',
      email: 'test.employee@example.com',
      phoneNumber: '09171234567',
      position: 'EMPLOYEE',
      employmentStatus: 'REGULAR',
      address: {
        permanentAddress: 'Sampaloc Manila',
        temporaryAddress: 'Sampaloc Manila',
        city: 'Manila',
        state: 'Metro Manila',
        country: 'Philippines',
        zipCode: '1000',
      },
    },
  },
  {
    label: 'Get Employees',
    description: 'Fetch paginated employee list for HR.',
    method: 'GET',
    path: '/api/employees?page=0&size=20',
  },
  {
    label: 'Update Employee',
    description: 'Update employee details by employee ID.',
    method: 'PATCH',
    path: '/api/employees/{empId}',
    body: {
      firstName: 'Updated',
      lastName: 'Employee',
    },
  },
  {
    label: 'Update Employee Status',
    description: 'Change employee status fields.',
    method: 'PATCH',
    path: '/api/employees/status/{empId}',
    body: {
      employmentStatus: 'REGULAR',
    },
  },
  {
    label: 'Create User Account',
    description: 'Create login account for an employee.',
    method: 'POST',
    path: '/api/user/create',
    body: {
      username: 'test.employee',
      password: 'password123',
      employeeId: '{empId}',
    },
  },
  {
    label: 'Create Leave Balance',
    description: 'Create leave balance row for employee.',
    method: 'POST',
    path: '/api/leave/balance/{empId}',
    body: {
      empId: '{empId}',
      balanceHours: 8,
      leaveType: 'SICK_LEAVE',
    },
  },
  {
    label: 'Update Leave Balance',
    description: 'Adjust leave balance by leave type.',
    method: 'PATCH',
    path: '/api/leave/balance/update/{empId}',
    body: {
      leaveType: 'SICK_LEAVE',
      type: 'add',
      balanceHours: 2,
    },
  },
  {
    label: 'Update Leave Request',
    description: 'Approve or deny leave request.',
    method: 'PATCH',
    path: '/api/leave/update/{leaveRequestId}',
    body: {
      leaveDate: '2026-03-03',
      approver: 'HR',
      reason: 'Approved request',
      requestStatus: 'APPROVED',
      approverReason: 'Approved by HR',
    },
  },
  {
    label: 'Get Overtime Requests',
    description: 'Fetch all overtime requests for HR.',
    method: 'GET',
    path: '/api/overtime/all?page=0&size=20',
  },
  {
    label: 'Update Overtime Request',
    description: 'Approve or deny overtime request.',
    method: 'PATCH',
    path: '/api/overtime/update',
    body: {
      overtimeId: '{overtimeId}',
      updateStatus: 'APPROVED',
      approveReason: 'Approved for payroll',
    },
  },
  {
    label: 'Add Shift Schedule',
    description: 'Create a template shift assignment.',
    method: 'POST',
    path: '/api/employee/schedule/add',
    body: {
      empId: '{empId}',
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '17:00',
    },
  },
  {
    label: 'Update Shift Schedule',
    description: 'Edit an existing shift assignment.',
    method: 'PATCH',
    path: '/api/employee/schedule/update',
    body: {
      shiftId: '{shiftId}',
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '18:00',
    },
  },
  {
    label: 'Create Calendar Event',
    description: 'Create company-wide calendar event.',
    method: 'POST',
    path: '/api/calendar/events/create',
    body: {
      title: 'Backend Test Event',
      month: 4,
      day: 10,
      year: 2026,
      isHoliday: false,
    },
  },
  {
    label: 'Update Calendar Event',
    description: 'Update existing calendar event.',
    method: 'PUT',
    path: '/api/calendar/events/update',
    body: {
      calendarId: '{calendarId}',
      title: 'Updated Backend Test Event',
    },
  },
  {
    label: 'Delete Calendar Event',
    description: 'Soft-delete calendar event by ID.',
    method: 'PATCH',
    path: '/api/calendar/events/delete/{calendarId}',
  },
  {
    label: 'Get Attendance Logs',
    description: 'Fetch attendance logs for HR review.',
    method: 'GET',
    path: '/api/logs/attendance?page=0&size=25',
  },
  {
    label: 'Get Activity Logs',
    description: 'Fetch activity logs for HR review.',
    method: 'GET',
    path: '/api/logs/activity?page=0&size=25',
  },
  {
    label: 'Process Payroll Run',
    description: 'Create a regular payroll run and generate payroll items.',
    method: 'POST',
    path: '/api/payroll/run/process',
    body: {
      periodStart: '2026-02-01',
      periodEnd: '2026-02-15',
      periodDescription: 'Regular payroll run Feb 1-15',
      payrollStatus: 'IN_PROGRESS',
      runType: 'REGULAR',
    },
  },
  {
    label: 'Create Adjustment Run',
    description: 'Create an adjustment payroll run for corrections.',
    method: 'POST',
    path: '/api/payroll/run/create',
    body: {
      periodStart: '2026-02-01',
      periodEnd: '2026-02-15',
      periodDescription: 'Adjustment payroll run Feb 1-15',
      payrollStatus: 'IN_PROGRESS',
      runType: 'ADJUSTMENT',
    },
  },
  {
    label: 'Create Payroll Item',
    description: 'Create payroll item for one employee.',
    method: 'POST',
    path: '/api/payroll/item/create',
    body: {
      payId: '{payId}',
      empId: '{empId}',
    },
  },
  {
    label: 'Update Payroll Item',
    description: 'Update payroll item values by item ID.',
    method: 'PATCH',
    path: '/api/payroll/item/update/{itemId}',
    body: {
      grossPay: 20000,
      netPay: 18000,
    },
  },
  {
    label: 'Get Run Items',
    description: 'Fetch payroll items under a run.',
    method: 'GET',
    path: '/api/payroll/run/{payId}/items?page=0&size=20',
  },
  {
    label: 'Get Dispute Requests',
    description: 'Fetch payroll dispute requests for HR.',
    method: 'GET',
    path: '/api/payroll/item/dispute/all?page=0&size=20',
  },
  {
    label: 'Update Dispute Request',
    description: 'Resolve a payroll dispute request.',
    method: 'PATCH',
    path: '/api/payroll/item/dispute/update/{disputeId}',
    body: {
      status: 'APPROVED',
      statusReason: 'Resolved during backend test',
    },
  },
  {
    label: 'Get Notifications',
    description: 'Fetch HR user notifications.',
    method: 'GET',
    path: '/api/notifications',
  },
];

export default function HrLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [headerTitle, setHeaderTitle] = useState('HR');
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!notifOpen) return;

      const target = e.target as Node;
      if (panelRef.current?.contains(target) || bellRef.current?.contains(target)) return;

      setNotifOpen(false);
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotifOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [notifOpen]);

  useEffect(() => {
    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) {
          setHeaderTitle('HR');
          return;
        }

        const detailsResponse = await apiFetchRaw(`/api/user/details/${encodeURIComponent(username)}`, {
          method: 'GET',
        });
        if (!detailsResponse.ok) {
          setHeaderTitle('HR');
        } else {
          const payload = (await detailsResponse.json()) as Record<string, unknown>;
          const employee =
            payload.employee && typeof payload.employee === 'object'
              ? (payload.employee as Record<string, unknown>)
              : null;
          const empId =
            extractFirstId(payload, ['employeeId', 'id']) ??
            extractFirstId(employee, ['employeeId', 'id']);
          setHeaderTitle(empId ? `HR#${empId}` : 'HR');
        }

        const notifResponse = await apiFetchRaw('/api/notifications?page=0&size=20', { method: 'GET' });
        if (!notifResponse.ok) {
          setNotifications([]);
          return;
        }

        const notifPayload = (await notifResponse.json()) as { content?: Array<Record<string, unknown>> };
        const mapped = Array.isArray(notifPayload?.content)
          ? notifPayload.content.map((row) => mapNotificationItem('hr', row))
          : [];
        setNotifications(mapped);
      } catch {
        setHeaderTitle('HR');
        setNotifications([]);
      }
    })();
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

  async function handleLogout() {
    await expireCurrentSession();
    navigate('/', { replace: true });
  }

  function handleBrandClick() {
    navigate('/hr/dashboard', { replace: true });
  }

  async function markNotificationRead(id: string) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    try {
      await apiFetchRaw(`/api/notifications?notificationId=${numericId}`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // no-op
    }
  }

  async function handleNotificationClick(notification: NotificationItem) {
    await markNotificationRead(notification.id);
    setNotifOpen(false);
    navigate(notification.destination);
  }

  async function fetchJsonWithAuth(path: string) {
    const response = await apiFetchRaw(path, { method: 'GET' });
    if (!response.ok) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function buildContext(username: string | null): Promise<PlaceholderContext> {
    const context: PlaceholderContext = { username: username ?? undefined };
    const users = await fetchJsonWithAuth('/api/employees?page=0&size=20');
    const firstEmployee = firstFromCollection(users);
    const empId = extractFirstId(firstEmployee, ['employeeId', 'id', 'empId']);
    if (empId) context.empId = empId;

    const overtimes = await fetchJsonWithAuth('/api/overtime/all?page=0&size=20');
    const firstOvertime = firstFromCollection(overtimes);
    const overtimeId = extractFirstId(firstOvertime, ['overtimeId', 'id']);
    if (overtimeId) context.overtimeId = overtimeId;

    const events = await fetchJsonWithAuth('/api/calendar/events?month=4&year=2026');
    const firstEvent = firstFromCollection(events);
    const calendarId = extractFirstId(firstEvent, ['calendarId', 'id']);
    if (calendarId) context.calendarId = calendarId;

    const disputes = await fetchJsonWithAuth('/api/payroll/item/dispute/all?page=0&size=20');
    const firstDispute = firstFromCollection(disputes);
    const disputeId = extractFirstId(firstDispute, ['disputeId', 'id', 'requestId']);
    if (disputeId) context.disputeId = disputeId;

    if (username) {
      const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
      const selfEmpId =
        extractFirstId(userDetails, ['employeeId', 'id']) ??
        extractFirstId(
          userDetails && typeof userDetails === 'object'
            ? (userDetails as Record<string, unknown>).employee
            : null,
          ['employeeId', 'id']
        );
      if (selfEmpId) {
        const selfItems = await fetchJsonWithAuth(`/api/payroll/item/${selfEmpId}`);
        const firstItem = firstFromCollection(selfItems);
        const itemId = extractFirstId(firstItem, ['id', 'itemId', 'payrollItemId']);
        const payId = extractFirstId(firstItem, ['payId', 'payrollRunId']);
        if (itemId) context.itemId = itemId;
        if (payId) context.payId = payId;
      }
    }

    return context;
  }

  async function handleBackendTest(action: BackendTestAction) {
    const context = await buildContext(getUserEmail());
    let pathResolved = applyPathPlaceholders(action.path, context);
    let bodyResolved = applyBodyPlaceholders(action.body, context);
    const missing = new Set([...pathResolved.missing, ...bodyResolved.missing]);

    for (const key of missing) {
      const entered = window.prompt(`Enter value for ${key}:`);
      if (!entered || entered.trim().length === 0) {
        setBackendResult(`Cancelled: missing required value "${key}".`);
        return;
      }
      context[key] = entered.trim();
    }

    pathResolved = applyPathPlaceholders(action.path, context);
    bodyResolved = applyBodyPlaceholders(action.body, context);
    const resolvedPath = pathResolved.value;
    const requestLabel = `${action.method} ${resolvedPath}`;
    setBackendAction(requestLabel);
    setIsLoading(true);
    setBackendResult(`Sending ${requestLabel} ...`);

    try {
      const headers: Record<string, string> = {};
      if (bodyResolved.value !== undefined) headers['Content-Type'] = 'application/json';

      const response = await apiFetchRaw(resolvedPath, {
        method: action.method,
        headers,
        body: bodyResolved.value !== undefined ? JSON.stringify(bodyResolved.value) : undefined,
      });

      const raw = await response.text();
      let formatted = raw;
      try {
        formatted = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        if (raw.trim().length === 0) formatted = '(no response body)';
      }

      setBackendResult(
        [
          `URL: ${API_BASE_URL}${resolvedPath}`,
          `Status: ${response.status} ${response.statusText}`,
          '',
          formatted,
        ].join('\n')
      );
    } catch (error) {
      setBackendResult(
        [
          `URL: ${API_BASE_URL}${resolvedPath}`,
          'Request failed before reaching backend.',
          String(error),
        ].join('\n')
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="employeeLayout">
      <aside className="eSide">
        <button
          type="button"
          className="eSide__brand eSide__brand--link"
          onClick={handleBrandClick}
          aria-label="Go to dashboard"
        >
          <div className="eSide__logo" aria-hidden="true" />
          <div className="eSide__name">MaridOne</div>
        </button>

        <nav className="eSide__nav">
          <NavLink
            to="/hr/dashboard"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiGrid className="eSide__icon" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/hr/attendance-reports"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCalendar className="eSide__icon" />
            <span>Attendance Reports</span>
          </NavLink>
          <NavLink
            to="/hr/approvals"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiClock className="eSide__icon" />
            <span>Approvals</span>
          </NavLink>
          <NavLink
            to="/hr/payslips"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiFileText className="eSide__icon" />
            <span>Manage Payslips</span>
          </NavLink>
          <NavLink
            to="/hr/pay-run-reporting"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCreditCard className="eSide__icon" />
            <span>Pay Run Reporting</span>
          </NavLink>
          <NavLink
            to="/hr/manage-emp"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiUsers className="eSide__icon" />
            <span>Manage Employees</span>
          </NavLink>
        </nav>

        <button className="eSide__logout" type="button" onClick={handleLogout}>
          <FiLogOut className="eSide__icon" />
          <span>Logout</span>
        </button>
      </aside>

      <div className="eMain">
        <header className="eTop">
          <div className="eTop__left">
            <div className="eTop__title">{headerTitle}</div>
            <span className="eTop__badge">Human Resources</span>
          </div>

          <div className="notif">
            <button
              ref={bellRef}
              className="eTop__bell"
              type="button"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <FiBell />
              {unreadCount > 0 && <span className="notif__badge">{unreadCount}</span>}
            </button>

            {notifOpen && <div className="notif__backdrop" />}

            {notifOpen && (
              <div ref={panelRef} className="notifPanel" role="dialog" aria-label="Notifications">
                <div className="notifPanel__header">
                  <div className="notifPanel__title">Notifications ({unreadCount})</div>
                  <div className="notifPanel__date">Today, {todayLabel}</div>
                </div>

                <div className="notifPanel__list">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className="notifItem"
                        onClick={() => void handleNotificationClick(n)}
                      >
                        <div className="notifItem__icon">
                          <FiCheckCircle />
                        </div>
                        <div className="notifItem__body">
                          <div className="notifItem__title">{n.title}</div>
                          {n.description && <div className="notifItem__msg">{n.description}</div>}
                        </div>
                        <div className="notifItem__time">{n.time}</div>
                      </button>
                    ))
                  ) : (
                    <div className="notifItem">
                      <div className="notifItem__icon">
                        <FiCheckCircle />
                      </div>
                      <div className="notifItem__body">
                        <div className="notifItem__title">No new notifications.</div>
                      </div>
                      <div className="notifItem__time">Now</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="eContent">
          {BACKEND_TEST_MODE ? (
            <section className="backendTest" aria-label="HR backend testing controls">
              <div className="backendTest__head">
                <h2>Backend Endpoint Testing</h2>
                <span>Last action: {backendAction}</span>
              </div>

              <div className="backendTest__actions">
                {backendActions.map((action) => (
                  <article key={`${action.method}-${action.path}`} className="backendTest__card">
                    <button type="button" onClick={() => handleBackendTest(action)} disabled={isLoading}>
                      {action.label}
                    </button>
                    <p>{action.description}</p>
                    <code>{action.method} {action.path}</code>
                  </article>
                ))}
              </div>
              {backendResult && <pre className="backendTest__result">{backendResult}</pre>}
            </section>
          ) : (
            <Outlet />
          )}
        </main>

        <footer className="eFooter">
        <div className="eFooter__inner">
          <div className="eFooter__brand">
            <div className="eFooter__brandRow">
              <div className="eFooter__logo" aria-hidden="true" />
              <div>
                <div className="eFooter__brandTitle">Marid Industries</div>
                <div className="eFooter__brandTitle">Corporation</div>
              </div>
            </div>

            <div className="eFooter__slogan">Smart packaging solutions for modern food service.</div>
            <div className="eFooter__copy">© 2026 Marid Industries Corporation</div>
          </div>

          <div className="eFooter__col">
            <h4>Mission:</h4>
            <p>To ignite a culinary revolution with our self-heating food packaging solutions.</p>
          </div>

          <div className="eFooter__col">
            <h4>Vision:</h4>
            <p>
              To be the trailblazer of the self-heating food packaging industry, setting a new
              standard for quality and innovation across the globe.
            </p>

            <div className="eFooter__contact">
              <span className="eFooter__contactLabel">Contact Us:</span>
              <span className="eFooter__contactValue"> marid@marid.com</span>
            </div>
          </div>
        </div>
        </footer>
      </div>
    </div>
  );
}
