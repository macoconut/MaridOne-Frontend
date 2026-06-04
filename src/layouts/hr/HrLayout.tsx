import { Outlet, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import {
  FiBarChart2,
  FiBookOpen,
  FiGrid,
  FiCalendar,
  FiCheckSquare,
  FiClipboard,
  FiFileText,
  FiUsers,
  FiCreditCard,
  FiActivity,
} from 'react-icons/fi';
import BackendTestPanel from '@/components/layout/BackendTestPanel';
import type { NavSection } from '@/components/navigation/SidebarNavSection';
import '@/layouts/shared/hr-theme.css';
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
    label: 'Create Employee',
    description: 'Create a new employee record.',
    method: 'POST',
    path: '/api/employees/create',
    body: {
      firstName: 'Test',
      middleName: 'H',
      lastName: 'Employee',
      birthDate: '1998-01-01',
      companyEmail: 'test.employee@example.com',
      personalEmail: 'test.employee.personal@example.com',
      phoneNumber: '09171234567',
      position: 'EMPLOYEE',
      employmentStatus: 'REGULAR',
      address: {
        permanentAddress: 'Sampaloc Manila',
        temporaryAddress: 'Sampaloc Manila',
        city: 'Manila',
        state: 'Metro Manila',
        country: 'Philippines',
        zipCode: '1000',
      },
    },
  },
  {
    label: 'Get Employees',
    description: 'Fetch paginated employee list for HR.',
    method: 'GET',
    path: '/api/employees?page=0&size=20',
  },
  {
    label: 'Update Employee',
    description: 'Update employee details by employee ID.',
    method: 'PATCH',
    path: '/api/employees/{empId}',
    body: {
      firstName: 'Updated',
      lastName: 'Employee',
    },
  },
  {
    label: 'Update Employee Status',
    description: 'Change employee status fields.',
    method: 'PATCH',
    path: '/api/employees/status/{empId}',
    body: {
      employmentStatus: 'REGULAR',
    },
  },
  {
    label: 'Create User Account',
    description: 'Create login account for an employee.',
    method: 'POST',
    path: '/api/user/create',
    body: {
      username: 'test.employee',
      password: 'password123',
      employeeId: '{empId}',
    },
  },
  {
    label: 'Create Leave Balance',
    description: 'Create leave balance row for employee.',
    method: 'POST',
    path: '/api/leave/balance/{empId}',
    body: {
      empId: '{empId}',
      balanceHours: 8,
      leaveType: 'SICK_LEAVE',
    },
  },
  {
    label: 'Update Leave Balance',
    description: 'Adjust leave balance by leave type.',
    method: 'PATCH',
    path: '/api/leave/balance/update/{empId}',
    body: {
      leaveType: 'SICK_LEAVE',
      type: 'add',
      balanceHours: 2,
    },
  },
  {
    label: 'Update Leave Request',
    description: 'Approve or deny leave request.',
    method: 'PATCH',
    path: '/api/leave/update/{leaveRequestId}',
    body: {
      leaveDate: '2026-03-03',
      approver: 'HR',
      reason: 'Approved request',
      requestStatus: 'APPROVED',
      approverReason: 'Approved by HR',
    },
  },
  {
    label: 'Get Overtime Requests',
    description: 'Fetch all overtime requests for HR.',
    method: 'GET',
    path: '/api/overtime/all?page=0&size=20',
  },
  {
    label: 'Update Overtime Request',
    description: 'Approve or deny overtime request.',
    method: 'PATCH',
    path: '/api/overtime/update',
    body: {
      overtimeId: '{overtimeId}',
      updateStatus: 'APPROVED',
      approveReason: 'Approved for payroll',
    },
  },
  {
    label: 'Add Shift Schedule',
    description: 'Create a template shift assignment.',
    method: 'POST',
    path: '/api/employee/schedule/add',
    body: {
      empId: '{empId}',
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '17:00',
    },
  },
  {
    label: 'Update Shift Schedule',
    description: 'Edit an existing shift assignment.',
    method: 'PATCH',
    path: '/api/employee/schedule/update',
    body: {
      shiftId: '{shiftId}',
      dayOfWeek: 'MONDAY',
      startTime: '09:00',
      endTime: '18:00',
    },
  },
  {
    label: 'Create Calendar Event',
    description: 'Create company-wide calendar event.',
    method: 'POST',
    path: '/api/calendar/events/create',
    body: {
      title: 'Backend Test Event',
      description: 'Backend test announcement created through the HR tools panel.',
      startDate: '2026-04-10T09:00:00Z',
      endDate: '2026-04-10T17:00:00Z',
      isActive: true,
    },
  },
  {
    label: 'Update Calendar Event',
    description: 'Update existing calendar event.',
    method: 'PUT',
    path: '/api/calendar/events/update',
    body: {
      calendarId: '{calendarId}',
      title: 'Updated Backend Test Event',
      description: 'Updated backend test announcement description.',
      startDate: '2026-04-10T09:00:00Z',
      endDate: '2026-04-10T18:00:00Z',
      isActive: true,
    },
  },
  {
    label: 'Delete Calendar Event',
    description: 'Soft-delete calendar event by ID.',
    method: 'PATCH',
    path: '/api/calendar/events/delete/{calendarId}',
  },
  {
    label: 'Get Attendance Logs',
    description: 'Fetch attendance logs for HR review.',
    method: 'GET',
    path: '/api/logs/attendance?page=0&size=25',
  },
  {
    label: 'Get Activity Logs',
    description: 'Fetch activity logs for HR review.',
    method: 'GET',
    path: '/api/logs/activity?page=0&size=25',
  },
  {
    label: 'Process Payroll Run',
    description: 'Create a regular payroll run and generate payroll items.',
    method: 'POST',
    path: '/api/payroll/run/process',
    body: {
      periodStart: '2026-02-01',
      periodEnd: '2026-02-15',
      periodDescription: 'Regular payroll run Feb 1-15',
      payrollStatus: 'IN_PROGRESS',
      runType: 'REGULAR',
    },
  },
  {
    label: 'Create Adjustment Run',
    description: 'Create an adjustment payroll run for corrections.',
    method: 'POST',
    path: '/api/payroll/run/create',
    body: {
      periodStart: '2026-02-01',
      periodEnd: '2026-02-15',
      periodDescription: 'Adjustment payroll run Feb 1-15',
      payrollStatus: 'IN_PROGRESS',
      runType: 'ADJUSTMENT',
    },
  },
  {
    label: 'Create Payroll Item',
    description: 'Create payroll item for one employee.',
    method: 'POST',
    path: '/api/payroll/item/create',
    body: {
      payId: '{payId}',
      empId: '{empId}',
    },
  },
  {
    label: 'Update Payroll Item',
    description: 'Update payroll item values by item ID.',
    method: 'PATCH',
    path: '/api/payroll/item/update/{itemId}',
    body: {
      grossPay: 20000,
      netPay: 18000,
    },
  },
  {
    label: 'Get Run Items',
    description: 'Fetch payroll items under a run.',
    method: 'GET',
    path: '/api/payroll/run/{payId}/items?page=0&size=20',
  },
  {
    label: 'Get Dispute Requests',
    description: 'Fetch payroll dispute requests for HR.',
    method: 'GET',
    path: '/api/payroll/item/dispute/all?page=0&size=20',
  },
  {
    label: 'Update Dispute Request',
    description: 'Resolve a payroll dispute request.',
    method: 'PATCH',
    path: '/api/payroll/item/dispute/update/{disputeId}',
    body: {
      status: 'APPROVED',
      statusReason: 'Resolved during backend test',
    },
  },
  {
    label: 'Get Notifications',
    description: 'Fetch HR user notifications.',
    method: 'GET',
    path: '/api/notifications',
  },
];

