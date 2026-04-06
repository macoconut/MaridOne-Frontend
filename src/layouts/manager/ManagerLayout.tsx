import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBell,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiCheckSquare,
  FiClipboard,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiMenu,
} from 'react-icons/fi';
import { useCallback, useEffect, useRef, useState } from 'react';
import AppFooter from '../../components/layout/AppFooter';
import HeaderRefreshButton from '../../components/navigation/HeaderRefreshButton';
import SidebarBrand from '../../components/navigation/SidebarBrand';
import useAnimatedPresence from '../../hooks/useAnimatedPresence';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';
import { useNotificationPolling } from '../../hooks/useNotificationPolling';
import SidebarNavSection, { type NavSection } from '../../components/navigation/SidebarNavSection';
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
  type PlaceholderContext,
} from '../../lib/backendTest';
import { PageRefreshProvider } from '../../lib/pageRefresh';

const API_BASE_URL = getApiBaseUrl();

type BackendTestAction = {
  label: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const backendActions: BackendTestAction[] = [
  { label: 'Get Notifications', method: 'GET', path: '/api/notifications' },
  { label: 'Get Calendar Events', method: 'GET', path: '/api/calendar/events?month=4&year=2026' },
  { label: 'Get Team Attendance', method: 'GET', path: '/api/logs/attendance/team?page=0&size=25' },
  { label: 'Get My Attendance', method: 'GET', path: '/api/logs/attendance/self/{empId}?page=0&size=25' },
];

const navSections: NavSection[] = [
  {
    id: 'employee',
    label: 'Self-Service',
    defaultOpen: true,
    items: [
      { to: '/manager/self-service/dashboard', label: 'User Dashboard', icon: FiGrid },
      { to: '/manager/self-service/attendance', label: 'Attendance', icon: FiCalendar },
      { to: '/manager/self-service/approvals', label: 'View Approvals', icon: FiCheckSquare },
      { to: '/manager/self-service/payslip', label: 'View Payslip', icon: FiFileText },
      { to: '/manager/self-service/training', label: 'Training Materials', icon: FiBookOpen },
    ],
  },
  {
    id: 'hr',
    label: 'Team Management',
    defaultOpen: true,
    items: [
      { to: '/manager/attendance-dashboard', label: 'Attendance Dashboard', icon: FiBarChart2 },
      { to: '/manager/attendance-reports', label: 'Attendance Reports', icon: FiClipboard },
      { to: '/manager/monthly-team-schedule', label: 'Manage Schedule', icon: FiCalendar },
      { to: '/manager/pending-approvals', label: 'Pending Approvals', icon: FiCheckSquare },
    ],
  },
];

export default function ManagerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const notificationPresence = useAnimatedPresence(notifOpen, 180);
  const { notifications, setNotifications } = useNotificationPolling('manager');
  const [headerBadge, setHeaderBadge] = useState('Manager');
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('Waiting for backend test.');
  const [isLoading, setIsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen]))
  );
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const unreadOnOpenRef = useRef<string[]>([]);

  const markNotificationsRead = useCallback(async (ids: string[]) => {
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
  }, [setNotifications]);

  const closeNotificationBell = useCallback(() => {
    if (!notifOpen) return;

    const unreadIds = unreadOnOpenRef.current;
    unreadOnOpenRef.current = [];
    setNotifOpen(false);
    void markNotificationsRead(unreadIds);
  }, [markNotificationsRead, notifOpen]);

  useEscapeDismiss(notifOpen, closeNotificationBell);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

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
  }, [closeNotificationBell, notifOpen]);

  useEffect(() => {
    void (async () => {
      try {
        setHeaderBadge(await resolveHeaderBadge(getUserEmail(), 'Manager'));
      } catch {
        setHeaderBadge('Manager');
      }
    })();
  }, []);

  useEffect(() => {
    const activeSection = navSections.find((section) =>
      section.items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    );

    if (!activeSection) return;

    setOpenSections((prev) => (prev[activeSection.id] ? prev : { ...prev, [activeSection.id]: true }));
  }, [location.pathname]);

  async function handleLogout() {
    await expireCurrentSession();
    navigate('/', { replace: true });
  }

  function handleBrandClick() {
    navigate('/manager/self-service/dashboard', { replace: true });
  }

  function toggleSection(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
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
    const empId = extractFirstId(userDetails, ['employeeId', 'id']);
    if (empId) context.empId = empId;
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
    <PageRefreshProvider>
      <div className="employeeLayout">
      <aside className={`eSide${drawerOpen ? ' is-open' : ''}`}>
        <SidebarBrand label="Go to dashboard" onClick={handleBrandClick} />

        <div className="eSide__navWrap">
          {navSections.map((section) => (
            <SidebarNavSection
              key={section.id}
              section={section}
              isOpen={openSections[section.id]}
              onToggle={toggleSection}
            />
          ))}
        </div>

        <div className="eSide__footer">
          <button className="eSide__logout" type="button" onClick={handleLogout}>
            <FiLogOut className="eSide__icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="eMain">
        <header className="eTop">
          <div className="eTop__left">
            <button
              className="eTop__ham"
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setDrawerOpen(true)}
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
                Manager Backend Test Panel (click to expand)
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

        <AppFooter />
      </div>
      </div>
      <button
        type="button"
        className={`drawerOverlay${drawerOpen ? ' is-open' : ''}`}
        aria-label="Close navigation menu"
        onClick={() => setDrawerOpen(false)}
      />
    </PageRefreshProvider>
  );
}

