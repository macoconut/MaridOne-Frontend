import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, type ReactElement } from 'react';
import { getAuthToken, getRequiresPasswordChange, getUserRole, type UserRole } from './lib/session';
import {
  getAllLoginAliases,
  getRoleHomePath,
  getSelfServiceRouteMetadata,
  type SelfServicePage,
  type SelfServiceRole,
} from './lib/roleRoutes';

import Landing from './pages/public/Landing';
import VerifyEmail from './pages/public/VerifyEmail';
import EmployeeLogin from './pages/auth/login/Login';
import ChangePassword from './pages/auth/change-password/ChangePassword';
import ForgotPassword from './pages/auth/forgot-password/ForgotPassword';

import EmployeeLayout from './layouts/employee/EmployeeLayout';
import Dashboard from './pages/self-service/dashboard/Dashboard';
import Attendance from './pages/self-service/attendance/Attendance';
import Approval from './pages/self-service/approvals/Approval';
import Payslip from './pages/self-service/payslip/Payslip';
import Training from './pages/self-service/training/Training';
import HrLayout from './layouts/hr/HrLayout';
import HrDashboard from './pages/hr/dashboard/Dashboard';
import HrAttendanceReports from './pages/hr/attendance-reports/AttendanceReports';
import HrManageSchedule from './pages/hr/manage-schedule/ManageSchedule';
import HrApprovals from './pages/hr/approvals/Approvals';
import HrPayslips from './pages/hr/payslips/Payslips';
import HrManageEmployees from './pages/hr/manage-employees/ManageEmployees';
import HrPayRunReporting from './pages/hr/pay-run-reporting/PayRunReporting';
import HrAuditLogs from './pages/hr/audit-logs/AuditLogs';
import ManagementLayout from './layouts/management/ManagementLayout';
import ManagementAttendance from './pages/management/attendance/Attendance';
import ManagementPayrollCosts from './pages/management/payroll-costs/PayrollCosts';
import ManagementPayRunReporting from './pages/management/pay-run-reporting/PayRunReporting';
import ManagerLayout from './layouts/manager/ManagerLayout';
import ManagerAttendanceDashboard from './pages/manager/attendance-dashboard/AttendanceDashboard';
import ManagerAttendanceReports from './pages/manager/attendance-reports/AttendanceReports';
import ManagerPendingApprovals from './pages/manager/pending-approvals/PendingApprovals';
import ManagerMonthlyTeamSchedule from './pages/manager/monthly-team-schedule/MonthlyTeamSchedule';
import AccountingLayout from './layouts/accounting/AccountingLayout';
import AccountingPayrollDashboard from './pages/accounting/payroll-dashboard/PayrollDashboard';
import AccountingPayrollReview from './pages/accounting/payroll-review/PayrollReview';
import { UiDialogProvider } from './components/dialog/UiDialogProvider';
import { LoadingProvider } from './context/LoadingContext';
import {
  applyUiPreferences,
  subscribeToUiPreferencesChange,
} from './lib/uiPreferences';
import './styles/tokens.css';
import './styles/modals.css';
import './styles/forms.css';
import './styles/request-popup.css';
import './styles/buttons.css';
import './styles/tables.css';
import './styles/universal-ui.css';
import './styles/spinner.css';

function roleHome(role: UserRole) {
  return getRoleHomePath(role);
}

const selfServiceRouteMetadata = getSelfServiceRouteMetadata();
const loginAliasPaths = getAllLoginAliases();

function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: ReactElement;
}) {
  const token = getAuthToken();
  const currentRole = getUserRole();
  const requiresPasswordChange = getRequiresPasswordChange();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }

  if (requiresPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (currentRole !== role) {
    return <Navigate to={roleHome(currentRole)} replace />;
  }

  return children;
}

function LoginRoute() {
  const token = getAuthToken();
  const role = getUserRole();
  const requiresPasswordChange = getRequiresPasswordChange();

  if (token && role) {
    return <Navigate to={requiresPasswordChange ? '/change-password' : roleHome(role)} replace />;
  }

  return <EmployeeLogin />;
}

function LandingRoute() {
  const token = getAuthToken();
  const role = getUserRole();
  const requiresPasswordChange = getRequiresPasswordChange();

  if (token && role) {
    return <Navigate to={requiresPasswordChange ? '/change-password' : roleHome(role)} replace />;
  }

  return <Landing />;
}

function ForgotPasswordRoute() {
  const token = getAuthToken();
  const role = getUserRole();
  const requiresPasswordChange = getRequiresPasswordChange();

  if (token && role) {
    return <Navigate to={requiresPasswordChange ? '/change-password' : roleHome(role)} replace />;
  }

  return <ForgotPassword />;
}

