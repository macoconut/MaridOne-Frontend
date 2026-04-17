import { useLoading } from '../../../context/useLoading';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiEdit2,
  FiFilter,
  FiPlus,
  FiSearch,
  FiX,
  FiXCircle,
} from 'react-icons/fi';
import { ApiError, apiFetchJson, toArray } from '../../../lib/api';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import LargePopup from '../../../components/dialog/LargePopup';
import SensitiveAccessIndicator from '../../../components/security/SensitiveAccessIndicator';
import SensitiveAccessModal from '../../../components/security/SensitiveAccessModal';
import { useUiDialog } from '../../../components/dialog/useUiDialog';
import EmployeeSortMenu from '../../../components/layout/EmployeeSortMenu';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { useSensitiveAccessPrompt } from '../../../hooks/useSensitiveAccessPrompt';
import { useUnsavedChangesPrompt } from '../../../hooks/useUnsavedChangesPrompt';
import { compareEmployees, type EmployeeSortKey } from '../../../lib/employeeSort';
import { formatPayrollRunTypeLabel, formatPayrollStatusLabel, hasBonusEarning } from '../../../lib/payrollRunLabels';
import { extractAttachmentReference, openDocumentAttachment } from '../../../lib/documentAttachments';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import { getManilaNow } from '../../../lib/manilaTime';
import '../approvals/Approvals.css';
import '../../manager/pending-approvals/PendingApprovals.css';
import './Payslips.css';

type DisputeDto = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  itemId?: number;
  employeeId?: number;
  employeeName?: string;
  statusReason?: string;
};

type PayrollRunDto = {
  payId?: number;
  periodStart?: string;
  periodEnd?: string;
  paymentDate?: string;
  periodDescription?: string;
  payrollStatus?: string;
  runType?: string;
  itemCount?: number;
};

type PayrollItemSummaryDto = {
  empId?: number;
  firstName?: string;
  lastName?: string;
  itemId?: number;
  grossPay?: number | string;
  netPay?: number | string;
};

type PayrollItemSummaryRow = {
  itemId: number;
  empId?: number;
  employee: string;
  grossPay: number;
  deductions: number;
  netPay: number;
};

type EmployeeOption = {
  id: number;
  name: string;
  status: string;
  position: string;
  department: string;
};

type RunItemViewRow = PayrollItemSummaryRow & {
  role: string;
  department: string;
};

type ManualLineFormState = {
  empId: string;
  lineType: 'EARNING' | 'BONUS' | 'DEDUCTION';
  amount: string;
};

type DisputeStatusCode = 'PENDING' | 'WAITING_ADJUSTMENT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type DisputeStatusFilter = 'all' | DisputeStatusCode;
type DisputeTypeFilter = 'all' | 'Overtime' | 'Attendance Issue' | 'Absent Deduction' | 'General' | 'Other';

type DisputeRow = {
  id: number;
  itemId?: number;
  employeeId?: number;
  employeeName?: string;
  employee: string;
  payrollPeriod: string;
  submittedAt: string;
  sortStamp: number;
  statusCode: DisputeStatusCode;
  statusLabel: string;
  statusTone: 'pending' | 'waiting-adjustment' | 'approved' | 'rejected' | 'cancelled';
  subject: string;
  reason: string;
  decisionSummary?: string;
  attachmentPathId?: number;
};

type RunFormState = {
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  runType: 'REGULAR' | 'ADJUSTMENT';
};

type CorrectionIntent = {
  disputeId: number;
  itemId: number;
  employee: string;
  message: string;
  disputeReason: string;
  decisionReason: string;
};

type CorrectionSourceItem = {
  itemId?: number;
  empId?: number;
  firstName?: string;
  lastName?: string;
  grossPay?: number | string;
  netPay?: number | string;
  runDetails?: {
    id?: number;
    periodStart?: string;
    periodEnd?: string;
    payrollStatus?: string;
    runType?: string;
  };
};

type CorrectionLine = {
  key: string;
  lineId: number;
  lineType: 'EARNING' | 'DEDUCTION';
  label: string;
  amount: string;
  originalAmount?: string;
  adjustedBy?: string;
  adjustedAt?: string;
};

const PAYROLL_RUN_STORAGE_KEY = 'maridone.hr.latestPayrollRun';
const WAITING_DISPUTE_STORAGE_KEY = 'maridone.hr.waitingDisputes';
const EMPLOYEE_OPTIONS_TIMEOUT_MS = 10000;

function normalizeText(value?: string) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function mapDisputeType(subject?: string): Exclude<DisputeTypeFilter, 'all'> {
  const normalized = normalizeText(subject);
  if (normalized.includes('overtime')) return 'Overtime';
  if (normalized.includes('late') || normalized.includes('attendance')) return 'Attendance Issue';
  if (normalized.includes('absent')) return 'Absent Deduction';
  if (normalized.includes('general')) return 'General';
  return 'Other';
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';
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

function toAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: unknown) {
  return `P${toAmount(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toMoneyString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return '0.00';
}

function toOptionalMoneyString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return undefined;
}

function toOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function mapCorrectionLine(
  row: Record<string, unknown>,
  idx: number,
  lineType: CorrectionLine['lineType']
): CorrectionLine | null {
  const lineId = Number(row.earningsId ?? row.deductionsId);
  if (!Number.isFinite(lineId) || lineId <= 0) return null;

  return {
    key: `${lineType}-${String(row.earningsId ?? row.deductionsId ?? idx + 1)}`,
    lineId,
    lineType,
    label:
      lineType === 'EARNING'
        ? String(row.description ?? `Earning ${idx + 1}`)
        : String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`),
    amount: toMoneyString(row.amount),
    originalAmount: toOptionalMoneyString(row.originalAmount),
    adjustedBy: toOptionalText(row.adjustedBy),
    adjustedAt: toOptionalText(row.adjustedAt),
  };
}

function summarizePayrollItemLines(
  earnings: CorrectionLine[],
  deductions: CorrectionLine[],
  fallback?: PayrollItemSummaryRow | null
) {
  const hasDetailedLines = earnings.length > 0 || deductions.length > 0;
  const grossPay =
    earnings.length > 0 ? earnings.reduce((sum, line) => sum + toAmount(line.amount), 0) : toAmount(fallback?.grossPay);
  const totalDeductions =
    deductions.length > 0
      ? deductions.reduce((sum, line) => sum + toAmount(line.amount), 0)
      : toAmount(fallback?.deductions);
  const netPay = hasDetailedLines ? grossPay - totalDeductions : toAmount(fallback?.netPay);

  return {
    grossPay,
    deductions: totalDeductions,
    netPay,
  };
}

function employeeLabel(employeeName?: string, employeeId?: number) {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : '';
  if (trimmedName) return trimmedName;
  return typeof employeeId === 'number' ? `Employee #${employeeId}` : 'Employee unavailable';
}

function employeeLabelFromParts(firstName?: string, lastName?: string, employeeId?: number) {
  const fullName = [firstName, lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();

  if (fullName) return fullName;
  if (typeof employeeId === 'number') return `EMP ID ${employeeId}`;
  return 'Employee unavailable';
}

function getStandardPaymentDate(startIso: string, endIso: string): string | null {
  if (!startIso || !endIso) return null;
  const [startYear, startMonth, startDay] = startIso.split('-').map(Number);
  const [endYear, endMonth, endDay] = endIso.split('-').map(Number);

  // 11th to 25th of the same month -> Payout on 30th
  if (startDay === 11 && endDay === 25 && startYear === endYear && startMonth === endMonth) {
    const daysInMonth = new Date(startYear, startMonth, 0).getDate();
    const payDay = Math.min(30, daysInMonth);
    return `${startYear}-${String(startMonth).padStart(2, '0')}-${String(payDay).padStart(2, '0')}`;
  }

  // 26th to 10th of next month -> Payout on 15th
  const isNextMonth =
    (startMonth === 12 && endMonth === 1 && endYear === startYear + 1) ||
    (endMonth === startMonth + 1 && endYear === startYear);

  if (startDay === 26 && endDay === 10 && isNextMonth) {
    return `${endYear}-${String(endMonth).padStart(2, '0')}-15`;
  }

  return null;
}

function createDefaultRunForm(): RunFormState {
  const manila = getManilaNow();
  const todayIso = manila.dateKey;
  const start = `${manila.year}-${String(manila.month).padStart(2, '0')}-01`;

  return {
    periodStart: start,
    periodEnd: todayIso,
    paymentDate: todayIso,
    runType: 'REGULAR',
  };
}

function createDefaultManualLineForm(): ManualLineFormState {
  return {
    empId: '',
    lineType: 'EARNING',
    amount: '',
  };
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
    .sort((left, right) => left.name.localeCompare(right.name));
}

function describeRun(periodStart: string, periodEnd: string) {
  return `Payroll run ${periodStart} to ${periodEnd}`;
}

function describeAdjustmentRun(periodStart: string, periodEnd: string) {
  return `Payroll adjustment ${periodStart} to ${periodEnd}`;
}

function formatRunType(value?: string) {
  return formatPayrollRunTypeLabel(value);
}

function normalizeRunType(value?: string): RunFormState['runType'] {
  return value === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'REGULAR';
}

function getTodayIsoDate() {
  return getManilaNow().dateKey;
}

function isFutureIsoDate(value: string, todayIsoDate: string) {
  return Boolean(value) && value > todayIsoDate;
}

function readStoredRun() {
  try {
    const raw = window.localStorage.getItem(PAYROLL_RUN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PayrollRunDto;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistRunSelection(run: PayrollRunDto | null) {
  try {
    if (run) {
      window.localStorage.setItem(PAYROLL_RUN_STORAGE_KEY, JSON.stringify(run));
    } else {
      window.localStorage.removeItem(PAYROLL_RUN_STORAGE_KEY);
    }
  } catch {
    // ignore storage write failures
  }
}

function clearStoredRun() {
  try {
    window.localStorage.removeItem(PAYROLL_RUN_STORAGE_KEY);
  } catch {
    // ignore storage write failures
  }
}

function toSortStamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareRunsDescending(a: PayrollRunDto, b: PayrollRunDto) {
  const endDiff = toSortStamp(b.periodEnd) - toSortStamp(a.periodEnd);
  if (endDiff !== 0) return endDiff;

  const startDiff = toSortStamp(b.periodStart) - toSortStamp(a.periodStart);
  if (startDiff !== 0) return startDiff;

  return (b.payId ?? 0) - (a.payId ?? 0);
}

function pickCurrentRun(runs: PayrollRunDto[], preferredPayId?: number | null) {
  const preferredRun =
    preferredPayId != null ? runs.find((run) => run.payId === preferredPayId) ?? null : null;
  const latestInProgressRun = runs.find((run) => run.payrollStatus === 'IN_PROGRESS') ?? null;
  const latestRunWithItems = runs.find((run) => (run.itemCount ?? 0) > 0) ?? null;

  return (
    (preferredRun && preferredRun.payrollStatus !== 'POSTED' ? preferredRun : null) ??
    latestInProgressRun ??
    preferredRun ??
    latestRunWithItems ??
    runs[0] ??
    null
  );
}

function toDisputeStatusCode(value?: string): DisputeStatusCode {
  const normalized = String(value ?? 'PENDING').trim().toUpperCase();
  if (normalized === 'WAITING_ADJUSTMENT') return 'WAITING_ADJUSTMENT';
  if (normalized === 'APPROVED') return 'APPROVED';
  if (normalized === 'REJECTED') return 'REJECTED';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

function formatDisputeStatusLabel(status: DisputeStatusCode) {
  if (status === 'WAITING_ADJUSTMENT') return 'Waiting for Adjustment';
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Denied';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
}

function toDisputeStatusTone(status: DisputeStatusCode): DisputeRow['statusTone'] {
  if (status === 'WAITING_ADJUSTMENT') return 'waiting-adjustment';
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function toDisputeRow(item: DisputeDto, idx: number): DisputeRow {
  const attachment = extractAttachmentReference(item.reason);
  const statusCode = toDisputeStatusCode(item.status);
  return {
    id: item.id ?? idx + 1,
    itemId: item.itemId,
    employeeId: item.employeeId,
    employeeName: item.employeeName,
    employee: employeeLabel(item.employeeName, item.employeeId),
    payrollPeriod: item.createdAt ? formatDate(item.createdAt) : 'No date',
    submittedAt: formatDateTime(item.createdAt),
    sortStamp: toSortStamp(item.createdAt),
    statusCode,
    statusLabel: formatDisputeStatusLabel(statusCode),
    statusTone: toDisputeStatusTone(statusCode),
    subject: item.subject || 'Payroll dispute',
    reason: attachment.cleanText,
    decisionSummary: item.statusReason || '',
    attachmentPathId: attachment.attachmentPathId ?? undefined,
  };
}

function createWaitingDisputeRow(row: DisputeRow, decisionSummary: string): DisputeRow {
  return {
    ...row,
    sortStamp: row.sortStamp || Date.now(),
    statusCode: 'WAITING_ADJUSTMENT',
    statusLabel: formatDisputeStatusLabel('WAITING_ADJUSTMENT'),
    statusTone: toDisputeStatusTone('WAITING_ADJUSTMENT'),
    decisionSummary,
    attachmentPathId: row.attachmentPathId,
  };
}

function readWaitingDisputes() {
  try {
    const raw = window.localStorage.getItem(WAITING_DISPUTE_STORAGE_KEY);
    if (!raw) return [] as DisputeRow[];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry, idx) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Partial<DisputeRow>;
        const id = typeof row.id === 'number' ? row.id : idx + 1;
        return createWaitingDisputeRow(
          {
            id,
            itemId: typeof row.itemId === 'number' ? row.itemId : undefined,
            employeeId: typeof row.employeeId === 'number' ? row.employeeId : undefined,
            employeeName: typeof row.employeeName === 'string' ? row.employeeName : undefined,
            employee: typeof row.employee === 'string' && row.employee.trim().length > 0 ? row.employee : 'Employee unavailable',
            payrollPeriod: typeof row.payrollPeriod === 'string' && row.payrollPeriod.trim().length > 0 ? row.payrollPeriod : 'No date',
            submittedAt: typeof row.submittedAt === 'string' && row.submittedAt.trim().length > 0 ? row.submittedAt : 'Not available',
            sortStamp: typeof row.sortStamp === 'number' && Number.isFinite(row.sortStamp) ? row.sortStamp : 0,
            statusCode: 'WAITING_ADJUSTMENT',
            statusLabel: formatDisputeStatusLabel('WAITING_ADJUSTMENT'),
            statusTone: toDisputeStatusTone('WAITING_ADJUSTMENT'),
            subject: typeof row.subject === 'string' && row.subject.trim().length > 0 ? row.subject : 'Payroll dispute',
            reason: typeof row.reason === 'string' ? row.reason : '',
            decisionSummary: typeof row.decisionSummary === 'string' ? row.decisionSummary : '',
            attachmentPathId: typeof row.attachmentPathId === 'number' ? row.attachmentPathId : undefined,
          },
          typeof row.decisionSummary === 'string' ? row.decisionSummary : ''
        );
      })
      .filter((row): row is DisputeRow => row !== null);
  } catch {
    return [];
  }
}

function writeWaitingDisputes(rows: DisputeRow[]) {
  try {
    if (rows.length > 0) {
      window.localStorage.setItem(WAITING_DISPUTE_STORAGE_KEY, JSON.stringify(rows));
    } else {
      window.localStorage.removeItem(WAITING_DISPUTE_STORAGE_KEY);
    }
  } catch {
    // ignore storage write failures
  }
}

function upsertWaitingDispute(row: DisputeRow) {
  const existing = readWaitingDisputes();
  const next = [...existing.filter((entry) => entry.id !== row.id), createWaitingDisputeRow(row, row.decisionSummary || '')]
    .sort((left, right) => right.sortStamp - left.sortStamp || left.employee.localeCompare(right.employee));
  writeWaitingDisputes(next);
}

function removeWaitingDispute(disputeId: number) {
  const next = readWaitingDisputes().filter((entry) => entry.id !== disputeId);
  writeWaitingDisputes(next);
}

async function reconcileWaitingDisputes() {
  const cached = readWaitingDisputes();
  if (cached.length === 0) return cached;

  const validIds = new Set<number>();

  try {
    const uniqueIds = [...new Set(cached.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0))];

    await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          await apiFetchJson<unknown>(`/api/payroll/item/dispute/details/${id}`);
          validIds.add(id);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            return;
          }
          throw error;
        }
      })
    );
  } catch {
    return cached;
  }

  const next = cached.filter((row) => validIds.has(row.id));
  if (next.length !== cached.length) {
    writeWaitingDisputes(next);
  }

  return next;
}

