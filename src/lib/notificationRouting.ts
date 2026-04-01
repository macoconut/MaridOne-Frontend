export type NotificationRole = 'employee' | 'hr' | 'management';

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

function defaultDestination(role: NotificationRole) {
  if (role === 'management') return '/management/dashboard';
  return role === 'hr' ? '/hr/dashboard' : '/employee/dashboard';
}

function resolveDestination(role: NotificationRole, message: string) {
  const normalized = message.trim().toLowerCase();

  if (role === 'hr') {
    if (
      normalized.includes('leave request') ||
      normalized.includes('overtime') ||
      normalized.includes('dispute')
    ) {
      return '/hr/approvals';
    }

    if (normalized.includes('pay run') || normalized.includes('payroll')) {
      return '/hr/pay-run-reporting';
    }

    if (normalized.includes('payslip')) {
      return '/hr/payslips';
    }

    if (normalized.includes('employee')) {
      return '/hr/manage-emp';
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
      return '/management/dashboard';
    }
  }

  if (normalized.includes('pay run posted') || normalized.includes('payslip')) {
    return '/employee/payslip';
  }

  if (
    normalized.includes('leave request') ||
    normalized.includes('overtime request') ||
    normalized.includes('dispute request')
  ) {
    return '/employee/approvals';
  }

  if (
    normalized.includes('training') ||
    normalized.includes('onboarding') ||
    normalized.includes('handbook') ||
    normalized.includes('calendar') ||
    normalized.includes('event')
  ) {
    return '/employee/training';
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
    description: typeof row.importance === 'string' ? `Importance: ${row.importance}` : undefined,
    time: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : 'Now',
    isRead: Boolean(row.readStatus),
    destination: resolveDestination(role, rawMessage),
  };
}
