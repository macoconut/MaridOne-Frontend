import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import ManagementLayout from './pages/management/layout/ManagementLayout';
import ManagementDashboard from './pages/management/dashboard/Dashboard';
import ManagementAttendance from './pages/management/attendance/Attendance';
import ManagementPayrollCosts from './pages/management/payroll/PayrollCosts';
import AccountingLayout from './pages/accounting/layout/AccountingLayout';
import AccountingPayrollDashboard from './pages/accounting/payroll-dashboard/PayrollDashboard';
import AccountingPayrollReview from './pages/accounting/payroll-review/PayrollReview';
import AccountingBookkeeping from './pages/accounting/bookkeeping/Bookkeeping';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<EmployeeLogin />} />
        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/hr/login" element={<EmployeeLogin />} />
        <Route path="/management/login" element={<EmployeeLogin />} />
        <Route path="/accounting/login" element={<EmployeeLogin />} />

        {/* Employee (FRAME) */}
        <Route path="/employee" element={<EmployeeLayout />}>
          {/* default */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="approvals" element={<Approval />} />
          <Route path="payslip" element={<Payslip />} />
          <Route path="training" element={<Training />} />
        </Route>

        {/* HR (FRAME) */}
        <Route path="/hr" element={<HrLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HrDashboard />} />
          <Route path="attendance-reports" element={<HrAttendanceReports />} />
          <Route path="approvals" element={<HrApprovals />} />
          <Route path="payslips" element={<HrPayslips />} />
          <Route path="manage-emp" element={<HrManageEmp />} />
          <Route path="employees" element={<Navigate to="/hr/manage-emp" replace />} />
        </Route>

        {/* Management (FRAME) */}
        <Route path="/management" element={<ManagementLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ManagementDashboard />} />
          <Route path="attendance" element={<ManagementAttendance />} />
          <Route path="payroll-costs" element={<ManagementPayrollCosts />} />
        </Route>

        {/* Accounting (FRAME) */}
        <Route path="/accounting" element={<AccountingLayout />}>
          <Route index element={<Navigate to="payroll-dashboard" replace />} />
          <Route path="payroll-dashboard" element={<AccountingPayrollDashboard />} />
          <Route path="payroll-review" element={<AccountingPayrollReview />} />
          <Route path="bookkeeping" element={<AccountingBookkeeping />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