function buildCorrectionIntent(row: DisputeRow): CorrectionIntent | null {
  if (typeof row.itemId !== 'number') return null;
  return {
    disputeId: row.id,
    itemId: row.itemId,
    employee: row.employee,
    message: row.subject,
    disputeReason: row.reason,
    decisionReason: row.decisionSummary || '',
  };
}

export default function HrPayslips() {
  const { showLoading, hideLoading } = useLoading();

  const { showSuccess } = useUiDialog();
  const sensitiveAccess = useSensitiveAccessPrompt();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRow | null>(null);
  const [runItems, setRunItems] = useState<PayrollItemSummaryRow[]>([]);
  const [isLoadingRunItems, setIsLoadingRunItems] = useState(false);
  const [runItemsError, setRunItemsError] = useState('');
  const [selectedPayrollItem, setSelectedPayrollItem] = useState<PayrollItemSummaryRow | null>(null);
  const [selectedPayrollItemEarnings, setSelectedPayrollItemEarnings] = useState<CorrectionLine[]>([]);
  const [selectedPayrollItemDeductions, setSelectedPayrollItemDeductions] = useState<CorrectionLine[]>([]);
  const [isLoadingPayrollItem, setIsLoadingPayrollItem] = useState(false);
  const [payrollItemError, setPayrollItemError] = useState('');
  const [editingPayrollLineKey, setEditingPayrollLineKey] = useState('');
  const [payrollLineDraftAmount, setPayrollLineDraftAmount] = useState('');
  const [isSavingPayrollLine, setIsSavingPayrollLine] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const [runModalOpen, setRunModalOpen] = useState(false);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [manualLineModalOpen, setManualLineModalOpen] = useState(false);
  const [runSubmitAttempted, setRunSubmitAttempted] = useState(false);
  const [runForm, setRunForm] = useState<RunFormState>(() => createDefaultRunForm());
  const [initialRunForm, setInitialRunForm] = useState<RunFormState>(() => createDefaultRunForm());
  const [manualLineForm, setManualLineForm] = useState<ManualLineFormState>(() => createDefaultManualLineForm());
  const [initialManualLineForm, setInitialManualLineForm] = useState<ManualLineFormState>(() => createDefaultManualLineForm());
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployeeOptions, setIsLoadingEmployeeOptions] = useState(false);
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState('');
  const [initialManualEmployeeSearch, setInitialManualEmployeeSearch] = useState('');
  const [manualEmployeePickerOpen, setManualEmployeePickerOpen] = useState(false);
  const [manualLineError, setManualLineError] = useState('');
  const [manualLineSubmitAttempted, setManualLineSubmitAttempted] = useState(false);
  const [isSubmittingManualLine, setIsSubmittingManualLine] = useState(false);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [isPostingRun, setIsPostingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunDto[]>([]);
  const [currentRun, setCurrentRun] = useState<PayrollRunDto | null>(null);
  const [runItemFilterOpen, setRunItemFilterOpen] = useState(false);
  const [runItemSortOpen, setRunItemSortOpen] = useState(false);
  const [runItemRoleFilter, setRunItemRoleFilter] = useState('all');
  const [runItemDepartmentFilter, setRunItemDepartmentFilter] = useState('all');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionIntent, setCorrectionIntent] = useState<CorrectionIntent | null>(null);
  const [correctionSource, setCorrectionSource] = useState<CorrectionSourceItem | null>(null);
  const [correctionLines, setCorrectionLines] = useState<CorrectionLine[]>([]);
  const [selectedCorrectionKey, setSelectedCorrectionKey] = useState('');
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [correctionError, setCorrectionError] = useState('');
  const [correctionSubmitAttempted, setCorrectionSubmitAttempted] = useState(false);
  const [isLoadingCorrection, setIsLoadingCorrection] = useState(false);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [adjustmentRunId, setAdjustmentRunId] = useState<number | null>(null);
  const [pendingDisputeDecision, setPendingDisputeDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [confirmDisputeDecisionOpen, setConfirmDisputeDecisionOpen] = useState(false);
  const [disputeDecisionSubmitAttempted, setDisputeDecisionSubmitAttempted] = useState(false);
  const [disputeSearchValue, setDisputeSearchValue] = useState('');
  const [disputeFilterOpen, setDisputeFilterOpen] = useState(false);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<DisputeStatusFilter>('all');
  const [disputeTypeFilter, setDisputeTypeFilter] = useState<DisputeTypeFilter>('all');
  const [runItemSort, setRunItemSort] = useState<EmployeeSortKey>('name');
  const [attachmentError, setAttachmentError] = useState('');
  const [openingAttachmentId, setOpeningAttachmentId] = useState<number | null>(null);
  const manualEmployeePickerRef = useRef<HTMLDivElement | null>(null);
  const loadedRunItemsPayIdRef = useRef<number | null>(null);
  const isRunDirty =
    runModalOpen &&
    (runForm.periodStart !== initialRunForm.periodStart ||
      runForm.periodEnd !== initialRunForm.periodEnd ||
      runForm.paymentDate !== initialRunForm.paymentDate ||
      runForm.runType !== initialRunForm.runType);
  const isManualLineDirty =
    manualLineModalOpen &&
    (manualLineForm.empId !== initialManualLineForm.empId ||
      manualLineForm.lineType !== initialManualLineForm.lineType ||
      manualLineForm.amount !== initialManualLineForm.amount ||
      manualEmployeeSearch !== initialManualEmployeeSearch);
  const isCorrectionDirty =
    correctionOpen && (selectedCorrectionKey.trim().length > 0 || correctedAmount.trim().length > 0);
  const isDisputeReviewDirty =
    Boolean(selectedDispute) && (remarks.trim().length > 0 || pendingDisputeDecision !== null);
  const runUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: runModalOpen,
    isDirty: isRunDirty,
    isBusy: isSubmittingRun,
    onDiscard: closeRunModal,
  });
  const manualLineUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: manualLineModalOpen,
    isDirty: isManualLineDirty,
    isBusy: isSubmittingManualLine,
    onDiscard: resetManualLineState,
  });
  const correctionUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: correctionOpen,
    isDirty: isCorrectionDirty,
    isBusy: isSubmittingCorrection,
    onDiscard: resetCorrectionState,
  });
  const disputeReviewUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: Boolean(selectedDispute),
    isDirty: isDisputeReviewDirty,
    isBusy: isSaving,
    onDiscard: () => setSelectedDispute(null),
  });

  useErrorDialogEffect(loadError, 'Payroll data could not be loaded');
  useErrorDialogEffect(runItemsError, 'Payroll run items could not be loaded');
  useErrorDialogEffect(payrollItemError, 'Payroll item action failed');
  useErrorDialogEffect(manualLineError, 'Manual adjustment line could not be added');
  useErrorDialogEffect(actionError, 'Dispute action failed');
  useErrorDialogEffect(runError, 'Payroll run could not be completed');
  useErrorDialogEffect(correctionError, 'Payroll correction could not be completed');
  useErrorDialogEffect(attachmentError, 'Attachment could not be opened');
  useEscapeDismiss(runModalOpen && !isSubmittingRun && !runUnsavedPrompt.confirmOpen, runUnsavedPrompt.requestClose, 10);
  useEscapeDismiss(postModalOpen && !isPostingRun, () => setPostModalOpen(false), 10);
  useEscapeDismiss(
    manualLineModalOpen && !isSubmittingManualLine && !manualLineUnsavedPrompt.confirmOpen,
    manualLineUnsavedPrompt.requestClose,
    10
  );
  useEscapeDismiss(
    correctionOpen && !isSubmittingCorrection && !correctionUnsavedPrompt.confirmOpen,
    correctionUnsavedPrompt.requestClose,
    10
  );
  useEscapeDismiss(Boolean(selectedPayrollItem), () => setSelectedPayrollItem(null), 10);
  useEscapeDismiss(
    Boolean(selectedDispute) && !isSaving && !disputeReviewUnsavedPrompt.confirmOpen,
    disputeReviewUnsavedPrompt.requestClose,
    10
  );
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled:
      !selectedDispute &&
      !selectedPayrollItem &&
      !runModalOpen &&
      !postModalOpen &&
      !manualLineModalOpen &&
      !correctionOpen &&
      !isSaving &&
      !isSubmittingManualLine &&
      !isSubmittingRun &&
      !isPostingRun &&
      !isSubmittingCorrection,
  });

  const syncRunForm = useCallback((run: PayrollRunDto) => {
    setRunForm((prev) => ({
      periodStart: run.periodStart ?? prev.periodStart,
      periodEnd: run.periodEnd ?? prev.periodEnd,
      paymentDate: run.paymentDate ?? prev.paymentDate,
      runType: normalizeRunType(run.runType),
    }));
  }, []);

  const loadCurrentRun = useCallback(async (preferredPayId?: number | null) => {
    try {
      const response = await apiFetchJson<unknown>('/api/payroll/run');
      const runs = [...toArray<PayrollRunDto>(response)].sort(compareRunsDescending);
      if (preferredPayId != null && !runs.some((run) => run.payId === preferredPayId)) {
        clearStoredRun();
      }
      const nextRun = pickCurrentRun(runs, preferredPayId);

      setPayrollRuns(runs);
      setCurrentRun(nextRun);
      if (nextRun) syncRunForm(nextRun);
    } catch (error) {
      setPayrollRuns([]);
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    }
  }, [syncRunForm]);

  useEffect(() => {
    if (selectedDispute || selectedPayrollItem || runModalOpen || postModalOpen || manualLineModalOpen || correctionOpen) {
      document.body.classList.add('modal-open');
    }
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [correctionOpen, manualLineModalOpen, postModalOpen, runModalOpen, selectedDispute, selectedPayrollItem]);

  useEffect(() => {
    setRemarks('');
    setActionError('');
    setPendingDisputeDecision(null);
    setDisputeDecisionSubmitAttempted(false);
    setConfirmDisputeDecisionOpen(false);
  }, [selectedDispute?.id]);

  useEffect(() => {
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
  }, [selectedPayrollItem?.itemId]);

  useEffect(() => {
    if ((!manualLineModalOpen && currentRun?.payrollStatus !== 'IN_PROGRESS') || employeeOptions.length > 0) {
      return;
    }

    let cancelled = false;
    let didTimeout = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, EMPLOYEE_OPTIONS_TIMEOUT_MS);

    async function loadEmployeeOptions() {
      setIsLoadingEmployeeOptions(true);
      if (manualLineModalOpen) {
        setManualLineError('');
      }
      try {
        let response: unknown;
        try {
          response = await apiFetchJson<unknown>('/api/employees/options', { signal: controller.signal });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (!(error instanceof ApiError) || error.status !== 404) {
            throw error;
          }
          response = await apiFetchJson<unknown>('/api/employees?page=0&size=200', { signal: controller.signal });
        }

        if (cancelled) return;
        setEmployeeOptions(buildEmployeeOptions(response));
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (didTimeout) {
          if (manualLineModalOpen) {
            setManualLineError(
              'Employee list took too long to load. Close and reopen this dialog, then restart the backend if it keeps happening.'
            );
          }
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (manualLineModalOpen) {
          setManualLineError(getFriendlyErrorMessage(error, 'employee-load'));
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setIsLoadingEmployeeOptions(false);
      }
    }

    void loadEmployeeOptions();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentRun?.payrollStatus, employeeOptions.length, manualLineModalOpen]);

  useEffect(() => {
    if (!manualEmployeePickerOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!manualEmployeePickerRef.current?.contains(event.target as Node)) {
        setManualEmployeePickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [manualEmployeePickerOpen]);

  useEffect(() => {
    const storedRun = readStoredRun();
    void loadCurrentRun(storedRun?.payId);
  }, [loadCurrentRun, refreshTick]);

  useEffect(() => {
    persistRunSelection(currentRun);
  }, [currentRun]);

  async function loadDisputes() {
    const waitingDisputes = await reconcileWaitingDisputes();
    try {
      setLoadError('');
      const response = await apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=100');
      const pendingDisputes = toArray<DisputeDto>(response).map((item, idx) => toDisputeRow(item, idx));
      const merged = [...pendingDisputes, ...waitingDisputes]
        .filter((row, idx, rows) => rows.findIndex((entry) => entry.id === row.id) === idx)
        .sort((left, right) => right.sortStamp - left.sortStamp || left.employee.localeCompare(right.employee));
      setDisputes(merged);
      return merged;
    } catch (error) {
      setDisputes(waitingDisputes);
      setLoadError(getFriendlyErrorMessage(error, 'payroll-dispute'));
      return waitingDisputes;
    }
  }

  useEffect(() => {
    void loadDisputes();
  }, [refreshTick]);

  useEffect(() => {
    if (!currentRun?.payId || currentRun.payrollStatus !== 'IN_PROGRESS') {
      loadedRunItemsPayIdRef.current = null;
      setRunItems([]);
      setRunItemsError('');
      setIsLoadingRunItems(false);
      return;
    }

    let cancelled = false;

    async function loadRunItems() {
      const payId = currentRun?.payId;
      if (payId == null) {
        loadedRunItemsPayIdRef.current = null;
        setRunItems([]);
        setIsLoadingRunItems(false);
        return;
      }

      const shouldShowLoadingState = loadedRunItemsPayIdRef.current !== payId;
      if (shouldShowLoadingState) {
        setIsLoadingRunItems(true);
        setRunItems([]);
      }
      setRunItemsError('');

      try {
        const response = await apiFetchJson<unknown>(`/api/payroll/run/${payId}/items?page=0&size=500`);
        if (cancelled) return;

        const mapped = toArray<PayrollItemSummaryDto>(response)
          .map((row, idx) => {
            const grossPay = toAmount(row.grossPay);
            const netPay = toAmount(row.netPay);
            return {
              itemId: row.itemId ?? idx + 1,
              empId: row.empId,
              employee: employeeLabelFromParts(row.firstName, row.lastName, row.empId),
              grossPay,
              deductions: Math.max(grossPay - netPay, 0),
              netPay,
            } satisfies PayrollItemSummaryRow;
          })
          .sort((left, right) => left.employee.localeCompare(right.employee) || left.itemId - right.itemId);

        loadedRunItemsPayIdRef.current = payId;
        setRunItems(mapped);
      } catch (error) {
        if (!cancelled) {
          if (shouldShowLoadingState) {
            loadedRunItemsPayIdRef.current = null;
            setRunItems([]);
          }
          setRunItemsError(getFriendlyErrorMessage(error, 'payroll-run'));
        }
      } finally {
        if (!cancelled) setIsLoadingRunItems(false);
      }
    }

    void loadRunItems();

    return () => {
      cancelled = true;
    };
  }, [currentRun?.payId, currentRun?.payrollStatus, refreshTick]);

  const displayedPeriodStart = currentRun?.periodStart ?? runForm.periodStart;
  const displayedPeriodEnd = currentRun?.periodEnd ?? runForm.periodEnd;
  const canAddManualAdjustmentLine =
    currentRun?.payrollStatus === 'IN_PROGRESS' && currentRun?.runType === 'ADJUSTMENT';
  const canPostCurrentRun =
    Boolean(currentRun?.payId) &&
    currentRun?.payrollStatus !== 'POSTED' &&
    (currentRun?.itemCount ?? 0) > 0;
  const emptyRunHint =
    currentRun && currentRun.payrollStatus !== 'POSTED' && (currentRun.itemCount ?? 0) <= 0
      ? currentRun.runType === 'ADJUSTMENT'
        ? ''
        : 'This run has no generated payroll items yet. Process the payroll period again or check if there were eligible employees for these dates.'
      : '';
  const runModalTitle =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run';
  const runSubmitLabel =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run';
  const hasOngoingRunConflict =
    currentRun?.payrollStatus === 'IN_PROGRESS' &&
    (currentRun.periodStart !== runForm.periodStart ||
      currentRun.periodEnd !== runForm.periodEnd ||
      normalizeRunType(currentRun.runType) !== runForm.runType);
  const confirmRunTitle = hasOngoingRunConflict
    ? 'Ongoing Payroll Run Detected'
    : runForm.runType === 'ADJUSTMENT'
      ? 'Confirm Adjustment Run'
      : 'Confirm New Payroll Run';
  const confirmRunMessage =
    hasOngoingRunConflict && currentRun
      ? `There is already an ongoing ${formatRunType(currentRun.runType)} for ${formatDate(
          currentRun.periodStart
        )} to ${formatDate(
          currentRun.periodEnd
        )}. Creating another run will switch this page to the new run. Continue?`
      : `Create a ${runForm.runType === 'ADJUSTMENT' ? 'payroll adjustment' : 'new payroll'} run for ${formatDate(
          runForm.periodStart
        )} to ${formatDate(runForm.periodEnd)}?`;
  const confirmRunConfirmLabel = hasOngoingRunConflict
    ? 'Create Another Run'
    : runForm.runType === 'ADJUSTMENT'
      ? 'Create Adjustment Run'
      : 'Create New Payroll Run';
  const confirmRunCancelLabel = hasOngoingRunConflict ? 'Keep Current Run' : 'Go Back';

  const currentPayPeriod = useMemo(() => {
    return formatDate(currentRun?.paymentDate ?? runForm.paymentDate);
  }, [currentRun?.paymentDate, runForm.paymentDate]);
  const todayIsoDate = useMemo(() => getTodayIsoDate(), []);
  const normalizedDisputeSearch = normalizeText(disputeSearchValue);
  const canReviewSelectedDispute = selectedDispute ? selectedDispute.statusCode === 'PENDING' : false;
  const canStageSelectedDisputeCorrection =
    selectedDispute ? selectedDispute.statusCode === 'WAITING_ADJUSTMENT' : false;
  const isCurrentRunInProgress = currentRun?.payrollStatus === 'IN_PROGRESS';
  const canEditSelectedPayrollItem = currentRun?.payrollStatus === 'IN_PROGRESS';
  const inProgressRuns = useMemo(
    () => payrollRuns.filter((run) => run.payrollStatus === 'IN_PROGRESS'),
    [payrollRuns]
  );
  const currentInProgressRunIndex = useMemo(() => {
    if (currentRun?.payId == null) return -1;
    return inProgressRuns.findIndex((run) => run.payId === currentRun.payId);
  }, [currentRun?.payId, inProgressRuns]);
  const hasMultipleInProgressRuns = inProgressRuns.length > 1;
  const canViewPreviousInProgressRun = currentInProgressRunIndex > 0;
  const canViewNextInProgressRun =
    currentInProgressRunIndex >= 0 && currentInProgressRunIndex < inProgressRuns.length - 1;
  const employeeOptionsById = useMemo(
    () => new Map(employeeOptions.map((option) => [option.id, option])),
    [employeeOptions]
  );
  const manualSelectableEmployeeOptions = useMemo(
    () => employeeOptions.filter((option) => normalizeText(option.status) !== 'terminated'),
    [employeeOptions]
  );
  const selectedPayrollGross = selectedPayrollItem ? selectedPayrollItem.grossPay : 0;
  const selectedPayrollNet = selectedPayrollItem ? selectedPayrollItem.netPay : 0;
  const selectedPayrollDeductions = useMemo(() => {
    if (!selectedPayrollItem) return 0;
    if (selectedPayrollItemDeductions.length > 0) {
      return selectedPayrollItemDeductions.reduce((sum, line) => sum + toAmount(line.amount), 0);
    }
    return selectedPayrollItem.deductions;
  }, [selectedPayrollItem, selectedPayrollItemDeductions]);
  const selectedPayrollIsBonusPayout = useMemo(
    () => currentRun?.runType === 'ADJUSTMENT' && hasBonusEarning(selectedPayrollItemEarnings),
    [currentRun?.runType, selectedPayrollItemEarnings]
  );
  const runItemRows = useMemo<RunItemViewRow[]>(() => {
    return runItems.map((row) => {
      const option = typeof row.empId === 'number' ? employeeOptionsById.get(row.empId) : undefined;
      return {
        ...row,
        role: option?.position ?? '',
        department: option?.department ?? '',
      };
    });
  }, [employeeOptionsById, runItems]);

  const runItemRoleOptions = useMemo(
    () => Array.from(new Set(runItemRows.map((row) => row.role).filter(Boolean))).sort(),
    [runItemRows]
  );

  const runItemDepartmentOptions = useMemo(
    () => Array.from(new Set(runItemRows.map((row) => row.department).filter(Boolean))).sort(),
    [runItemRows]
  );

  const visibleRunItems = useMemo(() => {
    const filtered = runItemRows.filter((row) => {
      if (runItemRoleFilter !== 'all' && row.role !== runItemRoleFilter) {
        return false;
      }

      if (runItemDepartmentFilter !== 'all' && row.department !== runItemDepartmentFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((left, right) =>
      compareEmployees(runItemSort, { id: left.empId, name: left.employee }, { id: right.empId, name: right.employee })
    );
  }, [runItemDepartmentFilter, runItemRoleFilter, runItemRows, runItemSort]);
  const selectedManualEmployee = useMemo(() => {
    const employeeId = Number(manualLineForm.empId);
    if (!Number.isFinite(employeeId) || employeeId <= 0) return null;
    return manualSelectableEmployeeOptions.find((option) => option.id === employeeId) ?? null;
  }, [manualLineForm.empId, manualSelectableEmployeeOptions]);
  const filteredEmployeeOptions = useMemo(() => {
    const query = normalizeText(manualEmployeeSearch);
    if (!query) return manualSelectableEmployeeOptions;
    return manualSelectableEmployeeOptions.filter((option) => normalizeText(option.name).includes(query));
  }, [manualEmployeeSearch, manualSelectableEmployeeOptions]);
  const canClearManualEmployeePicker =
    manualEmployeeSearch.trim().length > 0 || manualLineForm.empId.trim().length > 0;

  const visibleDisputes = useMemo(() => {
    return disputes.filter((row) => {
      if (disputeStatusFilter !== 'all' && row.statusCode !== disputeStatusFilter) {
        return false;
      }

      if (disputeTypeFilter !== 'all' && mapDisputeType(row.subject) !== disputeTypeFilter) {
        return false;
      }

      if (!normalizedDisputeSearch) {
        return true;
      }

      const haystack = [
        row.employee,
        row.payrollPeriod,
        row.submittedAt,
        row.statusLabel,
        row.subject,
        row.reason,
        row.decisionSummary,
      ]
        .map(normalizeText)
        .join(' ');

      return haystack.includes(normalizedDisputeSearch);
    });
  }, [disputes, disputeStatusFilter, disputeTypeFilter, normalizedDisputeSearch]);

  const activeDisputeFilterCount = [disputeStatusFilter, disputeTypeFilter].filter((value) => value !== 'all').length;
  const activeRunItemFilterCount = [runItemRoleFilter, runItemDepartmentFilter].filter((value) => value !== 'all').length;

  const selectedCorrectionLine = useMemo(
    () => correctionLines.find((line) => line.key === selectedCorrectionKey) ?? null,
    [correctionLines, selectedCorrectionKey]
  );
  const isRunPeriodStartInvalid = runSubmitAttempted && !runForm.periodStart;
  const isRunPeriodEndInvalid = runSubmitAttempted && !runForm.periodEnd;
  const isManualEmployeeInvalid = manualLineSubmitAttempted && !manualLineForm.empId.trim();
  const isManualAmountInvalid = manualLineSubmitAttempted && manualLineForm.amount.trim().length === 0;
  const isCorrectionAmountInvalid =
    correctionSubmitAttempted && Boolean(selectedCorrectionLine) && correctedAmount.trim().length === 0;
  const isDisputeRemarksInvalid = disputeDecisionSubmitAttempted && remarks.trim().length < 5;

  function clearDisputeFilters() {
    setDisputeStatusFilter('all');
    setDisputeTypeFilter('all');
  }

  function clearRunItemFilters() {
    setRunItemRoleFilter('all');
    setRunItemDepartmentFilter('all');
  }

  function showAdjacentInProgressRun(direction: -1 | 1) {
    if (currentInProgressRunIndex < 0) return;

    const nextRun = inProgressRuns[currentInProgressRunIndex + direction];
    if (!nextRun) return;

    setCurrentRun(nextRun);
    syncRunForm(nextRun);
  }

  function closeRunModal() {
    setRunModalOpen(false);
    setRunSubmitAttempted(false);
  }

  function resetCorrectionState() {
    setCorrectionOpen(false);
    setCorrectionIntent(null);
    setCorrectionSource(null);
    setCorrectionLines([]);
    setSelectedCorrectionKey('');
    setCorrectedAmount('');
    setCorrectionError('');
    setCorrectionSubmitAttempted(false);
    setIsLoadingCorrection(false);
    hideLoading();
    setIsSubmittingCorrection(false);
    setAdjustmentRunId(null);
  }

  function resetManualLineState() {
    setManualLineModalOpen(false);
    setManualLineForm(createDefaultManualLineForm());
    setManualEmployeeSearch('');
    setManualEmployeePickerOpen(false);
    setManualLineError('');
    setManualLineSubmitAttempted(false);
    setIsLoadingEmployeeOptions(false);
    hideLoading();
    setIsSubmittingManualLine(false);
  }

  function openManualLineModal(defaults?: Partial<ManualLineFormState>) {
    setManualLineError('');
    setManualLineSubmitAttempted(false);
    setIsLoadingEmployeeOptions(false);
    const nextEmpId = defaults?.empId ?? '';
    const nextForm: ManualLineFormState = {
      empId: nextEmpId,
      lineType: defaults?.lineType ?? 'EARNING',
      amount: defaults?.amount ?? '',
    };
    const nextEmployee =
      nextEmpId && Number.isFinite(Number(nextEmpId))
        ? manualSelectableEmployeeOptions.find((option) => option.id === Number(nextEmpId)) ?? null
        : null;
    const nextSearch = nextEmployee?.name ?? '';
    setManualLineForm(nextForm);
    setInitialManualLineForm(nextForm);
    setManualEmployeeSearch(nextSearch);
    setInitialManualEmployeeSearch(nextSearch);
    setManualEmployeePickerOpen(false);
    setManualLineModalOpen(true);
  }

  function selectManualEmployee(option: EmployeeOption) {
    setManualLineForm((prev) => ({ ...prev, empId: String(option.id) }));
    setManualEmployeeSearch(option.name);
    setManualEmployeePickerOpen(false);
    setManualLineError('');
  }

  function clearManualEmployeeSelection() {
    setManualLineForm((prev) => ({ ...prev, empId: '' }));
    setManualEmployeeSearch('');
    setManualEmployeePickerOpen(false);
    setManualLineError('');
  }

  function mapCorrectionLines(response: unknown, lineType: CorrectionLine['lineType']) {
    return toArray<Record<string, unknown>>(response)
      .map((row, idx) => mapCorrectionLine(row, idx, lineType))
      .filter((line): line is CorrectionLine => line !== null);
  }

  async function openPayrollItemDetail(row: PayrollItemSummaryRow) {
    setSelectedPayrollItemEarnings([]);
    setSelectedPayrollItemDeductions([]);
    setPayrollItemError('');
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
    setIsLoadingPayrollItem(true);

    try {
      const [earningsResponse, deductionsResponse] = await Promise.all([
        apiFetchJson<unknown>(`/api/payroll/item/earnings/${row.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/deductions/${row.itemId}`),
      ]);

      setSelectedPayrollItemEarnings(mapCorrectionLines(earningsResponse, 'EARNING'));
      setSelectedPayrollItemDeductions(mapCorrectionLines(deductionsResponse, 'DEDUCTION'));
      setSelectedPayrollItem(row);
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => openPayrollItemDetail(row),
          'Verify access before opening payroll item earnings and deductions.'
        )
      ) {
        return;
      }
      setPayrollItemError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingPayrollItem(false);
    }
  }

  async function ensurePayrollItemForEmployee(payId: number, empId: number) {
    const existingItem = runItems.find((row) => row.empId === empId);
    if (existingItem?.itemId) {
      return existingItem.itemId;
    }

    const createdItem = await apiFetchJson<Record<string, unknown>>('/api/payroll/item/create', {
      method: 'POST',
      body: JSON.stringify({
        payId,
        empId,
      }),
    });

    const nextItemId = Number(createdItem.id);
    if (!Number.isFinite(nextItemId) || nextItemId <= 0) {
      throw new Error('The payroll item was created, but its ID was not returned.');
    }
    return nextItemId;
  }

  async function submitManualLine() {
    setManualLineSubmitAttempted(true);
    if (!currentRun?.payId || currentRun.runType !== 'ADJUSTMENT') {
      setManualLineError('Open an in-progress adjustment run before adding manual lines.');
      return;
    }

    const empId = Number(manualLineForm.empId);
    if (!Number.isFinite(empId) || empId <= 0) {
      setManualLineError('Choose an employee before adding a manual line.');
      return;
    }

    const trimmedAmount = manualLineForm.amount.trim();
    if (!trimmedAmount) {
      setManualLineError('Enter the amount for this manual line.');
      return;
    }

    const parsedAmount = Number(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setManualLineError('Manual line amount must be a valid amount greater than zero.');
      return;
    }

    setManualLineError('');
    showLoading();
    setIsSubmittingManualLine(true);

    try {
      const itemId = await ensurePayrollItemForEmployee(currentRun.payId, empId);
      if (manualLineForm.lineType === 'DEDUCTION') {
        await apiFetchJson(`/api/payroll/item/deductions/create/${itemId}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: trimmedAmount,
          }),
        });
      } else {
        await apiFetchJson(`/api/payroll/item/earnings/create/${itemId}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: trimmedAmount,
            earningsType: manualLineForm.lineType === 'BONUS' ? 'BONUS' : 'FIXED',
          }),
        });
      }

      await loadCurrentRun(currentRun.payId);
      resetManualLineState();
      showSuccess(
        `${manualLineForm.lineType === 'DEDUCTION'
          ? 'Deduction'
          : manualLineForm.lineType === 'BONUS'
            ? 'Bonus'
            : 'Earning'} line added for ${selectedManualEmployee?.name ?? `Employee #${empId}`}.`,
        'Adjustment Line Added'
      );
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          submitManualLine,
          'Verify access before adding a manual payroll earning or deduction.'
        )
      ) {
        return;
      }
      setManualLineError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      hideLoading();
      setIsSubmittingManualLine(false);
    }
  }

  function startPayrollLineEdit(line: CorrectionLine) {
    setPayrollItemError('');
    setEditingPayrollLineKey(line.key);
    setPayrollLineDraftAmount(line.amount);
  }

  function cancelPayrollLineEdit() {
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
    setPayrollItemError('');
  }

  async function savePayrollLineAmount(line: CorrectionLine) {
    if (!selectedPayrollItem) return;

    const trimmedAmount = payrollLineDraftAmount.trim();
    if (!trimmedAmount) {
      setPayrollItemError('Enter an updated amount before saving this payroll line.');
      return;
    }

    const parsedAmount = Number(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setPayrollItemError('Payroll line amount must be a valid non-negative number.');
      return;
    }

    if (parsedAmount.toFixed(2) === toAmount(line.amount).toFixed(2)) {
      setPayrollItemError('Change the amount before saving. The updated value cannot match the current amount.');
      return;
    }

    setPayrollItemError('');
    setIsSavingPayrollLine(true);

    try {
      const endpoint =
        line.lineType === 'EARNING'
          ? `/api/payroll/item/earnings/update/${line.lineId}`
          : `/api/payroll/item/deductions/update/${line.lineId}`;
      const updatedResponse = await apiFetchJson<Record<string, unknown>>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ amount: trimmedAmount }),
      });

      const updatedLine = mapCorrectionLine(updatedResponse, 0, line.lineType);
      if (!updatedLine) {
        throw new Error('The updated payroll line could not be read.');
      }

      const nextEarnings =
        line.lineType === 'EARNING'
          ? selectedPayrollItemEarnings.map((entry) => (entry.key === line.key ? updatedLine : entry))
          : selectedPayrollItemEarnings;
      const nextDeductions =
        line.lineType === 'DEDUCTION'
          ? selectedPayrollItemDeductions.map((entry) => (entry.key === line.key ? updatedLine : entry))
          : selectedPayrollItemDeductions;
      const nextTotals = summarizePayrollItemLines(nextEarnings, nextDeductions, selectedPayrollItem);

      setSelectedPayrollItemEarnings(nextEarnings);
      setSelectedPayrollItemDeductions(nextDeductions);
      setSelectedPayrollItem((prev) =>
        prev && prev.itemId === selectedPayrollItem.itemId
          ? {
              ...prev,
              grossPay: nextTotals.grossPay,
              deductions: nextTotals.deductions,
              netPay: nextTotals.netPay,
            }
          : prev
      );
      setRunItems((prev) =>
        prev.map((entry) =>
          entry.itemId === selectedPayrollItem.itemId
            ? {
                ...entry,
                grossPay: nextTotals.grossPay,
                deductions: nextTotals.deductions,
                netPay: nextTotals.netPay,
              }
            : entry
        )
      );
      setEditingPayrollLineKey('');
      setPayrollLineDraftAmount('');
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => savePayrollLineAmount(line),
          'Verify access before updating protected payroll line amounts.'
        )
      ) {
        return;
      }
      setPayrollItemError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsSavingPayrollLine(false);
    }
  }

  async function ensureAdjustmentRun(source: CorrectionSourceItem) {
    const sourceRun = source.runDetails;
    const sourceStart = sourceRun?.periodStart;
    const sourceEnd = sourceRun?.periodEnd;

    if (!sourceStart || !sourceEnd) {
      throw new Error('The source payslip is missing its payroll period, so no adjustment run can be prepared yet.');
    }

    const runsResponse = await apiFetchJson<unknown>('/api/payroll/run');
    const runs = toArray<PayrollRunDto>(runsResponse);
    const sortedRuns = [...runs].sort(compareRunsDescending);
    setPayrollRuns(sortedRuns);
    const reusableRun =
      runs.find(
        (run) =>
          run.runType === 'ADJUSTMENT' &&
          run.payrollStatus !== 'POSTED' &&
          run.periodStart === sourceStart &&
          run.periodEnd === sourceEnd
      ) ?? null;

    if (reusableRun) {
      setCurrentRun(reusableRun);
      syncRunForm(reusableRun);
      persistRunSelection(reusableRun);
      setAdjustmentRunId(reusableRun.payId ?? null);
      return reusableRun;
    }

    const createdRun = await apiFetchJson<PayrollRunDto>('/api/payroll/run/create', {
      method: 'POST',
      body: JSON.stringify({
        periodStart: sourceStart,
        periodEnd: sourceEnd,
        periodDescription: describeAdjustmentRun(sourceStart, sourceEnd),
        payrollStatus: 'IN_PROGRESS',
        runType: 'ADJUSTMENT',
      }),
    });

    setPayrollRuns((prev) => [...prev.filter((run) => run.payId !== createdRun.payId), createdRun].sort(compareRunsDescending));
    setCurrentRun(createdRun);
    syncRunForm(createdRun);
    persistRunSelection(createdRun);
    setAdjustmentRunId(createdRun.payId ?? null);
    showSuccess('Adjustment run is ready for the approved dispute.', 'Adjustment Run Ready');
    return createdRun;
  }

  async function startApprovedDisputeCorrection(intent: CorrectionIntent) {
    setCorrectionOpen(true);
    setCorrectionIntent(intent);
    setCorrectionSource(null);
    setCorrectionLines([]);
    setSelectedCorrectionKey('');
    setCorrectedAmount('');
    setCorrectionError('');
    setIsLoadingCorrection(true);

    try {
      const [sourceResponse, earningsResponse, deductionsResponse] = await Promise.all([
        apiFetchJson<CorrectionSourceItem>(`/api/payroll/item/manage/${intent.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/earnings/${intent.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/deductions/${intent.itemId}`),
      ]);

      const nextLines: CorrectionLine[] = [
        ...mapCorrectionLines(earningsResponse, 'EARNING'),
        ...mapCorrectionLines(deductionsResponse, 'DEDUCTION'),
      ];

      if (nextLines.length === 0) {
        throw new Error('No earnings or deductions were found for the selected payslip item.');
      }

      setCorrectionSource(sourceResponse);
      setCorrectionLines(nextLines);
      setSelectedCorrectionKey('');
      await ensureAdjustmentRun(sourceResponse);
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => startApprovedDisputeCorrection(intent),
          'Verify access before opening the correction workspace for a protected payslip item.'
        )
      ) {
        return;
      }
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
      if (!currentRun) {
        await loadCurrentRun();
      }
    } finally {
      setIsLoadingCorrection(false);
    }
  }

  async function submitCorrection() {
    setCorrectionSubmitAttempted(true);
    if (!correctionIntent || !correctionSource?.itemId || !selectedCorrectionLine || !adjustmentRunId) {
      setCorrectionError('Complete the correction details before submitting.');
      return;
    }

    const trimmedAmount = correctedAmount.trim();
    if (!trimmedAmount) {
      setCorrectionError('Enter the corrected amount before staging this payroll change.');
      return;
    }

    const parsedAmount = Number(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setCorrectionError('Corrected amount must be a valid non-negative number.');
      return;
    }

    if (parsedAmount.toFixed(2) === Number(selectedCorrectionLine.amount).toFixed(2)) {
      setCorrectionError('Change the amount before submitting. The corrected amount cannot match the current line.');
      return;
    }

    setCorrectionError('');
    showLoading();
    setIsSubmittingCorrection(true);
    try {
      await apiFetchJson(`/api/payroll/run/${adjustmentRunId}/adjustment/correction`, {
        method: 'POST',
        body: JSON.stringify({
          sourceItemId: correctionSource.itemId,
          sourceLineType: selectedCorrectionLine.lineType,
          sourceLineId: selectedCorrectionLine.lineId,
          correctedAmount: trimmedAmount,
          disputeId: correctionIntent.disputeId,
        }),
      });

      const runId = adjustmentRunId;
      const employee = correctionIntent.employee;
      resetCorrectionState();
      setSelectedDispute(null);
      removeWaitingDispute(correctionIntent.disputeId);
      await loadCurrentRun(runId);
      await loadDisputes();
      showSuccess(`Correction for ${employee} was staged successfully.`, 'Correction Staged');
    } catch (error) {
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      hideLoading();
      setIsSubmittingCorrection(false);
    }
  }

  async function updateDispute(status: 'APPROVED' | 'REJECTED') {
    if (!selectedDispute) return;
    setDisputeDecisionSubmitAttempted(true);
    const trimmedRemarks = remarks.trim();
    if (trimmedRemarks.length < 5) {
      setActionError('Please enter at least 5 characters explaining the approval or denial.');
      return;
    }

    setIsSaving(true);
    setActionError('');
    try {
      const activeDispute = selectedDispute;
      await apiFetchJson<DisputeDto>(`/api/payroll/item/dispute/update/${activeDispute.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          statusReason: trimmedRemarks,
        }),
      });
      setRemarks('');
      setPendingDisputeDecision(null);
      if (status === 'APPROVED') {
        const waitingRow = createWaitingDisputeRow(activeDispute, trimmedRemarks);
        upsertWaitingDispute(waitingRow);
        await loadDisputes();
        setSelectedDispute(null);
        showSuccess(
          `${activeDispute.employee}'s dispute was moved to Waiting for Adjustment. Reopen the request when you are ready to stage the correction.`,
          'Dispute Approved'
        );
      } else {
        removeWaitingDispute(activeDispute.id);
        setSelectedDispute(null);
        await loadDisputes();
      }
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      setIsSaving(false);
    }
  }

  function openSelectedDisputeCorrection() {
    if (!selectedDispute) return;
    const intent = buildCorrectionIntent(selectedDispute);
    if (!intent) {
      setActionError('This dispute is missing its source payslip item, so no adjustment can be staged yet.');
      return;
    }

    setActionError('');
    setSelectedDispute(null);
    void startApprovedDisputeCorrection(intent);
  }

  function openDisputeRow(row: DisputeRow) {
    if (row.statusCode === 'WAITING_ADJUSTMENT') {
      const intent = buildCorrectionIntent(row);
      if (!intent) {
        setActionError('This dispute is missing its source payslip item, so no adjustment can be staged yet.');
        return;
      }

      setActionError('');
      setSelectedDispute(null);
      void startApprovedDisputeCorrection(intent);
      return;
    }

    setSelectedDispute(row);
  }

  async function confirmDisputeDecision() {
    if (!pendingDisputeDecision) {
      setActionError('Choose approve or deny before confirming the dispute decision.');
      return;
    }

    await updateDispute(pendingDisputeDecision);
  }

  function requestDisputeDecisionConfirmation() {
    setDisputeDecisionSubmitAttempted(true);
    if (!pendingDisputeDecision) {
      setActionError('Choose approve or deny before confirming the dispute decision.');
      return;
    }
    if (remarks.trim().length < 5) {
      setActionError('Please enter at least 5 characters explaining the approval or denial.');
      return;
    }
    setActionError('');
    setConfirmDisputeDecisionOpen(true);
  }

  async function handleOpenAttachment(pathId: number) {
    setAttachmentError('');
    setOpeningAttachmentId(pathId);
    try {
      await openDocumentAttachment(pathId);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Failed to open the attachment.');
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  function requestPayrollRunConfirmation() {
    setRunSubmitAttempted(true);
    setRunError('');

    if (!runForm.periodStart || !runForm.periodEnd) {
      setRunError('Payroll period start and end dates are required.');
      return;
    }

    if (runForm.periodEnd < runForm.periodStart) {
      setRunError('Period end cannot be earlier than period start.');
      return;
    }

    if (isFutureIsoDate(runForm.periodStart, todayIsoDate) || isFutureIsoDate(runForm.periodEnd, todayIsoDate)) {
      setRunError('Payroll run dates cannot be later than today.');
      return;
    }

    setConfirmRunOpen(true);
  }

  async function submitPayrollRun() {
    setRunSubmitAttempted(true);
    setRunError('');

    if (!runForm.periodStart || !runForm.periodEnd) {
      setRunError('Payroll period start and end dates are required.');
      return;
    }

    if (runForm.periodEnd < runForm.periodStart) {
      setRunError('Period end cannot be earlier than period start.');
      return;
    }

    if (isFutureIsoDate(runForm.periodStart, todayIsoDate) || isFutureIsoDate(runForm.periodEnd, todayIsoDate)) {
      setRunError('Payroll run dates cannot be later than today.');
      return;
    }

    const isAdjustmentRun = runForm.runType === 'ADJUSTMENT';
    const endpoint = isAdjustmentRun ? '/api/payroll/run/create' : '/api/payroll/run/process';

    showLoading();
    setIsSubmittingRun(true);
    try {
      const createdRun = await apiFetchJson<PayrollRunDto>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          periodStart: runForm.periodStart,
          periodEnd: runForm.periodEnd,
          paymentDate: runForm.paymentDate,
          periodDescription: describeRun(runForm.periodStart, runForm.periodEnd),
          payrollStatus: 'IN_PROGRESS',
          runType: runForm.runType,
        }),
      });

      persistRunSelection(createdRun);
      await loadCurrentRun(createdRun.payId);
      setRunModalOpen(false);
      if (isAdjustmentRun) {
        showSuccess('Adjustment run successfully created and is now the active run on this page.', 'Adjustment Run Created');
      } else {
        showSuccess('Payroll run successfully created and is now the active run on this page.', 'Payroll Run In Progress');
      }
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      hideLoading();
      setIsSubmittingRun(false);
    }
  }

  async function postCurrentRun() {
    if (!currentRun?.payId) {
      setRunError('Create a payroll run first before posting it.');
      return;
    }

    if ((currentRun.itemCount ?? 0) <= 0) {
      setRunError('Generate payroll items first before posting this run.');
      return;
    }

    setRunError('');
    showLoading();
    setIsPostingRun(true);
    try {
      const postedRun = await apiFetchJson<PayrollRunDto>(`/api/payroll/run/${currentRun.payId}/post`, {
        method: 'PATCH',
      });
      setCurrentRun(postedRun);
      setPostModalOpen(false);
      showSuccess('Payroll run successfully posted.', 'Payroll Run Posted');
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      hideLoading();
      setIsPostingRun(false);
    }
  }

  return (
    <div className="hrPay">
      <div className="hrPay__head">
        <PageHeader
          title="Manage Payslips"
          description="Manage payroll runs, review disputes, and publish finalized payslips."
          titleMeta={
            <SensitiveAccessIndicator
              onActivate={() =>
                sensitiveAccess.requestVerification(
                  async () => Promise.resolve(),
                  'Enter your password to unlock payslip management.'
                )
              }
            />
          }
        />
      </div>

      <section className="hrPayPeriod">
        <div className="hrPayPeriod__copy">
          <h2>
            Current Pay Period: <span>{currentPayPeriod}</span>
          </h2>
          <p>
            <strong>Period from:</strong> {formatDate(displayedPeriodStart)} - {formatDate(displayedPeriodEnd)}
          </p>
        </div>

        <div className="hrPayPeriod__actions">
          {canPostCurrentRun && (
            <button
              type="button"
              className="hrPay__runBtn hrPay__runBtn--secondary"
              onClick={() => setPostModalOpen(true)}
              disabled={isPostingRun}
            >
              <FiCheckCircle />
              <span>{isPostingRun ? 'Posting...' : 'Post Payroll Run'}</span>
            </button>
          )}
          <button
            type="button"
            className="hrPay__runBtn"
            onClick={() => {
              setRunError('');
              setRunSubmitAttempted(false);
              setInitialRunForm(runForm);
              setRunModalOpen(true);
            }}
          >
            <FiPlus />
            <span>Create New Payroll Run</span>
          </button>
        </div>
      </section>
      {emptyRunHint && <p className="hrPay__message">{emptyRunHint}</p>}

      {isCurrentRunInProgress && currentRun && (
        <section className="hrPayPanel hrPayPanel--runProgress">
          <div className="hrPayPanel__headRow hrPayPanel__headRow--centered">
            {hasMultipleInProgressRuns ? (
              <div className="hrPayPanel__runPager" aria-label="In-progress payroll run navigation">
                <button
                  type="button"
                  className="hrPayPanel__runPagerBtn"
                  onClick={() => showAdjacentInProgressRun(-1)}
                  disabled={!canViewPreviousInProgressRun}
                  aria-label="Show previous in-progress payroll run"
                >
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <span className="hrPayPanel__runPagerLabel">
                  {currentInProgressRunIndex + 1} of {inProgressRuns.length}
                </span>
                <button
                  type="button"
                  className="hrPayPanel__runPagerBtn"
                  onClick={() => showAdjacentInProgressRun(1)}
                  disabled={!canViewNextInProgressRun}
                  aria-label="Show next in-progress payroll run"
                >
                  <FiChevronRight aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <header className="hrPayPanel__head">Payroll Run in Progress</header>
            <div className="hrPayPanel__tools">
              {canAddManualAdjustmentLine && (
                <button
                  type="button"
                  className="hrPay__runBtn"
                  onClick={() => openManualLineModal()}
                  disabled={isSubmittingManualLine}
                >
                  <FiPlus />
                  <span>Add Manual Line</span>
                </button>
              )}
              <EmployeeSortMenu
                value={runItemSort}
                onChange={setRunItemSort}
                open={runItemSortOpen}
                onOpenChange={(open) => {
                  setRunItemSortOpen(open);
                  if (open) {
                    setRunItemFilterOpen(false);
                  }
                }}
              />
              <div className="uFilter">
                <button
                  type="button"
                  className={`uFilter__toggle ${runItemFilterOpen ? 'is-open' : ''} ${
                    activeRunItemFilterCount > 0 ? 'is-active' : ''
                  }`}
                  onClick={() =>
                    setRunItemFilterOpen((open) => {
                      const nextOpen = !open;
                      if (nextOpen) {
                        setRunItemSortOpen(false);
                      }
                      return nextOpen;
                    })
                  }
                >
                  <FiFilter />
                  <span>Filter</span>
                </button>

                {runItemFilterOpen ? (
                  <div className="uFilter__panel">
                    <label className="uFilter__field">
                      <span>Role</span>
                      <select value={runItemRoleFilter} onChange={(event) => setRunItemRoleFilter(event.target.value)}>
                        <option value="all">All Roles</option>
                        {runItemRoleOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="uFilter__field">
                      <span>Department</span>
                      <select
                        value={runItemDepartmentFilter}
                        onChange={(event) => setRunItemDepartmentFilter(event.target.value)}
                      >
                        <option value="all">All Departments</option>
                        {runItemDepartmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="uFilter__actions">
                      <button type="button" onClick={clearRunItemFilters}>
                        Reset Filters
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hrPayRunSummary">
            <article className="hrPayRunSummary__card">
              <span>Payment Date</span>
              <strong>{formatDate(currentRun.paymentDate)}</strong>
            </article>
            <article className="hrPayRunSummary__card">
              <span>Coverage</span>
              <strong>{formatDate(currentRun.periodStart)} - {formatDate(currentRun.periodEnd)}</strong>
            </article>
            <article className="hrPayRunSummary__card">
              <span>Run Type</span>
              <strong>{formatRunType(currentRun.runType)}</strong>
            </article>
            <article className="hrPayRunSummary__card">
              <span>Payslips Generated</span>
              <strong>{currentRun.itemCount ?? 0}</strong>
            </article>
          </div>

          <div className="hrPayTableShell mgrPendTable">
            {isLoadingRunItems ? (
              <div className="mgrPendTable__empty">
                <span>Loading payroll item summaries.</span>
                <span>Checking the current run now.</span>
              </div>
            ) : visibleRunItems.length > 0 ? (
              <>
                <div className="hrPayRunTable__head hrPayRunTable__head--reporting" role="row">
                  <span>EMP ID</span>
                  <span>NAME</span>
                  <span>Gross Pay</span>
                  <span>Deductions</span>
                  <span>Net Pay</span>
                  <span className="hrPayRunTable__headCell--peek" aria-hidden="true" />
                </div>

                <div className="mgrPendTable__body">
                  {visibleRunItems.map((row) => (
                    <button
                      key={row.itemId}
                      type="button"
                      className="hrPayRunTable__row hrPayRunTable__row--reporting"
                      onClick={() => void openPayrollItemDetail(row)}
                    >
                      <span className="mgrPendTable__cell">{row.empId ?? '-'}</span>
                      <span className="mgrPendTable__cell mgrPendTable__cell--name">
                        {row.employee}
                      </span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.grossPay)}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.deductions)}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.netPay)}</span>
                      <span className="mgrPendTable__cell hrPayRunTable__cell--peek" aria-hidden="true">
                        <FiEye className="hrPayRunTable__peekIcon" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="uEmptyState">
                {runItems.length > 0
                  ? 'No payroll items matched the selected role or department filters. Try clearing the filters to show more employees.'
                  : canAddManualAdjustmentLine
                    ? 'No payroll items yet for this in-progress run. Add a manual adjustment line to create the first payroll item.'
                    : 'No payroll items yet for this in-progress run. Process the payroll period or add adjustment items first.'}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="hrPayPanel">
        <header className="hrPayPanel__head">Payroll Dispute from Employees</header>

        <div className="hrPayToolbar">
          <label className="uSearch" aria-label="Search payroll disputes">
            <FiSearch />
            <input
              value={disputeSearchValue}
              onChange={(event) => setDisputeSearchValue(event.target.value)}
              placeholder="Search employee, dispute type, reason, or status"
            />
            {disputeSearchValue && (
              <button type="button" aria-label="Clear search" onClick={() => setDisputeSearchValue('')}>
                <FiXCircle />
              </button>
            )}
          </label>

          <div className="uFilter">
            <button
              type="button"
              className={`uFilter__toggle ${disputeFilterOpen ? 'is-open' : ''} ${
                activeDisputeFilterCount > 0 ? 'is-active' : ''
              }`}
              onClick={() => setDisputeFilterOpen((open) => !open)}
            >
              <FiFilter />
              <span>Filter</span>
            </button>

            {disputeFilterOpen && (
              <div className="uFilter__panel">
                <label className="uFilter__field">
                  <span>Dispute Type</span>
                  <select
                    value={disputeTypeFilter}
                    onChange={(event) => setDisputeTypeFilter(event.target.value as DisputeTypeFilter)}
                  >
                    <option value="all">All Types</option>
                    <option value="Overtime">Overtime</option>
                    <option value="Attendance Issue">Attendance Issue</option>
                    <option value="Absent Deduction">Absent Deduction</option>
                    <option value="General">General</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="uFilter__field">
                  <span>Status</span>
                  <select
                    value={disputeStatusFilter}
                    onChange={(event) => setDisputeStatusFilter(event.target.value as DisputeStatusFilter)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="WAITING_ADJUSTMENT">Waiting for Adjustment</option>
                  </select>
                </label>

                <div className="uFilter__actions">
                  <button type="button" onClick={clearDisputeFilters}>
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hrPayTableShell mgrPendTable">
          {visibleDisputes.length > 0 ? (
            <>
              <div className="mgrPendTable__head hrPayDisputeTable__head" role="row">
                <span>Name</span>
                <span>Request</span>
                <span>Specific Type</span>
                <span>Payroll Period</span>
                <span>Submitted At</span>
                <span className="mgrPendTable__headCell--status">Status</span>
              </div>

              <div className="mgrPendTable__body">
                {visibleDisputes.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`mgrPendTable__row mgrPendTable__row--${row.statusTone}`}
                    onClick={() => openDisputeRow(row)}
                  >
                    <span className="mgrPendTable__cell mgrPendTable__cell--name">{row.employee}</span>
                    <span className="mgrPendTable__cell">Payroll Dispute</span>
                    <span className="mgrPendTable__cell">{row.subject}</span>
                    <span className="mgrPendTable__cell">{row.payrollPeriod}</span>
                    <span className="mgrPendTable__cell">{row.submittedAt}</span>
                    <span className="mgrPendTable__cell mgrPendTable__cell--status">
                      <span className={`hrApprRow__status hrApprRow__status--${row.statusTone}`}>{row.statusLabel}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="uEmptyState">
              {disputes.length > 0
                ? 'No matching disputes found for your search or filters.'
                : 'No payroll disputes have been submitted yet. New employee disputes will show up here.'}
            </div>
          )}
        </div>
      </section>

      {runModalOpen && (
        <LargePopup
          open
          ariaLabel={runModalTitle}
          title={runModalTitle}
          subtitle="Set the payroll coverage window and run type before starting this payroll process."
          size="lg"
          className="hrPayPopup hrPayPopup--runSetup"
          onClose={runUnsavedPrompt.requestClose}
          closeDisabled={isSubmittingRun}
          footer={(
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={runUnsavedPrompt.requestClose}
                disabled={isSubmittingRun}
              >
                Cancel
              </button>
              <button type="button" className="btn" onClick={requestPayrollRunConfirmation} disabled={isSubmittingRun}>
                {isSubmittingRun ? 'Submitting...' : runSubmitLabel}
              </button>
            </>
          )}
        >
          <div className="hrPayModal hrPayModal--run">
            <div className="hrPayModal__grid hrPayModal__grid--compact">
              <label>
                <span>Period Start:</span>
                <input
                  type="date"
                  value={runForm.periodStart}
                  aria-invalid={isRunPeriodStartInvalid ? 'true' : undefined}
                  onChange={(event) => {
                    const nextStart = event.target.value;
                    setRunForm((prev) => {
                      const next = { ...prev, periodStart: nextStart };
                      const standard = getStandardPaymentDate(next.periodStart, next.periodEnd);
                      if (standard) next.paymentDate = standard;
                      return next;
                    });
                  }}
                  max={runForm.periodEnd || todayIsoDate}
                />
              </label>
              <label>
                <span>Period End:</span>
                <input
                  type="date"
                  value={runForm.periodEnd}
                  aria-invalid={isRunPeriodEndInvalid ? 'true' : undefined}
                  onChange={(event) => {
                    const nextEnd = event.target.value;
                    setRunForm((prev) => {
                      const next = { ...prev, periodEnd: nextEnd };
                      const standard = getStandardPaymentDate(next.periodStart, next.periodEnd);
                      if (standard) next.paymentDate = standard;
                      return next;
                    });
                  }}
                  min={runForm.periodStart || undefined}
                  max={todayIsoDate}
                />
              </label>
              <label>
                <span>
                  Payment Date:
                  {getStandardPaymentDate(runForm.periodStart, runForm.periodEnd) === runForm.paymentDate && (
                    <small style={{ color: 'var(--hr-primary)', marginLeft: '6px', fontWeight: 'bold' }}>
                      (Standard)
                    </small>
                  )}
                </span>
                <input
                  type="date"
                  value={runForm.paymentDate}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                  min={runForm.periodEnd || undefined}
                />
              </label>
              <label>
                <span>Run Type:</span>
                <select
                  value={runForm.runType}
                  onChange={(event) =>
                    setRunForm((prev) => ({
                      ...prev,
                      runType: event.target.value as RunFormState['runType'],
                    }))
                  }
                >
                  <option value="REGULAR">Regular Payroll</option>
                  <option value="ADJUSTMENT">Adjustment Payroll</option>
                </select>
              </label>
            </div>
          </div>
        </LargePopup>
      )}

      {manualLineModalOpen && currentRun && (
        <LargePopup
          open
          ariaLabel="Add manual adjustment line"
          title="Add Manual Adjustment Line"
          subtitle="Choose an employee, select whether this is an earning or deduction, and enter the amount to add it to the active adjustment run."
          size="xl"
          className="hrPayPopup hrPayPopup--manualLine"
          onClose={manualLineUnsavedPrompt.requestClose}
          closeDisabled={isSubmittingManualLine}
          footer={(
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={manualLineUnsavedPrompt.requestClose}
                disabled={isSubmittingManualLine}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void submitManualLine()}
                disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
              >
                {isSubmittingManualLine ? 'Adding...' : 'Add Line'}
              </button>
            </>
          )}
        >
          <div className="hrPayModal hrPayModal--run">
            <div className="hrPayModal__grid hrPayModal__grid--compact hrPayModal__grid--manualLine">
              <label className="hrPayModal__gridItem--full">
                <span>Employee:</span>
                <div className={`hrPayPicker ${manualEmployeePickerOpen ? 'is-open' : ''}`} ref={manualEmployeePickerRef}>
                  <div className="hrPayPicker__control" aria-invalid={isManualEmployeeInvalid ? 'true' : undefined}>
                    <input
                      type="text"
                      className="hrPayPicker__input"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="manual-employee-options"
                      aria-expanded={manualEmployeePickerOpen}
                      aria-haspopup="listbox"
                      aria-invalid={isManualEmployeeInvalid ? 'true' : undefined}
                      value={manualEmployeeSearch}
                      onFocus={() => setManualEmployeePickerOpen(true)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setManualEmployeeSearch(nextValue);
                        setManualEmployeePickerOpen(true);
                        setManualLineError('');
                        if (normalizeText(selectedManualEmployee?.name ?? '') !== normalizeText(nextValue)) {
                          setManualLineForm((prev) => ({ ...prev, empId: '' }));
                        }
                      }}
                      placeholder={isLoadingEmployeeOptions ? 'Loading employees...' : 'Search or choose an employee'}
                      disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
                    />
                    {canClearManualEmployeePicker ? (
                      <button
                        type="button"
                        className="hrPayPicker__clear"
                        onClick={clearManualEmployeeSelection}
                        disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
                        aria-label="Clear employee selection"
                      >
                        <FiX />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="hrPayPicker__toggle"
                      onClick={() => setManualEmployeePickerOpen((prev) => !prev)}
                      disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
                      aria-label={manualEmployeePickerOpen ? 'Close employee list' : 'Open employee list'}
                    >
                      <FiChevronDown />
                    </button>
                  </div>
                  {manualEmployeePickerOpen && (
                    <div className="hrPayPicker__menu" id="manual-employee-options" role="listbox">
                      {isLoadingEmployeeOptions ? (
                        <div className="hrPayPicker__empty">Loading employees...</div>
                      ) : filteredEmployeeOptions.length > 0 ? (
                        filteredEmployeeOptions.map((option) => {
                          const isSelected = option.id === Number(manualLineForm.empId);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              className={`hrPayPicker__option ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => selectManualEmployee(option)}
                            >
                              {option.name}
                            </button>
                          );
                        })
                      ) : (
                        <div className="hrPayPicker__empty">No employees match that search.</div>
                      )}
                    </div>
                  )}
                </div>
              </label>
              <label>
                <span>Line Type:</span>
                <select
                  value={manualLineForm.lineType}
                  onChange={(event) =>
                    setManualLineForm((prev) => ({
                      ...prev,
                      lineType: event.target.value as ManualLineFormState['lineType'],
                    }))
                  }
                  disabled={isSubmittingManualLine}
                >
                  <option value="EARNING">Manual Earning</option>
                  <option value="BONUS">Bonus</option>
                  <option value="DEDUCTION">Manual Deduction</option>
                </select>
              </label>
              <label>
                <span>Amount:</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualLineForm.amount}
                  aria-invalid={isManualAmountInvalid ? 'true' : undefined}
                  onChange={(event) => setManualLineForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="0.00"
                  disabled={isSubmittingManualLine}
                />
              </label>
            </div>
            {manualLineError && <p className="hrPay__message">{manualLineError}</p>}
          </div>
        </LargePopup>
      )}

      {postModalOpen && currentRun && (
        <LargePopup
          open
          ariaLabel="Post payroll run"
          title="Post Payroll Run"
          subtitle="Review the payroll run summary carefully before confirming the final posting step."
          size="lg"
          className="hrPayPopup hrPayPopup--postRun"
          onClose={() => setPostModalOpen(false)}
          closeDisabled={isPostingRun}
          footer={(
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setPostModalOpen(false)} disabled={isPostingRun}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={() => void postCurrentRun()} disabled={isPostingRun}>
                {isPostingRun ? 'Posting...' : 'Confirm Post'}
              </button>
            </>
          )}
        >
          <div className="hrPayModal hrPayModal--run">
            <div className="hrPayModal__summary">
              <div className="hrPayModal__summaryRow">
                <span>Run ID</span>
                <strong>#{currentRun.payId ?? '-'}</strong>
              </div>
              <div className="hrPayModal__summaryRow">
                <span>Type</span>
                <strong>{formatRunType(currentRun.runType)}</strong>
              </div>
              <div className="hrPayModal__summaryRow">
                <span>Period</span>
                <strong>{formatDate(currentRun.periodStart)} - {formatDate(currentRun.periodEnd)}</strong>
              </div>
            </div>
          </div>
        </LargePopup>
      )}

      {correctionOpen && (
        <LargePopup
          open
          ariaLabel="Stage payroll correction"
          title="Stage Approved Dispute Correction"
          subtitle="Review the approved dispute, choose the matching payroll line, and stage the corrected amount into the active adjustment run."
          size="xl"
          className="hrPayPopup hrPayPopup--correction"
          onClose={correctionUnsavedPrompt.requestClose}
          closeDisabled={isSubmittingCorrection}
          footer={(
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={correctionUnsavedPrompt.requestClose}
                disabled={isSubmittingCorrection}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void submitCorrection()}
                disabled={isLoadingCorrection || isSubmittingCorrection || !selectedCorrectionLine}
              >
                {isSubmittingCorrection ? 'Staging...' : 'Stage Correction'}
              </button>
            </>
          )}
        >
          <div className="hrPayModal">
            {isLoadingCorrection ? (
              <p className="hrPayModal__intro">
                Loading the disputed payslip item, its earnings and deductions, and the adjustment run to use for this
                correction.
              </p>
            ) : (
              <>
                <div className="hrPayCorrectionSummary">
                  <div className="hrPayCorrectionSummary__row">
                    <span className="hrPayCorrectionSummary__label">Employee</span>
                    <div className="hrPayCorrectionSummary__value">{correctionIntent?.employee ?? '-'}</div>
                  </div>
                  <div className="hrPayCorrectionSummary__row">
                    <span className="hrPayCorrectionSummary__label">Source Item</span>
                    <div className="hrPayCorrectionSummary__value">
                      #{correctionSource?.itemId ?? correctionIntent?.itemId ?? '-'}
                    </div>
                  </div>
                  <div className="hrPayCorrectionSummary__row">
                    <span className="hrPayCorrectionSummary__label">Source Period</span>
                    <div className="hrPayCorrectionSummary__value">
                      {formatDate(correctionSource?.runDetails?.periodStart)} - {formatDate(correctionSource?.runDetails?.periodEnd)}
                    </div>
                  </div>
                  <div className="hrPayCorrectionSummary__row">
                    <span className="hrPayCorrectionSummary__label">Adjustment Run</span>
                    <div className="hrPayCorrectionSummary__value">#{adjustmentRunId ?? '-'}</div>
                  </div>
                </div>

                <label className="hrPayModal__area">
                  <span>Dispute Message:</span>
                  <textarea value={correctionIntent?.message ?? 'No dispute message provided.'} readOnly />
                </label>

                <label className="hrPayModal__area">
                  <span>Employee Reason:</span>
                  <textarea value={correctionIntent?.disputeReason ?? 'No employee reason provided.'} readOnly />
                </label>

                <label className="hrPayModal__area">
                  <span>HR Decision Note:</span>
                  <textarea value={correctionIntent?.decisionReason ?? '-'} readOnly />
                </label>

                <div className="hrPayCorrectionPicker">
                  <div className="hrPayCorrectionPicker__head">
                    <div className="hrPayCorrectionPicker__heading">
                      <span className="hrPayCorrectionPicker__stepText">Step 1</span>
                      <strong>Select the exact line to correct</strong>
                      <p>
                        Click the matching payroll line below to select it. The line name is filled in automatically,
                        so you only need to type the corrected amount afterward.
                      </p>
                    </div>
                  </div>
                  <div className="hrPayCorrectionPicker__list">
                    {correctionLines.map((line) => (
                      <button
                        key={line.key}
                        type="button"
                        className={`hrPayCorrectionLine${line.key === selectedCorrectionKey ? ' is-selected' : ''}`}
                        onClick={() => setSelectedCorrectionKey(line.key)}
                        aria-pressed={line.key === selectedCorrectionKey}
                      >
                        <div className="hrPayCorrectionLine__main">
                          <div className="hrPayCorrectionLine__identity">
                            <span className="hrPayCorrectionLine__type">
                              {line.lineType === 'EARNING' ? 'Earning' : 'Deduction'}
                            </span>
                            <strong>{line.label}</strong>
                          </div>
                          <span className="hrPayCorrectionLine__amount">{formatCurrency(line.amount)}</span>
                        </div>
                        <div className="hrPayCorrectionLine__meta">
                          {line.originalAmount && <span>Original posted amount: {formatCurrency(line.originalAmount)}</span>}
                          {line.adjustedBy && <span>Last adjusted by {line.adjustedBy}</span>}
                          {line.adjustedAt && <span>{formatDateTime(line.adjustedAt)}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hrPayCorrectionAction">
                  <div className="hrPayCorrectionAction__card">
                    <span>Step 2</span>
                    <strong>
                      {selectedCorrectionLine
                        ? `${selectedCorrectionLine.lineType === 'EARNING' ? 'Earning' : 'Deduction'} - ${selectedCorrectionLine.label}`
                        : 'No payroll line selected yet'}
                    </strong>
                    <p>
                      {selectedCorrectionLine
                        ? 'Enter the corrected amount for the selected payroll line.'
                        : 'Click one payroll line above to lock in the exact line before the corrected amount field becomes available.'}
                    </p>
                  </div>
                  <label className="hrPayCorrectionAction__card hrPayCorrectionAction__card--form">
                    <span>Corrected Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={correctedAmount}
                      aria-invalid={isCorrectionAmountInvalid ? 'true' : undefined}
                      onChange={(event) => setCorrectedAmount(event.target.value)}
                      placeholder={selectedCorrectionLine ? `Current amount: ${selectedCorrectionLine.amount}` : 'Choose a line first'}
                      disabled={!selectedCorrectionLine || isSubmittingCorrection}
                    />
                    {!selectedCorrectionLine && <small>Pick the exact payroll line above to enable amount entry.</small>}
                  </label>
                </div>

              </>
            )}

          </div>
        </LargePopup>
      )}

      {selectedPayrollItem && (
        <LargePopup
          open
          ariaLabel="Payroll item breakdown"
          title={`${selectedPayrollItem.employee} - Payslip Breakdown`}
          subtitle="Review the current earnings, deductions, and totals, and edit line amounts while this payroll item is still in progress."
          size="xl"
          className="hrPayPopup hrPayPopup--breakdown"
          onClose={() => setSelectedPayrollItem(null)}
        >
          <div className="hrPayModal">
            <div className="hrPayModal__grid">
              <label>
                <span>Payroll Item:</span>
                <input value={`#${selectedPayrollItem.itemId}`} readOnly />
              </label>
              <label>
                <span>Run Status:</span>
                <input value={formatPayrollStatusLabel(currentRun?.payrollStatus ?? 'IN_PROGRESS')} readOnly />
              </label>
              <label>
                <span>Pay Period:</span>
                <input value={`${formatDate(currentRun?.periodStart)} - ${formatDate(currentRun?.periodEnd)}`} readOnly />
              </label>
              <label>
                <span>Run Type:</span>
                <input
                  value={formatPayrollRunTypeLabel(currentRun?.runType, {
                    bonusPayout: selectedPayrollIsBonusPayout,
                  })}
                  readOnly
                />
              </label>
            </div>

            <div className="hrPayBreakdownTotals">
              <div className="hrPayBreakdownTotals__card">
                <span>Gross Pay</span>
                <strong>{formatCurrency(selectedPayrollGross)}</strong>
              </div>
              <div className="hrPayBreakdownTotals__card">
                <span>Total Deductions</span>
                <strong>{formatCurrency(selectedPayrollDeductions)}</strong>
              </div>
              <div className="hrPayBreakdownTotals__card">
                <span>Net Pay</span>
                <strong>{formatCurrency(selectedPayrollNet)}</strong>
              </div>
            </div>

            {isLoadingPayrollItem ? (
              <p className="hrPayModal__intro">
                Loading the payroll lines for this employee so the full payslip breakdown can be reviewed.
              </p>
            ) : (
              <>
                <div className="hrPayBreakdown">
                  <section className="hrPayBreakdown__section">
                    <div className="hrPayBreakdown__head">
                      <h4>Earnings</h4>
                      <span>{selectedPayrollItemEarnings.length} line(s)</span>
                    </div>
                    <div className="hrPayBreakdown__list">
                      {selectedPayrollItemEarnings.length > 0 ? (
                        selectedPayrollItemEarnings.map((line) => (
                          <div key={line.key} className="hrPayBreakdown__row">
                            <div>
                              <strong>{line.label}</strong>
                              {(line.adjustedBy || line.adjustedAt) && (
                                <span>
                                  {line.adjustedBy ? `Adjusted by ${line.adjustedBy}` : 'Adjusted'}{' '}
                                  {line.adjustedAt ? `on ${formatDateTime(line.adjustedAt)}` : ''}
                                </span>
                              )}
                            </div>
                            <div className="hrPayBreakdown__amounts">
                              {line.originalAmount && <small>Original: {formatCurrency(line.originalAmount)}</small>}
                              {editingPayrollLineKey === line.key ? (
                                <div className="hrPayBreakdown__editor">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payrollLineDraftAmount}
                                    onChange={(event) => setPayrollLineDraftAmount(event.target.value)}
                                    aria-label={`Edit amount for ${line.label}`}
                                  />
                                  <div className="hrPayBreakdown__editorActions">
                                    <button
                                      type="button"
                                      className="hrPayBreakdown__editorBtn is-muted"
                                      onClick={cancelPayrollLineEdit}
                                      disabled={isSavingPayrollLine}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="hrPayBreakdown__editorBtn"
                                      onClick={() => void savePayrollLineAmount(line)}
                                      disabled={isSavingPayrollLine}
                                    >
                                      {isSavingPayrollLine ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="hrPayBreakdown__valueRow">
                                  <strong>{formatCurrency(line.amount)}</strong>
                                  {canEditSelectedPayrollItem && (
                                    <button
                                      type="button"
                                      className="hrPayBreakdown__editBtn"
                                      onClick={() => startPayrollLineEdit(line)}
                                      disabled={isSavingPayrollLine}
                                      aria-label={`Edit amount for ${line.label}`}
                                      title={`Edit amount for ${line.label}`}
                                    >
                                      <FiEdit2 />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="hrPayBreakdown__empty">No earnings were returned for this payroll item.</div>
                      )}
                    </div>
                  </section>

                  <section className="hrPayBreakdown__section">
                    <div className="hrPayBreakdown__head">
                      <h4>Deductions</h4>
                      <span>{selectedPayrollItemDeductions.length} line(s)</span>
                    </div>
                    <div className="hrPayBreakdown__list">
                      {selectedPayrollItemDeductions.length > 0 ? (
                        selectedPayrollItemDeductions.map((line) => (
                          <div key={line.key} className="hrPayBreakdown__row">
                            <div>
                              <strong>{line.label}</strong>
                              {(line.adjustedBy || line.adjustedAt) && (
                                <span>
                                  {line.adjustedBy ? `Adjusted by ${line.adjustedBy}` : 'Adjusted'}{' '}
                                  {line.adjustedAt ? `on ${formatDateTime(line.adjustedAt)}` : ''}
                                </span>
                              )}
                            </div>
                            <div className="hrPayBreakdown__amounts">
                              {line.originalAmount && <small>Original: {formatCurrency(line.originalAmount)}</small>}
                              {editingPayrollLineKey === line.key ? (
                                <div className="hrPayBreakdown__editor">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={payrollLineDraftAmount}
                                    onChange={(event) => setPayrollLineDraftAmount(event.target.value)}
                                    aria-label={`Edit amount for ${line.label}`}
                                  />
                                  <div className="hrPayBreakdown__editorActions">
                                    <button
                                      type="button"
                                      className="hrPayBreakdown__editorBtn is-muted"
                                      onClick={cancelPayrollLineEdit}
                                      disabled={isSavingPayrollLine}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="hrPayBreakdown__editorBtn"
                                      onClick={() => void savePayrollLineAmount(line)}
                                      disabled={isSavingPayrollLine}
                                    >
                                      {isSavingPayrollLine ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="hrPayBreakdown__valueRow">
                                  <strong>{formatCurrency(line.amount)}</strong>
                                  {canEditSelectedPayrollItem && (
                                    <button
                                      type="button"
                                      className="hrPayBreakdown__editBtn"
                                      onClick={() => startPayrollLineEdit(line)}
                                      disabled={isSavingPayrollLine}
                                      aria-label={`Edit amount for ${line.label}`}
                                      title={`Edit amount for ${line.label}`}
                                    >
                                      <FiEdit2 />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="hrPayBreakdown__empty">No deductions were returned for this payroll item.</div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </LargePopup>
      )}

      {selectedDispute && (
        <LargePopup
          open
          ariaLabel="Payslip dispute review"
          title={`${selectedDispute.employee} - Payslip Dispute`}
          subtitle="Review the employee dispute, decide whether it should be denied or moved to waiting for adjustment, and reopen it later when you are ready to stage the correction."
          size="xl"
          className="hrPayPopup hrPayPopup--dispute"
          onClose={disputeReviewUnsavedPrompt.requestClose}
          footer={(
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={disputeReviewUnsavedPrompt.requestClose}
                disabled={isSaving}
              >
                {canReviewSelectedDispute || canStageSelectedDisputeCorrection ? 'Cancel' : 'Close'}
              </button>
              {canReviewSelectedDispute ? (
                <button type="button" className="btn" onClick={requestDisputeDecisionConfirmation} disabled={isSaving || !pendingDisputeDecision}>
                  {isSaving
                    ? 'Saving...'
                    : pendingDisputeDecision === 'APPROVED'
                      ? 'Move to Waiting Adjustment'
                      : pendingDisputeDecision === 'REJECTED'
                        ? 'Confirm Denial'
                        : 'Confirm Decision'}
                </button>
              ) : canStageSelectedDisputeCorrection ? (
                <button type="button" className="btn" onClick={openSelectedDisputeCorrection}>
                  Open Adjustment Workspace
                </button>
              ) : (
                <button type="button" className="btn" onClick={disputeReviewUnsavedPrompt.requestClose} disabled={isSaving}>
                  Close
                </button>
              )}
            </>
          )}
        >
          <div className="hrPayModal">
            <div className="hrPayModal__grid">
              <label>
                <span>Status:</span>
                <input value={selectedDispute.statusLabel} readOnly />
              </label>
              <label>
                <span>Submitted At:</span>
                <input value={selectedDispute.submittedAt} readOnly />
              </label>
              <label>
                <span>Payroll Period:</span>
                <input value={selectedDispute.payrollPeriod} readOnly />
              </label>
              <label>
                <span>Dispute Type:</span>
                <input value={selectedDispute.subject} readOnly />
              </label>
            </div>

            <label className="hrPayModal__area">
              <span>Reason for Dispute:</span>
              <textarea value={selectedDispute.reason || 'No reason provided.'} readOnly />
            </label>

            <div className="hrApprAttachment hrApprAttachment--payroll">
              <div className="hrApprAttachment__copy">
                <span>Attachment:</span>
                <p>
                  {typeof selectedDispute.attachmentPathId === 'number'
                    ? 'A supporting file was uploaded with this dispute.'
                    : 'No attachment was uploaded with this dispute.'}
                </p>
              </div>
              {typeof selectedDispute.attachmentPathId === 'number' && (
                <button
                  type="button"
                  className="hrApprAttachment__button"
                  onClick={() => void handleOpenAttachment(selectedDispute.attachmentPathId!)}
                  disabled={openingAttachmentId === selectedDispute.attachmentPathId}
                >
                  {openingAttachmentId === selectedDispute.attachmentPathId ? 'Opening...' : 'View Attachment'}
                </button>
              )}
            </div>

            {selectedDispute.decisionSummary && (
              <label className="hrPayModal__area">
                <span>Latest Decision Note:</span>
                <textarea value={selectedDispute.decisionSummary} readOnly />
              </label>
            )}

            {canReviewSelectedDispute && (
              <>
                <div className="hrPayModal__area">
                  <span>Administrative Decision:</span>
                  <div className="decisionPicker">
                    <div className="decisionPicker__actions">
                      <button
                        type="button"
                        className={`decisionPicker__button ${pendingDisputeDecision === 'APPROVED' ? 'is-selected' : ''}`}
                        disabled={isSaving}
                        onClick={() => setPendingDisputeDecision('APPROVED')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className={`decisionPicker__button ${pendingDisputeDecision === 'REJECTED' ? 'is-selected' : ''}`}
                        disabled={isSaving}
                        onClick={() => setPendingDisputeDecision('REJECTED')}
                      >
                        Deny
                      </button>
                    </div>
                    <p className="decisionPicker__note">
                      Approving this dispute will move it to <strong>Waiting for Adjustment</strong> so you can stage
                      the payroll fix later instead of being redirected immediately.
                    </p>
                  </div>
                </div>

                <label className="hrPayModal__area">
                  <span>Reason for Approval / Denial:</span>
                  <textarea
                    placeholder="Type at least 5 characters explaining the decision"
                    value={remarks}
                    aria-invalid={isDisputeRemarksInvalid ? 'true' : undefined}
                    onChange={(event) => setRemarks(event.target.value)}
                  />
                </label>
              </>
            )}

            {canStageSelectedDisputeCorrection && (
              <div className="hrPayModal__callout">
                <strong>This dispute is waiting for adjustment.</strong>
                <span>
                  The approval is already saved. Open the correction workspace whenever you are ready to edit the
                  payroll line and stage the adjustment entry.
                </span>
              </div>
            )}

            {selectedDispute.statusCode === 'APPROVED' && (
              <p className="hrPay__message hrPay__message--ok">
                This dispute is already settled. Any correction that was needed has been staged or finalized.
              </p>
            )}

            {selectedDispute.statusCode === 'REJECTED' && (
              <p className="hrPay__message">This dispute was denied and no payroll adjustment will be staged from it.</p>
            )}

            {selectedDispute.statusCode === 'CANCELLED' && (
              <p className="hrPay__message">The employee cancelled this dispute before it was fully processed.</p>
            )}
          </div>
        </LargePopup>
      )}
      <ConfirmDialog
        open={confirmRunOpen}
        title={confirmRunTitle}
        message={confirmRunMessage}
        confirmLabel={confirmRunConfirmLabel}
        cancelLabel={confirmRunCancelLabel}
        isBusy={isSubmittingRun}
        onConfirm={() => {
          setConfirmRunOpen(false);
          void submitPayrollRun();
        }}
        onCancel={() => setConfirmRunOpen(false)}
      />
      <ConfirmDialog
        open={confirmDisputeDecisionOpen}
        title={pendingDisputeDecision === 'REJECTED' ? 'Confirm Dispute Denial' : 'Confirm Dispute Approval'}
        message={
          selectedDispute
            ? pendingDisputeDecision === 'REJECTED'
              ? `Apply this denial to ${selectedDispute.employee}'s payroll dispute?`
              : `Approve ${selectedDispute.employee}'s payroll dispute and move it to Waiting for Adjustment?`
            : 'Confirm this dispute decision?'
        }
        confirmLabel={pendingDisputeDecision === 'REJECTED' ? 'Confirm Denial' : 'Move to Waiting Adjustment'}
        cancelLabel="Go Back"
        isBusy={isSaving}
        onConfirm={() => {
          setConfirmDisputeDecisionOpen(false);
          void confirmDisputeDecision();
        }}
        onCancel={() => setConfirmDisputeDecisionOpen(false)}
      />
      <ConfirmDialog
        open={runUnsavedPrompt.confirmOpen}
        title="Discard Payroll Run Setup?"
        message="You have unsaved changes in this payroll run form. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={runUnsavedPrompt.discardAndClose}
        onCancel={runUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={manualLineUnsavedPrompt.confirmOpen}
        title="Discard Manual Line?"
        message="You have unsaved changes in this manual adjustment form. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={manualLineUnsavedPrompt.discardAndClose}
        onCancel={manualLineUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={correctionUnsavedPrompt.confirmOpen}
        title="Discard Correction Draft?"
        message="You have unsaved changes in this correction workspace. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={correctionUnsavedPrompt.discardAndClose}
        onCancel={correctionUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={disputeReviewUnsavedPrompt.confirmOpen}
        title="Discard Dispute Review Changes?"
        message="You have unsaved changes in this dispute review. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={disputeReviewUnsavedPrompt.discardAndClose}
        onCancel={disputeReviewUnsavedPrompt.keepEditing}
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
