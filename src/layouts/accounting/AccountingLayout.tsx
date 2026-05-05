import { Outlet } from 'react-router-dom';
import { FiBarChart2, FiClipboard } from 'react-icons/fi';
import BackendTestPanel from '../../components/layout/BackendTestPanel';
import type { NavSection } from '../../components/navigation/SidebarNavSection';
import { BACKEND_TEST_MODE } from '../../config/flags';
import {
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../lib/test/backendTest';
import { useRoleLayout } from '../../hooks/useRoleLayout';
import { RoleShell } from '../shared/RoleShell';
import type { BackendTestAction } from '../shared/useBackendTestRunner';

const backendActions: BackendTestAction[] = [
  {
    label: 'Get Notifications',
    method: 'GET',
    path: '/api/notifications',
  },
  {
    label: 'Get Runs',
    method: 'GET',
    path: '/api/payroll/run',
  },
  {
    label: 'Get Run Details',
    method: 'GET',
    path: '/api/payroll/run/{payId}',
  },
  {
    label: 'Get Run Items',
    method: 'GET',
    path: '/api/payroll/run/{payId}/items?page=0&size=20',
  },
  {
    label: 'Get Run Summary',
    method: 'GET',
    path: '/api/payroll/run/summary/{payId}',
  },
];

const navSections: NavSection[] = [
  {
    id: 'payroll',
    label: 'Payroll Audit',
    defaultOpen: true,
    items: [
      { to: '/accounting/payroll-dashboard', label: 'Payroll Dashboard', icon: FiBarChart2 },
      { to: '/accounting/payroll-review', label: 'Payslip Review', icon: FiClipboard },
    ],
  },
];

export default function AccountingLayout() {
  const controller = useRoleLayout({
    roleLabel: 'Accounting',
    homePath: '/accounting/payroll-dashboard',
    navSections,
    backendPanel: {
      actions: backendActions,
      ariaLabel: 'Accounting backend testing controls',
      title: 'Backend Endpoint Testing',
      variant: 'details',
      summaryLabel: 'Accounting Backend Test Panel (click to expand)',
      initialResult: 'Waiting for backend test.',
      autoRunFirstAction: true,
      buildContext: async ({ fetchJsonWithAuth, username }) => {
        const context: PlaceholderContext = { username: username ?? undefined };
        const runs = await fetchJsonWithAuth('/api/payroll/run');
        const firstRun = firstFromCollection(runs);
        const payId = extractFirstId(firstRun, ['payId', 'id']);
        if (payId) {
          context.payId = payId;
        }

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

