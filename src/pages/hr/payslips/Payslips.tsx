import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetchJson, toArray } from '../../../lib/api';
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

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDate(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
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
        payrollPeriod: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'No date',
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
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Process Payroll Run';
  const runModalIntro =
    runForm.runType === 'ADJUSTMENT'
      ? 'Adjustment runs start empty so HR can add correction lines before posting them.'
      : 'This will create the payroll run and immediately generate payroll items for all eligible employees in the selected period.';
  const runSubmitLabel =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Process Payroll';

  const currentPayPeriod = useMemo(() => {
    return formatDate(displayedPeriodEnd);
  }, [displayedPeriodEnd]);
  const canReviewSelectedDispute =
    selectedDispute ? String(selectedDispute.rawStatus ?? '').toUpperCase() === 'PENDING' : false;

  const selectedCorrectionLine = useMemo(
    () => correctionLines.find((line) => line.key === selectedCorrectionKey) ?? null,
    [correctionLines, selectedCorrectionKey]
  );

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
        <h1 className="hrPay__title">Manage Payslips</h1>
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
            Run Pay for this Period
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

        <div className="hrPayTable">
          <div className="hrPayTable__head">
            <span>Employee Name</span>
            <span>Department</span>
            <span>Payroll Period</span>
            <span>Status</span>
          </div>
          <div className="hrPayTable__body">
            {disputes.length > 0 ? (
              disputes.map((row) => (
                <button key={row.id} className="hrPayRow" type="button" onClick={() => setSelectedDispute(row)}>
                  <span>{row.employee}</span>
                  <span>{row.department}</span>
                  <span>{row.payrollPeriod}</span>
                  <span className={row.status === 'Open' ? 'is-open' : ''}>{row.status}</span>
                </button>
              ))
            ) : (
              <div className="hrPayRow">
                <span>No disputes yet</span>
                <span>-</span>
                <span>-</span>
                <span>Clear</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {runModalOpen && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label={runModalTitle}>
          <article className="hrPayModal hrPayModal--run">
            <h3>{runModalTitle}</h3>
            <div className="hrPayModal__rule" />

            <p className="hrPayModal__intro">{runModalIntro}</p>

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
              <button type="button" onClick={() => void submitPayrollRun()} disabled={isSubmittingRun}>
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

            <div className="hrPayModal__line">
              <span>Administrative Approval:</span>
              <div className="hrPayModal__inlineBtns">
                <button type="button" disabled={isSaving || !canReviewSelectedDispute} onClick={() => void updateDispute('APPROVED')}>
                  Approve
                </button>
                <button
                  type="button"
                  className="is-muted"
                  disabled={isSaving || !canReviewSelectedDispute}
                  onClick={() => void updateDispute('REJECTED')}
                >
                  Deny
                </button>
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
              <button type="button" onClick={() => setSelectedDispute(null)} disabled={isSaving}>
                Close
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
