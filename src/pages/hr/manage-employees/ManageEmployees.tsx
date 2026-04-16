import { useLoading } from '../../../context/LoadingContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiDownload, FiEdit2, FiFilter, FiMoreVertical, FiPlus, FiSearch, FiUserX, FiX, FiXCircle } from 'react-icons/fi';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import SensitiveAccessIndicator from '../../../components/security/SensitiveAccessIndicator';
import SensitiveAccessModal from '../../../components/security/SensitiveAccessModal';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import EmployeeSortMenu from '../../../components/layout/EmployeeSortMenu';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { useSensitiveAccessPrompt } from '../../../hooks/useSensitiveAccessPrompt';
import { apiFetchJson, toArray } from '../../../lib/api';
import { compareEmployees, type EmployeeSortKey } from '../../../lib/employeeSort';
import { openDocumentAttachment } from '../../../lib/documentAttachments';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './ManageEmployees.css';

type ModalType = 'add' | 'edit' | 'delete' | null;
type ConfirmAction = 'edit' | 'delete';
type LeaveBalanceAdjustmentType = 'add' | 'subtract';
type LeaveType =
  | 'SICK_LEAVE'
  | 'VACATION_LEAVE'
  | 'MATERNITY_LEAVE'
  | 'PATERNITY_LEAVE'
  | 'SOLO_PARENT_LEAVE'
  | 'MAGNA_CARTA'
  | 'RA9262'
  | 'EMERGENCY_LEAVE';
type SeparationReason =
  | 'TERMINATED'
  | 'VOLUNTARY_RESIGNATION'
  | 'INVOLUNTARY_SEPARATION'
  | 'END_OF_CONTRACT'
  | 'DECEASED';

type EmployeeRow = {
  id: string;
  name: string;
  username: string;
  status: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  exemptionStatus: string;
  searchIndex: string;
};

type EmployeeDetails = {
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  birthDate?: string;
  employmentStatus?: string;
  exemptionStatus?: string;
  employmentDateStart?: string;
  employmentDateEnd?: string;
  yearlySalary?: number | string;
  email?: string;
  phoneNumber?: string;
  position?: string;
  department?: string;
  userAccountName?: string;
  managerId?: number;
  sssNumber?: string;
  philhealthNumber?: string;
  pagibigNumber?: string;
  tinNumber?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactNumber?: string;
  separationReason?: SeparationReason;
  eligibleForRehire?: boolean;
  separationNotes?: string;
  separationEffectiveDate?: string;
  separationProcessedBy?: string;
  address?: {
    permanentAddress?: string;
    temporaryAddress?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
};

type ComplianceDocument = {
  pathId?: number;
  fileName?: string;
  fileType?: string;
  category?: string;
  filePath?: string;
};

type ComplianceLeaveRecord = {
  requestId?: number;
  leaveType?: string;
  status?: string;
  paid?: boolean;
  startDateTime?: string;
  endDateTime?: string;
  reason?: string;
  approver?: string;
  approverReason?: string;
  approvedAt?: string;
};

type ComplianceDisputeRecord = {
  disputeId?: number;
  payrollItemId?: number;
  subject?: string;
  reason?: string;
  status?: string;
  statusReason?: string;
  approver?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ComplianceDisciplinaryAction = {
  action?: string;
  status?: string;
  summary?: string;
  notes?: string;
  recordedBy?: string;
  recordedAt?: string;
};

type CompliancePerformanceSummary = {
  windowDays?: number;
  attendanceDays?: number;
  completeLogPairs?: number;
  incompleteLogDays?: number;
  totalHours?: number;
  averageHoursPerAttendanceDay?: number;
  averageHoursPerWindowDay?: number;
};

type ComplianceTimelineEntry = {
  type?: string;
  title?: string;
  detail?: string;
  timestamp?: string;
};

type ComplianceRecord = {
  employeeId?: number;
  employeeName?: string;
  username?: string;
  employmentStatus?: string;
  position?: string;
  department?: string;
  employmentDateStart?: string;
  employmentDateEnd?: string;
  documents?: ComplianceDocument[];
  leaveRequests?: ComplianceLeaveRecord[];
  disputes?: ComplianceDisputeRecord[];
  disciplinaryActions?: ComplianceDisciplinaryAction[];
  performanceSummary?: CompliancePerformanceSummary;
  timeline?: ComplianceTimelineEntry[];
};

type EmployeeMutationResponse = {
  id?: number;
  employeeId?: number;
};

type EmployeeOption = {
  id: number;
  name: string;
  status: string;
  position: string;
  department: string;
};

type LeaveBalanceRow = {
  leaveId?: number;
  balanceHours?: number | string | null;
  leaveType?: LeaveType | string;
};

type LeaveBalanceCreateForm = {
  leaveType: LeaveType;
  balanceHours: string;
};

type LeaveBalanceAdjustForm = {
  balanceHours: string;
  type: LeaveBalanceAdjustmentType;
};

type FormState = {
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  employmentStatus: string;
  exemptionStatus: string;
  employmentDateStart: string;
  employmentDateEnd: string;
  email: string;
  phoneNumber: string;
  position: string;
  department: string;
  yearlySalary: string;
  managerId: string;
  username: string;
  password: string;
  permanentAddress: string;
  temporaryAddress: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  sssNumber: string;
  philhealthNumber: string;
  pagibigNumber: string;
  tinNumber: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  separationReason: SeparationReason | '';
  eligibleForRehire: '' | 'YES' | 'NO';
  separationNotes: string;
};

const employmentStatusOptions = ['REGULAR', 'NEW_HIRE', 'PART_TIME', 'SUSPENDED', 'TERMINATED'] as const;
const exemptionStatusOptions = ['EXEMPT', 'NON_EXEMPT'] as const;
const positionOptions = ['EMPLOYEE', 'MANAGER', 'HR', 'MANAGEMENT', 'ACCOUNTING', 'UNKNOWN'] as const;
const separationReasonOptions: Array<{ label: string; value: SeparationReason }> = [
  { label: 'Terminated', value: 'TERMINATED' },
  { label: 'Voluntary Resignation', value: 'VOLUNTARY_RESIGNATION' },
  { label: 'Involuntary Separation', value: 'INVOLUNTARY_SEPARATION' },
  { label: 'End of Contract', value: 'END_OF_CONTRACT' },
  { label: 'Deceased', value: 'DECEASED' },
];
const managerDepartmentOptions = [
  'People Operations Department',
  'Procurements Department',
  'Productions Department',
  'Product Development Department',
] as const;
const leaveTypeOptions: Array<{ label: string; value: LeaveType }> = [
  { label: 'Sick Leave', value: 'SICK_LEAVE' },
  { label: 'Vacation Leave', value: 'VACATION_LEAVE' },
  { label: 'Maternity Leave', value: 'MATERNITY_LEAVE' },
  { label: 'Paternity Leave', value: 'PATERNITY_LEAVE' },
  { label: 'Solo Parent Leave', value: 'SOLO_PARENT_LEAVE' },
  { label: 'Magna Carta', value: 'MAGNA_CARTA' },
  { label: 'RA 9262', value: 'RA9262' },
  { label: 'Emergency Leave', value: 'EMERGENCY_LEAVE' },
];
const HOURS_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const emptyForm: FormState = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  employmentStatus: 'REGULAR',
  exemptionStatus: 'NON_EXEMPT',
  employmentDateStart: '',
  employmentDateEnd: '',
  email: '',
  phoneNumber: '',
  position: 'EMPLOYEE',
  department: '',
  yearlySalary: '',
  managerId: '',
  username: '',
  password: '',
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
  separationReason: '',
  eligibleForRehire: '',
  separationNotes: '',
};

const emptyLeaveBalanceCreateForm: LeaveBalanceCreateForm = {
  leaveType: 'SICK_LEAVE',
  balanceHours: '',
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function toCsvValue(value: unknown) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(rows: string[][]) {
  return rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n');
}

function buildEmployeeExportFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `employees-${year}-${month}-${day}.csv`;
}

function isTerminatedStatus(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase() === 'TERMINATED';
}

function toRehireSelectValue(value?: boolean) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  return '';
}

function fromRehireSelectValue(value: FormState['eligibleForRehire']) {
  if (value === 'YES') return true;
  if (value === 'NO') return false;
  return undefined;
}

function normalizeSeparationReason(value?: string | null): FormState['separationReason'] {
  const normalized = String(value ?? '').trim().toUpperCase();
  return separationReasonOptions.some((option) => option.value === normalized)
    ? (normalized as SeparationReason)
    : '';
}

function formatEmploymentStatusLabel(value?: string | null) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return '-';
  if (normalized === 'TERMINATED') return 'RELEASED';
  return normalized.replace(/_/g, ' ');
}

function formatSeparationReasonLabel(value?: SeparationReason | string | null) {
  const normalized = String(value ?? '').trim().toUpperCase();
  const match = separationReasonOptions.find((option) => option.value === normalized);
  return match?.label ?? displayValue(value);
}

function isLongSeparationNote(value?: string | null) {
  const text = String(value ?? '').trim();
  return text.length > 120 || text.includes('\n');
}

function buildEmployeeSearchIndex(row: Omit<EmployeeRow, 'searchIndex'>) {
  return normalizeText(
    [row.id, row.name, row.username, row.status, row.email, row.phone, row.position, row.department].join(' ')
  );
}

function getDefaultExemptionStatus(position: string) {
  return position === 'EMPLOYEE' || position === 'UNKNOWN' ? 'NON_EXEMPT' : 'EXEMPT';
}

function isEmployeePosition(position?: string | null) {
  return String(position ?? '')
    .trim()
    .toUpperCase() === 'EMPLOYEE';
}

function isManagerPosition(position?: string | null) {
  return String(position ?? '')
    .trim()
    .toUpperCase() === 'MANAGER';
}

