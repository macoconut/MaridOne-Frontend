import { toArray } from '../../../lib/api';
import { getManilaNow } from '../../../lib/manilaTime';
import type { AttendanceLeaveRequest as LeaveRequestRow, ShiftSchedule as ShiftScheduleRow } from '../../../lib/types/attendance';
import { formatSss, formatPhilHealth, formatPagibig, formatTin, formatPhone, formatBankAccount } from '../../../lib/phIdFormatters';

export type UserDetails = {
  username?: string;
  employeeId?: number;
  twoFactorEnabled?: boolean;
  canChangePasswordNow?: boolean;
  passwordChangeAvailableAt?: string;
  employee?: {
    bankAccounts?: Array<{
      bankId?: number;
      accountNumber?: string;
      bankName?: string;
    }>;
    employeeId?: number;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    gender?: string;
    contactNumber?: string;
    phoneNumber?: string;
    companyEmail?: string;
    personalEmail?: string;
    email?: string;
    isVerified?: boolean | string;
    address?: string | Record<string, unknown>;
    employmentDateStart?: string;
    employmentDate?: string;
    dateHired?: string;
    position?: string;
    department?: string;
    managerName?: string;
    managerHeadLabel?: string;
    employmentStatus?: string;
    sssNumber?: string;
    philhealthNumber?: string;
    pagibigNumber?: string;
    tinNumber?: string;
    birthDate?: string;
    emergencyContactName?: string;
    emergencyContactRelationship?: string;
    emergencyContactNumber?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
  };
};

export type CalendarEvent = {
  calendarId?: number;
  day?: number;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  employeeId?: number;
  employeeName?: string;
};

export type CalendarDayEvent = {
  key: string;
  calendarId?: number;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  employeeId?: number;
  employeeName: string;
};

export type SelectedAnnouncementDay = {
  label: string;
  events: CalendarDayEvent[];
};

export type AnnouncementDraft = {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
};

export function padDateTimePart(value: number) {
  return String(value).padStart(2, '0');
}

export function toDateTimeLocalValue(value: Date) {
  return `${value.getFullYear()}-${padDateTimePart(value.getMonth() + 1)}-${padDateTimePart(value.getDate())}T${padDateTimePart(value.getHours())}:${padDateTimePart(value.getMinutes())}`;
}

export function createAnnouncementDraft(baseDate?: Date): AnnouncementDraft {
  const start = baseDate ? new Date(baseDate) : new Date();
  if (!baseDate) {
    const manila = getManilaNow();
    start.setFullYear(manila.year, manila.month - 1, manila.day);
    start.setHours(manila.hour, manila.minute, 0, 0);
  }
  start.setSeconds(0, 0);

  const roundedMinutes = start.getMinutes() <= 30 ? 30 : 60;
  if (roundedMinutes === 60) {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  } else {
    start.setMinutes(30, 0, 0);
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    title: '',
    description: '',
    startDateTime: toDateTimeLocalValue(start),
    endDateTime: toDateTimeLocalValue(end),
  };
}

export function syncAnnouncementRange(startDateTime: string, endDateTime: string) {
  if (!startDateTime) return endDateTime;
  if (!endDateTime || endDateTime < startDateTime) return startDateTime;
  return endDateTime;
}

