import { useLoading } from '@/context/useLoading';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ConfirmDialog from '@/components/dialog/ConfirmDialog';
import { useUiDialog } from '@/components/dialog/useUiDialog';
import PageHeader from '@/components/layout/PageHeader';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { useSensitiveAccessPrompt } from '@/hooks/useSensitiveAccessPrompt';
import SensitiveAccessModal from '@/components/security/SensitiveAccessModal';
import { apiFetchJson, toArray } from '@/lib/api/api';
import { getSelfServicePath } from '@/lib/utils/roleRoutes';
import { getAuthToken, getUserEmail, getUserRole } from '@/lib/utils/session';
import { getFriendlyErrorMessage } from '@/lib/utils/uiErrors';
import { getManilaNow } from '@/lib/utils/manilaTime';
import type { AttendanceLeaveRequest as LeaveRequestRow, AttendanceLog, ShiftSchedule as ShiftScheduleRow } from '@/lib/types/attendance';
import type { LeaveBalanceRow } from '@/lib/types/employee';
import {
  downloadLibraryDocument,
  getEmployeeHandbookDocument,
  loadDocumentLibrary,
  openLibraryDocument,
  type DocumentLibraryItem,
} from '@/lib/document/documentLibrary';
import {
  createAnnouncementDraft,
  createBankAccountDrafts,
  createEditDraft,
  formatDashboardDateTime,
  formatJwtIssuedAt,
  getApprovedUpcomingLeave,
  getCalendarEventsByDay,
  isEmailVerified,
  syncAnnouncementRange,
  type AnnouncementDraft,
  type CalendarDayEvent,
  type CalendarEvent,
  type SelectedAnnouncementDay,
  type UserDetails,
} from './dashboardShared';
import AnnouncementDayModal from './sections/AnnouncementDayModal';
import CompanyEventsCalendar from './sections/CompanyEventsCalendar';
import CreateAnnouncementModal from './sections/CreateAnnouncementModal';
import DashboardActions from './sections/DashboardActions';
import EditInfoModal from './sections/EditInfoModal';
import EmployeeSummaryCard from './sections/EmployeeSummaryCard';
import HandbookWidget from './sections/HandbookWidget';
import TimeOffBalancesCard from './sections/TimeOffBalancesCard';
import './Dashboard.css';

type BankAccountDraft = {
  bankId?: number;
  bankName: string;
  accountNumber: string;
};

