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
import { clearSession, getAuthToken, getUserEmail } from '../../../lib/session';
import { BACKEND_TEST_MODE } from '../../../config/flags';
import {
  applyBodyPlaceholders,
  applyPathPlaceholders,
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../../lib/backendTest';

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
};

type BackendTestAction = {
  label: string;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const notifications: NotificationItem[] = [];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

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
      requestedAt: '2026-02-28T08:00:00',
      requestedHours: 2.5,
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
      leaveType: 'SICK',
      startDate: '2026-03-03',
      endDate: '2026-03-03',
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
      accountName: 'Test Employee',
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
      accountId: '{accountId}',
      accountName: 'Test Employee Updated',
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
      employeeId: '{empId}',
      activity: 'LOGIN',
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
      reason: 'Testing dispute endpoint communication',
    },
  },
];

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
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

  const unreadCount = notifications.length;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

  function handleLogout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  async function fetchJsonWithAuth(path: string, token: string | null) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    if (!response.ok) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function buildContext(token: string | null, username: string | null): Promise<PlaceholderContext> {
    const context: PlaceholderContext = { username: username ?? undefined };
    if (!username) return context;

    const userDetails = await fetchJsonWithAuth(
      `/api/user/details/${encodeURIComponent(username)}`,
      token
    );
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
      const payrollItems = await fetchJsonWithAuth(`/api/payroll/item/${context.empId}`, token);
      const firstItem = firstFromCollection(payrollItems);
      const itemId = extractFirstId(firstItem, ['id', 'itemId', 'payrollItemId']);
      if (itemId) context.itemId = itemId;

      const bankAccounts = await fetchJsonWithAuth(`/api/bank/${context.empId}`, token);
      const firstAccount = firstFromCollection(bankAccounts);
      const accountId = extractFirstId(firstAccount, ['accountId', 'id', 'bankId']);
      if (accountId) context.accountId = accountId;
    }

    return context;
  }

  async function handleBackendTest(action: BackendTestAction) {
    const username = getUserEmail();
    const token = getAuthToken();
    const context = await buildContext(token, username);

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
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}${resolvedPath}`, {
        method: action.method,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
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
          onClick={() => navigate('/login', { replace: true })}
          aria-label="Go to login"
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
            <div className="eTop__title">Employee</div>
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
                      <div key={n.id} className="notifItem">
                        <div className="notifItem__icon">
                          <FiCheckCircle />
                        </div>

                        <div className="notifItem__body">
                          <div className="notifItem__title">{n.title}</div>
                          {n.description && <div className="notifItem__msg">{n.description}</div>}
                        </div>

                        <div className="notifItem__time">{n.time}</div>
                      </div>
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
      </div>

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
  );
}
