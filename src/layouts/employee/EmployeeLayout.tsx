import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import {
  FiGrid,
  FiCalendar,
  FiCheckSquare,
  FiFileText,
  FiBookOpen,
  FiMenu,
} from 'react-icons/fi';

import AppFooter from '../../components/layout/AppFooter';
import BackendTestPanel from '../../components/layout/BackendTestPanel';
import NotificationCenter from '../../components/layout/NotificationCenter';
import HeaderRefreshButton from '../../components/navigation/HeaderRefreshButton';
import RoleSidebar from '../../components/navigation/RoleSidebar';
import SettingsModal from '../../components/settings/SettingsModal';
import useResponsiveSidebar from '../../hooks/useResponsiveSidebar';
import '../shared/RoleLayout.css';
import { getUserEmail } from '../../lib/session';
import { BACKEND_TEST_MODE } from '../../config/flags';
import { apiFetchRaw, expireCurrentSession } from '../../lib/api';
import {
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../lib/backendTest';
import { PageRefreshProvider } from '../../lib/pageRefresh';
import type { NavSection } from '../../components/navigation/SidebarNavSection';
import { useBackendTestRunner, type BackendTestAction } from '../shared/useBackendTestRunner';
import { useHeaderBadge } from '../shared/useHeaderBadge';
import { useNotificationCenter } from '../shared/useNotificationCenter';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const { drawerOpen, isMobileLayout, setDrawerOpen, sidebarCollapsed, toggleSidebar } = useResponsiveSidebar();
  const { headerBadge, headerDepartment } = useHeaderBadge('Employee');
  const handleNotificationNavigation = useCallback(
    (destination: string) => {
      navigate(destination);
    },
    [navigate]
  );
  const notificationCenter = useNotificationCenter('employee', handleNotificationNavigation);

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
    navigate('/employee/dashboard', { replace: true });
  }

  function handleOpenSettings() {
    setDrawerOpen(false);
    setSettingsOpen(true);
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
  }, [fetchJsonWithAuth]);
  const { backendAction, backendResult, handleBackendTest, isLoading } = useBackendTestRunner(buildContext);

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
              ariaLabel="Employee backend testing controls"
              isLoading={isLoading}
              lastAction={backendAction}
              onRun={handleBackendTest}
              result={backendResult}
              title="Backend Endpoint Testing"
            />
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