export function createEditDraft(source: UserDetails['employee'] | null | undefined) {
  const rawAddress =
    source && typeof source.address === 'object' && source.address
      ? (source.address as Record<string, unknown>)
      : {};

  return {
    gender: typeof source?.gender === 'string' ? source.gender : '',
    birthDate: typeof source?.birthDate === 'string' ? source.birthDate : '',
    bankName: typeof source?.bankName === 'string' ? source.bankName : '',
    bankAccountNumber: typeof source?.bankAccountNumber === 'string' ? source.bankAccountNumber : '',
    companyEmail:
      typeof source?.companyEmail === 'string'
        ? source.companyEmail
        : typeof source?.email === 'string'
          ? source.email
          : '',
    personalEmail: typeof source?.personalEmail === 'string' ? source.personalEmail : '',
    phoneNumber: formatPhone(
      typeof source?.phoneNumber === 'string'
        ? source.phoneNumber
        : typeof source?.contactNumber === 'string'
          ? source.contactNumber
          : ''
    ),
    permanentAddress: typeof rawAddress.permanentAddress === 'string' ? rawAddress.permanentAddress : '',
    temporaryAddress: typeof rawAddress.temporaryAddress === 'string' ? rawAddress.temporaryAddress : '',
    city: typeof rawAddress.city === 'string' ? rawAddress.city : '',
    state: typeof rawAddress.state === 'string' ? rawAddress.state : '',
    country: typeof rawAddress.country === 'string' ? rawAddress.country : '',
    zipCode: typeof rawAddress.zipCode === 'string' ? rawAddress.zipCode : '',
    sssNumber: typeof source?.sssNumber === 'string' ? formatSss(source.sssNumber) : '',
    philhealthNumber: typeof source?.philhealthNumber === 'string' ? formatPhilHealth(source.philhealthNumber) : '',
    pagibigNumber: typeof source?.pagibigNumber === 'string' ? formatPagibig(source.pagibigNumber) : '',
    tinNumber: typeof source?.tinNumber === 'string' ? formatTin(source.tinNumber) : '',
    emergencyContactName: typeof source?.emergencyContactName === 'string' ? source.emergencyContactName : '',
    emergencyContactRelationship: typeof source?.emergencyContactRelationship === 'string' ? source.emergencyContactRelationship : '',
    emergencyContactNumber: typeof source?.emergencyContactNumber === 'string' ? formatPhone(source.emergencyContactNumber) : '',
  };
}

export function createBankAccountDrafts(source: UserDetails['employee'] | null | undefined) {
  const bankAccounts = Array.isArray(source?.bankAccounts) ? source.bankAccounts : [];
  const drafts = bankAccounts
    .map((entry) => ({
      bankId: typeof entry?.bankId === 'number' ? entry.bankId : undefined,
      bankName: typeof entry?.bankName === 'string' ? entry.bankName : '',
      accountNumber: typeof entry?.accountNumber === 'string' ? formatBankAccount(entry.accountNumber) : '',
    }))
    .filter((entry) => entry.bankId || entry.bankName || entry.accountNumber);

  if (drafts.length > 0) {
    return drafts;
  }

  if (source?.bankName || source?.bankAccountNumber) {
    return [{
      bankName: typeof source.bankName === 'string' ? source.bankName : '',
      accountNumber: typeof source.bankAccountNumber === 'string' ? formatBankAccount(source.bankAccountNumber) : '',
    }];
  }

  return [{
    bankName: '',
    accountNumber: '',
  }];
}

export function isEmailVerified(value: UserDetails['employee'] | null | undefined) {
  const rawValue = value?.isVerified;

  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'verified') return true;
    if (normalized === 'false' || normalized === 'unverified') return false;
  }

  return false;
}

