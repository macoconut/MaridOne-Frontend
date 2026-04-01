import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  FiGrid,
  FiCalendar,
  FiClock,
  FiFileText,
  FiBookOpen,
  FiLogOut,
  FiBell,
  FiCheckCircle,
} from 'react-icons/fi';

import './EmployeeLayout.css';
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
    label: 'Get User Account',
    description: 'Fetch own user account details by username.',
    method: 'GET',
    path: '/api/user/details/{username}',
  },
  {
    label: 'Get Employee Details',
    description: 'Fetch employee profile details for self.',
    method: 'GET',
    path: '/api/employees/{empId}',
  },
  {
    label: 'Get Notifications',
    description: 'Fetch logged-in user notifications.',
    method: 'GET',
    path: '/api/notifications',
  },
  {
    label: 'Get Calendar Events',
    description: 'Fetch company events for a month/year.',
    method: 'GET',
    path: '/api/calendar/events?month=4&year=2026',
  },
  {
    label: 'Create Overtime Request',
    description: 'Submit overtime request as employee.',
    method: 'POST',
    path: '/api/overtime/create',
    body: {
      workDate: '2026-03-10',
      startTime: '2026-03-10T18:00:00',
      endTime: '2026-03-10T20:00:00',
      overtimeType: 'OVERTIME',
      reason: 'Backend endpoint testing',
    },
  },
  {
    label: 'Get My Overtime',
    description: 'Fetch overtime requests for employee.',
    method: 'GET',
    path: '/api/overtime/all/{empId}?page=0&size=10',
  },
  {
    label: 'Get Leave Balance',
    description: 'Fetch leave balances for employee.',
    method: 'GET',
    path: '/api/leave/balance/{empId}',
  },
  {
    label: 'Create Leave Request',
    description: 'Submit leave request as employee.',
    method: 'POST',
    path: '/api/leave/create?empId={empId}',
    body: {
      leaveDate: '2026-03-03',
      approver: 'HR',
      reason: 'Backend test request',
    },
  },
  {
    label: 'Get Shift Schedule',
    description: 'Fetch employee shift schedule.',
    method: 'GET',
    path: '/api/employee/schedule/{empId}',
  },
  {
    label: 'Add Bank Account',
    description: 'Create bank account details for employee.',
    method: 'POST',
    path: '/api/bank/add/{empId}',
    body: {
      accountNumber: '1234567890',
      bankName: 'Sample Bank',
    },
  },
  {
    label: 'Update Bank Account',
    description: 'Update existing bank account details.',
    method: 'PATCH',
    path: '/api/bank/update/{empId}',
    body: {
      bankId: '{accountId}',
      accountNumber: '1234567899',
      bankName: 'Sample Bank Updated',
    },
  },
  {
    label: 'Get Bank Accounts',
    description: 'Fetch employee bank account list.',
    method: 'GET',
    path: '/api/bank/{empId}',
  },
  {
    label: 'Create Activity Log',
    description: 'Create activity log event for employee.',
    method: 'POST',
    path: '/api/logs/activity',
    body: {
      username: '{username}',
      activityType: 'CREATE',
      message: 'Employee backend endpoint test',
    },
  },
  {
    label: 'Create Attendance Log',
    description: 'Create attendance time log entry.',
    method: 'POST',
    path: '/api/logs/attendance/{empId}',
  },
  {
    label: 'Get Payroll Items',
    description: 'Fetch payroll items assigned to employee.',
    method: 'GET',
    path: '/api/payroll/item/{empId}',
  },
  {
    label: 'Get Earnings',
    description: 'Fetch earnings line items for payroll item.',
    method: 'GET',
    path: '/api/payroll/item/earnings/{itemId}',
  },
  {
    label: 'Get Deductions',
    description: 'Fetch deduction line items for payroll item.',
    method: 'GET',
    path: '/api/payroll/item/deductions/{itemId}',
  },
  {
    label: 'Get My Disputes',
    description: 'Fetch dispute requests for employee.',
    method: 'GET',
    path: '/api/payroll/item/dispute/self?empId={empId}',
  },
  {
    label: 'Create Payroll Dispute',
    description: 'Create dispute request for payroll item.',
    method: 'POST',
    path: '/api/payroll/item/dispute/create/{itemId}',
    body: {
      subject: 'Payroll review',
      reason: 'Testing dispute endpoint communication',
    },
  },
];

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [headerTitle, setHeaderTitle] = useState('Employee');
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
      const username = getUserEmail();
      if (!username) {
        setHeaderTitle('Employee');
        return;
      }

      try {
        const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
        const directEmpId = extractFirstId(userDetails, ['employeeId', 'id', 'empId']);
        const nestedEmpId = extractFirstId(
          userDetails && typeof userDetails === 'object'
            ? (userDetails as Record<string, unknown>).employee
            : null,
          ['employeeId', 'id', 'empId']
        );
        const empId = directEmpId ?? nestedEmpId;
        setHeaderTitle(empId ? `Employee#${empId}` : 'Employee');
      } catch {
        setHeaderTitle('Employee');
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiFetchRaw('/api/notifications?page=0&size=20', { method: 'GET' });
        if (!response.ok) {
          setNotifications([]);
          return;
        }

        const payload = (await response.json()) as { content?: Array<Record<string, unknown>> };
        const mapped = Array.isArray(payload?.content)
          ? payload.content.map((row) => mapNotificationItem('employee', row))
          : [];

        setNotifications(mapped);
      } catch {
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
    navigate('/employee/dashboard', { replace: true });
  }

  async function markNotificationRead(id: string) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;

    try {
      await apiFetchRaw(`/api/notifications?notificationId=${numericId}`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch {
      // Keep UI state unchanged if backend mark-read fails.
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
    if (!username) return context;

    const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
    const empId =
      extractFirstId(userDetails, ['employeeId', 'id']) ??
      extractFirstId(
        userDetails && typeof userDetails === 'object'
          ? (userDetails as Record<string, unknown>).employee
          : null,
        ['employeeId', 'id']
      );
    if (empId) context.empId = empId;

    if (context.empId) {
      const payrollItems = await fetchJsonWithAuth(`/api/payroll/item/${context.empId}`);
      const firstItem = firstFromCollection(payrollItems);
      const itemId = extractFirstId(firstItem, ['id', 'itemId', 'payrollItemId']);
      if (itemId) context.itemId = itemId;

      const bankAccounts = await fetchJsonWithAuth(`/api/bank/${context.empId}`);
      const firstAccount = firstFromCollection(bankAccounts);
      const accountId = extractFirstId(firstAccount, ['accountId', 'id', 'bankId']);
      if (accountId) context.accountId = accountId;
    }

    return context;
  }

  async function handleBackendTest(action: BackendTestAction) {
    const username = getUserEmail();
    const context = await buildContext(username);

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
            to="/employee/dashboard"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiGrid className="eSide__icon" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/employee/attendance"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCalendar className="eSide__icon" />
            <span>Attendance</span>
          </NavLink>

          <NavLink
            to="/employee/approvals"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiClock className="eSide__icon" />
            <span>View Approvals</span>
          </NavLink>

          <NavLink
            to="/employee/payslip"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiFileText className="eSide__icon" />
            <span>Payslip</span>
          </NavLink>

          <NavLink
            to="/employee/training"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiBookOpen className="eSide__icon" />
            <span>Training Materials</span>
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
            <span className="eTop__badge">Employee</span>
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
            <section className="backendTest" aria-label="Employee backend testing controls">
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