function RequirePasswordChange() {
  const token = getAuthToken();
  const role = getUserRole();
  const requiresPasswordChange = getRequiresPasswordChange();

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!requiresPasswordChange) {
    return <Navigate to={roleHome(role)} replace />;
  }

  return <ChangePassword />;
}

function getSelfServiceElement(page: SelfServicePage) {
  switch (page) {
    case 'dashboard':
      return <Dashboard />;
    case 'attendance':
      return <Attendance />;
    case 'approvals':
      return <Approval />;
    case 'payslip':
      return <Payslip />;
    case 'training':
      return <Training />;
  }
}

function renderSelfServiceRoutes(role: SelfServiceRole) {
  return selfServiceRouteMetadata.map((route) => (
    <Route key={`${role}-${route.path}`} path={route.path} element={getSelfServiceElement(route.page)} />
  ));
}

export default function App() {
  useEffect(() => {
    const syncPreferences = () => {
      applyUiPreferences();
    };

    const unsubscribeUiPreferences = subscribeToUiPreferencesChange(syncPreferences);

    syncPreferences();

    return () => {
      unsubscribeUiPreferences();
    };
  }, []);

  return (
    <UiDialogProvider>
      <LoadingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingRoute />} />
            <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
            <Route path="/change-password" element={<RequirePasswordChange />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            {loginAliasPaths.map((path) => (
              <Route key={path} path={path} element={<LoginRoute />} />
            ))}

            <Route path="/employee" element={<RequireRole role="employee"><EmployeeLayout /></RequireRole>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              {renderSelfServiceRoutes('employee')}
            </Route>

            <Route path="/hr" element={<RequireRole role="hr"><HrLayout /></RequireRole>}>
              <Route index element={<Navigate to={roleHome('hr')} replace />} />
              <Route path="dashboard" element={<HrDashboard />} />
              <Route path="attendance-reports" element={<HrAttendanceReports />} />
              <Route path="manage-schedule" element={<HrManageSchedule />} />
              <Route path="approvals" element={<HrApprovals />} />
              <Route path="payslips" element={<HrPayslips />} />
              <Route path="pay-run-reporting" element={<HrPayRunReporting />} />
              <Route path="manage-employees" element={<HrManageEmployees />} />
              <Route path="manage-emp" element={<Navigate to="/hr/manage-employees" replace />} />
              <Route path="audit-logs" element={<HrAuditLogs />} />
              <Route path="self-service">
                <Route index element={<Navigate to="dashboard" replace />} />
                {renderSelfServiceRoutes('hr')}
              </Route>
              <Route path="employees" element={<Navigate to="/hr/manage-employees" replace />} />
            </Route>

            <Route path="/management" element={<RequireRole role="management"><ManagementLayout /></RequireRole>}>
              <Route index element={<Navigate to={roleHome('management')} replace />} />
              <Route path="dashboard" element={<ManagementAttendance />} />
              <Route path="attendance" element={<ManagementAttendance />} />
              <Route path="payroll-dashboard" element={<ManagementPayrollCosts />} />
              <Route path="pay-run-reporting" element={<ManagementPayRunReporting />} />
              <Route path="payroll-costs" element={<ManagementPayrollCosts />} />
              <Route path="self-service">
                <Route index element={<Navigate to="dashboard" replace />} />
                {renderSelfServiceRoutes('management')}
              </Route>
            </Route>

            <Route path="/manager" element={<RequireRole role="manager"><ManagerLayout /></RequireRole>}>
              <Route index element={<Navigate to={roleHome('manager')} replace />} />
              <Route path="dashboard" element={<Navigate to="/manager/self-service/dashboard" replace />} />
              <Route path="attendance-dashboard" element={<ManagerAttendanceDashboard />} />
              <Route path="attendance-reports" element={<ManagerAttendanceReports />} />
              <Route path="team-shift-schedules" element={<Navigate to="/manager/monthly-team-schedule" replace />} />
              <Route path="monthly-team-schedule" element={<ManagerMonthlyTeamSchedule />} />
              <Route path="pending-approvals" element={<ManagerPendingApprovals />} />
              <Route path="self-service">
                <Route index element={<Navigate to="dashboard" replace />} />
                {renderSelfServiceRoutes('manager')}
              </Route>
            </Route>

            <Route path="/accounting" element={<RequireRole role="accounting"><AccountingLayout /></RequireRole>}>
              <Route index element={<Navigate to="payroll-dashboard" replace />} />
              <Route path="payroll-dashboard" element={<AccountingPayrollDashboard />} />
              <Route path="payroll-review" element={<AccountingPayrollReview />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LoadingProvider>
    </UiDialogProvider>
  );
}
