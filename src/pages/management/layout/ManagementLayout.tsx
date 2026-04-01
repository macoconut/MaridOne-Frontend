import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { FiBell, FiCalendar, FiCheckCircle, FiDollarSign, FiGrid, FiLogOut } from 'react-icons/fi';
import { useEffect, useRef, useState } from 'react';
import '../../employee/layout/EmployeeLayout.css';
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

const API_BASE_URL = getApiBaseUrl();

type BackendTestAction = {
  label: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const backendActions: BackendTestAction[] = [
  {
    label: 'Get Notifications',
    method: 'GET',
    path: '/api/notifications',
  },
  {
    label: 'Get Calendar Events',
    method: 'GET',
    path: '/api/calendar/events?month=4&year=2026',
  },
  {
    label: 'Get My Employee Details',
    method: 'GET',
    path: '/api/employees/{empId}',
  },
  {
    label: 'Get My Attendance',
    method: 'GET',
    path: '/api/logs/attendance/self/{empId}?page=0&size=25',
  },
  {
    label: 'Get My Payroll Items',
    method: 'GET',
    path: '/api/payroll/item/{empId}',
  },
  {
    label: 'Get Run Summary',
    method: 'GET',
    path: '/api/payroll/run/summary/{payId}',
  },
];

export default function ManagementLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [headerTitle, setHeaderTitle] = useState('Management');
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('Waiting for backend test.');
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!notifOpen) return;

      const target = event.target as Node;
      if (panelRef.current?.contains(target) || bellRef.current?.contains(target)) return;
      setNotifOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setNotifOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [notifOpen]);

  useEffect(() => {
    void loadHeaderAndNotifications();
  }, []);

  useEffect(() => {
    if (!BACKEND_TEST_MODE) return;
    void handleBackendTest(backendActions[0]);
  }, []);

  async function loadHeaderAndNotifications() {
    try {
      const username = getUserEmail();
      if (!username) {
        setHeaderTitle('Management');
      } else {
        const detailsResponse = await apiFetchRaw(`/api/user/details/${encodeURIComponent(username)}`, {
          method: 'GET',
        });

        if (!detailsResponse.ok) {
          setHeaderTitle('Management');
        } else {
          const payload = (await detailsResponse.json()) as Record<string, unknown>;
          const employeeId =
            extractFirstId(payload, ['employeeId', 'id']) ??
            extractFirstId(
              payload.employee && typeof payload.employee === 'object'
                ? (payload.employee as Record<string, unknown>)
                : null,
              ['employeeId', 'id']
            );

          if (!employeeId) {
            setHeaderTitle(username);
          } else {
            const employeeResponse = await apiFetchRaw(`/api/employees/${employeeId}`, {
              method: 'GET',
            });

            if (!employeeResponse.ok) {
              setHeaderTitle(`Management#${employeeId}`);
            } else {
              const employee = (await employeeResponse.json()) as Record<string, unknown>;
              const firstName =
                typeof employee.firstName === 'string' ? employee.firstName.trim() : '';
              const lastName =
                typeof employee.lastName === 'string' ? employee.lastName.trim() : '';
              const fullName = [firstName, lastName].filter(Boolean).join(' ');
              setHeaderTitle(fullName || `Management#${employeeId}`);
            }
          }
        }
      }

      const notifResponse = await apiFetchRaw('/api/notifications?page=0&size=20', { method: 'GET' });
      if (!notifResponse.ok) {
        setNotifications([]);
        return;
      }

      const notifPayload = (await notifResponse.json()) as { content?: Array<Record<string, unknown>> };
      const mapped = Array.isArray(notifPayload?.content)
        ? notifPayload.content.map((row) => mapNotificationItem('management', row))
        : [];
      setNotifications(mapped);
    } catch {
      setHeaderTitle('Management');
      setNotifications([]);
    }
  }

  async function handleLogout() {
    await expireCurrentSession();
    navigate('/', { replace: true });
  }

  function handleBrandClick() {
    navigate('/management/attendance', { replace: true });
  }

  async function markNotificationRead(id: string) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    try {
      await apiFetchRaw(`/api/notifications?notificationId=${numericId}`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
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
    if (empId) {
      context.empId = empId;
      const items = await fetchJsonWithAuth(`/api/payroll/item/${empId}`);
      const firstItem = firstFromCollection(items);
      const payId = extractFirstId(firstItem, ['payId', 'payrollRunId']);
      if (payId) context.payId = payId;
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

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

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
            to="/management/attendance"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCalendar className="eSide__icon" />
            <span>Attendance Dashboard</span>
          </NavLink>

          <NavLink
            to="/management/payroll-dashboard"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiGrid className="eSide__icon" />
            <span>Payroll Dashboard</span>
          </NavLink>

          <NavLink
            to="/management/pay-run-reporting"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiDollarSign className="eSide__icon" />
            <span>Pay Run Reporting</span>
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
            <span className="eTop__badge">Management</span>
          </div>

          <div className="notif">
            <button
              ref={bellRef}
              className="eTop__bell"
              type="button"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((value) => !value)}
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
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="notifItem"
                        onClick={() => void handleNotificationClick(item)}
                      >
                        <div className="notifItem__icon">
                          <FiCheckCircle />
                        </div>
                        <div className="notifItem__body">
                          <div className="notifItem__title">{item.title}</div>
                          {item.description && <div className="notifItem__msg">{item.description}</div>}
                        </div>
                        <div className="notifItem__time">{item.time}</div>
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
          {BACKEND_TEST_MODE && (
            <details
              style={{
                border: '1.5px solid rgba(0,0,0,.18)',
                borderRadius: 12,
                background: '#fff',
                padding: 12,
                marginBottom: 12,
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                Management Backend Test Panel (click to expand)
              </summary>
              <div style={{ marginTop: 10, fontSize: 13, color: '#4a3e5e' }}>
                Last action: <strong>{backendAction}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {backendActions.map((action) => (
                  <button
                    key={`${action.method}-${action.path}`}
                    type="button"
                    onClick={() => void handleBackendTest(action)}
                    disabled={isLoading}
                    style={{
                      border: '1px solid rgba(0,0,0,.2)',
                      borderRadius: 8,
                      background: '#fff',
                      padding: '6px 10px',
                      cursor: isLoading ? 'default' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <pre
                style={{
                  marginTop: 10,
                  border: '1px solid rgba(0,0,0,.14)',
                  borderRadius: 8,
                  background: '#f8f8fb',
                  padding: 10,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 220,
                  overflow: 'auto',
                  fontSize: 11,
                }}
              >
                {backendResult}
              </pre>
            </details>
          )}
          <Outlet />
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
