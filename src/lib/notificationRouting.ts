import {
  getRoleHomePath,
  getSelfServicePath,
  type SelfServicePage,
  type SelfServiceRole,
} from './roleRoutes';

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

type NotificationSelfServicePage = Extract<
  SelfServicePage,
  'attendance' | 'approvals' | 'payslip' | 'training'
>;

const HR_APPROVAL_PREFIXES = [
  'new leave request',
  'new overtime request',
  'an employee cancelled a leave request',
  'an employee cancelled an overtime request',
  'leave request from',
  'overtime request from',
] as const;

const HR_PAYSLIP_PREFIXES = [
  'new payroll dispute',
  'an employee cancelled a dispute request',
  'dispute request from',
] as const;

const MANAGER_APPROVAL_PREFIXES = [
  'new team leave request',
  'new team overtime request',
  'team leave request',
  'team overtime request',
  'new leave request',
  'new overtime request',
  'new payroll dispute',
] as const;

const NOTIFICATION_MESSAGE_DATE_PATTERN =
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;

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

function formatNotificationMessageDate(value: string) {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatNotificationMessage(message: string) {
  return message.replace(NOTIFICATION_MESSAGE_DATE_PATTERN, (match) =>
    formatNotificationMessageDate(match)
  );
}

function defaultDestination(role: NotificationRole) {
  return getRoleHomePath(role);
}

function selfServiceNotificationPath(role: SelfServiceRole, page: NotificationSelfServicePage) {
  return getSelfServicePath(role, page);
}

function includesAny(value: string, patterns: readonly string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function startsWithAny(value: string, patterns: readonly string[]) {
  return patterns.some((pattern) => value.startsWith(pattern));
}

function parseReadStatus(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return Boolean(value);
}

function resolveDestination(role: NotificationRole, message: string) {
  const normalized = message.trim().toLowerCase();
  const selfServiceRole: SelfServiceRole = role;

  if (role === 'hr') {
    if (startsWithAny(normalized, HR_APPROVAL_PREFIXES)) {
      return '/hr/approvals';
    }

    if (startsWithAny(normalized, HR_PAYSLIP_PREFIXES)) {
      return '/hr/payslips';
    }

    if (includesAny(normalized, ['pay run', 'payroll run'])) {
      return '/hr/pay-run-reporting';
    }
  }

  if (role === 'manager' && startsWithAny(normalized, MANAGER_APPROVAL_PREFIXES)) {
    return '/manager/pending-approvals';
  }

  if (role === 'management' && includesAny(normalized, ['pay run', 'payroll run'])) {
    return '/management/payroll-dashboard';
  }

  if (includesAny(normalized, ['payslip', 'deductions summary'])) {
    return selfServiceNotificationPath(selfServiceRole, 'payslip');
  }

  if (
    includesAny(normalized, [
      'leave request',
      'leave update',
      'overtime request',
      'overtime update',
      'dispute request',
      'dispute update',
      'awaiting review',
      'has been received',
      'your dispute',
    ])
  ) {
    return selfServiceNotificationPath(selfServiceRole, 'approvals');
  }

  if (includesAny(normalized, ['attendance reminder', 'time log', 'time logs'])) {
    return selfServiceNotificationPath(selfServiceRole, 'attendance');
  }

  if (role === 'manager' && normalized.includes('attendance')) {
    return '/manager/attendance-dashboard';
  }

  if (role === 'management' && normalized.includes('attendance')) {
    return '/management/attendance';
  }

  if (includesAny(normalized, ['training', 'onboarding', 'handbook'])) {
    return selfServiceNotificationPath(selfServiceRole, 'training');
  }

  if (includesAny(normalized, ['calendar', 'event', 'announcement'])) {
    return defaultDestination(role);
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
  const displayMessage = formatNotificationMessage(rawMessage);
  const createdAt = typeof row.createdAt === 'string' ? new Date(row.createdAt) : null;

  return {
    id,
    title: displayMessage,
    rawMessage,
    description: undefined,
    time: formatNotificationTime(createdAt),
    isRead: parseReadStatus(row.readStatus),
    destination: resolveDestination(role, rawMessage),
  };
}
