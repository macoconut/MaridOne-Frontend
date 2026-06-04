import { Outlet, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiClipboard,
  FiFileText,
  FiGrid,
} from 'react-icons/fi';
import { useCallback } from 'react';
import BackendTestPanel from '@/components/layout/BackendTestPanel';
import type { NavSection } from '@/components/navigation/SidebarNavSection';
import { BACKEND_TEST_MODE } from '@/config/flags';
import {
  extractFirstId,
  type PlaceholderContext,
} from '@/lib/test/backendTest';
import { useRoleLayout } from '@/hooks/useRoleLayout';
import { RoleShell } from '../shared/RoleShell';
import { useNotificationCenter } from '../shared/useNotificationCenter';
import type { BackendTestAction } from '../shared/useBackendTestRunner';

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
      { to: '/manager/self-service/approvals', label: 'Leave Request Filing', icon: FiCheckSquare },
      { to: '/manager/self-service/payslip', label: 'View Payslip', icon: FiFileText },
      { to: '/manager/self-service/training', label: 'Documents', icon: FiBookOpen },
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
      { to: '/manager/pending-approvals', label: 'Manage Leave Requests', icon: FiCheckSquare },
    ],
  },
];

export default function ManagerLayout() {
  const navigate = useNavigate();
  const handleNotificationNavigation = useCallback(
    (destination: string) => {
      navigate(destination);
    },
    [navigate]
  );
  const notificationCenter = useNotificationCenter('manager', handleNotificationNavigation);
  const controller = useRoleLayout({
    roleLabel: 'Manager',
    homePath: '/manager/self-service/dashboard',
    navSections,
    backendPanel: {
      actions: backendActions,
      ariaLabel: 'Manager backend testing controls',
      title: 'Backend Endpoint Testing',
      variant: 'details',
      summaryLabel: 'Manager Backend Test Panel (click to expand)',
      initialResult: 'Waiting for backend test.',
      buildContext: async ({ fetchJsonWithAuth, username }) => {
        const context: PlaceholderContext = { username: username ?? undefined };
        if (!username) return context;

        const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
        const empId = extractFirstId(userDetails, ['employeeId', 'id']);
        if (empId) context.empId = empId;
        return context;
      },
    },
  });

  const backendPanel = controller.backendPanelProps ? (
    <BackendTestPanel {...controller.backendPanelProps} />
  ) : null;

  return (
    <RoleShell
      brandLabel={controller.brandLabel}
      drawerOpen={controller.drawerOpen}
      headerBadge={controller.headerBadge}
      headerDepartment={controller.headerDepartment}
      isMobileLayout={controller.isMobileLayout}
      navSections={navSections}
      notificationCenterProps={{
        bellRef: notificationCenter.bellRef,
        panelRef: notificationCenter.panelRef,
        notifOpen: notificationCenter.notifOpen,
        unreadCount: notificationCenter.unreadCount,
        notifications: notificationCenter.notifications,
        todayLabel: notificationCenter.todayLabel,
        notificationPresence: notificationCenter.notificationPresence,
        onBellClick: notificationCenter.handleNotificationBellClick,
        onNotificationClick: notificationCenter.handleNotificationClick,
        onPanelWheel: notificationCenter.handleNotificationPanelWheel,
      }}
      onBrandClick={controller.handleBrandClick}
      onCloseDrawer={() => controller.setDrawerOpen(false)}
      onCloseSettings={() => controller.setSettingsOpen(false)}
      onLogout={controller.handleLogout}
      onOpenSettings={controller.handleOpenSettings}
      onToggleSection={controller.toggleSection}
      onToggleSidebar={controller.toggleSidebar}
      openSections={controller.resolvedOpenSections}
      settingsOpen={controller.settingsOpen}
      sidebarCollapsed={controller.sidebarCollapsed}
    >
      <>
        {BACKEND_TEST_MODE ? backendPanel : null}
        <Outlet />
      </>
    </RoleShell>
  );
}

