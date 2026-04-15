import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FiDownload, FiEdit2, FiFileText, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionButton from '../../../components/button/ActionButton';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import MaterialArt from '../../../components/document/MaterialArt';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import {
  downloadLibraryDocument,
  handbookLibraryCard,
  openLibraryDocument,
} from '../../../lib/materialLibrary';
import { getSelfServicePath } from '../../../lib/roleRoutes';
import { getAuthToken, getUserEmail, getUserRole } from '../../../lib/session';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import { getManilaNow } from '../../../lib/manilaTime';
import './Dashboard.css';

type UserDetails = {
  username?: string;
  employeeId?: number;
  twoFactorEnabled?: boolean;
  canChangePasswordNow?: boolean;
  passwordChangeAvailableAt?: string;
  employee?: {
    employeeId?: number;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    contactNumber?: string;
    phoneNumber?: string;
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
    emergencyContactName?: string;
    emergencyContactRelationship?: string;
    emergencyContactNumber?: string;
  };
};

type CalendarEvent = {
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

type CalendarDayEvent = {
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

type SelectedAnnouncementDay = {
  label: string;
  events: CalendarDayEvent[];
};

type AttendanceLog = {
  timestamp?: string;
};

type AnnouncementDraft = {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
};

function padDateTimePart(value: number) {
  return String(value).padStart(2, '0');
}

function toDateTimeLocalValue(value: Date) {
  return `${value.getFullYear()}-${padDateTimePart(value.getMonth() + 1)}-${padDateTimePart(value.getDate())}T${padDateTimePart(value.getHours())}:${padDateTimePart(value.getMinutes())}`;
}

function createAnnouncementDraft(baseDate?: Date): AnnouncementDraft {
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

function syncAnnouncementRange(startDateTime: string, endDateTime: string) {
  if (!startDateTime) return endDateTime;
  if (!endDateTime || endDateTime < startDateTime) return startDateTime;
  return endDateTime;
}

function createEditDraft(source: UserDetails['employee'] | null | undefined) {
  const rawAddress =
    source && typeof source.address === 'object' && source.address
      ? (source.address as Record<string, unknown>)
      : {};

  return {
    email: typeof source?.email === 'string' ? source.email : '',
    phoneNumber:
      typeof source?.phoneNumber === 'string'
        ? source.phoneNumber
        : typeof source?.contactNumber === 'string'
          ? source.contactNumber
          : '',
    permanentAddress: typeof rawAddress.permanentAddress === 'string' ? rawAddress.permanentAddress : '',
    temporaryAddress: typeof rawAddress.temporaryAddress === 'string' ? rawAddress.temporaryAddress : '',
    city: typeof rawAddress.city === 'string' ? rawAddress.city : '',
    state: typeof rawAddress.state === 'string' ? rawAddress.state : '',
    country: typeof rawAddress.country === 'string' ? rawAddress.country : '',
    zipCode: typeof rawAddress.zipCode === 'string' ? rawAddress.zipCode : '',
    sssNumber: typeof source?.sssNumber === 'string' ? source.sssNumber : '',
    philhealthNumber: typeof source?.philhealthNumber === 'string' ? source.philhealthNumber : '',
    pagibigNumber: typeof source?.pagibigNumber === 'string' ? source.pagibigNumber : '',
    tinNumber: typeof source?.tinNumber === 'string' ? source.tinNumber : '',
    emergencyContactName: typeof source?.emergencyContactName === 'string' ? source.emergencyContactName : '',
    emergencyContactRelationship: typeof source?.emergencyContactRelationship === 'string' ? source.emergencyContactRelationship : '',
    emergencyContactNumber: typeof source?.emergencyContactNumber === 'string' ? source.emergencyContactNumber : '',
  };
}

function isEmailVerified(value: UserDetails['employee'] | null | undefined) {
  const rawValue = value?.isVerified;

  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'verified') return true;
    if (normalized === 'false' || normalized === 'unverified') return false;
  }

  return false;
}

function formatAddress(value: unknown) {
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

function formatDashboardDate(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDashboardDateTime(value?: string) {
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

function formatJwtIssuedAt(token: string | null) {
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

function getCalendarEventTitle(event: CalendarEvent) {
  return typeof event.title === 'string' && event.title.trim().length > 0
    ? event.title.trim()
    : 'Company event';
}

function getCalendarEventDescription(event: CalendarEvent) {
  return typeof event.description === 'string' ? event.description.trim() : '';
}

function getCalendarEventEmployeeName(event: CalendarEvent) {
  return typeof event.employeeName === 'string' && event.employeeName.trim().length > 0
    ? event.employeeName.trim()
    : 'MaridOne Staff';
}

function getCalendarEventKey(event: CalendarEvent) {
  if (typeof event.calendarId === 'number') return `calendar-${event.calendarId}`;

  return [
    getCalendarEventTitle(event),
    event.startDate ?? '',
    event.endDate ?? '',
    typeof event.day === 'number' ? String(event.day) : '',
  ].join('|');
}

function formatCalendarEventDateRange(startDate?: string, endDate?: string) {
  if (!startDate) return 'Date not available';

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 'Date not available';

  const formattedStart = start.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (!endDate) return formattedStart;

  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return formattedStart;

  const formattedEnd = end.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return formattedStart === formattedEnd ? formattedStart : `${formattedStart} - ${formattedEnd}`;
}

function formatAnnouncementCreatedAt(value?: string) {
  if (!value) return 'Created date not available';

  const createdAt = new Date(value);
  if (Number.isNaN(createdAt.getTime())) return 'Created date not available';

  return createdAt.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type LeaveBalanceRow = {
  leaveId?: number;
  balanceHours?: number | string | null;
  leaveType?: string;
};

type LeaveRequestRow = {
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  leaveType?: string;
};

type ShiftScheduleRow = {
  shiftId?: number;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
};

function formatBalanceHours(value?: number | string | null) {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : 0;
  if (Number.isNaN(num)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(num);
}

function getLeaveTypeLabel(type?: string) {
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

function getLeaveMaxHours(_type?: string) {
  return 40;
}

function calculateNextDayOff(
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

function getCalendarEventsByDay(events: CalendarEvent[], year: number, monthIndex: number) {
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

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showError, showSuccess } = useUiDialog();
  const userRole = getUserRole() ?? 'employee';
  const [profile, setProfile] = useState<UserDetails | null>(null);
  const [employee, setEmployee] = useState<UserDetails['employee'] | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [lastLoginLabel, setLastLoginLabel] = useState<string>('Not available');
  const [lastAttendanceLabel, setLastAttendanceLabel] = useState<string>('Not available');
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [shiftSchedule, setShiftSchedule] = useState<ShiftScheduleRow[]>([]);
  const [nextLeave, setNextLeave] = useState<LeaveRequestRow | null>(null);
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(() => getManilaNow().month - 1);
  const [calendarYear, setCalendarYear] = useState(() => getManilaNow().year);
  const [refreshTick, setRefreshTick] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmEmailChangeOpen, setConfirmEmailChangeOpen] = useState(false);
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [createAnnouncementError, setCreateAnnouncementError] = useState('');
  const [createAnnouncementSubmitAttempted, setCreateAnnouncementSubmitAttempted] = useState(false);
  const [selectedAnnouncementDay, setSelectedAnnouncementDay] = useState<SelectedAnnouncementDay | null>(null);
  const [announcementActionError, setAnnouncementActionError] = useState('');
  const [announcementPendingDelete, setAnnouncementPendingDelete] = useState<CalendarDayEvent | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<number | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState<AnnouncementDraft>(() => createAnnouncementDraft());
  const [editDraft, setEditDraft] = useState({
    email: '',
    phoneNumber: '',
    permanentAddress: '',
    temporaryAddress: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    sssNumber: '',
    philhealthNumber: '',
    pagibigNumber: '',
    tinNumber: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactNumber: '',
  });

  useErrorDialogEffect(editError, 'Profile changes could not be saved');
  useErrorDialogEffect(createAnnouncementError, 'Announcement could not be created');
  useErrorDialogEffect(announcementActionError, 'Announcement action failed');
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useEscapeDismiss(Boolean(selectedAnnouncementDay), closeAnnouncementDay, 10);
  useEscapeDismiss(createAnnouncementOpen && !creatingAnnouncement, closeCreateAnnouncementModal, 10);
  useEscapeDismiss(editOpen && !savingEdit && !confirmEmailChangeOpen, closeEditModal, 10);
  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled:
      !editOpen &&
      !createAnnouncementOpen &&
      !selectedAnnouncementDay &&
      !announcementPendingDelete &&
      !savingEdit &&
      !creatingAnnouncement,
  });

  useEffect(() => {
    setLastLoginLabel(formatJwtIssuedAt(getAuthToken()));
  }, [refreshTick]);

  useEffect(() => {
    if (
      editOpen ||
      createAnnouncementOpen ||
      selectedAnnouncementDay ||
      announcementPendingDelete
    ) {
      document.body.classList.add('modal-open');
    }
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [announcementPendingDelete, createAnnouncementOpen, editOpen, selectedAnnouncementDay]);

  useEffect(() => {
    const username = getUserEmail();
    if (!username) return;

    void (async () => {
      try {
        const details = await apiFetchJson<UserDetails>(`/api/user/details/${encodeURIComponent(username)}`);
        setProfile(details);

        const fromUser =
          details.employee && typeof details.employee === 'object' ? details.employee : null;
        const resolvedEmpId =
          typeof details.employeeId === 'number'
            ? details.employeeId
            : typeof fromUser?.employeeId === 'number'
              ? fromUser.employeeId
              : null;
        setEmployeeId(resolvedEmpId ?? null);

        if (resolvedEmpId) {
          // fetch leave balances
          void apiFetchJson<unknown>(`/api/leave/balance/${resolvedEmpId}`)
            .then(balances => setLeaveBalances(toArray<LeaveBalanceRow>(balances).filter(b => b.leaveType !== 'BEREAVEMENT_LEAVE')))
            .catch(() => setLeaveBalances([]));

          // fetch shift schedule
          void apiFetchJson<unknown>(`/api/employee/schedule/${resolvedEmpId}`)
            .then(schedule => setShiftSchedule(toArray<ShiftScheduleRow>(schedule)))
            .catch(() => setShiftSchedule([]));

          // fetch upcoming leaves
          void apiFetchJson<unknown>(`/api/leave/request/${resolvedEmpId}`)
            .then(leaves => {
              // Page object response from backend
              const list = (leaves as any)?.content || toArray<LeaveRequestRow>(leaves);
              const upcoming = list
                .filter((l: any) => l.requestStatus === 'APPROVED' && l.startDateTime && new Date(l.startDateTime) > new Date())
                .sort((a: any, b: any) => new Date(a.startDateTime!).getTime() - new Date(b.startDateTime!).getTime())[0];
              setNextLeave(upcoming || null);
            })
            .catch(() => setNextLeave(null));
        }

        if (fromUser) {
          setEmployee(fromUser);
          setEditDraft(createEditDraft(fromUser));
          const empId = typeof fromUser.employeeId === 'number' ? fromUser.employeeId : resolvedEmpId;
          if (empId) {
            try {
              const attendance = await apiFetchJson<unknown>(`/api/logs/attendance/self/${empId}?page=0&size=1`);
              const first = toArray<AttendanceLog>(attendance)[0];
              if (first?.timestamp) {
                setLastAttendanceLabel(formatDashboardDateTime(first.timestamp));
              } else {
                setLastAttendanceLabel('Not available');
              }
            } catch {
              setLastAttendanceLabel('Not available');
            }
          }
          return;
        }

        if (resolvedEmpId) {
          const selfEmployee = await apiFetchJson<UserDetails['employee']>(
            `/api/employees/${resolvedEmpId}`
          );
          setEmployee(selfEmployee);
          setEditDraft(createEditDraft(selfEmployee));
          try {
            const attendance = await apiFetchJson<unknown>(`/api/logs/attendance/self/${resolvedEmpId}?page=0&size=1`);
            const first = toArray<AttendanceLog>(attendance)[0];
            if (first?.timestamp) {
              setLastAttendanceLabel(formatDashboardDateTime(first.timestamp));
            } else {
              setLastAttendanceLabel('Not available');
            }
          } catch {
            setLastAttendanceLabel('Not available');
          }
          return;
        }

        setEmployee(null);
      } catch {
        setProfile(null);
        setEmployee(null);
        setLastAttendanceLabel('Not available');
      }
    })();
  }, []);

  useEffect(() => {
    const month = calendarMonthIndex + 1;
    const year = calendarYear;
    void (async () => {
      const eventsResponse = await apiFetchJson<unknown>(`/api/calendar/events?month=${month}&year=${year}`)
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch(() => ({ status: 'rejected' as const }));

      if (eventsResponse.status === 'fulfilled') {
        setCalendarEvents(toArray<CalendarEvent>(eventsResponse.value));
      } else {
        setCalendarEvents([]);
      }
    })();
  }, [calendarMonthIndex, calendarYear, refreshTick]);

  const monthLabel = new Date(calendarYear, calendarMonthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const year = calendarYear;
  const monthIndex = calendarMonthIndex;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBasedStart = firstDay.getDay();
  const calendarWeekRows = Math.ceil((sundayBasedStart + daysInMonth) / 7);
  const totalCells = calendarWeekRows * 7;
  const calendarGridStyle = { '--calendar-week-rows': calendarWeekRows } as CSSProperties;

  const employeeName = useMemo(() => {
    const emp = employee;
    const fromParts = [emp?.firstName, emp?.middleName, emp?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    return emp?.fullName || fromParts || 'Employee Name';
  }, [employee]);

  const calendarEventsByDay = useMemo(
    () => getCalendarEventsByDay(calendarEvents, calendarYear, calendarMonthIndex),
    [calendarEvents, calendarMonthIndex, calendarYear]
  );
  const announcementHeaderEvent = selectedAnnouncementDay?.events[0] ?? null;
  const canManageAnnouncements =
    location.pathname.startsWith('/hr/') || location.pathname.startsWith('/management/');
  const savedEmailNormalized = employee?.email?.trim().toLowerCase() ?? '';
  const draftEmailNormalized = editDraft.email.trim().toLowerCase();
  const emailChanged = Boolean(draftEmailNormalized && draftEmailNormalized !== savedEmailNormalized);
  const emailVerified = isEmailVerified(employee);
  const emailVerificationWillReset = emailVerified && emailChanged;

  function selfServicePath(page: 'dashboard' | 'attendance' | 'approvals' | 'payslip' | 'training') {
    if (location.pathname.startsWith('/hr/')) {
      return getSelfServicePath('hr', page);
    }

    if (location.pathname.startsWith('/manager/')) {
      return getSelfServicePath('manager', page);
    }

    if (location.pathname.startsWith('/management/')) {
      return getSelfServicePath('management', page);
    }

    return getSelfServicePath('employee', page);
  }

  function attendanceOverviewPath() {
    if (userRole === 'manager') return '/manager/attendance-dashboard';
    if (userRole === 'management') return '/management/attendance';
    if (userRole === 'hr') return '/hr/attendance-reports';
    return selfServicePath('attendance');
  }

  const dashboardActions =
    userRole === 'manager'
      ? [
          { label: 'View Payslip', path: selfServicePath('payslip') },
          { label: 'View My Attendance', path: selfServicePath('attendance') },
          { label: 'View Team Attendance', path: attendanceOverviewPath() },
          { label: 'Request Leave', path: selfServicePath('attendance') },
        ]
      : userRole === 'hr' || userRole === 'management'
        ? [
            { label: 'View Payslip', path: selfServicePath('payslip') },
            { label: 'View My Attendance', path: selfServicePath('attendance') },
            { label: 'View Company Attendance', path: attendanceOverviewPath() },
            { label: 'Request Leave', path: selfServicePath('attendance') },
          ]
        : [
            { label: 'View Payslip', path: selfServicePath('payslip') },
            { label: 'View Attendance', path: selfServicePath('attendance') },
            { label: 'Request Overtime', path: selfServicePath('attendance') },
            { label: 'Request Leave', path: selfServicePath('attendance') },
          ];

  function shiftCalendarMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonthIndex + offset, 1);
    setAnnouncementActionError('');
    setAnnouncementPendingDelete(null);
    setDeletingAnnouncementId(null);
    setSelectedAnnouncementDay(null);
    setCalendarYear(next.getFullYear());
    setCalendarMonthIndex(next.getMonth());
  }

  function openAnnouncementDay(dayNumber: number, events: CalendarDayEvent[]) {
    const label = new Date(calendarYear, calendarMonthIndex, dayNumber).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    setAnnouncementActionError('');
    setSelectedAnnouncementDay({ label, events });
  }

  function closeAnnouncementDay() {
    setAnnouncementActionError('');
    setAnnouncementPendingDelete(null);
    setDeletingAnnouncementId(null);
    setSelectedAnnouncementDay(null);
  }

  function requestDeleteAnnouncement(event: CalendarDayEvent) {
    if (!canManageAnnouncements || typeof event.calendarId !== 'number') return;
    setAnnouncementActionError('');
    setAnnouncementPendingDelete(event);
  }

  function closeDeleteAnnouncementDialog() {
    if (deletingAnnouncementId !== null) return;
    setAnnouncementPendingDelete(null);
  }

  function openCreateAnnouncementModal() {
    setCreateAnnouncementError('');
    setAnnouncementDraft(createAnnouncementDraft());
    setCreateAnnouncementSubmitAttempted(false);
    setCreateAnnouncementOpen(true);
  }

  function closeCreateAnnouncementModal() {
    if (creatingAnnouncement) return;
    setCreateAnnouncementOpen(false);
    setCreateAnnouncementError('');
    setCreateAnnouncementSubmitAttempted(false);
    setAnnouncementDraft(createAnnouncementDraft());
  }

  function setAnnouncementDraftField<K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) {
    setAnnouncementDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setAnnouncementStartDateTime(value: string) {
    setAnnouncementDraft((prev) => ({
      ...prev,
      startDateTime: value,
      endDateTime: syncAnnouncementRange(value, prev.endDateTime),
    }));
  }

  async function submitAnnouncement() {
    setCreateAnnouncementSubmitAttempted(true);
    const title = announcementDraft.title.trim();
    const description = announcementDraft.description.trim();
    const startDate = announcementDraft.startDateTime ? new Date(announcementDraft.startDateTime) : null;
    const endDate = announcementDraft.endDateTime ? new Date(announcementDraft.endDateTime) : null;

    if (!title) {
      setCreateAnnouncementError('Announcement title is required.');
      return;
    }

    if (title.length > 120) {
      setCreateAnnouncementError('Announcement title must be 120 characters or fewer.');
      return;
    }

    if (description.length > 500) {
      setCreateAnnouncementError('Announcement description must be 500 characters or fewer.');
      return;
    }

    if (!startDate || Number.isNaN(startDate.getTime())) {
      setCreateAnnouncementError('Start date and time are required.');
      return;
    }

    if (!endDate || Number.isNaN(endDate.getTime())) {
      setCreateAnnouncementError('End date and time are required.');
      return;
    }

    if (endDate < startDate) {
      setCreateAnnouncementError('End date and time must be after the start date and time.');
      return;
    }

    setCreateAnnouncementError('');
    setCreatingAnnouncement(true);

    try {
      const createdAnnouncement = await apiFetchJson<CalendarEvent>('/api/calendar/events/create', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isActive: true,
        }),
      });

      setCalendarEvents((prev) => {
        const next = prev.filter((event) => event.calendarId !== createdAnnouncement.calendarId);
        next.push(createdAnnouncement);
        return next;
      });

      setCreateAnnouncementOpen(false);
      setAnnouncementDraft(createAnnouncementDraft());
    } catch (error) {
      setCreateAnnouncementError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setCreatingAnnouncement(false);
    }
  }

  async function handleDeleteAnnouncement() {
    const event = announcementPendingDelete;
    if (!canManageAnnouncements || typeof event?.calendarId !== 'number') return;

    setAnnouncementActionError('');
    setDeletingAnnouncementId(event.calendarId);

    try {
      await apiFetchJson(`/api/calendar/events/delete/${event.calendarId}`, {
        method: 'PATCH',
      });

      setCalendarEvents((prev) => prev.filter((item) => item.calendarId !== event.calendarId));
      setSelectedAnnouncementDay((prev) => {
        if (!prev) return prev;
        const remainingEvents = prev.events.filter((item) => item.calendarId !== event.calendarId);
        return remainingEvents.length > 0 ? { ...prev, events: remainingEvents } : null;
      });
    } catch (error) {
      setAnnouncementActionError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setAnnouncementPendingDelete(null);
      setDeletingAnnouncementId(null);
    }
  }

  async function openHandbook() {
    try {
      await openLibraryDocument(handbookLibraryCard.document);
    } catch (error) {
      showError(getFriendlyErrorMessage(error, 'generic'), 'Unable to open handbook');
    }
  }

  async function downloadHandbook() {
    try {
      await downloadLibraryDocument(handbookLibraryCard.document);
    } catch (error) {
      showError(getFriendlyErrorMessage(error, 'generic'), 'Unable to download handbook');
    }
  }

  function openEditModal() {
    setEditError('');
    setEditDraft(createEditDraft(employee));
    setEditOpen(true);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditOpen(false);
    setConfirmEmailChangeOpen(false);
    setEditError('');
    setEditDraft(createEditDraft(employee));
  }

  function setEditField<K extends keyof typeof editDraft>(key: K, value: (typeof editDraft)[K]) {
    setEditDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function runEditInfoSubmit() {
    if (!employeeId) {
      setEditError('Employee profile cannot be updated right now.');
      return;
    }

    setEditError('');
    setSavingEdit(true);
    try {
      await apiFetchJson(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: editDraft.email.trim() || undefined,
          phoneNumber: editDraft.phoneNumber.trim() || undefined,
          sssNumber: editDraft.sssNumber.trim() || undefined,
          philhealthNumber: editDraft.philhealthNumber.trim() || undefined,
          pagibigNumber: editDraft.pagibigNumber.trim() || undefined,
          tinNumber: editDraft.tinNumber.trim() || undefined,
          emergencyContactName: editDraft.emergencyContactName.trim() || undefined,
          emergencyContactRelationship: editDraft.emergencyContactRelationship.trim() || undefined,
          emergencyContactNumber: editDraft.emergencyContactNumber.trim() || undefined,
          address: {
            permanentAddress: editDraft.permanentAddress.trim() || undefined,
            temporaryAddress: editDraft.temporaryAddress.trim() || undefined,
            city: editDraft.city.trim() || undefined,
            state: editDraft.state.trim() || undefined,
            country: editDraft.country.trim() || undefined,
            zipCode: editDraft.zipCode.trim() || undefined,
          },
        }),
      });
      const refreshed = await apiFetchJson<UserDetails['employee']>(`/api/employees/${employeeId}`);
      setEmployee(refreshed);
      setEditDraft(createEditDraft(refreshed));
      setEditOpen(false);
      if (emailChanged) {
        showSuccess(
          emailVerified
            ? 'Profile updated. Your email now needs a fresh verification link from Settings because the saved address changed.'
            : 'Profile updated. If you want to verify this saved email, you can do that from Settings.',
          'Profile Updated'
        );
      }
    } catch (error) {
      setEditError(getFriendlyErrorMessage(error, 'profile-update'));
    } finally {
      setSavingEdit(false);
    }
  }

  async function submitEditInfo() {
    if (emailVerificationWillReset) {
      setConfirmEmailChangeOpen(true);
      return;
    }
    await runEditInfoSubmit();
  }

  return (
    <div className="dashPage">
      <PageHeader
        title="Dashboard"
        description="Review your profile, quick actions, and company events from one workspace."
      />

      {/* INFO CARD */}
      <section className="infoCardX">
        <button
          className="infoCardX__edit"
          type="button"
          onClick={openEditModal}
          disabled={savingEdit}
          aria-label="Edit information"
          title="Edit information"
        >
          <FiEdit2 aria-hidden="true" />
        </button>

        <div className="infoCardX__grid">
          {/* left: Identity */}
          <div className="infoCardX__left">
            <div className="infoCardX__photo" aria-hidden="true" />
            <div className="infoCardX__bio">
              <div className="infoCardX__name">{employeeName}</div>
              <div className="statBlock__sub">
                Joined {formatDashboardDate(employee?.employmentDateStart || employee?.employmentDate || employee?.dateHired)}
              </div>
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* middle: Contacts */}
          <div className="infoCardX__mid">
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span className="infoRow__link">{employee?.email || profile?.username || 'Email not available'}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">☎</span>
              <span>{employee?.phoneNumber || employee?.contactNumber || 'Phone not available'}</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">⌂</span>
              <span>{formatAddress(employee?.address)}</span>
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* right: Activity Stats */}
          <div className="infoCardX__right">
            <div className="statBlock">
              <div className="statBlock__label">Last Portal Login</div>
              <div className="statBlock__value">{lastLoginLabel}</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Recent Attendance</div>
              <div className="statBlock__value">{lastAttendanceLabel}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <section className="actionRowX">
        {dashboardActions.map((action) => (
          <button
            key={action.label}
            className="actionBtnX"
            type="button"
            onClick={() => navigate(action.path)}
          >
            <span>{action.label}</span>
            <span className="actionBtnX__arrow">→</span>
          </button>
        ))}
      </section>

      {/* LOWER */}
      <section className="lowerGridX">
        {/* left column */}
        <div className="lowerColX">
          {/* time off summary card */}
          <div className="cardX">
            <div className="cardX__title">Time-Off & Balances</div>
            
            <div className="leaveSplitLayout">
              {/* Left: Next Day Off */}
              <div className="leaveSplitLayout__next">
                {(() => {
                  const nextOff = calculateNextDayOff(
                    toArray<LeaveRequestRow>(nextLeave ? [nextLeave] : []),
                    shiftSchedule
                  );

                  if (!nextOff) {
                    return (
                      <div className="nextDayOffEmpty">
                        <div className="nextDayOffEmpty__icon">📅</div>
                        <p>No upcoming time-off scheduled.</p>
                      </div>
                    );
                  }

                  const dateObj = new Date(nextOff.date);
                  const monthShort = dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                  const dayNum = dateObj.getDate();
                  const dayShort = dateObj.toLocaleDateString(undefined, { weekday: 'short' });

                  return (
                    <div className="nextDayOff">
                      <div className="nextDayOff__label">
                        {nextOff.isLeave ? 'Next Approved Leave' : 'Next Day Off'}
                      </div>
                      <div className="nextDayOff__badge">
                        <div className="nextDayOff__badgeMonth">{monthShort}</div>
                        <div className="nextDayOff__badgeNum">{dayNum}</div>
                        <div className="nextDayOff__badgeDay">{dayShort}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: Balances */}
              <div className="leaveSplitLayout__bars">
                {leaveBalances.length > 0 ? (
                  [...leaveBalances]
                    .sort((a, b) => {
                      const prio: Record<string, number> = { SICK_LEAVE: 1, VACATION_LEAVE: 2 };
                      return (prio[a.leaveType || ''] || 99) - (prio[b.leaveType || ''] || 99);
                    })
                    .slice(0, 4)
                    .map((balance) => {
                      const current = typeof balance.balanceHours === 'number' ? balance.balanceHours : parseFloat(balance.balanceHours || '0');
                      const max = getLeaveMaxHours(balance.leaveType);
                      const percentage = Math.min(100, (current / max) * 100);
                      return (
                        <div key={balance.leaveId || balance.leaveType} className="leaveProgress">
                          <div className="leaveProgress__top">
                            <span className="leaveProgress__type">{getLeaveTypeLabel(balance.leaveType)}</span>
                            <span className="leaveProgress__value">{formatBalanceHours(balance.balanceHours)}h</span>
                          </div>
                          <div className="leaveProgress__barWrap">
                            <div className="leaveProgress__bar" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="leaveBalancesX__empty">No leave balances available.</div>
                )}
                {leaveBalances.length > 4 && (
                  <button
                    type="button"
                    className="leaveBalancesX__more"
                    onClick={() => navigate(selfServicePath('attendance'))}
                  >
                    View All Balances →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* handbook */}
          <div className="cardX">
            <div className="cardX__title">Company Handbook</div>

            <div className="handbookRow">
              <div className="handbookRow__main">
                <div className="handbookRow__artWrap" aria-hidden="true">
                  <MaterialArt kind={handbookLibraryCard.artKind} className="handbookRow__art" />
                </div>
                <div className="handbookRow__text">
                  <div className="handbookRow__name">{handbookLibraryCard.heading}</div>
                  <p className="handbookRow__intro u-line-clamp-2">{handbookLibraryCard.introduction}</p>
                </div>
              </div>
              <div className="handbookRow__actions">
                <ActionButton className="handbookBtn" size="sm" icon={<FiFileText />} type="button" onClick={() => void openHandbook()}>
                  {handbookLibraryCard.viewLabel}
                </ActionButton>
                <ActionButton className="handbookBtn" size="sm" icon={<FiDownload />} type="button" onClick={() => void downloadHandbook()}>
                  {handbookLibraryCard.downloadLabel}
                </ActionButton>
              </div>
            </div>
          </div>
        </div>

        {/* right calendar */}
        <div className="cardX cardX--calendar">
          <div className="cardX__titleBar">
            <div className="cardX__title">Company Events</div>
            {canManageAnnouncements ? (
              <button type="button" className="cardX__manageBtn" onClick={openCreateAnnouncementModal}>
                <FiPlus aria-hidden="true" />
                <span>Create Announcement</span>
              </button>
            ) : null}
          </div>
          <div className="calendarShell" aria-label="Company events calendar">
            <div className="calendarShell__top">
              <button type="button" className="calendarShell__navBtn" onClick={() => shiftCalendarMonth(-1)} aria-label="Previous month">‹</button>
              <strong>{monthLabel}</strong>
              <button type="button" className="calendarShell__navBtn" onClick={() => shiftCalendarMonth(1)} aria-label="Next month">›</button>
            </div>

            <div className="calendarGrid" style={calendarGridStyle}>
              <div className="calHead">SU</div><div className="calHead">MO</div><div className="calHead">TU</div>
              <div className="calHead">WE</div><div className="calHead">TH</div><div className="calHead">FR</div><div className="calHead">SA</div>

              {Array.from({ length: totalCells }).map((_, i) => {
                const dayNumber = i - sundayBasedStart + 1;
                const value = dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : '';
                const dayEvents = typeof value === 'number' ? calendarEventsByDay.get(value) ?? [] : [];
                const primaryDayEvent = dayEvents[0];
                const dayLabel =
                  typeof value === 'number'
                    ? new Date(calendarYear, calendarMonthIndex, value).toLocaleDateString(undefined, {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';
                const cellTitle =
                  dayEvents.length > 0
                    ? `${dayEvents.map((event) => event.title).join(' • ')}. Click to view announcement details.`
                    : undefined;
                const cellContent = (
                  <>
                    {typeof value === 'number' ? <span className="calCell__day">{value}</span> : null}
                    {primaryDayEvent ? (
                      <div className="calCell__events">
                        <span className="calCell__event">{primaryDayEvent.title}</span>
                        {dayEvents.length > 1 ? (
                          <span className="calCell__more">+{dayEvents.length - 1} more</span>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                );

                if (dayEvents.length > 0 && typeof value === 'number') {
                  return (
                  <button
                    key={i}
                    type="button"
                    className="calCell calCell--button is-event"
                    title={cellTitle}
                    aria-label={`View ${dayEvents.length} company announcement${dayEvents.length === 1 ? '' : 's'} for ${dayLabel}`}
                    onClick={() => openAnnouncementDay(value, dayEvents)}
                  >
                    {cellContent}
                  </button>
                  );
                }

                return (
                  <div key={i} className="calCell" title={cellTitle}>
                    {cellContent}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {selectedAnnouncementDay && (
        <div className="dashModalBackdrop" role="dialog" aria-modal="true" aria-label="Company announcements">
          <div className="dashModal dashModal--announcement">
            <div className="dashModal__top">
              <div>
                <div className="dashModal__title">{announcementHeaderEvent?.employeeName || 'MaridOne Staff'}</div>
                <div className="dashModal__subtitle">{formatAnnouncementCreatedAt(announcementHeaderEvent?.createdAt)}</div>
              </div>
              <ModalCloseButton className="dashModal__close" onClick={closeAnnouncementDay} />
            </div>

            <div className="dashModal__rule" />

            <div className="announcementModal__list">
              {selectedAnnouncementDay.events.map((event) => {
                const isDeleting = deletingAnnouncementId === event.calendarId;

                return (
                  <article key={event.key} className="announcementModal__card">
                    <div className="announcementModal__titleRow">
                      <h3 className="announcementModal__title">{event.title}</h3>
                      <div className="announcementModal__dates">
                        {formatCalendarEventDateRange(event.startDate, event.endDate)}
                      </div>
                    </div>
                    <p>{event.description || 'No description provided for this announcement yet.'}</p>
                    {canManageAnnouncements && typeof event.calendarId === 'number' ? (
                      <div className="announcementModal__deleteRow">
                        <button
                          type="button"
                          className="announcementModal__delete"
                          onClick={() => requestDeleteAnnouncement(event)}
                          disabled={isDeleting}
                          aria-label={`Delete announcement ${event.title}`}
                          title="Delete announcement"
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(announcementPendingDelete)}
        title="Delete Announcement"
        message={
          announcementPendingDelete
            ? `Delete "${announcementPendingDelete.title}" from the company announcements?`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isBusy={deletingAnnouncementId === announcementPendingDelete?.calendarId}
        onConfirm={() => void handleDeleteAnnouncement()}
        onCancel={closeDeleteAnnouncementDialog}
      />

      <ConfirmDialog
        open={confirmEmailChangeOpen}
        title="Confirm Email Change"
        message="Changing your verified email will remove its verified status until you verify the new address again. Do you want to continue saving this profile update?"
        confirmLabel="Continue Saving"
        cancelLabel="Go Back"
        isBusy={savingEdit}
        onConfirm={() => {
          setConfirmEmailChangeOpen(false);
          void runEditInfoSubmit();
        }}
        onCancel={() => setConfirmEmailChangeOpen(false)}
      />

      {createAnnouncementOpen && (
        <div className="dashModalBackdrop" role="dialog" aria-modal="true" aria-label="Create announcement">
          <div className="dashModal">
            <div className="dashModal__top">
              <div>
                <div className="dashModal__title">CREATE ANNOUNCEMENT</div>
                <div className="dashModal__subtitle">Share a company-wide announcement on the calendar.</div>
              </div>
              <ModalCloseButton
                className="dashModal__close"
                onClick={closeCreateAnnouncementModal}
                disabled={creatingAnnouncement}
              />
            </div>

            <div className="dashModal__rule" />

            <div className="dashModal__grid">
              <label className="dashModal__field dashModal__field--full">
                <span>Announcement Title</span>
                <input
                  value={announcementDraft.title}
                  maxLength={120}
                  aria-invalid={
                    createAnnouncementSubmitAttempted && announcementDraft.title.trim().length === 0
                      ? 'true'
                      : undefined
                  }
                  onChange={(event) => setAnnouncementDraftField('title', event.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Start Date and Time</span>
                <input
                  type="datetime-local"
                  value={announcementDraft.startDateTime}
                  aria-invalid={
                    createAnnouncementSubmitAttempted && !announcementDraft.startDateTime ? 'true' : undefined
                  }
                  onChange={(event) => setAnnouncementStartDateTime(event.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>End Date and Time</span>
                <input
                  type="datetime-local"
                  value={announcementDraft.endDateTime}
                  min={announcementDraft.startDateTime || undefined}
                  aria-invalid={
                    createAnnouncementSubmitAttempted && !announcementDraft.endDateTime ? 'true' : undefined
                  }
                  onChange={(event) => setAnnouncementDraftField('endDateTime', event.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Description</span>
                <textarea
                  value={announcementDraft.description}
                  maxLength={500}
                  rows={6}
                  placeholder="Optional announcement details"
                  onChange={(event) => setAnnouncementDraftField('description', event.target.value)}
                />
              </label>
            </div>

            <div className="dashModal__helper">
              {announcementDraft.title.trim().length}/120 title characters
              {' · '}
              {announcementDraft.description.trim().length}/500 description characters
            </div>

            <div className="dashModal__actions">
              <button
                type="button"
                className="dashModal__btn dashModal__btn--ghost"
                onClick={closeCreateAnnouncementModal}
                disabled={creatingAnnouncement}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dashModal__btn"
                onClick={() => void submitAnnouncement()}
                disabled={creatingAnnouncement}
              >
                {creatingAnnouncement ? 'Creating...' : 'Publish Announcement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="dashModalBackdrop" role="dialog" aria-modal="true" aria-label="Edit employee info">
          <div className="dashModal">
            <div className="dashModal__top">
              <div>
                <div className="dashModal__title">EDIT INFO</div>
                <div className="dashModal__subtitle">Update your contact details and address information before saving the changes.</div>
              </div>
              <ModalCloseButton className="dashModal__close" onClick={closeEditModal} disabled={savingEdit} />
            </div>

            <div className="dashModal__rule" />

            <div className="dashModal__grid">
              <label className="dashModal__field">
                <span>Email</span>
                <input
                  value={editDraft.email}
                  placeholder="Optional email address"
                  onChange={(e) => setEditField('email', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Phone Number</span>
                <input
                  value={editDraft.phoneNumber}
                  placeholder="Optional phone number"
                  onChange={(e) => setEditField('phoneNumber', e.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Permanent Address</span>
                <input
                  value={editDraft.permanentAddress}
                  placeholder="Optional permanent address"
                  onChange={(e) => setEditField('permanentAddress', e.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Temporary Address</span>
                <input
                  value={editDraft.temporaryAddress}
                  placeholder="Optional temporary address"
                  onChange={(e) => setEditField('temporaryAddress', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>City</span>
                <input
                  value={editDraft.city}
                  placeholder="Optional city"
                  onChange={(e) => setEditField('city', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>State</span>
                <input
                  value={editDraft.state}
                  placeholder="Optional state"
                  onChange={(e) => setEditField('state', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Country</span>
                <input
                  value={editDraft.country}
                  placeholder="Optional country"
                  onChange={(e) => setEditField('country', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Zip Code</span>
                <input
                  value={editDraft.zipCode}
                  placeholder="Optional ZIP code"
                  onChange={(e) => setEditField('zipCode', e.target.value)}
                />
              </label>

              <div className="dashModal__sectionHeader">Government Identifiers</div>
              <label className="dashModal__field">
                <span>SSS Number</span>
                <input
                  value={editDraft.sssNumber}
                  placeholder="00-0000000-0"
                  onChange={(e) => setEditField('sssNumber', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>PhilHealth ID</span>
                <input
                  value={editDraft.philhealthNumber}
                  placeholder="00-000000000-0"
                  onChange={(e) => setEditField('philhealthNumber', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Pag-IBIG MID</span>
                <input
                  value={editDraft.pagibigNumber}
                  placeholder="0000-0000-0000"
                  onChange={(e) => setEditField('pagibigNumber', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>TIN</span>
                <input
                  value={editDraft.tinNumber}
                  placeholder="000-000-000-000"
                  onChange={(e) => setEditField('tinNumber', e.target.value)}
                />
              </label>

              <div className="dashModal__sectionHeader">Emergency Contact</div>
              <label className="dashModal__field">
                <span>Contact Name</span>
                <input
                  value={editDraft.emergencyContactName}
                  placeholder="Full name"
                  onChange={(e) => setEditField('emergencyContactName', e.target.value)}
                />
              </label>
              <label className="dashModal__field">
                <span>Relationship</span>
                <input
                  value={editDraft.emergencyContactRelationship}
                  placeholder="e.g. Spouse, Sibling"
                  onChange={(e) => setEditField('emergencyContactRelationship', e.target.value)}
                />
              </label>
              <label className="dashModal__field dashModal__field--full">
                <span>Contact Number</span>
                <input
                  value={editDraft.emergencyContactNumber}
                  placeholder="Phone number"
                  onChange={(e) => setEditField('emergencyContactNumber', e.target.value)}
                />
              </label>
            </div>

            {emailVerificationWillReset && (
              <div className="dashModal__helper dashModal__helper--warning">
                Changing this verified email will reset its verification status until the new address is verified.
              </div>
            )}

            <div className="dashModal__actions">
              <button
                type="button"
                className="dashModal__btn dashModal__btn--ghost"
                onClick={closeEditModal}
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dashModal__btn"
                onClick={() => void submitEditInfo()}
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