const navSections: NavSection[] = [
  {
    id: 'employee',
    label: 'Self-Service',
    defaultOpen: true,
    items: [
      { to: '/hr/self-service/dashboard', label: 'User Dashboard', icon: FiGrid },
      { to: '/hr/self-service/attendance', label: 'Attendance', icon: FiCalendar },
      { to: '/hr/self-service/approvals', label: 'Leave Request Filing', icon: FiCheckSquare },
      { to: '/hr/self-service/payslip', label: 'View Payslip', icon: FiFileText },
      { to: '/hr/self-service/training', label: 'Documents', icon: FiBookOpen },
    ],
  },
  {
    id: 'hr',
    label: 'People Operations',
    defaultOpen: true,
    items: [
      { to: '/hr/dashboard', label: 'Attendance Dashboard', icon: FiBarChart2 },
      { to: '/hr/attendance-reports', label: 'Attendance Reports', icon: FiClipboard },
      { to: '/hr/manage-schedule', label: 'Manage Schedule', icon: FiCalendar },
      { to: '/hr/approvals', label: 'Manage Leave Requests', icon: FiCheckSquare },
      { to: '/hr/payslips', label: 'Manage Payslips', icon: FiCreditCard },
      { to: '/hr/pay-run-reporting', label: 'Pay Run Reporting', icon: FiFileText },
      { to: '/hr/manage-employees', label: 'Manage Employees', icon: FiUsers },
      { to: '/hr/audit-logs', label: 'Audit Logs', icon: FiActivity },
    ],
  },
];

