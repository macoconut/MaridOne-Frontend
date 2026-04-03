import type { UserRole } from './session';

export type SelfServiceRole = Exclude<UserRole, 'accounting'>;
export type SelfServicePage = 'dashboard' | 'attendance' | 'approvals' | 'payslip' | 'training';

export function getRoleHomePath(role: UserRole) {
  switch (role) {
    case 'employee':
      return '/employee/dashboard';
    case 'hr':
      return '/hr/self-service/dashboard';
    case 'manager':
      return '/manager/self-service/dashboard';
    case 'management':
      return '/management/self-service/dashboard';
    case 'accounting':
      return '/accounting/payroll-dashboard';
  }
}

export function getSelfServicePath(role: SelfServiceRole, page: SelfServicePage) {
  if (role === 'employee') {
    return `/employee/${page}`;
  }

  return `/${role}/self-service/${page}`;
}
