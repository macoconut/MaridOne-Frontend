import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { getAuthToken, getUserRole, type UserRole } from './lib/session';

import Landing from './pages/Public/Landing';
import EmployeeLogin from './pages/employee/auth/Login/Login';

import EmployeeLayout from './pages/employee/layout/EmployeeLayout';
import Dashboard from './pages/employee/dashboard/Dashboard';
import Attendance from './pages/employee/attendance/Attendance';
import Approval from './pages/employee/approval/Approval';
import Payslip from './pages/employee/payslip/Payslip';
import Training from './pages/employee/training/Training';
import HrLayout from './pages/hr/layout/HrLayout';
import HrDashboard from './pages/hr/dashboard/Dashboard';
import HrAttendanceReports from './pages/hr/attendance-reports/AttendanceReports';
import HrApprovals from './pages/hr/approvals/Approvals';
import HrPayslips from './pages/hr/payslips/Payslips';
import HrManageEmp from './pages/hr/manage-emp/manage-emp';
import HrPayRunReporting from './pages/hr/pay-run-reporting/PayRunReporting';
import ManagementLayout from './pages/management/layout/ManagementLayout';
import ManagementAttendance from './pages/management/attendance/Attendance';
import ManagementPayrollCosts from './pages/management/payroll/PayrollCosts';
import ManagementPayRunReporting from './pages/management/pay-run-reporting/PayRunReporting';
import ManagerLayout from './pages/manager/layout/ManagerLayout';
import ManagerDashboard from './pages/manager/dashboard/Dashboard';
import ManagerAttendanceDashboard from './pages/manager/attendance-dashboard/AttendanceDashboard';
import ManagerAttendanceReports from './pages/manager/attendance-reports/AttendanceReports';
import ManagerPendingApprovals from './pages/manager/pending-approvals/PendingApprovals';
import AccountingLayout from './pages/accounting/layout/AccountingLayout';
import AccountingPayrollDashboard from './pages/accounting/payroll-dashboard/PayrollDashboard';
import AccountingPayrollReview from './pages/accounting/payroll-review/PayrollReview';

function roleHome(role: UserRole) {
  switch (role) {
    case 'employee':
      return '/employee/dashboard';
    case 'hr':
      return '/hr/dashboard';
    case 'manager':
      return '/manager/dashboard';
    case 'management':
      return '/management/attendance';
    case 'accounting':
      return '/accounting/payroll-dashboard';
  }
}

function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: ReactElement;
}) {
  const token = getAuthToken();
  const currentRole = getUserRole();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }

  if (currentRole !== role) {
    return <Navigate to={roleHome(currentRole)} replace />;
  }

  return children;
}

function LoginRoute() {
  const token = getAuthToken();
  const role = getUserRole();

  if (token && role) {
    return <Navigate to={roleHome(role)} replace />;
  }

  return <EmployeeLogin />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/employee/login" element={<LoginRoute />} />
        <Route path="/hr/login" element={<LoginRoute />} />
        <Route path="/manager/login" element={<LoginRoute />} />
        <Route path="/management/login" element={<LoginRoute />} />
        <Route path="/accounting/login" element={<LoginRoute />} />

        {/* Employee (FRAME) */}
        <Route path="/employee" element={<RequireRole role="employee"><EmployeeLayout /></RequireRole>}>
          {/* default */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="approvals" element={<Approval />} />
          <Route path="payslip" element={<Payslip />} />
          <Route path="training" element={<Training />} />
        </Route>

        {/* HR (FRAME) */}
        <Route path="/hr" element={<RequireRole role="hr"><HrLayout /></RequireRole>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HrDashboard />} />
          <Route path="attendance-reports" element={<HrAttendanceReports />} />
          <Route path="approvals" element={<HrApprovals />} />
          <Route path="payslips" element={<HrPayslips />} />
          <Route path="pay-run-reporting" element={<HrPayRunReporting />} />
          <Route path="manage-emp" element={<HrManageEmp />} />
          <Route path="employees" element={<Navigate to="/hr/manage-emp" replace />} />
        </Route>

        {/* Management (FRAME) */}
        <Route path="/management" element={<RequireRole role="management"><ManagementLayout /></RequireRole>}>
          <Route index element={<Navigate to="attendance" replace />} />
          <Route path="dashboard" element={<ManagementAttendance />} />
          <Route path="attendance" element={<ManagementAttendance />} />
          <Route path="payroll-dashboard" element={<ManagementPayrollCosts />} />
          <Route path="pay-run-reporting" element={<ManagementPayRunReporting />} />
          <Route path="payroll-costs" element={<ManagementPayrollCosts />} />
        </Route>

        {/* Manager (FRAME) */}
        <Route path="/manager" element={<RequireRole role="manager"><ManagerLayout /></RequireRole>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="attendance-dashboard" element={<ManagerAttendanceDashboard />} />
          <Route path="attendance-reports" element={<ManagerAttendanceReports />} />
          <Route path="pending-approvals" element={<ManagerPendingApprovals />} />
        </Route>

        {/* Accounting (FRAME) */}
        <Route path="/accounting" element={<RequireRole role="accounting"><AccountingLayout /></RequireRole>}>
          <Route index element={<Navigate to="payroll-dashboard" replace />} />
          <Route path="payroll-dashboard" element={<AccountingPayrollDashboard />} />
          <Route path="payroll-review" element={<AccountingPayrollReview />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
