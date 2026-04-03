import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
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

type DisputeStatus = 'Open' | 'Clear';
type DisputeStatusFilter = 'all' | 'Open' | 'Clear';
type DisputeTypeFilter = 'all' | 'Overtime' | 'Late Penalty' | 'Absent Deduction' | 'General' | 'Other';

type DisputeRow = {
  id: number;
  itemId?: number;
  employeeId?: number;
  employeeName?: string;
  employee: string;
  department: string;
  payrollPeriod: string;
  status: DisputeStatus;
  rawStatus: string;
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

type CorrectionRouteState = {
  correctionIntent?: CorrectionIntent;
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

function mapStatus(value: string | undefined): DisputeStatus {
  return value && value.toUpperCase() === 'PENDING' ? 'Open' : 'Clear';
}

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
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function employeeLabel(employeeName?: string, employeeId?: number) {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : '';
  if (trimmedName) return trimmedName;
  return typeof employeeId === 'number' ? `Employee ID ${employeeId}` : 'Employee unavailable';
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

export default function HrPayslips() {
  const navigate = useNavigate();
  const location = useLocation();
  const handledCorrectionIntentRef = useRef<string | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRow | null>(null);
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
      const runs = toArray<PayrollRunDto>(response);
      const preferredRun =
        preferredPayId != null ? runs.find((run) => run.payId === preferredPayId) ?? null : null;
      const nextRun = preferredRun ?? runs.find((run) => (run.itemCount ?? 0) > 0) ?? runs[0] ?? null;

      setCurrentRun(nextRun);
      if (nextRun) syncRunForm(nextRun);
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    }
  }

  useEffect(() => {
    if (selectedDispute || runModalOpen || postModalOpen || correctionOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [correctionOpen, postModalOpen, runModalOpen, selectedDispute]);

  useEffect(() => {
    setRemarks('');
    setActionError('');
    setPendingDisputeDecision(null);
    setConfirmDisputeDecisionOpen(false);
  }, [selectedDispute?.id]);

  useEffect(() => {
    const storedRun = readStoredRun();
    if (storedRun) syncRunForm(storedRun);
    const routeState = location.state as CorrectionRouteState | null;
    if (routeState?.correctionIntent) return;
    void loadCurrentRun(storedRun?.payId);
  }, []);

  useEffect(() => {
    const routeState = location.state as CorrectionRouteState | null;
    const intent = routeState?.correctionIntent;
    if (!intent) return;

    const intentKey = `${intent.disputeId}:${intent.itemId}:${intent.decisionReason}`;
    if (handledCorrectionIntentRef.current === intentKey) return;
    handledCorrectionIntentRef.current = intentKey;

    void startApprovedDisputeCorrection(intent);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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
    try {
      setLoadError('');
      const response = await apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=100');
      const mapped = toArray<DisputeDto>(response).map((item, idx) => ({
        id: item.id ?? idx + 1,
        itemId: item.itemId,
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employee: employeeLabel(item.employeeName, item.employeeId),
        department: 'Payroll',
        payrollPeriod: item.createdAt ? formatDate(item.createdAt) : 'No date',
        status: mapStatus(item.status),
        rawStatus: item.status || 'PENDING',
        subject: item.subject || 'Payroll dispute',
        reason: item.reason || '',
        decisionSummary: item.statusReason || '',
      }));
      setDisputes(mapped);
    } catch (error) {
      setDisputes([]);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  useEffect(() => {
    void loadDisputes();
  }, []);

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
  const canReviewSelectedDispute =
    selectedDispute ? String(selectedDispute.rawStatus ?? '').toUpperCase() === 'PENDING' : false;

  const visibleDisputes = useMemo(() => {
    return disputes.filter((row) => {
      if (disputeStatusFilter !== 'all' && row.status !== disputeStatusFilter) {
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
        row.department,
        row.payrollPeriod,
        row.status,
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
        ...toArray<Record<string, unknown>>(earningsResponse).map((row, idx) => ({
          key: `EARNING-${String(row.earningsId ?? idx + 1)}`,
          lineId: Number(row.earningsId),
          lineType: 'EARNING' as const,
          label: String(row.description ?? `Earning ${idx + 1}`),
          amount: toMoneyString(row.amount),
          originalAmount: toOptionalMoneyString(row.originalAmount),
          adjustedBy: toOptionalText(row.adjustedBy),
          adjustedAt: toOptionalText(row.adjustedAt),
        })),
        ...toArray<Record<string, unknown>>(deductionsResponse).map((row, idx) => ({
          key: `DEDUCTION-${String(row.deductionsId ?? idx + 1)}`,
          lineId: Number(row.deductionsId),
          lineType: 'DEDUCTION' as const,
          label: String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`),
          amount: toMoneyString(row.amount),
          originalAmount: toOptionalMoneyString(row.originalAmount),
          adjustedBy: toOptionalText(row.adjustedBy),
          adjustedAt: toOptionalText(row.adjustedAt),
        })),
      ].filter((line) => Number.isFinite(line.lineId) && line.lineId > 0);

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
      await loadCurrentRun(runId);
      await loadDisputes();
      setRunMessage(
        `Approved dispute for ${employee} was staged in adjustment run #${runId}. Review the run and post it when you are ready.`
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
      await apiFetchJson(`/api/payroll/item/dispute/update/${activeDispute.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          statusReason: trimmedRemarks,
        }),
      });

      const approvedIntent =
        status === 'APPROVED' && typeof activeDispute.itemId === 'number'
          ? {
              disputeId: activeDispute.id,
              itemId: activeDispute.itemId,
              employee: activeDispute.employee,
              message: activeDispute.subject,
              disputeReason: activeDispute.reason,
              decisionReason: trimmedRemarks,
            }
          : null;

      setSelectedDispute(null);
      setRemarks('');
      await loadDisputes();

      if (approvedIntent) {
        await startApprovedDisputeCorrection(approvedIntent);
      }
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      setIsSaving(false);
    }
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
      {runError && <p className="hrPay__message">{runError}</p>}
      {emptyRunHint && <p className="hrPay__message">{emptyRunHint}</p>}

      <section className="hrPayPanel">
        <header className="hrPayPanel__head">Payroll Dispute from Employees</header>
        {loadError && <p className="hrPay__message">{loadError}</p>}

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
                    <option value="Open">Open</option>
                    <option value="Clear">Clear</option>
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

        <div className="hrPayTable">
          <div className="hrPayTable__head">
            <span>Employee Name</span>
            <span>Department</span>
            <span>Payroll Period</span>
            <span>Status</span>
          </div>
          <div className="hrPayTable__body">
            {visibleDisputes.length > 0 ? (
              visibleDisputes.map((row) => (
                <button key={row.id} className="hrPayRow" type="button" onClick={() => setSelectedDispute(row)}>
                  <span>{row.employee}</span>
                  <span>{row.department}</span>
                  <span>{row.payrollPeriod}</span>
                  <span className={row.status === 'Open' ? 'is-open' : ''}>{row.status}</span>
                </button>
              ))
            ) : (
              <div className="hrPayRow">
                <span>{disputes.length > 0 ? 'No matching disputes' : 'No disputes yet'}</span>
                <span>{disputes.length > 0 ? 'Adjust search or filters' : '-'}</span>
                <span>-</span>
                <span>{disputes.length > 0 ? '-' : 'Clear'}</span>
              </div>
            )}
          </div>
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

            <p className="hrPayModal__intro">
              You are about to post this payroll run. Once posted, the run status will move from
              <strong> IN_PROGRESS </strong>
              to
              <strong> POSTED</strong>.
            </p>

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
                          ? `${selectedCorrectionLine.lineType === 'EARNING' ? 'Earning' : 'Deduction'} • ${selectedCorrectionLine.label}`
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

                {correctionError && <p className="hrPay__message">{correctionError}</p>}
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

      {selectedDispute && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true">
          <article className="hrPayModal">
            <h3>{selectedDispute.employee} - Payslip Dispute</h3>
            <p className="hrPayModal__subtitle">Review the employee dispute, choose a decision, and confirm it only after the decision reason is complete.</p>
            <div className="hrPayModal__rule" />

            <div className="hrPayModal__grid">
              <label>
                <span>Department:</span>
                <input value={selectedDispute.department} readOnly />
              </label>
              <label>
                <span>Status:</span>
                <input value={selectedDispute.rawStatus} readOnly />
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

            <div className="hrPayModal__area">
              <span>Administrative Approval:</span>
              <div className="decisionPicker">
                <div className="decisionPicker__actions">
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDisputeDecision === 'APPROVED' ? 'is-selected' : ''}`}
                    disabled={isSaving || !canReviewSelectedDispute}
                    onClick={() => setPendingDisputeDecision('APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDisputeDecision === 'REJECTED' ? 'is-selected' : ''}`}
                    disabled={isSaving || !canReviewSelectedDispute}
                    onClick={() => setPendingDisputeDecision('REJECTED')}
                  >
                    Deny
                  </button>
                </div>
                {canReviewSelectedDispute && (
                  <p className="decisionPicker__note">
                    Choose the outcome first, then enter the decision reason below and use the confirm button to submit it.
                  </p>
                )}
              </div>
            </div>

            <label className="hrPayModal__area">
              <span>Reason for Approval / Denial:</span>
              <textarea
                placeholder="Type at least 5 characters explaining the decision"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                readOnly={!canReviewSelectedDispute}
              />
            </label>
            {!canReviewSelectedDispute && (
              <p className="hrPay__message">This dispute already has a final decision. Open a new adjustment from the payroll page if another correction is needed.</p>
            )}
            {actionError && <p className="hrPay__message">{actionError}</p>}

            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={() => setSelectedDispute(null)} disabled={isSaving}>
                Cancel
              </button>
              {canReviewSelectedDispute ? (
                <button type="button" onClick={requestDisputeDecisionConfirmation} disabled={isSaving || !pendingDisputeDecision}>
                  {isSaving
                    ? 'Saving...'
                    : pendingDisputeDecision === 'APPROVED'
                      ? 'Confirm Approval'
                      : pendingDisputeDecision === 'REJECTED'
                        ? 'Confirm Denial'
                        : 'Confirm Decision'}
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
        message={`Create a ${runForm.runType === 'ADJUSTMENT' ? 'payroll adjustment' : 'new payroll'} run for ${runForm.periodStart} to ${runForm.periodEnd}?`}
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
            ? `Apply this ${pendingDisputeDecision === 'REJECTED' ? 'denial' : 'approval'} to ${selectedDispute.employee}'s payroll dispute?`
            : 'Confirm this dispute decision?'
        }
        confirmLabel={pendingDisputeDecision === 'REJECTED' ? 'Confirm Denial' : 'Confirm Approval'}
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
