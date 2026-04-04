import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
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

type DisputeStatusCode = 'PENDING' | 'WAITING_ADJUSTMENT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type DisputeStatusFilter = 'all' | DisputeStatusCode;
type DisputeTypeFilter = 'all' | 'Overtime' | 'Late Penalty' | 'Absent Deduction' | 'General' | 'Other';

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
};

type RunFormState = {
  periodStart: string;
  periodEnd: string;
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

function normalizeText(value?: string) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function mapDisputeType(subject?: string): Exclude<DisputeTypeFilter, 'all'> {
  const normalized = normalizeText(subject);
  if (normalized.includes('overtime')) return 'Overtime';
  if (normalized.includes('late')) return 'Late Penalty';
  if (normalized.includes('absent')) return 'Absent Deduction';
  if (normalized.includes('general')) return 'General';
  return 'Other';
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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

function employeeLabel(employeeName?: string, _employeeId?: number) {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : '';
  if (trimmedName) return trimmedName;
  return 'Employee unavailable';
}

function employeeLabelFromParts(firstName?: string, lastName?: string, employeeId?: number) {
  const fullName = [firstName, lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim();

  if (fullName) return fullName;
  if (typeof employeeId === 'number') return `Employee ID ${employeeId}`;
  return 'Employee unavailable';
}

function createDefaultRunForm(): RunFormState {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    periodStart: toISODate(start),
    periodEnd: toISODate(end),
    runType: 'REGULAR',
  };
}

function describeRun(periodStart: string, periodEnd: string) {
  return `Payroll run ${periodStart} to ${periodEnd}`;
}

function describeAdjustmentRun(periodStart: string, periodEnd: string) {
  return `Payroll adjustment ${periodStart} to ${periodEnd}`;
}

function formatRunType(value?: string) {
  if (!value) return 'Regular Payroll';
  return value === 'ADJUSTMENT' ? 'Adjustment Payroll' : 'Regular Payroll';
}

function normalizeRunType(value?: string): RunFormState['runType'] {
  return value === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'REGULAR';
}

function formatItemCount(value?: number) {
  const count = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${count} payroll item${count === 1 ? '' : 's'}`;
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
    reason: item.reason || '',
    decisionSummary: item.statusReason || '',
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

  const [runModalOpen, setRunModalOpen] = useState(false);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [runForm, setRunForm] = useState<RunFormState>(() => createDefaultRunForm());
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [isPostingRun, setIsPostingRun] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [runError, setRunError] = useState('');
  const [currentRun, setCurrentRun] = useState<PayrollRunDto | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionIntent, setCorrectionIntent] = useState<CorrectionIntent | null>(null);
  const [correctionSource, setCorrectionSource] = useState<CorrectionSourceItem | null>(null);
  const [correctionLines, setCorrectionLines] = useState<CorrectionLine[]>([]);
  const [selectedCorrectionKey, setSelectedCorrectionKey] = useState('');
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [correctionError, setCorrectionError] = useState('');
  const [isLoadingCorrection, setIsLoadingCorrection] = useState(false);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [adjustmentRunId, setAdjustmentRunId] = useState<number | null>(null);
  const [pendingDisputeDecision, setPendingDisputeDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [confirmDisputeDecisionOpen, setConfirmDisputeDecisionOpen] = useState(false);
  const [disputeSearchValue, setDisputeSearchValue] = useState('');
  const [disputeFilterOpen, setDisputeFilterOpen] = useState(false);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState<DisputeStatusFilter>('all');
  const [disputeTypeFilter, setDisputeTypeFilter] = useState<DisputeTypeFilter>('all');

  useErrorDialogEffect(loadError, 'Payroll data could not be loaded');
  useErrorDialogEffect(runItemsError, 'Payroll run items could not be loaded');
  useErrorDialogEffect(payrollItemError, 'Payroll item action failed');
  useErrorDialogEffect(actionError, 'Dispute action failed');
  useErrorDialogEffect(runError, 'Payroll run could not be completed');
  useErrorDialogEffect(correctionError, 'Payroll correction could not be completed');
  useEscapeDismiss(runModalOpen && !isSubmittingRun, () => setRunModalOpen(false), 10);
  useEscapeDismiss(postModalOpen && !isPostingRun, () => setPostModalOpen(false), 10);
  useEscapeDismiss(correctionOpen && !isSubmittingCorrection, resetCorrectionState, 10);
  useEscapeDismiss(Boolean(selectedPayrollItem), () => setSelectedPayrollItem(null), 10);
  useEscapeDismiss(Boolean(selectedDispute) && !isSaving, () => setSelectedDispute(null), 10);

  function syncRunForm(run: PayrollRunDto) {
    setRunForm((prev) => ({
      periodStart: run.periodStart ?? prev.periodStart,
      periodEnd: run.periodEnd ?? prev.periodEnd,
      runType: normalizeRunType(run.runType),
    }));
  }

  async function loadCurrentRun(preferredPayId?: number | null) {
    try {
      const response = await apiFetchJson<unknown>('/api/payroll/run');
      const runs = [...toArray<PayrollRunDto>(response)].sort(compareRunsDescending);
      const preferredRun =
        preferredPayId != null ? runs.find((run) => run.payId === preferredPayId) ?? null : null;
      const activeRun =
        runs.find((run) => run.payrollStatus === 'IN_PROGRESS' && (run.itemCount ?? 0) > 0) ??
        runs.find((run) => run.payrollStatus === 'IN_PROGRESS') ??
        null;
      const nextRun =
        (preferredRun?.payrollStatus === 'IN_PROGRESS' ? preferredRun : null) ??
        activeRun ??
        preferredRun ??
        runs.find((run) => (run.itemCount ?? 0) > 0) ??
        runs[0] ??
        null;

      setCurrentRun(nextRun);
      if (nextRun) syncRunForm(nextRun);
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    }
  }

  useEffect(() => {
    if (selectedDispute || selectedPayrollItem || runModalOpen || postModalOpen || correctionOpen) {
      document.body.classList.add('modal-open');
    }
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [correctionOpen, postModalOpen, runModalOpen, selectedDispute, selectedPayrollItem]);

  useEffect(() => {
    setRemarks('');
    setActionError('');
    setPendingDisputeDecision(null);
    setConfirmDisputeDecisionOpen(false);
  }, [selectedDispute?.id]);

  useEffect(() => {
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
  }, [selectedPayrollItem?.itemId]);

  useEffect(() => {
    const storedRun = readStoredRun();
    if (storedRun) syncRunForm(storedRun);
    void loadCurrentRun(storedRun?.payId);
  }, []);

  useEffect(() => {
    try {
      if (currentRun) {
        window.localStorage.setItem(PAYROLL_RUN_STORAGE_KEY, JSON.stringify(currentRun));
      } else {
        window.localStorage.removeItem(PAYROLL_RUN_STORAGE_KEY);
      }
    } catch {
      // ignore storage write failures
    }
  }, [currentRun]);

  async function loadDisputes() {
    const waitingDisputes = readWaitingDisputes();
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
  }, []);

  useEffect(() => {
    if (!currentRun?.payId || currentRun.payrollStatus !== 'IN_PROGRESS') {
      setRunItems([]);
      setRunItemsError('');
      setIsLoadingRunItems(false);
      return;
    }

    let cancelled = false;

    async function loadRunItems() {
      const payId = currentRun?.payId;
      if (payId == null) {
        setRunItems([]);
        setIsLoadingRunItems(false);
        return;
      }

      setIsLoadingRunItems(true);
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

        setRunItems(mapped);
      } catch (error) {
        if (!cancelled) {
          setRunItems([]);
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
  }, [currentRun?.payId, currentRun?.payrollStatus]);

  const displayedPeriodStart = currentRun?.periodStart ?? runForm.periodStart;
  const displayedPeriodEnd = currentRun?.periodEnd ?? runForm.periodEnd;
  const canPostCurrentRun =
    Boolean(currentRun?.payId) &&
    currentRun?.payrollStatus !== 'POSTED' &&
    (currentRun?.itemCount ?? 0) > 0;
  const emptyRunHint =
    currentRun && currentRun.payrollStatus !== 'POSTED' && (currentRun.itemCount ?? 0) <= 0
      ? currentRun.runType === 'ADJUSTMENT'
        ? 'This adjustment run is still empty. Add correction items before posting it.'
        : 'This run has no generated payroll items yet. Process the payroll period again or check if there were eligible employees for these dates.'
      : '';
  const runModalTitle =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run';
  const runSubmitLabel =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run';

  const currentPayPeriod = useMemo(() => {
    return formatDate(displayedPeriodEnd);
  }, [displayedPeriodEnd]);
  const normalizedDisputeSearch = normalizeText(disputeSearchValue);
  const canReviewSelectedDispute = selectedDispute ? selectedDispute.statusCode === 'PENDING' : false;
  const canStageSelectedDisputeCorrection =
    selectedDispute ? selectedDispute.statusCode === 'WAITING_ADJUSTMENT' : false;
  const isCurrentRunInProgress = currentRun?.payrollStatus === 'IN_PROGRESS';
  const canEditSelectedPayrollItem = currentRun?.payrollStatus === 'IN_PROGRESS';
  const selectedPayrollGross = selectedPayrollItem ? selectedPayrollItem.grossPay : 0;
  const selectedPayrollNet = selectedPayrollItem ? selectedPayrollItem.netPay : 0;
  const selectedPayrollDeductions = useMemo(() => {
    if (!selectedPayrollItem) return 0;
    if (selectedPayrollItemDeductions.length > 0) {
      return selectedPayrollItemDeductions.reduce((sum, line) => sum + toAmount(line.amount), 0);
    }
    return selectedPayrollItem.deductions;
  }, [selectedPayrollItem, selectedPayrollItemDeductions]);

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

  const selectedCorrectionLine = useMemo(
    () => correctionLines.find((line) => line.key === selectedCorrectionKey) ?? null,
    [correctionLines, selectedCorrectionKey]
  );

  function clearDisputeFilters() {
    setDisputeStatusFilter('all');
    setDisputeTypeFilter('all');
  }

  function resetCorrectionState() {
    setCorrectionOpen(false);
    setCorrectionIntent(null);
    setCorrectionSource(null);
    setCorrectionLines([]);
    setSelectedCorrectionKey('');
    setCorrectedAmount('');
    setCorrectionError('');
    setIsLoadingCorrection(false);
    setIsSubmittingCorrection(false);
    setAdjustmentRunId(null);
  }

  function mapCorrectionLines(response: unknown, lineType: CorrectionLine['lineType']) {
    return toArray<Record<string, unknown>>(response)
      .map((row, idx) => mapCorrectionLine(row, idx, lineType))
      .filter((line): line is CorrectionLine => line !== null);
  }

  async function openPayrollItemDetail(row: PayrollItemSummaryRow) {
    setSelectedPayrollItem(row);
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
    } catch (error) {
      setPayrollItemError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingPayrollItem(false);
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
      setAdjustmentRunId(reusableRun.payId ?? null);
      setRunMessage(`Reusing adjustment run #${reusableRun.payId ?? '-'} for this approved dispute.`);
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

    setCurrentRun(createdRun);
    syncRunForm(createdRun);
    setAdjustmentRunId(createdRun.payId ?? null);
    setRunMessage(`Adjustment run #${createdRun.payId ?? '-'} is ready for the approved dispute.`);
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
      setSelectedCorrectionKey(nextLines[0]?.key ?? '');
      await ensureAdjustmentRun(sourceResponse);
    } catch (error) {
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
      if (!currentRun) {
        await loadCurrentRun();
      }
    } finally {
      setIsLoadingCorrection(false);
    }
  }

  async function submitCorrection() {
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
      setRunMessage(
        `Correction for ${employee} was staged in adjustment run #${runId}. Review the run and post it when you are ready.`
      );
    } catch (error) {
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      setIsSubmittingCorrection(false);
    }
  }

  async function updateDispute(status: 'APPROVED' | 'REJECTED') {
    if (!selectedDispute) return;
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
        const refreshedDisputes = await loadDisputes();
        setSelectedDispute(refreshedDisputes.find((row) => row.id === waitingRow.id) ?? waitingRow);
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

  async function confirmDisputeDecision() {
    if (!pendingDisputeDecision) {
      setActionError('Choose approve or deny before confirming the dispute decision.');
      return;
    }

    await updateDispute(pendingDisputeDecision);
  }

  function requestDisputeDecisionConfirmation() {
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

  function requestPayrollRunConfirmation() {
    setRunError('');
    setRunMessage('');

    if (!runForm.periodStart || !runForm.periodEnd) {
      setRunError('Payroll period start and end dates are required.');
      return;
    }

    if (runForm.periodEnd < runForm.periodStart) {
      setRunError('Period end cannot be earlier than period start.');
      return;
    }

    setConfirmRunOpen(true);
  }

  async function submitPayrollRun() {
    setRunError('');
    setRunMessage('');

    if (!runForm.periodStart || !runForm.periodEnd) {
      setRunError('Payroll period start and end dates are required.');
      return;
    }

    if (runForm.periodEnd < runForm.periodStart) {
      setRunError('Period end cannot be earlier than period start.');
      return;
    }

    const isAdjustmentRun = runForm.runType === 'ADJUSTMENT';
    const endpoint = isAdjustmentRun ? '/api/payroll/run/create' : '/api/payroll/run/process';

    setIsSubmittingRun(true);
    try {
      const createdRun = await apiFetchJson<PayrollRunDto>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          periodStart: runForm.periodStart,
          periodEnd: runForm.periodEnd,
          periodDescription: describeRun(runForm.periodStart, runForm.periodEnd),
          payrollStatus: 'IN_PROGRESS',
          runType: runForm.runType,
        }),
      });

      setCurrentRun(createdRun);
      syncRunForm(createdRun);
      setRunModalOpen(false);

      const generatedCount = createdRun.itemCount ?? 0;
      if (isAdjustmentRun) {
        setRunMessage(`Adjustment run #${createdRun.payId ?? '-'} is ready for corrections.`);
      } else if (generatedCount > 0) {
        setRunMessage(
          `Payroll run #${createdRun.payId ?? '-'} generated ${formatItemCount(generatedCount)}.`
        );
      } else {
        setRunMessage(
          `Payroll run #${createdRun.payId ?? '-'} was processed, but no payroll items were generated for this period.`
        );
      }
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
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
    setRunMessage('');
    setIsPostingRun(true);
    try {
      const postedRun = await apiFetchJson<PayrollRunDto>(`/api/payroll/run/${currentRun.payId}/post`, {
        method: 'PATCH',
      });
      setCurrentRun(postedRun);
      setPostModalOpen(false);
      setRunMessage(`Payroll run #${postedRun.payId ?? '-'} has been posted.`);
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsPostingRun(false);
    }
  }

  return (
    <div className="hrPay">
      <div className="hrPay__head">
        <PageHeader
          title="Manage Payslips"
          description="Manage payroll runs, review disputes, and publish finalized payslips."
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

          {currentRun && (
            <div className="hrPayPeriod__meta">
              <span className="hrPayPill">{currentRun.runType ?? 'REGULAR'}</span>
              <span className="hrPayPill hrPayPill--status">{currentRun.payrollStatus ?? 'IN_PROGRESS'}</span>
              <span className="hrPayPeriod__runId">Run ID #{currentRun.payId ?? '-'}</span>
              <span className="hrPayPeriod__runCount">{formatItemCount(currentRun.itemCount)}</span>
            </div>
          )}
        </div>

        <div className="hrPayPeriod__actions">
          {canPostCurrentRun && (
            <button
              type="button"
              className="hrPay__runBtn hrPay__runBtn--secondary"
              onClick={() => setPostModalOpen(true)}
              disabled={isPostingRun}
            >
              {isPostingRun ? 'Posting...' : 'Post Payroll Run'}
            </button>
          )}
          <button
            type="button"
            className="hrPay__runBtn"
            onClick={() => {
              setRunError('');
              setRunMessage('');
              setRunModalOpen(true);
            }}
          >
            Create New Payroll Run
          </button>
        </div>
      </section>

      {runMessage && currentRun && (
        <section className="hrPayNotice hrPayNotice--success" aria-live="polite">
          <div className="hrPayNotice__copy">
            <strong>{runMessage}</strong>
            <span>
              {formatRunType(currentRun.runType)} for {formatDate(currentRun.periodStart)} - {formatDate(currentRun.periodEnd)}
            </span>
          </div>
          <div className="hrPayNotice__meta">
            <span>Run ID #{currentRun.payId ?? '-'}</span>
            <button type="button" className="hrPayNotice__dismiss" onClick={() => setRunMessage('')}>
              Dismiss
            </button>
          </div>
        </section>
      )}
      {emptyRunHint && <p className="hrPay__message">{emptyRunHint}</p>}

      {isCurrentRunInProgress && currentRun && (
        <section className="hrPayPanel">
          <header className="hrPayPanel__head">Payroll Run in Progress</header>

          <div className="hrPayTableShell mgrPendTable">
            {isLoadingRunItems ? (
              <div className="mgrPendTable__empty">
                <span>Loading payroll item summaries.</span>
                <span>Checking the current run now.</span>
              </div>
            ) : runItems.length > 0 ? (
              <>
                <div className="hrPayRunTable__head" role="row">
                  <span>Name</span>
                  <span>Payroll Item</span>
                  <span>Gross Pay</span>
                  <span>Deductions</span>
                  <span>Net Pay</span>
                  <span className="hrPayRunTable__headCell--action">Details</span>
                </div>

                <div className="mgrPendTable__body">
                  {runItems.map((row) => (
                    <button
                      key={row.itemId}
                      type="button"
                      className="hrPayRunTable__row"
                      onClick={() => void openPayrollItemDetail(row)}
                    >
                      <span className="mgrPendTable__cell mgrPendTable__cell--name">{row.employee}</span>
                      <span className="mgrPendTable__cell">#{row.itemId}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.grossPay)}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.deductions)}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.netPay)}</span>
                      <span className="mgrPendTable__cell hrPayRunTable__cell--action">
                        <span className="hrPayPreviewPill">View Breakdown</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mgrPendTable__empty">
                <span>No payroll items yet for this in-progress run.</span>
                <span>Process the payroll period or add adjustment items first.</span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="hrPayPanel">
        <header className="hrPayPanel__head">Payroll Dispute from Employees</header>

        <div className="hrPayToolbar">
          <label className="hrPaySearch" aria-label="Search payroll disputes">
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

          <div className="hrPayFilter">
            <button
              type="button"
              className={`hrPayFilter__toggle ${disputeFilterOpen ? 'is-open' : ''} ${
                activeDisputeFilterCount > 0 ? 'is-active' : ''
              }`}
              onClick={() => setDisputeFilterOpen((open) => !open)}
            >
              <FiFilter />
              <span>Filter</span>
              {activeDisputeFilterCount > 0 && <span className="hrPayFilter__count">{activeDisputeFilterCount}</span>}
            </button>

            {disputeFilterOpen && (
              <div className="hrPayFilter__panel">
                <label className="hrPayFilter__field">
                  <span>Dispute Type</span>
                  <select
                    value={disputeTypeFilter}
                    onChange={(event) => setDisputeTypeFilter(event.target.value as DisputeTypeFilter)}
                  >
                    <option value="all">All Types</option>
                    <option value="Overtime">Overtime</option>
                    <option value="Late Penalty">Late Penalty</option>
                    <option value="Absent Deduction">Absent Deduction</option>
                    <option value="General">General</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label className="hrPayFilter__field">
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

                <div className="hrPayFilter__actions">
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
                    onClick={() => setSelectedDispute(row)}
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
            <div className="mgrPendTable__empty">
              <span>{disputes.length > 0 ? 'No matching disputes.' : 'No disputes yet.'}</span>
              <span>{disputes.length > 0 ? 'Try clearing the search or adjusting the filters.' : 'New employee disputes will show up here.'}</span>
            </div>
          )}
        </div>
      </section>

      {runModalOpen && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label={runModalTitle}>
          <article className="hrPayModal hrPayModal--run">
            <h3>{runModalTitle}</h3>
            <p className="hrPayModal__subtitle">Set the payroll coverage window and run type before starting this payroll process.</p>
            <div className="hrPayModal__rule" />

            <div className="hrPayModal__grid hrPayModal__grid--compact">
              <label>
                <span>Period Start:</span>
                <input
                  type="date"
                  value={runForm.periodStart}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, periodStart: event.target.value }))}
                />
              </label>
              <label>
                <span>Period End:</span>
                <input
                  type="date"
                  value={runForm.periodEnd}
                  onChange={(event) => setRunForm((prev) => ({ ...prev, periodEnd: event.target.value }))}
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

            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={() => setRunModalOpen(false)} disabled={isSubmittingRun}>
                Cancel
              </button>
              <button type="button" onClick={requestPayrollRunConfirmation} disabled={isSubmittingRun}>
                {isSubmittingRun ? 'Submitting...' : runSubmitLabel}
              </button>
            </div>
          </article>
        </div>
      )}

      {postModalOpen && currentRun && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label="Post payroll run">
          <article className="hrPayModal hrPayModal--run">
            <h3>Post Payroll Run</h3>
            <p className="hrPayModal__subtitle">Review the payroll run summary carefully before confirming the final posting step.</p>
            <div className="hrPayModal__rule" />

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

            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={() => setPostModalOpen(false)} disabled={isPostingRun}>
                Cancel
              </button>
              <button type="button" onClick={() => void postCurrentRun()} disabled={isPostingRun}>
                {isPostingRun ? 'Posting...' : 'Confirm Post'}
              </button>
            </div>
          </article>
        </div>
      )}

      {correctionOpen && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label="Stage payroll correction">
          <article className="hrPayModal">
            <h3>Stage Approved Dispute Correction</h3>
            <p className="hrPayModal__subtitle">Select the exact payroll line that needs adjustment and stage the corrected amount into the active adjustment run.</p>
            <div className="hrPayModal__rule" />

            {isLoadingCorrection ? (
              <p className="hrPayModal__intro">
                Loading the disputed payslip item, its earnings and deductions, and the adjustment run to use for this
                correction.
              </p>
            ) : (
              <>
                <p className="hrPayModal__intro">
                  Pick the exact payroll line that needs to change, then enter the corrected amount that should be
                  staged into the adjustment run.
                </p>

                <div className="hrPayCorrectionSummary">
                  <div className="hrPayCorrectionSummary__row">
                    <span>Employee</span>
                    <strong>{correctionIntent?.employee ?? '-'}</strong>
                  </div>
                  <div className="hrPayCorrectionSummary__row">
                    <span>Source Item</span>
                    <strong>#{correctionSource?.itemId ?? correctionIntent?.itemId ?? '-'}</strong>
                  </div>
                  <div className="hrPayCorrectionSummary__row">
                    <span>Source Period</span>
                    <strong>
                      {formatDate(correctionSource?.runDetails?.periodStart)} - {formatDate(correctionSource?.runDetails?.periodEnd)}
                    </strong>
                  </div>
                  <div className="hrPayCorrectionSummary__row">
                    <span>Adjustment Run</span>
                    <strong>#{adjustmentRunId ?? '-'}</strong>
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
                    <span>Select the exact line to correct</span>
                    <span>{correctionLines.length} available lines</span>
                  </div>
                  <div className="hrPayCorrectionPicker__list">
                    {correctionLines.map((line) => (
                      <button
                        key={line.key}
                        type="button"
                        className={`hrPayCorrectionLine${line.key === selectedCorrectionKey ? ' is-selected' : ''}`}
                        onClick={() => setSelectedCorrectionKey(line.key)}
                      >
                        <div className="hrPayCorrectionLine__main">
                          <strong>{line.label}</strong>
                          <span>{line.lineType === 'EARNING' ? 'Earning' : 'Deduction'}</span>
                        </div>
                        <div className="hrPayCorrectionLine__meta">
                          <span>Current amount: {line.amount}</span>
                          {line.originalAmount && <span>Original posted amount: {line.originalAmount}</span>}
                          {line.adjustedBy && <span>Last adjusted by {line.adjustedBy}</span>}
                          {line.adjustedAt && <span>{formatDateTime(line.adjustedAt)}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hrPayModal__grid hrPayModal__grid--compact">
                  <label>
                    <span>Selected Line:</span>
                    <input
                      value={
                        selectedCorrectionLine
                          ? `${selectedCorrectionLine.lineType === 'EARNING' ? 'Earning' : 'Deduction'} - ${selectedCorrectionLine.label}`
                          : 'Choose a line first'
                      }
                      readOnly
                    />
                  </label>
                  <label>
                    <span>Corrected Amount:</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={correctedAmount}
                      onChange={(event) => setCorrectedAmount(event.target.value)}
                      placeholder={selectedCorrectionLine ? `Current amount: ${selectedCorrectionLine.amount}` : 'Enter amount'}
                    />
                  </label>
                </div>

              </>
            )}

            <div className="hrPayModal__actions">
              <button
                type="button"
                className="is-muted"
                onClick={() => resetCorrectionState()}
                disabled={isSubmittingCorrection}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCorrection()}
                disabled={isLoadingCorrection || isSubmittingCorrection}
              >
                {isSubmittingCorrection ? 'Staging...' : 'Stage Correction'}
              </button>
            </div>
          </article>
        </div>
      )}

      {selectedPayrollItem && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label="Payroll item breakdown">
          <article className="hrPayModal">
            <div className="hrPayModal__top">
              <div className="hrPayModal__heading">
                <h3>{selectedPayrollItem.employee} - Payslip Breakdown</h3>
                <p className="hrPayModal__subtitle">
                  Review the current earnings, deductions, and totals, and edit line amounts while this payroll item is
                  still in progress.
                </p>
              </div>
              <button
                type="button"
                className="hrPayModal__close"
                aria-label="Close payroll item breakdown"
                onClick={() => setSelectedPayrollItem(null)}
              >
                X
              </button>
            </div>
            <div className="hrPayModal__rule" />

            <div className="hrPayModal__grid">
              <label>
                <span>Payroll Item:</span>
                <input value={`#${selectedPayrollItem.itemId}`} readOnly />
              </label>
              <label>
                <span>Run Status:</span>
                <input value={currentRun?.payrollStatus ?? 'IN_PROGRESS'} readOnly />
              </label>
              <label>
                <span>Pay Period:</span>
                <input value={`${formatDate(currentRun?.periodStart)} - ${formatDate(currentRun?.periodEnd)}`} readOnly />
              </label>
              <label>
                <span>Run Type:</span>
                <input value={formatRunType(currentRun?.runType)} readOnly />
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

          </article>
        </div>
      )}

      {selectedDispute && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true">
          <article className="hrPayModal">
            <h3>{selectedDispute.employee} - Payslip Dispute</h3>
            <p className="hrPayModal__subtitle">
              Review the employee dispute, decide whether it should be denied or moved to waiting for adjustment, and
              reopen it later when you are ready to stage the correction.
            </p>
            <div className="hrPayModal__rule" />

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
            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={() => setSelectedDispute(null)} disabled={isSaving}>
                {canReviewSelectedDispute || canStageSelectedDisputeCorrection ? 'Cancel' : 'Close'}
              </button>
              {canReviewSelectedDispute ? (
                <button type="button" onClick={requestDisputeDecisionConfirmation} disabled={isSaving || !pendingDisputeDecision}>
                  {isSaving
                    ? 'Saving...'
                    : pendingDisputeDecision === 'APPROVED'
                      ? 'Move to Waiting Adjustment'
                      : pendingDisputeDecision === 'REJECTED'
                        ? 'Confirm Denial'
                        : 'Confirm Decision'}
                </button>
              ) : canStageSelectedDisputeCorrection ? (
                <button type="button" onClick={openSelectedDisputeCorrection}>
                  Open Adjustment Workspace
                </button>
              ) : (
                <button type="button" onClick={() => setSelectedDispute(null)} disabled={isSaving}>
                  Close
                </button>
              )}
            </div>
          </article>
        </div>
      )}
      <ConfirmDialog
        open={confirmRunOpen}
        title={runForm.runType === 'ADJUSTMENT' ? 'Confirm Adjustment Run' : 'Confirm New Payroll Run'}
        message={`Create a ${runForm.runType === 'ADJUSTMENT' ? 'payroll adjustment' : 'new payroll'} run for ${formatDate(
          runForm.periodStart
        )} to ${formatDate(runForm.periodEnd)}?`}
        confirmLabel={runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run'}
        cancelLabel="Go Back"
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
    </div>
  );
}
