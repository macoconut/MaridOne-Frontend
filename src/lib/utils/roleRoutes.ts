import type { UserRole } from './session';

export type SelfServiceRole = Exclude<UserRole, 'accounting'>;
export type SelfServicePage = 'dashboard' | 'attendance' | 'approvals' | 'payslip' | 'training';

type RoleRouteConfig = {
  homePath: string;
  loginAliases: string[];
  selfServiceBasePath?: string;
};

type SelfServiceRouteMeta = {
  page: SelfServicePage;
  path: SelfServicePage;
  label: string;
};

const ROLE_ROUTE_CONFIG: Record<UserRole, RoleRouteConfig> = {
  employee: {
    homePath: '/employee/dashboard',
    loginAliases: ['/login', '/employee/login'],
    selfServiceBasePath: '/employee',
  },
  hr: {
    homePath: '/hr/self-service/dashboard',
    loginAliases: ['/hr/login'],
    selfServiceBasePath: '/hr/self-service',
  },
  manager: {
    homePath: '/manager/self-service/dashboard',
    loginAliases: ['/manager/login'],
    selfServiceBasePath: '/manager/self-service',
  },
  management: {
    homePath: '/management/self-service/dashboard',
    loginAliases: ['/management/login'],
    selfServiceBasePath: '/management/self-service',
  },
  accounting: {
    homePath: '/accounting/payroll-dashboard',
    loginAliases: ['/accounting/login'],
  },
};

export const SELF_SERVICE_ROUTE_META: Record<SelfServicePage, SelfServiceRouteMeta> = {
  dashboard: { page: 'dashboard', path: 'dashboard', label: 'Dashboard' },
  attendance: { page: 'attendance', path: 'attendance', label: 'Attendance' },
  approvals: { page: 'approvals', path: 'approvals', label: 'Approvals' },
  payslip: { page: 'payslip', path: 'payslip', label: 'Payslip' },
  training: { page: 'training', path: 'training', label: 'Training' },
};

export const SELF_SERVICE_ROUTE_ORDER = Object.keys(SELF_SERVICE_ROUTE_META) as SelfServicePage[];

export function getRoleHomePath(role: UserRole) {
  return ROLE_ROUTE_CONFIG[role].homePath;
}

export function getRoleLoginAliases(role: UserRole) {
  return [...ROLE_ROUTE_CONFIG[role].loginAliases];
}

export function getAllLoginAliases() {
  return [...new Set(Object.values(ROLE_ROUTE_CONFIG).flatMap((config) => config.loginAliases))];
}

export function getSelfServiceBasePath(role: SelfServiceRole) {
  return ROLE_ROUTE_CONFIG[role].selfServiceBasePath!;
}

export function getSelfServiceRouteMeta(page: SelfServicePage) {
  return SELF_SERVICE_ROUTE_META[page];
}

export function getSelfServiceRouteMetadata() {
  return SELF_SERVICE_ROUTE_ORDER.map((page) => SELF_SERVICE_ROUTE_META[page]);
}

export function getSelfServicePath(role: SelfServiceRole, page: SelfServicePage) {
  return `${getSelfServiceBasePath(role)}/${getSelfServiceRouteMeta(page).path}`;
}