export default function Dashboard() {
  const { showLoading, hideLoading } = useLoading();

  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess } = useUiDialog();
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
  const [editIsDirty, setEditIsDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [editBankAccounts, setEditBankAccounts] = useState<BankAccountDraft[]>([]);
  const [bankRevealed, setBankRevealed] = useState(false);
  const sensitiveAccess = useSensitiveAccessPrompt();
  const [confirmEmailChangeOpen, setConfirmEmailChangeOpen] = useState(false);
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [createAnnouncementError, setCreateAnnouncementError] = useState('');
  const [createAnnouncementSubmitAttempted, setCreateAnnouncementSubmitAttempted] = useState(false);
  const [selectedAnnouncementDay, setSelectedAnnouncementDay] = useState<SelectedAnnouncementDay | null>(null);
  const [announcementActionError, setAnnouncementActionError] = useState('');
  const [announcementPendingDelete, setAnnouncementPendingDelete] = useState<CalendarDayEvent | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<number | null>(null);
  const [handbookDocument, setHandbookDocument] = useState<DocumentLibraryItem | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentActionKey, setDocumentActionKey] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState('');
  const [announcementDraft, setAnnouncementDraft] = useState<AnnouncementDraft>(() => createAnnouncementDraft());
  const [editDraft, setEditDraft] = useState({
    gender: '',
    birthDate: '',
    companyEmail: '',
    personalEmail: '',
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
  useErrorDialogEffect(documentActionError, 'Document action unavailable');
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useEscapeDismiss(Boolean(selectedAnnouncementDay), closeAnnouncementDay, 10);
  useEscapeDismiss(createAnnouncementOpen && !creatingAnnouncement, closeCreateAnnouncementModal, 10);
  useEscapeDismiss(editOpen && !savingEdit && !confirmEmailChangeOpen && !discardConfirmOpen, closeEditModal, 10);
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
              setNextLeave(getApprovedUpcomingLeave(leaves));
            })
            .catch(() => setNextLeave(null));
        }

        if (resolvedEmpId) {
          const selfEmployee = await apiFetchJson<UserDetails['employee']>(
            `/api/employees/${resolvedEmpId}`
          );
          setEmployee(selfEmployee);
          setEditDraft(createEditDraft(selfEmployee));
          setEditBankAccounts(createBankAccountDrafts(selfEmployee));
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

        if (fromUser) {
          setEmployee(fromUser);
          setEditDraft(createEditDraft(fromUser));
          setEditBankAccounts(createBankAccountDrafts(fromUser));
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setDocumentsLoading(true);

      try {
        const library = await loadDocumentLibrary();
        if (!cancelled) {
          setHandbookDocument(getEmployeeHandbookDocument(library.publicDocuments));
        }
      } catch {
        if (!cancelled) {
          setHandbookDocument(null);
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

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
  const selectedAnnouncementEvents = selectedAnnouncementDay?.events ?? [];
  const hasSingleAnnouncement = selectedAnnouncementEvents.length === 1;
  const announcementHeaderEvent = hasSingleAnnouncement ? selectedAnnouncementEvents[0] : null;
  const canManageAnnouncements =
    location.pathname.startsWith('/hr/') || location.pathname.startsWith('/management/');
  const canDeleteSingleAnnouncement =
    canManageAnnouncements && typeof announcementHeaderEvent?.calendarId === 'number';
  const savedEmailNormalized = employee?.personalEmail?.trim().toLowerCase() ?? '';
  const draftEmailNormalized = editDraft.personalEmail.trim().toLowerCase();
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

  function attendanceRequestPath(request: 'leave' | 'overtime') {
    return `${selfServicePath('attendance')}?request=${request}`;
  }

  const dashboardActions =
    userRole === 'manager'
      ? [
          { label: 'View Payslip', path: selfServicePath('payslip') },
          { label: 'View My Attendance', path: selfServicePath('attendance') },
          { label: 'View Team Attendance', path: attendanceOverviewPath() },
          { label: 'Request Leave', path: attendanceRequestPath('leave') },
        ]
      : userRole === 'hr' || userRole === 'management'
        ? [
            { label: 'View Payslip', path: selfServicePath('payslip') },
            { label: 'View My Attendance', path: selfServicePath('attendance') },
            { label: 'View Company Attendance', path: attendanceOverviewPath() },
            { label: 'Request Leave', path: attendanceRequestPath('leave') },
          ]
        : [
            { label: 'View Payslip', path: selfServicePath('payslip') },
            { label: 'View Attendance', path: selfServicePath('attendance') },
            { label: 'Request Overtime', path: attendanceRequestPath('overtime') },
            { label: 'Request Leave', path: attendanceRequestPath('leave') },
          ];

  function shiftCalendarMonth(offset: number) {
    const next = new Date(calendarYear, calendarMonthIndex + offset, 1);
    setAnnouncementActionError('');
    setAnnouncementPendingDelete(null);
    hideLoading();
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
    hideLoading();
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
    showLoading();
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
      hideLoading();
      setDeletingAnnouncementId(null);
    }
  }

  async function handleDashboardDocumentAction(
    action: 'view' | 'download',
    document: DocumentLibraryItem
  ) {
    const actionKey = `${action}-${document.scope}-${document.pathId}`;
    setDocumentActionKey(actionKey);
    setDocumentActionError('');

    try {
      if (action === 'view') {
        await openLibraryDocument(document);
      } else {
        await downloadLibraryDocument(document);
      }
    } catch (error) {
      setDocumentActionError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setDocumentActionKey(null);
    }
  }

  function openEditModal() {
    setEditError('');
    setEditDraft(createEditDraft(employee));
    setEditBankAccounts(createBankAccountDrafts(employee));
    setBankRevealed(false);
    setEditIsDirty(false);
    setEditOpen(true);
  }

  function actuallyCloseEditModal() {
    setEditOpen(false);
    setDiscardConfirmOpen(false);
    setConfirmEmailChangeOpen(false);
    setEditError('');
    setEditIsDirty(false);
    setBankRevealed(false);
    setEditDraft(createEditDraft(employee));
    setEditBankAccounts(createBankAccountDrafts(employee));
  }

  const revealBankNumbers = useCallback(() => {
    if (sensitiveAccess.isVerified) {
      setBankRevealed(true);
    } else {
      sensitiveAccess.requestVerification(
        async () => { setBankRevealed(true); },
        'Enter your password to view and edit bank account numbers.'
      );
    }
  }, [sensitiveAccess]);

  function closeEditModal() {
    if (savingEdit) return;
    if (editIsDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    actuallyCloseEditModal();
  }

  function setEditField<K extends keyof typeof editDraft>(key: K, value: (typeof editDraft)[K]) {
    setEditIsDirty(true);
    setEditDraft((prev) => ({ ...prev, [key]: value }));
  }

  function setEditBankAccountField(index: number, key: keyof BankAccountDraft, value: string) {
    if (!bankRevealed) return;
    setEditIsDirty(true);
    setEditBankAccounts((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              [key]: value,
            }
          : entry
      )
    );
  }

  function addEditBankAccount() {
    if (!bankRevealed) {
      revealBankNumbers();
      return;
    }
    setEditIsDirty(true);
    setEditBankAccounts((prev) => [...prev, { bankName: '', accountNumber: '' }]);
  }

  function removeEditBankAccount(index: number) {
    if (!bankRevealed) return;
    setEditIsDirty(true);
    setEditBankAccounts((prev) => prev.filter((_, i) => i !== index));
  }

  async function syncBankAccounts(employeeId: number) {
    const prepared = editBankAccounts
      .map((entry) => ({
        bankId: entry.bankId,
        bankName: entry.bankName.trim(),
        accountNumber: entry.accountNumber.trim(),
      }))
      .filter((entry) => entry.bankId || entry.bankName || entry.accountNumber);

    for (const entry of prepared) {
      if (!entry.bankName || !entry.accountNumber) {
        throw new Error('Each bank account needs both a bank name and account number before saving.');
      }

      await apiFetchJson(entry.bankId ? `/api/bank/update/${employeeId}` : `/api/bank/add/${employeeId}`, {
        method: entry.bankId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          bankId: entry.bankId,
          bankName: entry.bankName,
          accountNumber: entry.accountNumber,
        }),
      });
    }
  }

  async function runEditInfoSubmit() {
    if (!employeeId) {
      setEditError('Employee profile cannot be updated right now.');
      return;
    }

    setEditError('');
    showLoading();
    setSavingEdit(true);
    try {
      await apiFetchJson(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          gender: editDraft.gender.trim() || undefined,
          birthDate: editDraft.birthDate.trim() || undefined,
          personalEmail: editDraft.personalEmail.trim() || undefined,
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
      if (bankRevealed) {
        await syncBankAccounts(employeeId);
      }
      const refreshed = await apiFetchJson<UserDetails['employee']>(`/api/employees/${employeeId}`);
      setEmployee(refreshed);
      setEditDraft(createEditDraft(refreshed));
      setEditBankAccounts(createBankAccountDrafts(refreshed));
      setEditIsDirty(false);
      setBankRevealed(false);
      setEditOpen(false);
      if (emailChanged) {
        showSuccess(
          emailVerified
            ? 'Profile updated. Your personal email now needs a fresh verification link from Settings because the saved address changed.'
            : 'Profile updated. If you want to verify this saved personal email, you can do that from Settings.',
          'Profile Updated'
        );
      }
    } catch (error) {
      if (
        bankRevealed &&
        sensitiveAccess.handleProtectedError(
          error,
          async () => { await runEditInfoSubmit(); },
          'Enter your password to save bank account changes.'
        )
      ) {
        return;
      }
      setEditError(getFriendlyErrorMessage(error, 'profile-update'));
    } finally {
      hideLoading();
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

      <EmployeeSummaryCard
        employee={employee}
        employeeName={employeeName}
        lastAttendanceLabel={lastAttendanceLabel}
        lastLoginLabel={lastLoginLabel}
        profile={profile}
        savingEdit={savingEdit}
        onEdit={openEditModal}
      />

      <DashboardActions actions={dashboardActions} onNavigate={(path) => navigate(path)} />

      <section className="lowerGridX">
        <div className="lowerColX">
          <TimeOffBalancesCard
            leaveBalances={leaveBalances}
            nextLeave={nextLeave}
            shiftSchedule={shiftSchedule}
            onViewAllBalances={() => navigate(selfServicePath('attendance'))}
          />
          <HandbookWidget
            document={handbookDocument}
            loading={documentsLoading}
            activeActionKey={documentActionKey}
            onDownload={(document) => void handleDashboardDocumentAction('download', document)}
            onOpen={(document) => void handleDashboardDocumentAction('view', document)}
          />
        </div>
        <CompanyEventsCalendar
          calendarEventsByDay={calendarEventsByDay}
          calendarGridStyle={calendarGridStyle}
          calendarMonthIndex={calendarMonthIndex}
          calendarYear={calendarYear}
          canManageAnnouncements={canManageAnnouncements}
          daysInMonth={daysInMonth}
          monthLabel={monthLabel}
          sundayBasedStart={sundayBasedStart}
          totalCells={totalCells}
          onNextMonth={() => shiftCalendarMonth(1)}
          onOpenAnnouncementDay={openAnnouncementDay}
          onOpenCreateAnnouncementModal={openCreateAnnouncementModal}
          onPreviousMonth={() => shiftCalendarMonth(-1)}
        />
      </section>
      {selectedAnnouncementDay && (
        <AnnouncementDayModal
          announcementHeaderEvent={announcementHeaderEvent}
          canDeleteSingleAnnouncement={canDeleteSingleAnnouncement}
          canManageAnnouncements={canManageAnnouncements}
          deletingAnnouncementId={deletingAnnouncementId}
          hasSingleAnnouncement={hasSingleAnnouncement}
          selectedAnnouncementDay={selectedAnnouncementDay}
          selectedAnnouncementEvents={selectedAnnouncementEvents}
          onClose={closeAnnouncementDay}
          onRequestDelete={requestDeleteAnnouncement}
        />
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
        open={discardConfirmOpen}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        isBusy={false}
        onConfirm={actuallyCloseEditModal}
        onCancel={() => setDiscardConfirmOpen(false)}
      />

      <ConfirmDialog
        open={confirmEmailChangeOpen}
        title="Confirm Personal Email Change"
        message="Changing your verified personal email will remove its verified status until you verify the new address again. Do you want to continue saving this profile update?"
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
        <CreateAnnouncementModal
          announcementDraft={announcementDraft}
          createAnnouncementSubmitAttempted={createAnnouncementSubmitAttempted}
          creatingAnnouncement={creatingAnnouncement}
          onClose={closeCreateAnnouncementModal}
          onSetField={setAnnouncementDraftField}
          onSetStartDateTime={setAnnouncementStartDateTime}
          onSubmit={() => void submitAnnouncement()}
        />
      )}

      {editOpen && (
        <EditInfoModal
          editDraft={editDraft}
          bankAccounts={editBankAccounts}
          bankRevealed={bankRevealed}
          emailVerificationWillReset={emailVerificationWillReset}
          savingEdit={savingEdit}
          onClose={closeEditModal}
          onAddBankAccount={addEditBankAccount}
          onRemoveBankAccount={removeEditBankAccount}
          onSetBankAccountField={setEditBankAccountField}
          onRevealBankNumbers={revealBankNumbers}
          onSetField={setEditField}
          onSubmit={() => void submitEditInfo()}
        />
      )}

      <SensitiveAccessModal
        open={sensitiveAccess.open}
        onClose={sensitiveAccess.close}
        onVerified={sensitiveAccess.handleVerified}
        notice={sensitiveAccess.notice}
      />
    </div>
  );
}
