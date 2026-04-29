import type { EmployeeDetails, EmployeeOption, LeaveBalanceRow } from '../../../lib/types/employee';
import type {
  EmployeeRow,
  FormState,
  LeaveType,
  OrderedLeaveBalance,
  SeparationReason,
} from './types';

export const employmentStatusOptions = ['REGULAR', 'NEW_HIRE', 'PART_TIME', 'SUSPENDED', 'TERMINATED'] as const;
export const exemptionStatusOptions = ['EXEMPT', 'NON_EXEMPT'] as const;
export const positionOptions = ['EMPLOYEE', 'MANAGER', 'HR', 'MANAGEMENT', 'ACCOUNTING', 'UNKNOWN'] as const;
export const separationReasonOptions: Array<{ label: string; value: SeparationReason }> = [
  { label: 'Terminated', value: 'TERMINATED' },
  { label: 'Voluntary Resignation', value: 'VOLUNTARY_RESIGNATION' },
  { label: 'Involuntary Separation', value: 'INVOLUNTARY_SEPARATION' },
  { label: 'End of Contract', value: 'END_OF_CONTRACT' },
  { label: 'Deceased', value: 'DECEASED' },
];
export const managerDepartmentOptions = [
  'People Operations Department',
  'Procurements Department',
  'Productions Department',
  'Product Development Department',
] as const;
export const leaveTypeOptions: Array<{ label: string; value: LeaveType }> = [
  { label: 'Sick Leave', value: 'SICK_LEAVE' },
  { label: 'Vacation Leave', value: 'VACATION_LEAVE' },
  { label: 'Maternity Leave', value: 'MATERNITY_LEAVE' },
  { label: 'Paternity Leave', value: 'PATERNITY_LEAVE' },
  { label: 'Solo Parent Leave', value: 'SOLO_PARENT_LEAVE' },
  { label: 'Magna Carta', value: 'MAGNA_CARTA' },
  { label: 'RA 9262', value: 'RA9262' },
  { label: 'Emergency Leave', value: 'EMERGENCY_LEAVE' },
];
export const HOURS_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export const emptyForm: FormState = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  employmentStatus: 'REGULAR',
  exemptionStatus: 'NON_EXEMPT',
  employmentDateStart: '',
  employmentDateEnd: '',
  companyEmail: '',
  personalEmail: '',
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

export const emptyLeaveBalanceCreateForm = {
  leaveType: 'SICK_LEAVE' as LeaveType,
  balanceHours: '',
};

export function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function toCsvValue(value: unknown) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsvContent(rows: string[][]) {
  return rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n');
}

export function buildEmployeeExportFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `employees-${year}-${month}-${day}.csv`;
}

export function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isTerminatedStatus(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase() === 'TERMINATED';
}

export function toRehireSelectValue(value?: boolean) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  return '';
}

export function fromRehireSelectValue(value: FormState['eligibleForRehire']) {
  if (value === 'YES') return true;
  if (value === 'NO') return false;
  return undefined;
}

export function normalizeSeparationReason(value?: string | null): FormState['separationReason'] {
  const normalized = String(value ?? '').trim().toUpperCase();
  return separationReasonOptions.some((option) => option.value === normalized)
    ? (normalized as SeparationReason)
    : '';
}

export function formatEmploymentStatusLabel(value?: string | null) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return '-';
  if (normalized === 'TERMINATED') return 'INACTIVE';
  return normalized.replace(/_/g, ' ');
}

export function formatSeparationReasonLabel(value?: SeparationReason | string | null) {
  const normalized = String(value ?? '').trim().toUpperCase();
  const match = separationReasonOptions.find((option) => option.value === normalized);
  return match?.label ?? displayValue(value);
}

export function isLongSeparationNote(value?: string | null) {
  const text = String(value ?? '').trim();
  return text.length > 120 || text.includes('\n');
}

export function buildEmployeeSearchIndex(row: Omit<EmployeeRow, 'searchIndex'>) {
  return normalizeText(
    [row.id, row.name, row.username, row.status, row.email, row.personalEmail, row.phone, row.position, row.department].join(' ')
  );
}

export function getDefaultExemptionStatus(position: string) {
  return position === 'MANAGER' || position === 'MANAGEMENT' || position === 'HR' ? 'EXEMPT' : 'NON_EXEMPT';
}

export function isEmployeePosition(position?: string | null) {
  return String(position ?? '')
    .trim()
    .toUpperCase() === 'EMPLOYEE';
}

export function isManagerPosition(position?: string | null) {
  return String(position ?? '')
    .trim()
    .toUpperCase() === 'MANAGER';
}

export function buildEmployeeOptions(response: unknown) {
  return (Array.isArray(response) ? response : [])
    .map((item) => {
      const option = item as Record<string, unknown>;
      const id = Number(option.employeeId ?? option.id);
      if (!Number.isFinite(id)) return null;

      const name =
        [option.firstName, option.middleName, option.lastName]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          .join(' ') || `Employee #${id}`;

      return {
        id,
        name,
        status: String(option.employmentStatus ?? option.status ?? ''),
        position: String(option.position ?? ''),
        department: String(option.department ?? ''),
      } satisfies EmployeeOption;
    })
    .filter((option): option is EmployeeOption => option !== null)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
}

export function formatDateValue(value?: string | null) {
  if (!value) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTimeValue(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCurrencyValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString(undefined, {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  });
}

export function formatLeaveTypeLabel(value?: string) {
  const normalized = String(value ?? '').trim().toUpperCase();
  const match = leaveTypeOptions.find((option) => option.value === normalized);
  if (match) return match.label;
  return normalized ? normalized.replace(/_/g, ' ') : '-';
}

export function parseBalanceHours(value?: number | string | null) {
  const parsed = typeof value === 'number' ? value : Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatBalanceHoursLabel(value?: number | string | null) {
  const parsed = parseBalanceHours(value);
  return parsed === null ? '-' : `${HOURS_FORMATTER.format(parsed)} hr${parsed === 1 ? '' : 's'}`;
}

export function formatHoursValue(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${HOURS_FORMATTER.format(value)} hrs`;
}

export function displayValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export function mergeRowWithDetails(row: EmployeeRow, details: EmployeeDetails): EmployeeRow {
  const rowBase = {
    id: row.id,
    name: row.name,
    username: details.userAccountName?.trim() ? details.userAccountName : row.username,
    status: details.employmentStatus?.trim() ? details.employmentStatus : row.status,
    email: details.companyEmail?.trim() ? details.companyEmail : row.email,
    personalEmail: details.personalEmail?.trim() ? details.personalEmail : row.personalEmail,
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

export function toOrderedLeaveBalances(
  leaveBalances: LeaveBalanceRow[],
  leaveBalancesByType: Map<string, LeaveBalanceRow>
) {
  const knownTypes = new Set<string>(leaveTypeOptions.map((option) => option.value));
  const known = leaveTypeOptions
    .map((option) => leaveBalancesByType.get(option.value))
    .filter((balance): balance is OrderedLeaveBalance => Boolean(balance?.leaveType));
  const extras = leaveBalances.filter(
    (balance): balance is OrderedLeaveBalance =>
      typeof balance.leaveType === 'string' && balance.leaveType.length > 0 && !knownTypes.has(balance.leaveType)
  );

  return [...known, ...extras];
}