export default function HrLayout() {
  const navigate = useNavigate();
  const handleNotificationNavigation = useCallback(
    (destination: string) => {
      navigate(destination);
    },
    [navigate]
  );
  const notificationCenter = useNotificationCenter('hr', handleNotificationNavigation);
  const controller = useRoleLayout({
    roleLabel: 'HR',
    homePath: '/hr/self-service/dashboard',
    navSections,
    backendPanel: {
      actions: backendActions,
      ariaLabel: 'HR backend testing controls',
      title: 'Backend Endpoint Testing',
      mode: 'replace',
      buildContext: async ({ fetchJsonWithAuth, username }) => {
        const context: PlaceholderContext = { username: username ?? undefined };
        const users = await fetchJsonWithAuth('/api/employees?page=0&size=20');
        const firstEmployee = firstFromCollection(users);
        const empId = extractFirstId(firstEmployee, ['employeeId', 'id', 'empId']);
        if (empId) context.empId = empId;

        const overtimes = await fetchJsonWithAuth('/api/overtime/all?page=0&size=20');
        const firstOvertime = firstFromCollection(overtimes);
        const overtimeId = extractFirstId(firstOvertime, ['overtimeId', 'id']);
        if (overtimeId) context.overtimeId = overtimeId;

        const events = await fetchJsonWithAuth('/api/calendar/events?month=4&year=2026');
        const firstEvent = firstFromCollection(events);
        const calendarId = extractFirstId(firstEvent, ['calendarId', 'id']);
        if (calendarId) context.calendarId = calendarId;

        const disputes = await fetchJsonWithAuth('/api/payroll/item/dispute/all?page=0&size=20');
        const firstDispute = firstFromCollection(disputes);
        const disputeId = extractFirstId(firstDispute, ['disputeId', 'id', 'requestId']);
        if (disputeId) context.disputeId = disputeId;

        if (username) {
          const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
          const selfEmpId =
            extractFirstId(userDetails, ['employeeId', 'id']) ??
            extractFirstId(
              userDetails && typeof userDetails === 'object'
                ? (userDetails as Record<string, unknown>).employee
                : null,
              ['employeeId', 'id']
            );
          if (selfEmpId) {
            const selfItems = await fetchJsonWithAuth(`/api/payroll/item/${selfEmpId}`);
            const firstItem = firstFromCollection(selfItems);
            const itemId = extractFirstId(firstItem, ['id', 'itemId', 'payrollItemId']);
            const payId = extractFirstId(firstItem, ['payId', 'payrollRunId']);
            if (itemId) context.itemId = itemId;
            if (payId) context.payId = payId;
          }
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
      {BACKEND_TEST_MODE ? backendPanel : <Outlet />}
    </RoleShell>
  );
}

