import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  FiGrid,
  FiCalendar,
  FiCheckSquare,
  FiFileText,
  FiBookOpen,
  FiBell,
  FiCheckCircle,
  FiMenu,
} from 'react-icons/fi';

import AppFooter from '../../components/layout/AppFooter';
import HeaderRefreshButton from '../../components/navigation/HeaderRefreshButton';
import RoleSidebar from '../../components/navigation/RoleSidebar';
import SettingsModal from '../../components/settings/SettingsModal';
import useAnimatedPresence from '../../hooks/useAnimatedPresence';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';
import { useNotificationPolling } from '../../hooks/useNotificationPolling';
import useResponsiveSidebar from '../../hooks/useResponsiveSidebar';
import '../shared/RoleLayout.css';
import { getUserEmail } from '../../lib/session';
import { BACKEND_TEST_MODE } from '../../config/flags';
import { apiFetchRaw, expireCurrentSession, getApiBaseUrl } from '../../lib/api';
import { resolveHeaderBadge } from '../../lib/headerProfile';
import { type NotificationItem } from '../../lib/notificationRouting';
import { routeWheelToScrollableChild } from '../../lib/scrollContain';
import {
  applyBodyPlaceholders,
  applyPathPlaceholders,
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../lib/backendTest';
import { PageRefreshProvider } from '../../lib/pageRefresh';
import type { NavSection } from '../../components/navigation/SidebarNavSection';

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

const navSections: NavSection[] = [
  {
    id: 'employee',
    label: 'Self-Service',
    defaultOpen: true,
    items: [
      { to: '/employee/dashboard', label: 'User Dashboard', icon: FiGrid },
      { to: '/employee/attendance', label: 'Attendance', icon: FiCalendar },
      { to: '/employee/approvals', label: 'View Approvals', icon: FiCheckSquare },
      { to: '/employee/payslip', label: 'View Payslip', icon: FiFileText },
      { to: '/employee/training', label: 'Training Materials', icon: FiBookOpen },
    ],
  },
];

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationPresence = useAnimatedPresence(notifOpen, 180);
  const { notifications, setNotifications } = useNotificationPolling('employee');
  const [headerBadge, setHeaderBadge] = useState('Employee');
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const { drawerOpen, isMobileLayout, setDrawerOpen, sidebarCollapsed, toggleSidebar } = useResponsiveSidebar();

  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const unreadOnOpenRef = useRef<string[]>([]);

  useEscapeDismiss(notifOpen, closeNotificationBell);

  useEffect(() => {
    setDrawerOpen(false);
    setSettingsOpen(false);
  }, [location.pathname, setDrawerOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!notifOpen) return;

      const target = e.target as Node;
      if (panelRef.current?.contains(target) || bellRef.current?.contains(target)) return;

      closeNotificationBell();
    }

      document.addEventListener('mousedown', handleClick);
      return () => {
        document.removeEventListener('mousedown', handleClick);
      };
  }, [notifOpen]);

  useEffect(() => {
    void (async () => {
      try {
        setHeaderBadge(await resolveHeaderBadge(getUserEmail(), 'Employee'));
      } catch {
        setHeaderBadge('Employee');
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

  function handleOpenSettings() {
    setDrawerOpen(false);
    setSettingsOpen(true);
  }

  async function markNotificationsRead(ids: string[]) {
    const numericIds = ids
      .map((id) => ({ id, numericId: Number(id) }))
      .filter((item) => Number.isFinite(item.numericId));

    if (numericIds.length === 0) return;

    const pendingIds = new Set(numericIds.map((item) => item.id));
    setNotifications((prev) =>
      prev.map((item) => (pendingIds.has(item.id) ? { ...item, isRead: true } : item))
    );

    const results = await Promise.allSettled(
      numericIds.map(async ({ numericId }) => {
        const response = await apiFetchRaw(`/api/notifications?notificationId=${numericId}`, {
          method: 'PATCH',
        });
        if (!response.ok) {
          throw new Error(`Unable to mark notification ${numericId} as read.`);
        }
      })
    );

    const failedIds = new Set<string>();
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failedIds.add(numericIds[index].id);
      }
    });

    if (failedIds.size > 0) {
      setNotifications((prev) =>
        prev.map((item) => (failedIds.has(item.id) ? { ...item, isRead: false } : item))
      );
    }
  }

  function closeNotificationBell() {
    if (!notifOpen) return;

    const unreadIds = unreadOnOpenRef.current;
    unreadOnOpenRef.current = [];
    setNotifOpen(false);
    void markNotificationsRead(unreadIds);
  }

  function handleNotificationBellClick() {
    if (notifOpen) {
      closeNotificationBell();
      return;
    }

    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.id);
    unreadOnOpenRef.current = unreadIds;
    setNotifOpen(true);
  }

  function handleNotificationPanelWheel(event: Parameters<typeof routeWheelToScrollableChild>[0]) {
    routeWheelToScrollableChild(event, '.notifPanel__list');
  }

  async function handleNotificationClick(notification: NotificationItem) {
    closeNotificationBell();
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
    <PageRefreshProvider>
      <div className={`employeeLayout${!isMobileLayout && sidebarCollapsed ? ' employeeLayout--sidebarCollapsed' : ''}`}>
      <RoleSidebar
        brandLabel="Go to dashboard"
        collapsed={!isMobileLayout && sidebarCollapsed}
        drawerOpen={drawerOpen}
        isMobileLayout={isMobileLayout}
        navSections={navSections}
        onBrandClick={handleBrandClick}
        onLogout={handleLogout}
        onOpenSettings={handleOpenSettings}
        onToggleSidebar={toggleSidebar}
      />

      <div className="eMain">
        <header className="eTop">
          <div className="eTop__left">
            <button
              className="eTop__ham"
              type="button"
              aria-label={isMobileLayout ? (drawerOpen ? 'Close navigation menu' : 'Open navigation menu') : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              onClick={toggleSidebar}
            >
              <FiMenu />
            </button>
            <span className="eTop__badge">{headerBadge}</span>
          </div>

          <div className="eTop__actions">
            <HeaderRefreshButton />

            <div className="notif">
              <button
                ref={bellRef}
                className="eTop__bell"
                type="button"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={handleNotificationBellClick}
              >
                <FiBell />
                {unreadCount > 0 && <span className="notif__badge">{unreadCount}</span>}
              </button>

              {notificationPresence.isMounted && (
                <div className={`notif__backdrop${notificationPresence.isClosing ? ' is-closing' : ''}`} />
              )}

              {notificationPresence.isMounted && (
                <div
                  ref={panelRef}
                  className={`notifPanel${notificationPresence.isClosing ? ' is-closing' : ''}`}
                  role="dialog"
                  aria-label="Notifications"
                  onWheel={handleNotificationPanelWheel}
                >
                  <div className="notifPanel__header">
                    <div className="notifPanel__title">Notifications ({unreadCount})</div>
                    <div className="notifPanel__date">Today, {todayLabel}</div>
                  </div>

                  <div className="notifPanel__list">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notifItem ${n.isRead ? 'notifItem--read' : 'notifItem--unread'}`}
                        >
                          <div className="notifItem__icon">
                            <FiCheckCircle />
                          </div>

                          <button
                            type="button"
                            className="notifItem__main"
                            onClick={() => void handleNotificationClick(n)}
                          >
                            <div className="notifItem__body">
                              <div className="notifItem__title">{n.title}</div>
                              {n.description && <div className="notifItem__msg">{n.description}</div>}
                            </div>
                            <div className="notifItem__time">{n.time}</div>
                          </button>
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

        <AppFooter />

      </div>
      </div>
      <button
        type="button"
        className={`drawerOverlay${drawerOpen ? ' is-open' : ''}`}
        aria-label="Close navigation menu"
        onClick={() => setDrawerOpen(false)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </PageRefreshProvider>
  );
}
