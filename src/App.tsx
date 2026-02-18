import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Landing from './pages/Public/Landing';
import EmployeeLogin from './pages/employee/auth/Login/Login';

import EmployeeLayout from './pages/employee/layout/EmployeeLayout';
import Dashboard from './pages/employee/dashboard/Dashboard';
import Attendance from './pages/employee/attendance/Attendance';
import Approval from './pages/employee/approval/Approval';
import Payslip from './pages/employee/payslip/Payslip';
import Training from './pages/employee/training/Training';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/employee/login" element={<EmployeeLogin />} />

        {/* Employee (FRAME) */}
        <Route path="/employee" element={<EmployeeLayout />}>
          {/* default */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="approvals" element={<Approval />} />
          <Route path="payslip" element={<Payslip />} />
          <Route path="training" element={<Training />}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