export function formatAddress(value: unknown) {
  if (typeof value === 'string') return value.trim() || 'Address not available';
  if (!value || typeof value !== 'object') return 'Address not available';

  const data = value as Record<string, unknown>;
  const parts = [
    data.permanentAddress,
    data.temporaryAddress,
    data.city,
    data.state,
    data.country,
    data.zipCode,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

export function formatDashboardDate(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatGenderLabel(value?: string) {
  if (!value) return 'Gender not available';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatGenderIcon(gender?: string): string {
  if (!gender) return '';
  const upper = gender.toUpperCase();
  if (upper === 'MALE') return '♂';
  if (upper === 'FEMALE') return '♀';
  return '⚧';
}

export function maskBankNumber(accountNumber?: string): string {
  if (!accountNumber || accountNumber.trim().length === 0) return 'Not available';
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
}

export function formatTenure(value?: string): string {
  if (!value) return '';
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return '';

  const now = new Date();
  if (start > now) return '';

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return '';

  if (years === 0 && months === 0) return 'Less than a month';

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  return parts.join(' ');
}

export function formatDashboardDateTime(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatJwtIssuedAt(token: string | null) {
  if (!token || token === 'authenticated-session') return 'Not available';
  const parts = token.split('.');
  if (parts.length < 2) return 'Not available';

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    const payload = JSON.parse(decoded) as Record<string, unknown>;
    if (typeof payload.iat !== 'number') return 'Not available';
    const issuedAt = new Date(payload.iat * 1000);
    return formatDashboardDateTime(issuedAt.toISOString());
  } catch {
    return 'Not available';
  }
}

export function getCalendarEventTitle(event: CalendarEvent) {
  return typeof event.title === 'string' && event.title.trim().length > 0
    ? event.title.trim()
    : 'Company event';
}

export function getCalendarEventDescription(event: CalendarEvent) {
  return typeof event.description === 'string' ? event.description.trim() : '';
}

export function getCalendarEventEmployeeName(event: CalendarEvent) {
  return typeof event.employeeName === 'string' && event.employeeName.trim().length > 0
    ? event.employeeName.trim()
    : 'MaridOne Staff';
}

export function getCalendarEventKey(event: CalendarEvent) {
  if (typeof event.calendarId === 'number') return `calendar-${event.calendarId}`;

  return [
    getCalendarEventTitle(event),
    event.startDate ?? '',
    event.endDate ?? '',
    typeof event.day === 'number' ? String(event.day) : '',
  ].join('|');
}

export function formatAnnouncementDateTime(value?: string, fallback = 'Date not available') {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  const formattedDate = date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${formattedDate} at ${formattedTime}`;
}

export function formatAnnouncementCreatedAt(value?: string) {
  return formatAnnouncementDateTime(value, 'Created date not available');
}

export function formatAnnouncementMeta(employeeName?: string, createdAt?: string) {
  const author = typeof employeeName === 'string' && employeeName.trim().length > 0
    ? employeeName.trim()
    : 'MaridOne Staff';
  const createdLabel = formatAnnouncementCreatedAt(createdAt);

  return createdLabel === 'Created date not available'
    ? `Posted by ${author}`
    : `Posted by ${author} | ${createdLabel}`;
}

export function formatAnnouncementEventDuration(startDate?: string, endDate?: string) {
  if (!startDate) return 'Event duration not available';

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 'Event duration not available';

  const formattedStartDate = start.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedStartTime = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!endDate) return `${formattedStartDate} at ${formattedStartTime}`;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return `${formattedStartDate} at ${formattedStartTime}`;

  const formattedEndDate = end.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedEndTime = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (formattedStartDate === formattedEndDate) {
    return `${formattedStartDate} from ${formattedStartTime} to ${formattedEndTime}`;
  }

  return `${formattedStartDate} at ${formattedStartTime} - ${formattedEndDate} at ${formattedEndTime}`;
}

export function formatBalanceHours(value?: number | string | null) {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : 0;
  if (Number.isNaN(num)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(num);
}

export function getLeaveTypeLabel(type?: string) {
  switch (type) {
    case 'SICK_LEAVE': return 'Sick Leave';
    case 'VACATION_LEAVE': return 'Vacation Leave';
    case 'MATERNITY_LEAVE': return 'Maternity Leave';
    case 'PATERNITY_LEAVE': return 'Paternity Leave';
    case 'SOLO_PARENT_LEAVE': return 'Solo Parent';
    case 'MAGNA_CARTA': return 'Magna Carta';
    case 'RA9262': return 'RA 9262';
    case 'EMERGENCY_LEAVE': return 'Emergency Leave';
    default: return type?.replace(/_/g, ' ') || 'Leave';
  }
}

export function getLeaveMaxHours(type?: string) {
  if (!type) return 40;
  return 40;
}

export function getApprovedUpcomingLeave(rows: unknown) {
  const payload =
    rows && typeof rows === 'object' && 'content' in rows
      ? (rows as { content?: unknown }).content
      : rows;
  const list = toArray<LeaveRequestRow>(payload);

  return (
    list
      .filter(
        (leave) =>
          leave.requestStatus === 'APPROVED' &&
          Boolean(leave.startDateTime) &&
          new Date(leave.startDateTime as string) > new Date()
      )
      .sort(
        (left, right) =>
          new Date(left.startDateTime ?? '').getTime() - new Date(right.startDateTime ?? '').getTime()
      )[0] ?? null
  );
}

export function calculateNextDayOff(
  approvedLeaves: LeaveRequestRow[],
  shiftSchedule: ShiftScheduleRow[]
) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  // Scan next 30 days
  for (let i = 0; i < 30; i++) {
    const cursor = new Date(tomorrow);
    cursor.setDate(cursor.getDate() + i);
    const cursorKey = cursor.toISOString().slice(0, 10);
    const dayName = daysOfWeek[cursor.getDay()];

    // 1. Check approved leaves for this exact date
    const leaveOnDay = approvedLeaves.find(l => {
      if (!l.startDateTime) return false;
      const lStart = l.startDateTime.slice(0, 10);
      const lEnd = l.endDateTime?.slice(0, 10) || lStart;
      return cursorKey >= lStart && cursorKey <= lEnd;
    });

    if (leaveOnDay) {
      return {
        date: cursor.toISOString(),
        reason: getLeaveTypeLabel(leaveOnDay.leaveType),
        isLeave: true
      };
    }

    // 2. Check regular schedule (if day is missing or has no hours, it's a day off)
    const scheduleForDay = shiftSchedule.find(s => s.dayOfWeek === dayName);
    const isScheduledWorkDay = scheduleForDay && scheduleForDay.startTime && scheduleForDay.endTime;

    if (!isScheduledWorkDay) {
      return {
        date: cursor.toISOString(),
        reason: 'Scheduled Day Off',
        isLeave: false
      };
    }
  }

  return null;
}

export function getCalendarEventsByDay(events: CalendarEvent[], year: number, monthIndex: number) {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const eventsByDay = new Map<number, Map<string, CalendarDayEvent>>();

  for (const event of events) {
    const eventItem: CalendarDayEvent = {
      key: getCalendarEventKey(event),
      calendarId: event.calendarId,
      title: getCalendarEventTitle(event),
      description: getCalendarEventDescription(event),
      startDate: event.startDate,
      endDate: event.endDate,
      createdAt: event.createdAt,
      employeeId: event.employeeId,
      employeeName: getCalendarEventEmployeeName(event),
    };

    function addEventToDay(day: number) {
      const existing = eventsByDay.get(day) ?? new Map<string, CalendarDayEvent>();
      existing.set(eventItem.key, eventItem);
      eventsByDay.set(day, existing);
    }

    if (!event.startDate && typeof event.day === 'number') {
      addEventToDay(event.day);
      continue;
    }

    if (!event.startDate) continue;

    const rawStart = new Date(event.startDate);
    if (Number.isNaN(rawStart.getTime())) continue;

    const rawEnd = event.endDate ? new Date(event.endDate) : rawStart;
    const safeEnd = Number.isNaN(rawEnd.getTime()) ? rawStart : rawEnd;
    const visibleStart = rawStart > monthStart ? rawStart : monthStart;
    const visibleEnd = safeEnd < monthEnd ? safeEnd : monthEnd;

    if (visibleStart > visibleEnd) continue;

    const cursor = new Date(
      visibleStart.getFullYear(),
      visibleStart.getMonth(),
      visibleStart.getDate()
    );
    const endDay = new Date(
      visibleEnd.getFullYear(),
      visibleEnd.getMonth(),
      visibleEnd.getDate()
    );

    while (cursor <= endDay) {
      if (cursor.getFullYear() === year && cursor.getMonth() === monthIndex) {
        addEventToDay(cursor.getDate());
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return new Map(
    Array.from(eventsByDay.entries())
      .sort(([left], [right]) => left - right)
      .map(([day, dayEvents]) => [day, Array.from(dayEvents.values())])
  );
}