function buildEmployeeOptions(response: unknown) {
  return toArray<Record<string, unknown>>(response)
    .map((item, index) => {
      const id = Number(item.employeeId ?? item.id ?? index + 1);
      if (!Number.isFinite(id) || id <= 0) return null;

      const explicitName = typeof item.name === 'string' ? item.name.trim() : '';
      const fallbackName = [item.firstName, item.middleName, item.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();

      return {
        id,
        name: explicitName || fallbackName || `Employee #${id}`,
        status: String(item.status ?? item.employmentStatus ?? ''),
        position: String(item.position ?? ''),
        department: typeof item.department === 'string' ? item.department.trim() : '',
      } satisfies EmployeeOption;
    })
    .filter((option): option is EmployeeOption => option !== null)
    .filter((option) => normalizeText(option.status) !== 'terminated')
    .sort((left, right) => left.name.localeCompare(right.name));
}

function formatDateValue(value?: string | null) {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatDateTimeValue(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatCurrencyValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatLeaveTypeLabel(value?: string) {
  if (!value) return 'Leave';
  const option = leaveTypeOptions.find((entry) => entry.value === value);
  if (option) return option.label;

  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseBalanceHours(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatBalanceHoursLabel(value?: number | string | null) {
  const parsed = parseBalanceHours(value);
  if (parsed !== null) {
    return `${HOURS_FORMATTER.format(parsed)} hour${Math.abs(parsed - 1) < 0.00001 ? '' : 's'}`;
  }

  return '0 hours';
}

function formatHoursValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${HOURS_FORMATTER.format(value)} hrs`;
}

function displayValue(value?: string | number | null) {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text.length > 0 ? text : '-';
}

function mergeRowWithDetails(row: EmployeeRow, details: EmployeeDetails): EmployeeRow {
  const rowBase = {
    id: row.id,
    name: row.name,
    username: details.userAccountName?.trim() ? details.userAccountName : row.username,
    status: details.employmentStatus?.trim() ? details.employmentStatus : row.status,
    email: details.email?.trim() ? details.email : row.email,
    phone: details.phoneNumber?.trim() ? details.phoneNumber : row.phone,
    position: details.position?.trim() ? details.position : row.position,
    department: details.department?.trim() ? details.department : row.department,
    exemptionStatus: details.exemptionStatus?.trim() ? details.exemptionStatus : row.exemptionStatus,
  };

  return {
    ...rowBase,
    searchIndex: buildEmployeeSearchIndex(rowBase),
  };
}

export default function HrManageEmp() {
  const { showLoading, hideLoading } = useLoading();
  const { showSuccess } = useUiDialog();
  const sensitiveAccess = useSensitiveAccessPrompt();
  const [modal, setModal] = useState<ModalType>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([]);
  const [employeeDetailsById, setEmployeeDetailsById] = useState<Record<string, EmployeeDetails>>({});
  const [detailLoadingIds, setDetailLoadingIds] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [employeeComplianceById, setEmployeeComplianceById] = useState<Record<string, ComplianceRecord>>({});
  const [complianceLoadingIds, setComplianceLoadingIds] = useState<Record<string, boolean>>({});
  const [complianceErrors, setComplianceErrors] = useState<Record<string, string>>({});
  const [detailsDialogEmployeeId, setDetailsDialogEmployeeId] = useState<string | null>(null);
  const [expandedSeparationNotes, setExpandedSeparationNotes] = useState<Record<string, boolean>>({});
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [leaveBalanceStatus, setLeaveBalanceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [leaveBalanceError, setLeaveBalanceError] = useState('');
  const [leaveBalanceCreateForm, setLeaveBalanceCreateForm] = useState<LeaveBalanceCreateForm>(
    emptyLeaveBalanceCreateForm
  );
  const [leaveBalanceAdjustForms, setLeaveBalanceAdjustForms] = useState<Record<string, LeaveBalanceAdjustForm>>({});
  const [leaveBalanceSavingKey, setLeaveBalanceSavingKey] = useState<string | null>(null);
  const [loadMessage, setLoadMessage] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [initialForm, setInitialForm] = useState<FormState>(emptyForm);
  const [initialManagerSearch, setInitialManagerSearch] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('id');
  const [refreshTick, setRefreshTick] = useState(0);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployeeOptions, setIsLoadingEmployeeOptions] = useState(false);
  const [employeeOptionsError, setEmployeeOptionsError] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [hasExistingUserAccount, setHasExistingUserAccount] = useState(false);
  const managerPickerRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedEmployee = useMemo(
    () => employeeRows.find((row) => row.id === form.employeeId) ?? null,
    [employeeRows, form.employeeId]
  );
  const showManagerPicker = isEmployeePosition(form.position);
  const showDepartmentPicker = isManagerPosition(form.position);

  const detailsDialogEmployee = useMemo(
    () => employeeRows.find((row) => row.id === detailsDialogEmployeeId) ?? null,
    [detailsDialogEmployeeId, employeeRows]
  );
  const activeLeaveBalanceEmployeeId = detailsDialogEmployeeId ?? (modal === 'edit' && form.employeeId ? form.employeeId : null);

  const leaveBalancesByType = useMemo(() => {
    const next = new Map<string, LeaveBalanceRow>();
    for (const balance of leaveBalances) {
      if (typeof balance.leaveType !== 'string' || balance.leaveType.length === 0) continue;
      next.set(balance.leaveType, balance);
    }
    return next;
  }, [leaveBalances]);

  const orderedLeaveBalances = useMemo(() => {
    const knownTypes = new Set<string>(leaveTypeOptions.map((option) => option.value));
    const known = leaveTypeOptions
      .map((option) => leaveBalancesByType.get(option.value))
      .filter((balance): balance is LeaveBalanceRow & { leaveType: string } => Boolean(balance?.leaveType));
    const extras = leaveBalances.filter(
      (balance): balance is LeaveBalanceRow & { leaveType: string } =>
        typeof balance.leaveType === 'string' && balance.leaveType.length > 0 && !knownTypes.has(balance.leaveType)
    );

    return [...known, ...extras];
  }, [leaveBalances, leaveBalancesByType]);

  const availableLeaveTypeOptions = useMemo(
    () => leaveTypeOptions.filter((option) => !leaveBalancesByType.has(option.value)),
    [leaveBalancesByType]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.status).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );

  const filterPositionOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.position).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );

  const filterDepartmentOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.department).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );

  const visibleEmployeeRows = useMemo(() => {
    const normalizedSearch = normalizeText(searchValue);

    const filtered = employeeRows.filter((row) => {
      if (normalizedSearch && !row.searchIndex.includes(normalizedSearch)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (positionFilter !== 'all' && row.position !== positionFilter) return false;
      if (departmentFilter !== 'all' && row.department !== departmentFilter) return false;
      return true;
    });

    return [...filtered].sort((left, right) =>
      compareEmployees(employeeSort, { id: left.id, name: left.name }, { id: right.id, name: right.name })
    );
  }, [departmentFilter, employeeRows, employeeSort, positionFilter, searchValue, statusFilter]);

  const managerOptions = useMemo(
    () => employeeOptions.filter((option) => isManagerPosition(option.position)),
    [employeeOptions]
  );

  const selectedManagerOption = useMemo(() => {
    const managerId = Number(form.managerId);
    if (!Number.isFinite(managerId)) return null;
    return managerOptions.find((option) => option.id === managerId) ?? null;
  }, [form.managerId, managerOptions]);

  const filteredManagerOptions = useMemo(() => {
    const normalizedSearch = normalizeText(managerSearch);
    if (!normalizedSearch) return managerOptions;

    return managerOptions.filter((option) =>
      normalizeText([option.name, option.department, option.id].filter(Boolean).join(' ')).includes(normalizedSearch)
    );
  }, [managerOptions, managerSearch]);
  const canClearManagerPicker = managerSearch.trim().length > 0 || form.managerId.trim().length > 0;

  const activeFilterCount = [statusFilter, positionFilter, departmentFilter].filter((value) => value !== 'all').length;
  const phoneHelperMessage = modal !== 'delete' ? getPhoneValidationMessage(form.phoneNumber) : '';
  const phoneHasError =
    modal !== 'delete' && form.phoneNumber.trim().length > 0 && sanitizePhoneNumber(form.phoneNumber).length !== 11;
  const shouldHighlightRequiredFields = modal !== 'delete' && formSubmitAttempted;
  const firstNameMissing = shouldHighlightRequiredFields && form.firstName.trim().length === 0;
  const lastNameMissing = shouldHighlightRequiredFields && form.lastName.trim().length === 0;
  const birthDateMissing = shouldHighlightRequiredFields && form.birthDate.trim().length === 0;
  const emailMissing = shouldHighlightRequiredFields && form.email.trim().length === 0;
  const phoneMissing = shouldHighlightRequiredFields && modal === 'add' && form.phoneNumber.trim().length === 0;
  const managerSelectionMissing =
    shouldHighlightRequiredFields && showManagerPicker && managerSearch.trim().length > 0 && !form.managerId.trim();
  const departmentMissing = shouldHighlightRequiredFields && showDepartmentPicker && form.department.trim().length === 0;
  const usernameMissing = shouldHighlightRequiredFields && form.username.trim().length === 0;
  const passwordMissing =
    shouldHighlightRequiredFields &&
    ((modal === 'add' && form.password.trim().length === 0) ||
      (modal === 'edit' && !hasExistingUserAccount && form.password.trim().length === 0));
  const phoneInputInvalid = phoneHasError || phoneMissing;
  const rosterLoadError = loadMessage.startsWith('Unable to load the employee roster') ? loadMessage : '';

  useErrorDialogEffect(rosterLoadError, 'Employee roster could not be loaded');
  useErrorDialogEffect(submitError, 'Employee action could not be completed');
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useEscapeDismiss(Boolean(detailsDialogEmployeeId), closeDetailsDialog, 10);
  useEscapeDismiss(exportMenuOpen, () => setExportMenuOpen(false), 11);
  const hasUnsavedModalChanges = useMemo(() => {
    if (!modal) return false;
    return JSON.stringify(form) !== JSON.stringify(initialForm) || managerSearch !== initialManagerSearch;
  }, [form, initialForm, initialManagerSearch, managerSearch, modal]);

  function requestCloseModal() {
    if (isSaving) return;
    if (hasUnsavedModalChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    closeModal();
  }

  function discardAndCloseModal() {
    setConfirmDiscardOpen(false);
    closeModal();
  }

  useEscapeDismiss(Boolean(modal) && !isSaving && !confirmDiscardOpen && !confirmAction, requestCloseModal, 10);

  useEffect(() => {
    if (!modal || !hasUnsavedModalChanges) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedModalChanges, modal]);
  useEscapeDismiss(Boolean(confirmAction) && !isSaving, () => setConfirmAction(null), 50);
  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled: !modal && !detailsDialogEmployeeId && !confirmAction && !isSaving,
  });

  useEffect(() => {
    if (modal || detailsDialogEmployeeId) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [detailsDialogEmployeeId, modal]);

  useEffect(() => {
    void loadEmployees();
    void loadEmployeeOptions();
  }, [refreshTick]);

  useEffect(() => {
    if (!managerPickerOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!managerPickerRef.current?.contains(event.target as Node)) {
        setManagerPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [managerPickerOpen]);

  useEffect(() => {
    if (!exportMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!showManagerPicker) {
      setManagerPickerOpen(false);
      return;
    }

    if (!managerSearch.trim() && selectedManagerOption) {
      setManagerSearch(selectedManagerOption.name);
    }
  }, [managerSearch, selectedManagerOption, showManagerPicker]);

  useEffect(() => {
    if (!activeLeaveBalanceEmployeeId) {
      setLeaveBalances([]);
      setLeaveBalanceStatus('idle');
      setLeaveBalanceError('');
      setLeaveBalanceCreateForm(emptyLeaveBalanceCreateForm);
      setLeaveBalanceAdjustForms({});
      setLeaveBalanceSavingKey(null);
      return;
    }

    void loadLeaveBalances(activeLeaveBalanceEmployeeId);
  }, [activeLeaveBalanceEmployeeId]);

  async function loadEmployees() {
    try {
      const response = await apiFetchJson<unknown>('/api/employees?page=0&size=5000');
      const mapped = toArray<Record<string, unknown>>(response).map((item, index) => {
        const rowBase = {
          id: String(item.employeeId ?? item.id ?? index + 1),
          name:
            [item.firstName, item.middleName, item.lastName]
              .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
              .join(' ') || `Employee #${item.employeeId ?? item.id ?? index + 1}`,
          username: String(item.userAccountName ?? item.username ?? '-'),
          status: String(item.employmentStatus ?? '-'),
          email: String(item.email ?? '-'),
          phone: String(item.phoneNumber ?? '-'),
          position: String(item.position ?? '-'),
          department: String(item.department ?? '-'),
          exemptionStatus: String(item.exemptionStatus ?? getDefaultExemptionStatus(String(item.position ?? ''))),
        };

        return {
          ...rowBase,
          searchIndex: buildEmployeeSearchIndex(rowBase),
        };
      });

      setEmployeeRows(mapped);
      setEmployeeDetailsById({});
      setDetailLoadingIds({});
      setDetailErrors({});
      setEmployeeComplianceById({});
      setComplianceLoadingIds({});
      setComplianceErrors({});
      setDetailsDialogEmployeeId((current) => (current && mapped.some((row) => row.id === current) ? current : null));
      setLoadMessage(mapped.length === 0 ? 'No employees found.' : '');

    } catch (error) {
      setEmployeeRows([]);
      setEmployeeDetailsById({});
      setDetailLoadingIds({});
      setDetailErrors({});
      setEmployeeComplianceById({});
      setComplianceLoadingIds({});
      setComplianceErrors({});
      setDetailsDialogEmployeeId(null);
      setLoadMessage(
        `Unable to load the employee roster right now. (${getFriendlyErrorMessage(error, 'employee-load')})`
      );
    }
  }

  async function loadEmployeeOptions() {
    setIsLoadingEmployeeOptions(true);
    setEmployeeOptionsError('');

    try {
      const response = await apiFetchJson<unknown>('/api/employees/options');
      setEmployeeOptions(buildEmployeeOptions(response));
    } catch (error) {
      setEmployeeOptionsError(getFriendlyErrorMessage(error, 'employee-load'));
    } finally {
      setIsLoadingEmployeeOptions(false);
    }
  }

  function todayDateValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function exportEmployeeData() {
    if (visibleEmployeeRows.length === 0) return;

    const rows = [
      ['Employee ID', 'Name', 'Username', 'Status', 'Email', 'Phone', 'Position', 'Department'],
      ...visibleEmployeeRows
        .map((row) => [row.id, row.name, row.username, row.status, row.email, row.phone, row.position, row.department]),
    ];

    const csvContent = buildCsvContent(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildEmployeeExportFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);

    showSuccess(`Exported ${visibleEmployeeRows.length} employee record${visibleEmployeeRows.length === 1 ? '' : 's'}.`, 'Employee Data Exported');
  }

  function sanitizePhoneNumber(value: string) {
    return value.replace(/\D/g, '').slice(0, 11);
  }

  function parseLeaveBalanceHours(value: string, allowZero: boolean) {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(allowZero ? 'Balance hours are required.' : 'Adjustment hours are required.');
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error('Balance hours must be a valid number.');
    }

    if (allowZero ? parsed < 0 : parsed <= 0) {
      throw new Error(allowZero ? 'Balance hours must be 0 or greater.' : 'Adjustment hours must be greater than 0.');
    }

    return parsed;
  }

  function getPhoneValidationMessage(value: string) {
    const digits = sanitizePhoneNumber(value);
    if (!digits) return 'Enter an 11-digit mobile number, for example 09171234567.';
    if (digits.length !== 11) return 'Phone number must be exactly 11 digits.';
    return 'Enter an 11-digit mobile number, for example 09171234567.';
  }

  function validatePhoneNumber(value: string) {
    const digits = sanitizePhoneNumber(value);
    if (digits.length !== 11) {
      throw new Error('Phone number must be exactly 11 digits.');
    }
    return digits;
  }

  function parseYearlySalary(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('Yearly salary must be 0 or greater.');
    }
    return parsed;
  }

  function parseManagerId(value: string, employeeId: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error('Manager ID must be a valid employee number.');
    }
    if (employeeId && Number(employeeId) === parsed) {
      throw new Error('Employee cannot be their own manager.');
    }
    return parsed;
  }

  function resetMessages() {
    setSubmitError('');
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handlePositionChange(nextPosition: string) {
    setForm((current) => {
      const shouldRefreshExemption =
        !current.exemptionStatus || current.exemptionStatus === getDefaultExemptionStatus(current.position);

      return {
        ...current,
        position: nextPosition,
        exemptionStatus: shouldRefreshExemption ? getDefaultExemptionStatus(nextPosition) : current.exemptionStatus,
      };
    });

    if (!isEmployeePosition(nextPosition)) {
      setManagerPickerOpen(false);
    }
  }

  function selectManager(option: EmployeeOption) {
    setField('managerId', String(option.id));
    setManagerSearch(option.name);
    setManagerPickerOpen(false);
  }

  function clearManagerSelection() {
    setField('managerId', '');
    setManagerSearch('');
    setManagerPickerOpen(false);
  }

  function openAddModal() {
    const nextForm = {
      ...emptyForm,
      employmentDateStart: todayDateValue(),
      exemptionStatus: getDefaultExemptionStatus(emptyForm.position),
    };
    resetMessages();
    setConfirmAction(null);
    setConfirmDiscardOpen(false);
    setFormSubmitAttempted(false);
    setHasExistingUserAccount(false);
    setManagerSearch('');
    setInitialManagerSearch('');
    setManagerPickerOpen(false);
    setModal('add');
    setForm(nextForm);
    setInitialForm(nextForm);
  }

  function closeModal() {
    setModal(null);
    setConfirmAction(null);
    setConfirmDiscardOpen(false);
    setFormSubmitAttempted(false);
    setHasExistingUserAccount(false);
    setManagerSearch('');
    setInitialManagerSearch('');
    setManagerPickerOpen(false);
    resetMessages();
    setForm(emptyForm);
    setInitialForm(emptyForm);
  }

  function clearFilters() {
    setStatusFilter('all');
    setPositionFilter('all');
    setDepartmentFilter('all');
  }

  function syncLeaveBalanceForms(balances: LeaveBalanceRow[]) {
    setLeaveBalanceAdjustForms((current) => {
      const next: Record<string, LeaveBalanceAdjustForm> = {};
      for (const balance of balances) {
        if (typeof balance.leaveType !== 'string' || !balance.leaveType) continue;
        next[balance.leaveType] = current[balance.leaveType] ?? { balanceHours: '', type: 'add' };
      }
      return next;
    });

    setLeaveBalanceCreateForm((current) => {
      const nextLeaveType =
        leaveTypeOptions.find((option) => !balances.some((balance) => balance.leaveType === option.value))?.value ??
        current.leaveType;

      return {
        leaveType: nextLeaveType,
        balanceHours: current.balanceHours,
      };
    });
  }

  async function loadLeaveBalances(employeeId: string) {
    setLeaveBalanceStatus('loading');
    setLeaveBalanceError('');

    try {
      const payload = await apiFetchJson<unknown>(`/api/leave/balance/${employeeId}`);
      const rows = toArray<LeaveBalanceRow>(payload);
      setLeaveBalances(rows);
      syncLeaveBalanceForms(rows);
      setLeaveBalanceStatus('ready');
    } catch (error) {
      setLeaveBalances([]);
      setLeaveBalanceAdjustForms({});
      setLeaveBalanceStatus('error');
      setLeaveBalanceError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  async function fetchEmployeeDetails(employeeId: string) {
    if (employeeDetailsById[employeeId]) {
      return employeeDetailsById[employeeId];
    }

    setDetailLoadingIds((current) => ({ ...current, [employeeId]: true }));
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[employeeId];
      return next;
    });

    try {
      const payload = await apiFetchJson<EmployeeDetails>(`/api/employees/${employeeId}`);
      setEmployeeDetailsById((current) => ({ ...current, [employeeId]: payload }));
      setEmployeeRows((current) =>
        current.map((row) => (row.id === employeeId ? mergeRowWithDetails(row, payload) : row))
      );
      return payload;
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          async () => {
            await fetchEmployeeDetails(employeeId);
          },
          'Verify access before opening protected employee records, identifiers, and separation history.'
        )
      ) {
        return undefined;
      }
      const message = getFriendlyErrorMessage(error, 'employee-load');
      setDetailErrors((current) => ({ ...current, [employeeId]: message }));
      throw error;
    } finally {
      setDetailLoadingIds((current) => ({ ...current, [employeeId]: false }));
    }
  }

  async function fetchEmployeeCompliance(employeeId: string) {
    if (employeeComplianceById[employeeId]) {
      return employeeComplianceById[employeeId];
    }

    setComplianceLoadingIds((current) => ({ ...current, [employeeId]: true }));
    setComplianceErrors((current) => {
      const next = { ...current };
      delete next[employeeId];
      return next;
    });

    try {
      const payload = await apiFetchJson<ComplianceRecord>(`/api/compliance/${employeeId}`);
      setEmployeeComplianceById((current) => ({ ...current, [employeeId]: payload }));
      return payload;
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          async () => {
            await fetchEmployeeCompliance(employeeId);
          },
          'Verify access before opening confidential compliance records, files, and performance history.'
        )
      ) {
        return undefined;
      }
      const message = getFriendlyErrorMessage(error, 'employee-load');
      setComplianceErrors((current) => ({ ...current, [employeeId]: message }));
      throw error;
    } finally {
      setComplianceLoadingIds((current) => ({ ...current, [employeeId]: false }));
    }
  }

  async function openDetailsDialog(rowId: string) {
    if (detailLoadingIds[rowId]) {
      return;
    }

    if (employeeDetailsById[rowId]) {
      setDetailsDialogEmployeeId(rowId);
      void fetchEmployeeCompliance(rowId);
      return;
    }

    const payload = await fetchEmployeeDetails(rowId);
    if (payload) {
      setDetailsDialogEmployeeId(rowId);
      void fetchEmployeeCompliance(rowId);
    }
  }

  function closeDetailsDialog() {
    setDetailsDialogEmployeeId(null);
  }

  function toggleSeparationNote(employeeId: string) {
    setExpandedSeparationNotes((current) => ({
      ...current,
      [employeeId]: !current[employeeId],
    }));
  }

  function setLeaveBalanceCreateField<K extends keyof LeaveBalanceCreateForm>(key: K, value: LeaveBalanceCreateForm[K]) {
    setLeaveBalanceCreateForm((current) => ({ ...current, [key]: value }));
  }

  function setLeaveBalanceAdjustField(leaveType: string, field: keyof LeaveBalanceAdjustForm, value: string) {
    setLeaveBalanceAdjustForms((current) => ({
      ...current,
      [leaveType]: {
        balanceHours: current[leaveType]?.balanceHours ?? '',
        type: current[leaveType]?.type ?? 'add',
        [field]: value,
      } as LeaveBalanceAdjustForm,
    }));
  }

  async function handleCreateLeaveBalance() {
    if (!activeLeaveBalanceEmployeeId) return;

    const employeeId = Number(activeLeaveBalanceEmployeeId);
    if (!Number.isFinite(employeeId)) {
      setLeaveBalanceError('A valid employee ID is required before assigning leave balance.');
      return;
    }

    setLeaveBalanceError('');
    setLeaveBalanceSavingKey('create');

    try {
      await apiFetchJson(`/api/leave/balance/${employeeId}`, {
        method: 'POST',
        body: JSON.stringify({
          empId: employeeId,
          leaveType: leaveBalanceCreateForm.leaveType,
          balanceHours: parseLeaveBalanceHours(leaveBalanceCreateForm.balanceHours, true),
        }),
      });

      setLeaveBalanceCreateForm((current) => ({ ...current, balanceHours: '' }));
      await loadLeaveBalances(String(employeeId));
      showSuccess('Leave balance assigned successfully.', 'Leave Balance Created');
    } catch (error) {
      setLeaveBalanceError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setLeaveBalanceSavingKey(null);
    }
  }

  async function handleAdjustLeaveBalance(leaveType: string) {
    if (!activeLeaveBalanceEmployeeId) return;

    const employeeId = Number(activeLeaveBalanceEmployeeId);
    const formState = leaveBalanceAdjustForms[leaveType] ?? { balanceHours: '', type: 'add' };
    if (!Number.isFinite(employeeId)) {
      setLeaveBalanceError('A valid employee ID is required before adjusting leave balance.');
      return;
    }

    setLeaveBalanceError('');
    setLeaveBalanceSavingKey(leaveType);

    try {
      await apiFetchJson(`/api/leave/balance/update/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          leaveType,
          type: formState.type,
          balanceHours: parseLeaveBalanceHours(formState.balanceHours, false),
        }),
      });

      setLeaveBalanceAdjustForms((current) => ({
        ...current,
        [leaveType]: { balanceHours: '', type: current[leaveType]?.type ?? 'add' },
      }));
      await loadLeaveBalances(String(employeeId));
      showSuccess('Leave balance updated successfully.', 'Leave Balance Updated');
    } catch (error) {
      setLeaveBalanceError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setLeaveBalanceSavingKey(null);
    }
  }

  async function openEditModal(row: EmployeeRow) {
    resetMessages();
    setConfirmAction(null);
    setFormSubmitAttempted(false);

    try {
      const payload = await apiFetchJson<EmployeeDetails>(`/api/employees/${row.id}`);
      const nextForm: FormState = {
        employeeId: String(payload.id ?? row.id),
        firstName: payload.firstName ?? '',
        middleName: payload.middleName ?? '',
        lastName: payload.lastName ?? '',
        birthDate: payload.birthDate ?? '',
        employmentStatus: payload.employmentStatus ?? 'REGULAR',
        exemptionStatus: payload.exemptionStatus ?? getDefaultExemptionStatus(payload.position ?? 'EMPLOYEE'),
        employmentDateStart: payload.employmentDateStart ?? '',
        employmentDateEnd: payload.employmentDateEnd ?? '',
        email: payload.email ?? '',
        phoneNumber: sanitizePhoneNumber(payload.phoneNumber ?? ''),
        position: payload.position ?? 'EMPLOYEE',
        department: payload.department ?? '',
        yearlySalary:
          payload.yearlySalary !== undefined && payload.yearlySalary !== null ? String(payload.yearlySalary) : '',
        managerId: payload.managerId !== undefined && payload.managerId !== null ? String(payload.managerId) : '',
        username: payload.userAccountName ?? (row.username === '-' ? '' : row.username),
        password: '',
        permanentAddress: payload.address?.permanentAddress ?? '',
        temporaryAddress: payload.address?.temporaryAddress ?? '',
        city: payload.address?.city ?? '',
        state: payload.address?.state ?? '',
        country: payload.address?.country ?? '',
        zipCode: payload.address?.zipCode ?? '',
        sssNumber: payload.sssNumber ?? '',
        philhealthNumber: payload.philhealthNumber ?? '',
        pagibigNumber: payload.pagibigNumber ?? '',
        tinNumber: payload.tinNumber ?? '',
        emergencyContactName: payload.emergencyContactName ?? '',
        emergencyContactRelationship: payload.emergencyContactRelationship ?? '',
        emergencyContactNumber: payload.emergencyContactNumber ?? '',
        separationReason: normalizeSeparationReason(payload.separationReason),
        eligibleForRehire: toRehireSelectValue(payload.eligibleForRehire),
        separationNotes: payload.separationNotes ?? '',
      };
      const nextManagerSearch =
        payload.managerId !== undefined && payload.managerId !== null
          ? employeeOptions.find((option) => option.id === payload.managerId)?.name ?? ''
          : '';
      setForm(nextForm);
      setInitialForm(nextForm);
      setManagerSearch(nextManagerSearch);
      setInitialManagerSearch(nextManagerSearch);
      setConfirmDiscardOpen(false);
      setHasExistingUserAccount(Boolean(payload.userAccountName?.trim() || (row.username !== '-' && row.username.trim())));
      setManagerPickerOpen(false);
      setModal('edit');
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => openEditModal(row),
          'Verify access before editing protected employee information.'
        )
      ) {
        return;
      }
      setSubmitError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  function openDeleteModal(row: EmployeeRow) {
    const nextForm = {
      ...emptyForm,
      employeeId: row.id,
      username: row.username === '-' ? '' : row.username,
    };
    resetMessages();
    setConfirmAction(null);
    setConfirmDiscardOpen(false);
    setFormSubmitAttempted(false);
    setHasExistingUserAccount(Boolean(row.username !== '-' && row.username.trim()));
    if (isTerminatedStatus(row.status)) {
      setSubmitError('This employee is already marked inactive.');
      return;
    }
    setForm(nextForm);
    setInitialForm(nextForm);
    setInitialManagerSearch('');
    setModal('delete');
  }

  function validateTerminationFields() {
    if (!form.separationReason) {
      setSubmitError('Separation reason is required.');
      return false;
    }

    if (!form.eligibleForRehire) {
      setSubmitError('Eligible for rehire must be specified.');
      return false;
    }

    setSubmitError('');
    return true;
  }

  function validateRequiredEmployeeFields(mode: 'add' | 'edit') {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.email.trim()) {
      setSubmitError('First name, last name, birth date, and email are required.');
      return false;
    }

    if (mode === 'add' && !form.phoneNumber.trim()) {
      setSubmitError('Phone number is required.');
      return false;
    }

    if (showManagerPicker && managerSearch.trim() && !form.managerId.trim()) {
      setSubmitError('Choose a manager from the dropdown or clear the manager field.');
      return false;
    }

    if (showDepartmentPicker && !form.department.trim()) {
      setSubmitError('Department is required when the selected position is MANAGER.');
      return false;
    }

    if (!form.username.trim()) {
      setSubmitError('Username is required for the employee account.');
      return false;
    }

    if (mode === 'add' && !form.password.trim()) {
      setSubmitError('Password is required for the employee account.');
      return false;
    }

    if (mode === 'edit' && !hasExistingUserAccount && !form.password.trim()) {
      setSubmitError('Password is required when creating a new login account for this employee.');
      return false;
    }

    setSubmitError('');
    return true;
  }

  function buildEmployeePayload(isCreate: boolean) {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.email.trim()) {
      throw new Error('First name, last name, birth date, and email are required.');
    }

    if (showManagerPicker && managerSearch.trim() && !form.managerId.trim()) {
      throw new Error('Choose a manager from the dropdown or clear the manager field.');
    }

    if (showDepartmentPicker && !form.department.trim()) {
      throw new Error('Department is required when the selected position is MANAGER.');
    }

    const shouldDefaultEmploymentEndDate =
      !isCreate && isTerminatedStatus(form.employmentStatus) && !form.employmentDateEnd;

    return {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      birthDate: form.birthDate || undefined,
      employmentStatus: form.employmentStatus || undefined,
      exemptionStatus: form.exemptionStatus || undefined,
      employmentDateStart: form.employmentDateStart || undefined,
      employmentDateEnd: form.employmentDateEnd || (shouldDefaultEmploymentEndDate ? todayDateValue() : undefined),
      email: form.email.trim(),
      phoneNumber: isCreate || form.phoneNumber.trim() ? validatePhoneNumber(form.phoneNumber) : undefined,
      position: form.position || undefined,
      department: showDepartmentPicker ? form.department.trim() || undefined : undefined,
      yearlySalary: parseYearlySalary(form.yearlySalary),
      managerId: showManagerPicker ? parseManagerId(form.managerId, form.employeeId) : undefined,
      sssNumber: form.sssNumber.trim() || undefined,
      philhealthNumber: form.philhealthNumber.trim() || undefined,
      pagibigNumber: form.pagibigNumber.trim() || undefined,
      tinNumber: form.tinNumber.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyContactRelationship: form.emergencyContactRelationship.trim() || undefined,
      emergencyContactNumber: form.emergencyContactNumber.trim() || undefined,
      address: {
        permanentAddress: form.permanentAddress.trim() || undefined,
        temporaryAddress: form.temporaryAddress.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
      },
    };
  }

  async function saveUserAccount(employeeId: number, mode: 'add' | 'edit') {
    const username = form.username.trim();
    const password = form.password.trim();
    const hasExistingAccount = hasExistingUserAccount;

    if (!username) {
      throw new Error('Username is required for the employee account.');
    }
    if (mode === 'add' && !password) {
      throw new Error('Password is required for the employee account.');
    }
    if (mode === 'edit' && !hasExistingAccount && !password) {
      throw new Error('Password is required when creating a new login account for this employee.');
    }

    if (mode === 'add' || !hasExistingAccount) {
      await apiFetchJson('/api/user/create', {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          username,
          password,
        }),
      });
      return;
    }

    await apiFetchJson(`/api/user/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        employeeId,
        username,
        password: password || undefined,
      }),
    });
  }

  async function executeSubmit(targetModal: ModalType) {
    if (!targetModal) return;

    resetMessages();
    showLoading();
    setIsSaving(true);

    try {
      if (targetModal === 'add') {
        if (!form.phoneNumber.trim()) {
          throw new Error('Phone number is required.');
        }

        const createdEmployee = await apiFetchJson<EmployeeMutationResponse>('/api/employees/create', {
          method: 'POST',
          body: JSON.stringify(buildEmployeePayload(true)),
        });

        const employeeId = Number(createdEmployee.id ?? createdEmployee.employeeId);
        if (!Number.isFinite(employeeId)) {
          throw new Error('Employee was created, but the new employee ID was not returned.');
        }

        let accountError = '';
        try {
          await saveUserAccount(employeeId, 'add');
        } catch (error) {
          accountError = getFriendlyErrorMessage(error, 'employee-save');
        }

        await Promise.all([loadEmployees(), loadEmployeeOptions()]);

        if (accountError) {
          setSubmitError(`Employee record was created, but the linked user account could not be saved. (${accountError})`);
        } else {
          closeModal();
          showSuccess('Employee created successfully.', 'Employee Created');
        }
        return;
      }

      if (targetModal === 'edit') {
        const employeeId = Number(form.employeeId);
        if (!Number.isFinite(employeeId)) {
          throw new Error('Employee ID is required for edit.');
        }

        await apiFetchJson(`/api/employees/${employeeId}`, {
          method: 'PATCH',
          body: JSON.stringify(buildEmployeePayload(false)),
        });

        let accountError = '';
        try {
          await saveUserAccount(employeeId, 'edit');
        } catch (error) {
          accountError = getFriendlyErrorMessage(error, 'employee-save');
        }

        await Promise.all([loadEmployees(), loadEmployeeOptions()]);

        if (accountError) {
          setSubmitError(`Employee details were updated, but the linked user account could not be saved. (${accountError})`);
        } else {
          closeModal();
          showSuccess('Employee updated successfully.', 'Employee Updated');
        }
        return;
      }

      if (targetModal === 'delete') {
        const employeeId = Number(form.employeeId);
        if (!Number.isFinite(employeeId)) {
          throw new Error('Employee ID is required for termination.');
        }
        if (isTerminatedStatus(selectedEmployee?.status)) {
          throw new Error('This employee is already marked inactive.');
        }
        if (!form.separationReason) {
          throw new Error('Separation reason is required.');
        }
        const eligibleForRehire = fromRehireSelectValue(form.eligibleForRehire);
        if (eligibleForRehire === undefined) {
          throw new Error('Eligible for rehire must be specified.');
        }

        await apiFetchJson(`/api/employees/status/${employeeId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            employmentStatus: 'TERMINATED',
            employmentDateEnd: todayDateValue(),
            separationReason: form.separationReason,
            eligibleForRehire,
            separationNotes: form.separationNotes.trim() || undefined,
          }),
        });

        await Promise.all([loadEmployees(), loadEmployeeOptions()]);
        closeModal();
        showSuccess('Employee separation recorded successfully.', 'Employee Updated');
      }
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => executeSubmit(targetModal),
          targetModal === 'delete'
            ? 'Verify access before recording an employee separation.'
            : 'Verify access before saving protected employee information.'
        )
      ) {
        return;
      }
      setSubmitError(
        getFriendlyErrorMessage(error, targetModal === 'delete' ? 'employee-terminate' : 'employee-save')
      );
    } finally {
      hideLoading();
      setIsSaving(false);
    }
  }

  async function submit() {
    if (!modal) return;
    if (modal !== 'delete') {
      setFormSubmitAttempted(true);
    }

    if (modal === 'add') {
      if (!validateRequiredEmployeeFields('add')) {
        return;
      }
      await executeSubmit('add');
      return;
    }

    if (modal === 'edit' && !validateRequiredEmployeeFields('edit')) {
      return;
    }

    if (modal === 'delete' && !validateTerminationFields()) {
      return;
    }

    setConfirmAction(modal);
  }

  async function confirmAndSubmit() {
    if (!confirmAction) return;
    const nextAction = confirmAction;
    setConfirmAction(null);
    if (nextAction !== 'delete' && !validateRequiredEmployeeFields(nextAction)) {
      return;
    }
    if (nextAction === 'delete' && !validateTerminationFields()) {
      return;
    }
    await executeSubmit(nextAction);
  }

  function renderLeaveBalanceSummary() {
    if (leaveBalanceStatus === 'loading') {
      return <div className="hrEmpLeaveBalance__feedback">Loading leave balances...</div>;
    }

    if (leaveBalanceStatus === 'error') {
      return <div className="hrEmpLeaveBalance__feedback is-error">{leaveBalanceError}</div>;
    }

    if (orderedLeaveBalances.length === 0) {
      return <div className="hrEmpLeaveBalance__feedback">No leave balances are assigned yet for this employee.</div>;
    }

    return (
      <div className="hrEmpLeaveBalance__list hrEmpLeaveBalance__list--summary">
        {orderedLeaveBalances.map((balance) => {
          const leaveType = String(balance.leaveType ?? '');

          return (
            <article key={leaveType || String(balance.leaveId)} className="hrEmpLeaveBalance__card">
              <div className="hrEmpLeaveBalance__meta">
                <div>
                  <span className="hrEmpLeaveBalance__label">Leave Type</span>
                  <strong>{formatLeaveTypeLabel(leaveType)}</strong>
                </div>
                <div>
                  <span className="hrEmpLeaveBalance__label">Current Balance</span>
                  <strong>{formatBalanceHoursLabel(balance.balanceHours)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function renderLeaveBalanceEditor() {
    if (leaveBalanceStatus === 'loading') {
      return <div className="hrEmpLeaveBalance__feedback">Loading leave balances...</div>;
    }

    if (leaveBalanceStatus === 'error') {
      return <div className="hrEmpLeaveBalance__feedback is-error">{leaveBalanceError}</div>;
    }

    return (
      <>
        <div className="hrEmpLeaveBalance__create">
          <div className="hrEmpLeaveBalance__createHead">
            <strong>Standard balances are created automatically</strong>
            <span>Use this section for corrections and for adding special leave types only when the employee is eligible.</span>
          </div>
        </div>

        {orderedLeaveBalances.length > 0 ? (
          <div className="hrEmpLeaveBalance__list">
            {orderedLeaveBalances.map((balance) => {
              const leaveType = String(balance.leaveType ?? '');
              const adjustForm = leaveBalanceAdjustForms[leaveType] ?? { balanceHours: '', type: 'add' };
              const isSavingBalance = leaveBalanceSavingKey === leaveType;

              return (
                <article key={leaveType || String(balance.leaveId)} className="hrEmpLeaveBalance__card">
                  <div className="hrEmpLeaveBalance__meta">
                    <div>
                      <span className="hrEmpLeaveBalance__label">Leave Type</span>
                      <strong>{formatLeaveTypeLabel(leaveType)}</strong>
                    </div>
                    <div>
                      <span className="hrEmpLeaveBalance__label">Current Balance</span>
                      <strong>{formatBalanceHoursLabel(balance.balanceHours)}</strong>
                    </div>
                  </div>

                  <div className="hrEmpLeaveBalance__controls">
                    <div className="hrEmpField">
                      <label>Adjustment Type</label>
                      <select
                        value={adjustForm.type}
                        onChange={(event) =>
                          setLeaveBalanceAdjustField(
                            leaveType,
                            'type',
                            event.target.value as LeaveBalanceAdjustmentType
                          )
                        }
                      >
                        <option value="add">Add Hours</option>
                        <option value="subtract">Subtract Hours</option>
                      </select>
                    </div>

                    <div className="hrEmpField">
                      <label>Hours</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={adjustForm.balanceHours}
                        onChange={(event) => setLeaveBalanceAdjustField(leaveType, 'balanceHours', event.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <button
                      type="button"
                      className="hrEmpLeaveBalance__submit"
                      disabled={isSavingBalance}
                      onClick={() => void handleAdjustLeaveBalance(leaveType)}
                    >
                      {isSavingBalance ? 'Saving...' : 'Update Balance'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="hrEmpLeaveBalance__feedback">No leave balances are assigned yet for this employee.</div>
        )}

        {availableLeaveTypeOptions.length > 0 ? (
          <div className="hrEmpLeaveBalance__create">
            <div className="hrEmpLeaveBalance__createHead">
              <strong>Add Special Leave Type</strong>
              <span>Only add leave types that this employee is actually entitled to receive.</span>
            </div>

            <div className="hrEmpLeaveBalance__controls hrEmpLeaveBalance__controls--create">
              <div className="hrEmpField">
                <label>Leave Type</label>
                <select
                  value={leaveBalanceCreateForm.leaveType}
                  onChange={(event) => setLeaveBalanceCreateField('leaveType', event.target.value as LeaveType)}
                >
                  {availableLeaveTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hrEmpField">
                <label>Starting Hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={leaveBalanceCreateForm.balanceHours}
                  onChange={(event) => setLeaveBalanceCreateField('balanceHours', event.target.value)}
                  placeholder="0.00"
                />
              </div>

              <button
                type="button"
                className="hrEmpLeaveBalance__submit"
                disabled={leaveBalanceSavingKey === 'create'}
                onClick={() => void handleCreateLeaveBalance()}
              >
                {leaveBalanceSavingKey === 'create' ? 'Saving...' : 'Add Leave Type'}
              </button>
            </div>
          </div>
        ) : null}

        {leaveBalanceError ? <div className="hrEmpLeaveBalance__feedback is-error">{leaveBalanceError}</div> : null}
      </>
    );
  }

  function renderExpandedDetails(row: EmployeeRow) {
    const details = employeeDetailsById[row.id];
    const isLoading = Boolean(detailLoadingIds[row.id]);
    const detailError = detailErrors[row.id];
    const compliance = employeeComplianceById[row.id];
    const isComplianceLoading = Boolean(complianceLoadingIds[row.id]);
    const complianceError = complianceErrors[row.id];
    const username = details?.userAccountName ?? (row.username === '-' ? '' : row.username);
    const noteExpanded = Boolean(expandedSeparationNotes[row.id]);
    const separationNote = String(details?.separationNotes ?? '').trim();
    const canExpandSeparationNote = isLongSeparationNote(separationNote);

    if (isLoading && !details) {
      return <div className="hrEmpDetails__feedback">Loading employee details...</div>;
    }

    if (detailError && !details) {
      return <div className="hrEmpDetails__feedback is-error">{detailError}</div>;
    }

    if (!details) {
      return <div className="hrEmpDetails__feedback">No employee details available yet.</div>;
    }

    return (
      <>
        <div className="hrEmpDetails__hero">
          <div className="hrEmpDetails__heroText">
            <span className="hrEmpDetails__eyebrow">Employee Profile</span>
            <strong>{row.name}</strong>
            <span>Employee ID {row.id}</span>
          </div>
          <div className="hrEmpDetails__badges">
            <span>{displayValue(details.position ?? row.position)}</span>
            <span>{formatEmploymentStatusLabel(details.employmentStatus ?? row.status)}</span>
            <span>{displayValue(details.exemptionStatus)}</span>
          </div>
        </div>

        <div className="hrEmpDetails__grid">
          <section className="hrEmpDetails__card">
            <h3>Account and Contact</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Username</span>
                <strong>{displayValue(username)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Email</span>
                <strong>{displayValue(details.email)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Phone Number</span>
                <strong>{displayValue(details.phoneNumber)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Birth Date</span>
                <strong>{formatDateValue(details.birthDate)}</strong>
              </div>
            </div>
          </section>

          <section className="hrEmpDetails__card">
            <h3>Government Identifiers</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>SSS Number</span>
                <strong>{displayValue(details.sssNumber)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>PhilHealth ID</span>
                <strong>{displayValue(details.philhealthNumber)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Pag-IBIG MID</span>
                <strong>{displayValue(details.pagibigNumber)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>TIN</span>
                <strong>{displayValue(details.tinNumber)}</strong>
              </div>
            </div>
          </section>

          <section className="hrEmpDetails__card">
            <h3>Emergency Contact</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Contact Name</span>
                <strong>{displayValue(details.emergencyContactName)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Relationship</span>
                <strong>{displayValue(details.emergencyContactRelationship)}</strong>
              </div>
              <div className="hrEmpDetails__item hrEmpDetails__item--full">
                <span>Contact Number</span>
                <strong>{displayValue(details.emergencyContactNumber)}</strong>
              </div>
            </div>
          </section>

          <section className="hrEmpDetails__card">
            <h3>Employment</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Status</span>
                <strong>{formatEmploymentStatusLabel(details.employmentStatus)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Position</span>
                <strong>{displayValue(details.position)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Department</span>
                <strong>{displayValue(details.department)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Exemption Status</span>
                <strong>{displayValue(details.exemptionStatus)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Employment Start</span>
                <strong>{formatDateValue(details.employmentDateStart)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Employment End</span>
                <strong>{formatDateValue(details.employmentDateEnd)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Yearly Salary</span>
                <strong>{formatCurrencyValue(details.yearlySalary)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Manager ID</span>
                <strong>{displayValue(details.managerId)}</strong>
              </div>
            </div>
          </section>

          {(details.separationReason || details.separationNotes || details.separationEffectiveDate || details.separationProcessedBy) ? (
            <section className="hrEmpDetails__card hrEmpDetails__card--full">
              <h3>Separation Record</h3>
              <div className="hrEmpDetails__items">
                <div className="hrEmpDetails__item">
                  <span>Release Reason</span>
                  <strong>{formatSeparationReasonLabel(details.separationReason)}</strong>
                </div>
                <div className="hrEmpDetails__item">
                  <span>Eligible for Rehire</span>
                  <strong>{details.eligibleForRehire === undefined ? '-' : details.eligibleForRehire ? 'Yes' : 'No'}</strong>
                </div>
                <div className="hrEmpDetails__item">
                  <span>Effective Date</span>
                  <strong>{formatDateValue(details.separationEffectiveDate)}</strong>
                </div>
                <div className="hrEmpDetails__item">
                  <span>Recorded By</span>
                  <strong>{displayValue(details.separationProcessedBy)}</strong>
                </div>
                <div className="hrEmpDetails__item hrEmpDetails__item--full">
                  <span>Notes</span>
                  <strong className={`hrEmpDetails__noteValue ${noteExpanded ? 'is-expanded' : ''}`}>
                    {displayValue(details.separationNotes)}
                  </strong>
                  {canExpandSeparationNote ? (
                    <button
                      type="button"
                      className="hrEmpDetails__toggle"
                      onClick={() => toggleSeparationNote(row.id)}
                    >
                      {noteExpanded ? 'Show less' : 'Show more'}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="hrEmpDetails__card hrEmpDetails__card--full">
            <div className="hrEmpLeaveBalance__header">
              <div>
                <h3>Leave Balances</h3>
                <p>Review the employee's current leave balances here. Use Edit Employee to adjust them.</p>
              </div>
            </div>
            {renderLeaveBalanceSummary()}
          </section>

          <section className="hrEmpDetails__card hrEmpDetails__card--full">
            <div className="hrEmpLeaveBalance__header">
              <div>
                <h3>Compliance Record</h3>
                <p>Confidential HR dossier for legal compliance, employee files, requests, disputes, and performance tracking.</p>
              </div>
            </div>

            {isComplianceLoading && !compliance ? (
              <div className="hrEmpDetails__feedback">Loading compliance record...</div>
            ) : null}

            {complianceError && !compliance ? (
              <div className="hrEmpDetails__feedback is-error">{complianceError}</div>
            ) : null}

            {compliance ? (
              <div className="hrEmpCompliance">
                <div className="hrEmpCompliance__summary">
                  <div className="hrEmpCompliance__summaryCard">
                    <span>Files</span>
                    <strong>{compliance.documents?.length ?? 0}</strong>
                  </div>
                  <div className="hrEmpCompliance__summaryCard">
                    <span>Leave Requests</span>
                    <strong>{compliance.leaveRequests?.length ?? 0}</strong>
                  </div>
                  <div className="hrEmpCompliance__summaryCard">
                    <span>Disputes</span>
                    <strong>{compliance.disputes?.length ?? 0}</strong>
                  </div>
                  <div className="hrEmpCompliance__summaryCard">
                    <span>Disciplinary Actions</span>
                    <strong>{compliance.disciplinaryActions?.length ?? 0}</strong>
                  </div>
                  <div className="hrEmpCompliance__summaryCard">
                    <span>Avg Hours / Window Day</span>
                    <strong>{formatHoursValue(compliance.performanceSummary?.averageHoursPerWindowDay)}</strong>
                  </div>
                </div>

                <div className="hrEmpCompliance__grid">
                  <section className="hrEmpCompliance__section">
                    <div className="hrEmpCompliance__sectionHead">
                      <strong>Employment Journey</strong>
                      <span>{compliance.timeline?.length ?? 0} entries</span>
                    </div>
                    {compliance.timeline && compliance.timeline.length > 0 ? (
                      <div className="hrEmpCompliance__list hrEmpCompliance__list--timeline">
                        {compliance.timeline.map((entry, index) => (
                          <article key={`${entry.type ?? 'timeline'}-${entry.timestamp ?? index}`} className="hrEmpCompliance__timelineItem">
                            <div className="hrEmpCompliance__timelineMeta">
                              <span>{displayValue(entry.type)}</span>
                              <strong>{formatDateTimeValue(entry.timestamp)}</strong>
                            </div>
                            <h4>{displayValue(entry.title)}</h4>
                            <p>{displayValue(entry.detail)}</p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="hrEmpCompliance__empty">No employment journey entries yet.</div>
                    )}
                  </section>

                  <section className="hrEmpCompliance__section">
                    <div className="hrEmpCompliance__sectionHead">
                      <strong>Files and Contracts</strong>
                      <span>{compliance.documents?.length ?? 0} files</span>
                    </div>
                    {compliance.documents && compliance.documents.length > 0 ? (
                      <div className="hrEmpCompliance__list">
                        {compliance.documents.map((document, index) => (
                          <article key={document.pathId ?? index} className="hrEmpCompliance__entry">
                            <div className="hrEmpCompliance__entryBody">
                              <span>{displayValue(document.category)}</span>
                              <strong>{displayValue(document.fileName)}</strong>
                              <p>{displayValue(document.fileType)}</p>
                            </div>
                            {typeof document.pathId === 'number' ? (
                              <button
                                type="button"
                                className="hrEmpCompliance__action"
                                onClick={() => void openDocumentAttachment(document.pathId!)}
                              >
                                View File
                              </button>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="hrEmpCompliance__empty">No uploaded compliance files yet.</div>
                    )}
                  </section>

                  <section className="hrEmpCompliance__section">
                    <div className="hrEmpCompliance__sectionHead">
                      <strong>Leave Request History</strong>
                      <span>{compliance.leaveRequests?.length ?? 0} requests</span>
                    </div>
                    {compliance.leaveRequests && compliance.leaveRequests.length > 0 ? (
                      <div className="hrEmpCompliance__list">
                        {compliance.leaveRequests.map((request, index) => (
                          <article key={request.requestId ?? index} className="hrEmpCompliance__entry">
                            <div className="hrEmpCompliance__entryBody">
                              <span>{displayValue(request.status)}</span>
                              <strong>{displayValue(request.leaveType)}</strong>
                              <p>
                                {formatDateValue(request.startDateTime)} to {formatDateValue(request.endDateTime)}
                                {request.paid !== undefined ? ` • ${request.paid ? 'Paid' : 'Unpaid'}` : ''}
                              </p>
                              {request.reason ? <p>{request.reason}</p> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="hrEmpCompliance__empty">No leave request history yet.</div>
                    )}
                  </section>

                  <section className="hrEmpCompliance__section">
                    <div className="hrEmpCompliance__sectionHead">
                      <strong>Disputes</strong>
                      <span>{compliance.disputes?.length ?? 0} cases</span>
                    </div>
                    {compliance.disputes && compliance.disputes.length > 0 ? (
                      <div className="hrEmpCompliance__list">
                        {compliance.disputes.map((dispute, index) => (
                          <article key={dispute.disputeId ?? index} className="hrEmpCompliance__entry">
                            <div className="hrEmpCompliance__entryBody">
                              <span>{displayValue(dispute.status)}</span>
                              <strong>{displayValue(dispute.subject)}</strong>
                              <p>{displayValue(dispute.reason)}</p>
                              <p>
                                Updated {formatDateTimeValue(dispute.updatedAt ?? dispute.createdAt)}
                                {dispute.approver ? ` • ${dispute.approver}` : ''}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="hrEmpCompliance__empty">No dispute records yet.</div>
                    )}
                  </section>

                  <section className="hrEmpCompliance__section">
                    <div className="hrEmpCompliance__sectionHead">
                      <strong>Disciplinary Actions</strong>
                      <span>{compliance.disciplinaryActions?.length ?? 0} records</span>
                    </div>
                    {compliance.disciplinaryActions && compliance.disciplinaryActions.length > 0 ? (
                      <div className="hrEmpCompliance__list">
                        {compliance.disciplinaryActions.map((action, index) => (
                          <article key={`${action.action ?? 'disciplinary'}-${action.recordedAt ?? index}`} className="hrEmpCompliance__entry">
                            <div className="hrEmpCompliance__entryBody">
                              <span>{displayValue(action.status)}</span>
                              <strong>{displayValue(action.action)}</strong>
                              <p>{displayValue(action.summary)}</p>
                              <p>
                                {formatDateTimeValue(action.recordedAt)}
                                {action.recordedBy ? ` • ${action.recordedBy}` : ''}
                              </p>
                              {action.notes ? <p>{action.notes}</p> : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="hrEmpCompliance__empty">No disciplinary actions recorded.</div>
                    )}
                  </section>

                  <section className="hrEmpCompliance__section">
                    <div className="hrEmpCompliance__sectionHead">
                      <strong>Performance Tracking</strong>
                      <span>Past {compliance.performanceSummary?.windowDays ?? 30} days</span>
                    </div>
                    <div className="hrEmpCompliance__performance">
                      <div className="hrEmpCompliance__performanceItem">
                        <span>Total Hours</span>
                        <strong>{formatHoursValue(compliance.performanceSummary?.totalHours)}</strong>
                      </div>
                      <div className="hrEmpCompliance__performanceItem">
                        <span>Average / Attendance Day</span>
                        <strong>{formatHoursValue(compliance.performanceSummary?.averageHoursPerAttendanceDay)}</strong>
                      </div>
                      <div className="hrEmpCompliance__performanceItem">
                        <span>Average / Window Day</span>
                        <strong>{formatHoursValue(compliance.performanceSummary?.averageHoursPerWindowDay)}</strong>
                      </div>
                      <div className="hrEmpCompliance__performanceItem">
                        <span>Attendance Days</span>
                        <strong>{displayValue(compliance.performanceSummary?.attendanceDays)}</strong>
                      </div>
                      <div className="hrEmpCompliance__performanceItem">
                        <span>Complete Log Pairs</span>
                        <strong>{displayValue(compliance.performanceSummary?.completeLogPairs)}</strong>
                      </div>
                      <div className="hrEmpCompliance__performanceItem">
                        <span>Incomplete Log Days</span>
                        <strong>{displayValue(compliance.performanceSummary?.incompleteLogDays)}</strong>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
          </section>

          <section className="hrEmpDetails__card hrEmpDetails__card--full">
            <h3>Address</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Permanent Address</span>
                <strong>{displayValue(details.address?.permanentAddress)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Temporary Address</span>
                <strong>{displayValue(details.address?.temporaryAddress)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>City</span>
                <strong>{displayValue(details.address?.city)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>State</span>
                <strong>{displayValue(details.address?.state)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Country</span>
                <strong>{displayValue(details.address?.country)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Zip Code</span>
                <strong>{displayValue(details.address?.zipCode)}</strong>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  const emptyStateMessage =
    employeeRows.length === 0
      ? rosterLoadError
        ? 'Waiting for the employee roster.'
        : loadMessage || 'Waiting for backend data.'
      : 'No employees match your search or current filters.';

  return (
    <div className="hrEmp">
      <div className="hrEmp__head">
        <PageHeader
          title="Employee Management"
          description="Maintain employee records, accounts, and employment details from one directory."
          titleMeta={
            <SensitiveAccessIndicator
              onActivate={() =>
                sensitiveAccess.requestVerification(
                  async () => Promise.resolve(),
                  'Verify sensitive access to unlock employee management.'
                )
              }
            />
          }
        />
        <div className="hrEmp__headActions">
          <button type="button" className="hrEmpTable__actionBtn" onClick={openAddModal}>
            <FiPlus aria-hidden="true" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      <section className="hrEmpTable">
        <div className="hrEmpToolbar">
          <label className="uSearch" aria-label="Search employees">
            <FiSearch />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by employee name, ID, username, email, phone, role, or department"
            />
            {searchValue ? (
              <button type="button" aria-label="Clear employee search" onClick={() => setSearchValue('')}>
                <FiXCircle />
              </button>
            ) : null}
          </label>

          <div className="hrEmpToolbar__actions">
            <EmployeeSortMenu value={employeeSort} onChange={setEmployeeSort} />

            <div className="uFilter">
              <button
                type="button"
                className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${
                  activeFilterCount > 0 ? 'is-active' : ''
                }`}
                onClick={() => {
                  setFilterOpen((open) => !open);
                  setExportMenuOpen(false);
                }}
              >
                <FiFilter />
                <span>Filter</span>
              </button>

              {filterOpen ? (
                <div className="uFilter__panel">
                  <label className="uFilter__field">
                    <span>Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">All Statuses</option>
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="uFilter__field">
                    <span>Role</span>
                    <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
                      <option value="all">All Roles</option>
                      {filterPositionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="uFilter__field">
                    <span>Department</span>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                      <option value="all">All Departments</option>
                      {filterDepartmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="uFilter__actions">
                    <button type="button" onClick={clearFilters}>
                      Reset Filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="hrEmpMenu" ref={exportMenuRef}>
              <button
                type="button"
                className={`hrEmpMenu__toggle ${exportMenuOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setExportMenuOpen((open) => !open);
                  setFilterOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                aria-label="More employee table actions"
              >
                <FiMoreVertical />
              </button>

              {exportMenuOpen ? (
                <div className="hrEmpMenu__panel" role="menu" aria-label="Employee table actions">
                  <button
                    type="button"
                    className="hrEmpMenu__item"
                    role="menuitem"
                    onClick={exportEmployeeData}
                    disabled={visibleEmployeeRows.length === 0}
                  >
                    <FiDownload aria-hidden="true" />
                    <span>Export as CSV</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

          <div className="hrEmpTable__head">
          <div>EMP ID</div>
          <div>NAME</div>
          <div>Username</div>
          <div className="hrEmpTable__headCell--status">Status</div>
          <div>Position</div>
          <div>Email</div>
          <div className="hrEmpTable__headCell--actions"></div>
          </div>

        <div className="hrEmpTable__body">
          {visibleEmployeeRows.length > 0 ? (
            visibleEmployeeRows.map((row) => {
              const isTerminated = isTerminatedStatus(row.status);

              return (
                <div
                  key={row.id}
                  className={`hrEmpRow ${isTerminated ? 'is-terminated' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetailsDialog(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDetailsDialog(row.id);
                    }
                  }}
                >
                  <div>{row.id}</div>
                  <div className="hrEmpRow__name">
                    <span className="hrEmpRow__nameText">{row.name}</span>
                  </div>
                  <div>{row.username}</div>
                  <div className="hrEmpRow__statusCell">
                    {isTerminated ? 'RELEASED' : formatEmploymentStatusLabel(row.status)}
                  </div>
                  <div className="hrEmpRow__positionCell">
                    {row.position}
                  </div>
                  <div className="hrEmpRow__emailCell">
                    {row.email}
                  </div>
                  <div className="hrEmpRow__actions" onClick={(event) => event.stopPropagation()}>
                    {!isTerminated && (
                      <>
                        <button type="button" className="hrEmpRow__action" onClick={() => void openEditModal(row)} title="Edit employee">
                          <FiEdit2 aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="hrEmpRow__action hrEmpRow__action--danger"
                          onClick={() => openDeleteModal(row)}
                          title="Record employee separation"
                        >
                          <FiUserX aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="uEmptyState">
              No employee records to show. {emptyStateMessage}
            </div>
          )}
        </div>
      </section>

      {detailsDialogEmployee ? (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true" onClick={closeDetailsDialog}>
          <div className="hrEmpModal hrEmpModal--details" onClick={(event) => event.stopPropagation()}>
            <div className="hrEmpModal__top">
              <div className="hrEmpModal__heading">
                <h2>EMPLOYEE DETAILS</h2>
                <p className="hrEmpModal__subtitle">
                  Review the full employee profile, account information, and employment details in one view.
                </p>
              </div>
              <ModalCloseButton
                className="hrEmpModal__close"
                onClick={closeDetailsDialog}
                aria-label="Close employee details"
              />
            </div>
            <div className="hrEmpModal__rule" />
            <div className="hrEmpDetails hrEmpDetails--dialog" role="region" aria-label={`${detailsDialogEmployee.name} details`}>
              {renderExpandedDetails(detailsDialogEmployee)}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true">
          <div className={`hrEmpModal ${modal === 'delete' ? 'is-delete' : ''}`}>
            <div className="hrEmpModal__top">
              <div className="hrEmpModal__heading">
                <h2>{modal === 'add' ? 'ADD EMPLOYEE' : modal === 'edit' ? 'EDIT EMPLOYEE' : 'RECORD EMPLOYEE SEPARATION'}</h2>
                <p className="hrEmpModal__subtitle">
                  {modal === 'add'
                    ? 'Create the employee record and its login account together so HR does not need to manage them separately.'
                    : modal === 'edit'
                      ? 'Review the employee profile, employment details, and account access before saving the update.'
                      : 'Confirm the selected employee and document the release details before updating the employment status.'}
                </p>
              </div>
              <ModalCloseButton
                className="hrEmpModal__close"
                onClick={requestCloseModal}
                disabled={isSaving}
                aria-label="Close modal"
              />
            </div>
            <div className="hrEmpModal__rule" />

            <div className="hrEmpForm">
              {modal === 'delete' ? (
                <div className="hrEmpForm__section hrEmpForm__section--danger">
                  <div className="hrEmpForm__sectionTitle">Separation Details</div>
                  <div className="hrEmpDelete">
                    <div className="hrEmpDelete__summary">
                      <span className="hrEmpDelete__summaryLabel">Employee on record</span>
                      <strong>{selectedEmployee ? selectedEmployee.name : 'No employee selected yet'}</strong>
                      <span>
                        {selectedEmployee
                          ? `Employee ID ${selectedEmployee.id} | ${selectedEmployee.username === '-' ? 'No username yet' : selectedEmployee.username} | ${selectedEmployee.position} | ${formatEmploymentStatusLabel(selectedEmployee.status)}`
                          : 'Select a valid employee record before recording the separation.'}
                      </span>
                    </div>

                    <div className="hrEmpForm__grid hrEmpForm__grid--delete">
                      <div className="hrEmpField">
                        <label>Employee ID</label>
                        <input value={form.employeeId} readOnly placeholder="Employee ID" />
                      </div>

                      <div className="hrEmpField">
                        <label>Separation Reason</label>
                        <select
                          value={form.separationReason}
                          onChange={(event) => setField('separationReason', event.target.value as FormState['separationReason'])}
                        >
                          <option value="">Select a reason</option>
                          {separationReasonOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Eligible for Rehire</label>
                        <select
                          value={form.eligibleForRehire}
                          onChange={(event) => setField('eligibleForRehire', event.target.value as FormState['eligibleForRehire'])}
                        >
                          <option value="">Select</option>
                          <option value="YES">Yes</option>
                          <option value="NO">No</option>
                        </select>
                      </div>

                      <div className="hrEmpField hrEmpField--full">
                        <label>Notes</label>
                        <textarea
                          value={form.separationNotes}
                          onChange={(event) => setField('separationNotes', event.target.value)}
                          placeholder="Optional HR notes for the separation record"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Employment Details</div>
                    <div className="hrEmpForm__grid">
                      {modal === 'edit' ? (
                        <div className="hrEmpField">
                          <label>Employee ID</label>
                          <input value={form.employeeId} readOnly />
                        </div>
                      ) : null}

                      <div className="hrEmpField">
                        <label>Status</label>
                        <select
                          value={form.employmentStatus}
                          onChange={(event) => setField('employmentStatus', event.target.value)}
                        >
                          {employmentStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Position</label>
                        <select value={form.position} onChange={(event) => handlePositionChange(event.target.value)}>
                          {positionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Exemption Status</label>
                        <select
                          value={form.exemptionStatus}
                          onChange={(event) => setField('exemptionStatus', event.target.value)}
                        >
                          {exemptionStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Employment Start Date</label>
                        <input
                          type="date"
                          value={form.employmentDateStart}
                          onChange={(event) => setField('employmentDateStart', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Employment End Date</label>
                        <input
                          type="date"
                          value={form.employmentDateEnd}
                          onChange={(event) => setField('employmentDateEnd', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Yearly Salary</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.yearlySalary}
                          onChange={(event) => setField('yearlySalary', event.target.value)}
                          placeholder="Optional salary amount"
                        />
                      </div>

                      {showManagerPicker ? (
                        <div className="hrEmpField hrEmpField--manager">
                          <div className="hrEmpField__labelRow">
                            <label>Manager</label>
                            {selectedManagerOption ? (
                              <span className="hrEmpCombo__labelPill" aria-live="polite">
                                {selectedManagerOption.department || 'Not assigned'}
                              </span>
                            ) : null}
                          </div>
                          <div
                            className={`hrEmpCombo hrEmpCombo--compact ${managerPickerOpen ? 'is-open' : ''}`}
                            ref={managerPickerRef}
                          >
                            <div className="hrEmpCombo__control" aria-invalid={managerSelectionMissing ? 'true' : undefined}>
                              <input
                                type="text"
                                className="hrEmpCombo__input"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-controls="employee-manager-options"
                                aria-expanded={managerPickerOpen}
                                aria-haspopup="listbox"
                                aria-invalid={managerSelectionMissing ? 'true' : undefined}
                                value={managerSearch}
                                onFocus={() => setManagerPickerOpen(true)}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setManagerSearch(nextValue);
                                  setManagerPickerOpen(true);
                                  if (normalizeText(selectedManagerOption?.name ?? '') !== normalizeText(nextValue)) {
                                    setField('managerId', '');
                                  }
                                }}
                                placeholder={isLoadingEmployeeOptions ? 'Loading managers...' : 'Search by manager name'}
                                disabled={isLoadingEmployeeOptions}
                              />
                              {canClearManagerPicker ? (
                                <button
                                  type="button"
                                  className="hrEmpCombo__clear"
                                  onClick={clearManagerSelection}
                                  disabled={isLoadingEmployeeOptions}
                                  aria-label="Clear manager selection"
                                >
                                  <FiX />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="hrEmpCombo__toggle"
                                onClick={() => setManagerPickerOpen((current) => !current)}
                                disabled={isLoadingEmployeeOptions}
                                aria-label={managerPickerOpen ? 'Close manager list' : 'Open manager list'}
                              >
                                <FiChevronDown />
                              </button>
                            </div>

                            {managerPickerOpen ? (
                              <div className="hrEmpCombo__menu" id="employee-manager-options" role="listbox">
                                {isLoadingEmployeeOptions ? (
                                  <div className="hrEmpCombo__empty">Loading managers...</div>
                                ) : filteredManagerOptions.length > 0 ? (
                                  filteredManagerOptions.map((option) => {
                                    const isSelected = option.id === Number(form.managerId);
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`hrEmpCombo__option ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => selectManager(option)}
                                      >
                                        <span className="hrEmpCombo__optionName">{option.name}</span>
                                        <span className="hrEmpCombo__optionMeta">
                                          {option.department || 'No department assigned yet'}
                                        </span>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="hrEmpCombo__empty">No managers match that search.</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                          {employeeOptionsError ? (
                            <span className="hrEmpField__hint is-error">
                              Manager list could not be loaded right now. ({employeeOptionsError})
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {showDepartmentPicker ? (
                        <div className="hrEmpField">
                          <label>Department</label>
                          <select
                            value={form.department}
                            aria-invalid={departmentMissing ? 'true' : undefined}
                            onChange={(event) => setField('department', event.target.value)}
                          >
                            <option value="">Select department</option>
                            {managerDepartmentOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {modal === 'edit' ? (
                    <div className="hrEmpForm__section">
                      <div className="hrEmpForm__sectionTitle">Leave Balances</div>
                      {renderLeaveBalanceEditor()}
                    </div>
                  ) : null}

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Personal Information</div>
                    <div className="hrEmpForm__grid">
                      <div className="hrEmpField">
                        <label>First Name</label>
                        <input
                          value={form.firstName}
                          aria-invalid={firstNameMissing ? 'true' : undefined}
                          onChange={(event) => setField('firstName', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Middle Name</label>
                        <input
                          value={form.middleName}
                          placeholder="Optional middle name"
                          onChange={(event) => setField('middleName', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Last Name</label>
                        <input
                          value={form.lastName}
                          aria-invalid={lastNameMissing ? 'true' : undefined}
                          onChange={(event) => setField('lastName', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Birth Date</label>
                        <input
                          type="date"
                          value={form.birthDate}
                          aria-invalid={birthDateMissing ? 'true' : undefined}
                          onChange={(event) => setField('birthDate', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Email</label>
                        <input
                          type="email"
                          value={form.email}
                          aria-invalid={emailMissing ? 'true' : undefined}
                          onChange={(event) => setField('email', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={11}
                          placeholder={modal === 'add' ? 'Required 11-digit mobile number' : 'Optional 11-digit mobile number'}
                          aria-invalid={phoneInputInvalid ? 'true' : undefined}
                          value={form.phoneNumber}
                          onChange={(event) => setField('phoneNumber', sanitizePhoneNumber(event.target.value))}
                        />
                        {phoneHasError && <span className="hrEmpField__hint is-error">{phoneHelperMessage}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Government Identifiers</div>
                    <div className="hrEmpForm__grid">
                      <div className="hrEmpField">
                        <label>SSS Number</label>
                        <input
                          value={form.sssNumber}
                          placeholder="00-0000000-0"
                          onChange={(event) => setField('sssNumber', event.target.value)}
                        />
                      </div>
                      <div className="hrEmpField">
                        <label>PhilHealth ID</label>
                        <input
                          value={form.philhealthNumber}
                          placeholder="00-000000000-0"
                          onChange={(event) => setField('philhealthNumber', event.target.value)}
                        />
                      </div>
                      <div className="hrEmpField">
                        <label>Pag-IBIG MID</label>
                        <input
                          value={form.pagibigNumber}
                          placeholder="0000-0000-0000"
                          onChange={(event) => setField('pagibigNumber', event.target.value)}
                        />
                      </div>
                      <div className="hrEmpField">
                        <label>TIN</label>
                        <input
                          value={form.tinNumber}
                          placeholder="000-000-000-000"
                          onChange={(event) => setField('tinNumber', event.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Emergency Contact</div>
                    <div className="hrEmpForm__grid">
                      <div className="hrEmpField">
                        <label>Contact Name</label>
                        <input
                          value={form.emergencyContactName}
                          placeholder="Full name of emergency contact"
                          onChange={(event) => setField('emergencyContactName', event.target.value)}
                        />
                      </div>
                      <div className="hrEmpField">
                        <label>Relationship</label>
                        <input
                          value={form.emergencyContactRelationship}
                          placeholder="e.g. Spouse, Parent, Sibling"
                          onChange={(event) => setField('emergencyContactRelationship', event.target.value)}
                        />
                      </div>
                      <div className="hrEmpField">
                        <label>Contact Number</label>
                        <input
                          value={form.emergencyContactNumber}
                          placeholder="Phone number"
                          onChange={(event) => setField('emergencyContactNumber', event.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Account Access</div>
                    <div className="hrEmpForm__grid hrEmpForm__grid--account">
                      <div className="hrEmpField">
                        <label>Username</label>
                        <input
                          autoComplete="off"
                          value={form.username}
                          aria-invalid={usernameMissing ? 'true' : undefined}
                          onChange={(event) => setField('username', event.target.value)}
                          placeholder="Required"
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>{modal === 'add' ? 'Password' : 'Password Reset'}</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={form.password}
                          aria-invalid={passwordMissing ? 'true' : undefined}
                          onChange={(event) => setField('password', event.target.value)}
                          placeholder={modal === 'add' ? 'Required' : 'Leave blank to keep current password'}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Address Information</div>
                    <div className="hrEmpForm__grid">
                      <div className="hrEmpField">
                        <label>Permanent Address</label>
                        <input
                          value={form.permanentAddress}
                          placeholder="Optional permanent address"
                          onChange={(event) => setField('permanentAddress', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Temporary Address</label>
                        <input
                          value={form.temporaryAddress}
                          placeholder="Optional temporary address"
                          onChange={(event) => setField('temporaryAddress', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>City</label>
                        <input
                          value={form.city}
                          placeholder="Optional city"
                          onChange={(event) => setField('city', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>State</label>
                        <input
                          value={form.state}
                          placeholder="Optional state"
                          onChange={(event) => setField('state', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Country</label>
                        <input
                          value={form.country}
                          placeholder="Optional country"
                          onChange={(event) => setField('country', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Zip Code</label>
                        <input
                          value={form.zipCode}
                          placeholder="Optional ZIP code"
                          onChange={(event) => setField('zipCode', event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hrEmpModal__actions">
              <button type="button" onClick={requestCloseModal} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => void submit()} disabled={isSaving}>
                {modal === 'add' ? 'Add Employee' : modal === 'edit' ? 'Save Changes' : 'Record Separation'}
              </button>
            </div>

          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction === 'edit' ? 'Confirm Employee Update' : 'Confirm Separation Record'}
        message={
          confirmAction === 'edit'
            ? `Are you sure you want to save the changes for ${
                [form.firstName, form.middleName, form.lastName]
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .join(' ') || `employee ID ${form.employeeId}`
              }?`
            : `Are you sure you want to mark employee ID ${form.employeeId}${selectedEmployee ? ` (${selectedEmployee.name})` : ''} as inactive and save the separation record?`
        }
        confirmLabel={confirmAction === 'edit' ? 'Confirm Edit' : 'Confirm Separation'}
        cancelLabel="Go Back"
        isBusy={isSaving}
        onConfirm={() => void confirmAndSubmit()}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this employee form. If you close it now, your edits will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={discardAndCloseModal}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
      <SensitiveAccessModal
        open={sensitiveAccess.open}
        onClose={sensitiveAccess.close}
        onVerified={sensitiveAccess.handleVerified}
        notice={sensitiveAccess.notice}
      />
    </div>
  );
}
