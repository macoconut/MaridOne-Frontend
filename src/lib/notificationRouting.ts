import { getRoleHomePath, getSelfServicePath, type SelfServiceRole } from './roleRoutes';

export type NotificationRole = 'employee' | 'hr' | 'manager' | 'management';

type NotificationPayload = Record<string, unknown>;

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
  isRead?: boolean;
  destination: string;
  rawMessage: string;
};

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatNotificationTime(createdAt: Date | null) {
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return 'Now';
  }

  const now = new Date();
  if (isSameCalendarDay(createdAt, now)) {
    return createdAt.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return createdAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: createdAt.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

function defaultDestination(role: NotificationRole) {
  return getRoleHomePath(role);
}

function selfServiceNotificationPath(role: Extract<NotificationRole, 'employee' | 'manager' | 'management'>, page: 'payslip' | 'approvals' | 'training') {
  return getSelfServicePath(role, page);
}

function resolveDestination(role: NotificationRole, message: string) {
  const normalized = message.trim().toLowerCase();
  const selfServiceRole = role as SelfServiceRole;

  if (role === 'hr') {
    if (normalized.includes('dispute')) {
      return '/hr/payslips';
    }

    if (normalized.includes('leave request') || normalized.includes('overtime')) {
      return '/hr/approvals';
    }

    if (normalized.includes('pay run') || normalized.includes('payroll')) {
      return '/hr/pay-run-reporting';
    }

    if (normalized.includes('payslip')) {
      return '/hr/payslips';
    }

    if (normalized.includes('employee')) {
      return '/hr/manage-employees';
    }
  }

  if (role === 'manager') {
    if (
      normalized.startsWith('new leave request') ||
      normalized.startsWith('new overtime request') ||
      normalized.startsWith('new payroll dispute')
    ) {
      return '/manager/pending-approvals';
    }

    if (normalized.includes('attendance')) {
      return '/manager/attendance-dashboard';
    }

    if (normalized.includes('calendar') || normalized.includes('event')) {
      return getRoleHomePath('manager');
    }
  }

  if (role === 'management') {
    if (normalized.includes('pay run') || normalized.includes('payroll') || normalized.includes('payslip')) {
      return '/management/payroll-dashboard';
    }

    if (normalized.includes('attendance')) {
      return '/management/attendance';
    }

    if (normalized.includes('calendar') || normalized.includes('event')) {
      return getRoleHomePath('management');
    }
  }

  if (role === 'manager') {
    if (normalized.includes('leave request') || normalized.includes('overtime')) {
      return '/manager/pending-approvals';
    }

    if (normalized.includes('attendance')) {
      return '/manager/attendance-dashboard';
    }

    if (normalized.includes('calendar') || normalized.includes('event')) {
      return getRoleHomePath('manager');
    }
  }

  if (normalized.includes('pay run posted') || normalized.includes('payslip')) {
<<<<<<< Updated upstream
    if (role === 'manager') {
      return selfServiceNotificationPath('manager', 'payslip');
    }

    if (role === 'management') {
      return selfServiceNotificationPath('management', 'payslip');
    }

    return selfServiceNotificationPath('employee', 'payslip');
=======
    return getSelfServicePath(selfServiceRole, 'payslip');
>>>>>>> Stashed changes
  }

  if (
    normalized.includes('leave request') ||
    normalized.includes('overtime request') ||
    normalized.includes('dispute request') ||
    normalized.includes('dispute')
  ) {
<<<<<<< Updated upstream
    if (role === 'manager') {
      return selfServiceNotificationPath('manager', 'approvals');
    }

    if (role === 'management') {
      return selfServiceNotificationPath('management', 'approvals');
    }

    return selfServiceNotificationPath('employee', 'approvals');
=======
    return getSelfServicePath(selfServiceRole, 'approvals');
>>>>>>> Stashed changes
  }

  if (
    normalized.includes('training') ||
    normalized.includes('onboarding') ||
    normalized.includes('handbook') ||
    normalized.includes('calendar') ||
    normalized.includes('event')
  ) {
<<<<<<< Updated upstream
    if (role === 'manager') {
      return selfServiceNotificationPath('manager', 'training');
    }

    if (role === 'management') {
      return selfServiceNotificationPath('management', 'training');
    }

    return selfServiceNotificationPath('employee', 'training');
=======
    return getSelfServicePath(selfServiceRole, 'training');
>>>>>>> Stashed changes
  }

  return defaultDestination(role);
}

export function mapNotificationItem(
  role: NotificationRole,
  row: NotificationPayload
): NotificationItem {
  const idRaw = row.notificationId;
  const id = typeof idRaw === 'number' ? String(idRaw) : String(idRaw ?? crypto.randomUUID());
  const rawMessage = typeof row.message === 'string' ? row.message : 'Notification';
  const createdAt = typeof row.createdAt === 'string' ? new Date(row.createdAt) : null;

  return {
    id,
    title: rawMessage,
    rawMessage,
    description: undefined,
    time: formatNotificationTime(createdAt),
    isRead: Boolean(row.readStatus),
    destination: resolveDestination(role, rawMessage),
  };
}
