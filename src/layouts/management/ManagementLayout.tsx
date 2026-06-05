import { Outlet, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiClipboard,
  FiDollarSign,
  FiFileText,
  FiGrid,
} from 'react-icons/fi';
import { useCallback } from 'react';
import BackendTestPanel from '@/components/layout/BackendTestPanel';
import type { NavSection } from '@/components/navigation/SidebarNavSection';
import { BACKEND_TEST_MODE } from '@/config/flags';
import {
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '@/lib/test/backendTest';
import { useRoleLayout } from '@/hooks/useRoleLayout';
import { RoleShell } from '../shared/RoleShell';
import { useNotificationCenter } from '../shared/useNotificationCenter';
import type { BackendTestAction } from '../shared/useBackendTestRunner';

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

const navSections: NavSection[] = [
  {
    id: 'employee',
    label: 'Self-Service',
    defaultOpen: true,
    items: [
      { to: '/management/self-service/dashboard', label: 'User Dashboard', icon: FiGrid },
      { to: '/management/self-service/attendance', label: 'Attendance', icon: FiCalendar },
      { to: '/management/self-service/approvals', label: 'Leave Request Filing', icon: FiCheckSquare },
      { to: '/management/self-service/payslip', label: 'View Payslip', icon: FiFileText },
      { to: '/management/self-service/training', label: 'Documents', icon: FiBookOpen },
    ],
  },
  {
    id: 'management',
    label: 'Executive Dashboard',
    defaultOpen: true,
    items: [
      { to: '/management/attendance', label: 'Attendance Dashboard', icon: FiBarChart2 },
      { to: '/management/payroll-dashboard', label: 'Payroll Dashboard', icon: FiDollarSign },
      { to: '/management/pay-run-reporting', label: 'Pay Run Reporting', icon: FiClipboard },
      { to: '/management/pending-approvals', label: 'Manage Requests', icon: FiCheckSquare },
    ],
  },
];

export default function ManagementLayout() {
  const navigate = useNavigate();
  const handleNotificationNavigation = useCallback(
    (destination: string) => {
      navigate(destination);
    },
    [navigate]
  );
  const notificationCenter = useNotificationCenter('management', handleNotificationNavigation);
  const controller = useRoleLayout({
    roleLabel: 'Management',
    homePath: '/management/self-service/dashboard',
    navSections,
    backendPanel: {
      actions: backendActions,
      ariaLabel: 'Management backend testing controls',
      title: 'Backend Endpoint Testing',
      variant: 'details',
      summaryLabel: 'Management Backend Test Panel (click to expand)',
      initialResult: 'Waiting for backend test.',
      autoRunFirstAction: true,
      buildContext: async ({ fetchJsonWithAuth, username }) => {
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

