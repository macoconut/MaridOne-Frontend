import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiClipboard,
  FiFileText,
  FiGrid,
  FiMenu,
} from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppFooter from '../../components/layout/AppFooter';
import BackendTestPanel from '../../components/layout/BackendTestPanel';
import NotificationCenter from '../../components/layout/NotificationCenter';
import HeaderRefreshButton from '../../components/navigation/HeaderRefreshButton';
import RoleSidebar from '../../components/navigation/RoleSidebar';
import SettingsModal from '../../components/settings/SettingsModal';
import useResponsiveSidebar from '../../hooks/useResponsiveSidebar';
import type { NavSection } from '../../components/navigation/SidebarNavSection';
import '../shared/RoleLayout.css';
import { getUserEmail } from '../../lib/session';
import { BACKEND_TEST_MODE } from '../../config/flags';
import { apiFetchRaw, expireCurrentSession } from '../../lib/api';
import {
  extractFirstId,
  type PlaceholderContext,
} from '../../lib/backendTest';
import { PageRefreshProvider } from '../../lib/pageRefresh';
import { useBackendTestRunner, type BackendTestAction } from '../shared/useBackendTestRunner';
import { useHeaderBadge } from '../shared/useHeaderBadge';
import { useNotificationCenter } from '../shared/useNotificationCenter';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen]))
  );
  const { drawerOpen, isMobileLayout, setDrawerOpen, sidebarCollapsed, toggleSidebar } = useResponsiveSidebar();
  const { headerBadge, headerDepartment } = useHeaderBadge('Manager');
  const handleNotificationNavigation = useCallback(
    (destination: string) => {
      navigate(destination);
    },
    [navigate]
  );
  const notificationCenter = useNotificationCenter('manager', handleNotificationNavigation);
  const activeSectionId = useMemo(
    () =>
      navSections.find((section) =>
        section.items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      )?.id ?? null,
    [location.pathname]
  );
  const resolvedOpenSections = useMemo(
    () =>
      activeSectionId && !openSections[activeSectionId]
        ? { ...openSections, [activeSectionId]: true }
        : openSections,
    [activeSectionId, openSections]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDrawerOpen(false);
      setSettingsOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, setDrawerOpen]);

  async function handleLogout() {
    await expireCurrentSession();
    navigate('/', { replace: true });
  }

  function handleBrandClick() {
    navigate('/manager/self-service/dashboard', { replace: true });
  }

  function handleOpenSettings() {
    setDrawerOpen(false);
    setSettingsOpen(true);
  }

  function toggleSection(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  const fetchJsonWithAuth = useCallback(async (path: string) => {
    const response = await apiFetchRaw(path, { method: 'GET' });
    if (!response.ok) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const buildContext = useCallback(async (): Promise<PlaceholderContext> => {
    const username = getUserEmail();
    const context: PlaceholderContext = { username: username ?? undefined };
    if (!username) return context;
    const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
    const empId = extractFirstId(userDetails, ['employeeId', 'id']);
    if (empId) context.empId = empId;
    return context;
  }, [fetchJsonWithAuth]);
  const { backendAction, backendResult, handleBackendTest, isLoading } = useBackendTestRunner(
    buildContext,
    { initialResult: 'Waiting for backend test.' }
  );

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
        onToggleSection={toggleSection}
        onToggleSidebar={toggleSidebar}
        openSections={resolvedOpenSections}
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
            <div className="eTop__badgeWrap">
              <span className="eTop__badge">{headerBadge}</span>
              {headerDepartment ? <span className="eTop__badgeMeta">{headerDepartment}</span> : null}
            </div>
          </div>

          <div className="eTop__actions">
            <HeaderRefreshButton />
            <NotificationCenter
              bellRef={notificationCenter.bellRef}
              panelRef={notificationCenter.panelRef}
              notifOpen={notificationCenter.notifOpen}
              unreadCount={notificationCenter.unreadCount}
              notifications={notificationCenter.notifications}
              todayLabel={notificationCenter.todayLabel}
              notificationPresence={notificationCenter.notificationPresence}
              onBellClick={notificationCenter.handleNotificationBellClick}
              onNotificationClick={notificationCenter.handleNotificationClick}
              onPanelWheel={notificationCenter.handleNotificationPanelWheel}
            />
          </div>
        </header>

        <main className="eContent">
          {BACKEND_TEST_MODE ? (
            <BackendTestPanel
              actions={backendActions}
              ariaLabel="Manager backend testing controls"
              isLoading={isLoading}
              lastAction={backendAction}
              onRun={handleBackendTest}
              result={backendResult}
              title="Backend Endpoint Testing"
              variant="details"
              summaryLabel="Manager Backend Test Panel (click to expand)"
            />
          ) : null}
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
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </PageRefreshProvider>
  );
}

