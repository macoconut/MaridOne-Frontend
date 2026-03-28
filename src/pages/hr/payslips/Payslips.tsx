import { useEffect, useMemo, useState } from 'react';
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

type RunItemDto = {
  empId?: number;
  firstName?: string;
  lastName?: string;
  itemId?: number;
  grossPay?: number | string;
  netPay?: number | string;
};

type CorrectionSourceItemDto = {
  itemId?: number;
  empId?: number;
  firstName?: string;
  lastName?: string;
  runDetails?: {
    periodStart?: string;
    periodEnd?: string;
    runType?: string;
  };
  grossPay?: number | string;
  netPay?: number | string;
};

type CorrectionLineOption = {
  key: string;
  sourceLineType: 'EARNING' | 'DEDUCTION';
  sourceLineId: number;
  label: string;
  originalAmount: number;
  formattedAmount: string;
};

type DisputeStatus = 'Open' | 'Clear';

type DisputeRow = {
  id: number;
  itemId?: number;
  employee: string;
  department: string;
  payrollPeriod: string;
  status: DisputeStatus;
  subject: string;
  reason: string;
};

type RunFormState = {
  periodStart: string;
  periodEnd: string;
  runType: 'REGULAR' | 'ADJUSTMENT';
};

type CorrectionFormState = {
  targetPayId: string;
  sourceLineKey: string;
  correctedAmount: string;
};

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

function createDefaultCorrectionForm(): CorrectionFormState {
  return {
    targetPayId: '',
    sourceLineKey: '',
    correctedAmount: '',
  };
}

function describeRun(periodStart: string, periodEnd: string) {
  return `Payroll run ${periodStart} to ${periodEnd}`;
}

function formatRunType(value?: string) {
  if (!value) return 'Regular Payroll';
  return value === 'ADJUSTMENT' ? 'Adjustment Payroll' : 'Regular Payroll';
}

function formatMoney(value?: number | string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '0.00';
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCount(value?: number) {
  const count = Number(value ?? 0);
  return `${count} ${count === 1 ? 'payslip' : 'payslips'}`;
}

function buildEmployeeLabel(item: RunItemDto) {
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return item.empId ? `${fullName} (#${item.empId})` : fullName;
  }
  return item.empId ? `Employee #${item.empId}` : 'Employee record';
}

function buildCorrectionSourceLabel(item: CorrectionSourceItemDto | null) {
  if (!item) return 'Posted payslip';
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
  return fullName ? `${fullName} (#${item.empId ?? '-'})` : `Employee #${item.empId ?? '-'}`;
}

function isOpenAdjustmentRun(run: PayrollRunDto) {
  return run.runType === 'ADJUSTMENT' && run.payrollStatus !== 'POSTED' && Boolean(run.payId);
}

function isPostedRegularRun(run: PayrollRunDto | null | undefined) {
  return run?.payrollStatus === 'POSTED' && run.runType !== 'ADJUSTMENT';
}

function toEarningCorrectionOptions(response: unknown): CorrectionLineOption[] {
  return toArray<Record<string, unknown>>(response).map((row, idx) => {
    const amount = Number(row.amount ?? 0);
    return {
      key: `EARNING:${row.earningsId ?? idx}`,
      sourceLineType: 'EARNING',
      sourceLineId: Number(row.earningsId ?? 0),
      label: String(row.description ?? `Earning ${idx + 1}`),
      originalAmount: amount,
      formattedAmount: formatMoney(amount),
    };
  });
}

function toDeductionCorrectionOptions(response: unknown): CorrectionLineOption[] {
  return toArray<Record<string, unknown>>(response).map((row, idx) => {
    const amount = Number(row.amount ?? 0);
    return {
      key: `DEDUCTION:${row.deductionsId ?? idx}`,
      sourceLineType: 'DEDUCTION',
      sourceLineId: Number(row.deductionsId ?? 0),
      label: String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`),
      originalAmount: amount,
      formattedAmount: formatMoney(amount),
    };
  });
}

export default function HrPayslips() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');

  const [runModalOpen, setRunModalOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [runForm, setRunForm] = useState<RunFormState>(() => createDefaultRunForm());
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [isPostingRun, setIsPostingRun] = useState(false);
  const [runMessage, setRunMessage] = useState('');
  const [runError, setRunError] = useState('');
  const [runs, setRuns] = useState<PayrollRunDto[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isLoadingRunItems, setIsLoadingRunItems] = useState(false);
  const [runItemsError, setRunItemsError] = useState('');
  const [runItems, setRunItems] = useState<RunItemDto[]>([]);
  const [currentRun, setCurrentRun] = useState<PayrollRunDto | null>(null);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionSourceItem, setCorrectionSourceItem] = useState<CorrectionSourceItemDto | null>(null);
  const [correctionLines, setCorrectionLines] = useState<CorrectionLineOption[]>([]);
  const [correctionForm, setCorrectionForm] = useState<CorrectionFormState>(() => createDefaultCorrectionForm());
  const [isLoadingCorrectionSource, setIsLoadingCorrectionSource] = useState(false);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [correctionError, setCorrectionError] = useState('');

  useEffect(() => {
    if (selectedDispute || runModalOpen || postModalOpen || correctionModalOpen) {
      document.body.classList.add('modal-open');
    }
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [correctionModalOpen, postModalOpen, runModalOpen, selectedDispute]);

  async function loadDisputes() {
    try {
      setLoadError('');
      const response = await apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=100');
      const mapped = toArray<DisputeDto>(response).map((item, idx) => ({
        id: item.id ?? idx + 1,
        itemId: item.itemId,
        employee: `Item #${item.itemId ?? '-'}`,
        department: 'From backend',
        payrollPeriod: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'No date',
        status: mapStatus(item.status),
        subject: item.subject || 'Payroll dispute',
        reason: item.reason || '',
      }));
      setDisputes(mapped);
    } catch (error) {
      setDisputes([]);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  async function loadRuns(selectedPayId?: number) {
    setIsLoadingRuns(true);
    setRunError('');
    try {
      const response = await apiFetchJson<unknown>('/api/payroll/run');
      const rows = toArray<PayrollRunDto>(response);
      setRuns(rows);

      const preferredRun =
        (selectedPayId ? rows.find((row) => row.payId === selectedPayId) : null) ??
        (currentRun?.payId ? rows.find((row) => row.payId === currentRun.payId) : null) ??
        rows[0] ??
        null;

      setCurrentRun(preferredRun);
      if (preferredRun) {
        setRunForm((prev) => ({
          periodStart: preferredRun.periodStart ?? prev.periodStart,
          periodEnd: preferredRun.periodEnd ?? prev.periodEnd,
          runType:
            preferredRun.runType === 'ADJUSTMENT' || preferredRun.runType === 'REGULAR'
              ? preferredRun.runType
              : prev.runType,
        }));
      }
    } catch (error) {
      setRuns([]);
      setCurrentRun(null);
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingRuns(false);
    }
  }

  async function loadRunItems(payId: number) {
    setIsLoadingRunItems(true);
    setRunItemsError('');
    try {
      const response = await apiFetchJson<unknown>(`/api/payroll/run/${payId}/items?page=0&size=100`);
      setRunItems(toArray<RunItemDto>(response));
    } catch (error) {
      setRunItems([]);
      setRunItemsError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingRunItems(false);
    }
  }

  useEffect(() => {
    void loadDisputes();
    void loadRuns();
  }, []);

  useEffect(() => {
    if (!currentRun?.payId) {
      setRunItems([]);
      setRunItemsError('');
      return;
    }

    void loadRunItems(currentRun.payId);
  }, [currentRun?.payId]);

  const displayedPeriodStart = currentRun?.periodStart ?? runForm.periodStart;
  const displayedPeriodEnd = currentRun?.periodEnd ?? runForm.periodEnd;

  const currentPayPeriod = useMemo(() => formatDate(displayedPeriodEnd), [displayedPeriodEnd]);
  const openAdjustmentRuns = useMemo(() => runs.filter(isOpenAdjustmentRun), [runs]);
  const canStageCorrections = openAdjustmentRuns.length > 0;
  const canCorrectCurrentRun = isPostedRegularRun(currentRun) && canStageCorrections;
  const selectedCorrectionLine = useMemo(
    () => correctionLines.find((line) => line.key === correctionForm.sourceLineKey) ?? null,
    [correctionForm.sourceLineKey, correctionLines]
  );
  const correctionDeltaPreview = useMemo(() => {
    if (!selectedCorrectionLine) return '';
    const correctedAmount = Number(correctionForm.correctedAmount);
    if (!Number.isFinite(correctedAmount) || correctedAmount < 0) {
      return 'Enter the corrected amount for the selected source line.';
    }

    const delta = Number((correctedAmount - selectedCorrectionLine.originalAmount).toFixed(2));
    if (delta === 0) {
      return 'No delta will be created because the corrected amount matches the current line.';
    }

    const direction =
      selectedCorrectionLine.sourceLineType === 'EARNING'
        ? delta > 0
          ? `This will add an earning adjustment of ${formatMoney(delta)}.`
          : `This will add a deduction adjustment of ${formatMoney(Math.abs(delta))} to recover the overpayment.`
        : delta > 0
          ? `This will add a deduction adjustment of ${formatMoney(delta)}.`
          : `This will add an earning adjustment of ${formatMoney(Math.abs(delta))} to refund the overdeduction.`;

    return direction;
  }, [correctionForm.correctedAmount, selectedCorrectionLine]);

  async function selectRun(payId?: number) {
    if (!payId) return;
    setRunError('');
    try {
      const run = await apiFetchJson<PayrollRunDto>(`/api/payroll/run/${payId}`);
      setCurrentRun(run);
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    }
  }

  function closeCorrectionModal() {
    setCorrectionModalOpen(false);
    setCorrectionSourceItem(null);
    setCorrectionLines([]);
    setCorrectionForm(createDefaultCorrectionForm());
    setCorrectionError('');
    setIsLoadingCorrectionSource(false);
  }

  async function openCorrectionModal(sourceItemId?: number) {
    if (!sourceItemId) {
      setCorrectionError('Choose a posted payslip item first.');
      return;
    }

    setCorrectionModalOpen(true);
    setIsLoadingCorrectionSource(true);
    setCorrectionError('');
    try {
      const [sourceItem, earningsResponse, deductionsResponse] = await Promise.all([
        apiFetchJson<CorrectionSourceItemDto>(`/api/payroll/item/manage/${sourceItemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/earnings/${sourceItemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/deductions/${sourceItemId}`),
      ]);

      const sourceLines = [...toEarningCorrectionOptions(earningsResponse), ...toDeductionCorrectionOptions(deductionsResponse)]
        .filter((line) => Number.isFinite(line.sourceLineId) && line.sourceLineId > 0);
      const preferredTargetPayId =
        currentRun && isOpenAdjustmentRun(currentRun)
          ? String(currentRun.payId)
          : String(openAdjustmentRuns[0]?.payId ?? '');
      const firstLine = sourceLines[0] ?? null;

      setCorrectionSourceItem(sourceItem);
      setCorrectionLines(sourceLines);
      setCorrectionForm({
        targetPayId: preferredTargetPayId,
        sourceLineKey: firstLine?.key ?? '',
        correctedAmount: firstLine ? String(firstLine.originalAmount.toFixed(2)) : '',
      });
    } catch (error) {
      setCorrectionSourceItem(null);
      setCorrectionLines([]);
      setCorrectionForm(createDefaultCorrectionForm());
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingCorrectionSource(false);
    }
  }

  async function updateDispute(status: 'APPROVED' | 'REJECTED') {
    if (!selectedDispute) return;
    setIsSaving(true);
    setActionError('');
    try {
      await apiFetchJson(`/api/payroll/item/dispute/update/${selectedDispute.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          statusReason: remarks.trim() || `${status} by HR in payslip review`,
        }),
      });
      setSelectedDispute(null);
      setRemarks('');
      await loadDisputes();
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      setIsSaving(false);
    }
  }

  async function createPayrollRun() {
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

    setIsCreatingRun(true);
    try {
      const endpoint = runForm.runType === 'ADJUSTMENT' ? '/api/payroll/run/create' : '/api/payroll/run/process';
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

      await loadRuns(createdRun.payId);
      setCurrentRun(createdRun);
      setRunModalOpen(false);
      setRunMessage(
        runForm.runType === 'ADJUSTMENT'
          ? `Adjustment run #${createdRun.payId ?? '-'} is ready for linked payroll corrections.`
          : `Payroll run #${createdRun.payId ?? '-'} generated ${formatCount(createdRun.itemCount)}.`
      );
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsCreatingRun(false);
    }
  }

  async function createLineCorrection() {
    if (!correctionSourceItem?.itemId) {
      setCorrectionError('Pick the posted payslip item you want to correct.');
      return;
    }
    if (!correctionForm.targetPayId) {
      setCorrectionError('Create or choose an open adjustment run first.');
      return;
    }
    if (!selectedCorrectionLine) {
      setCorrectionError('Choose the specific payslip line that needs correcting.');
      return;
    }

    const correctedAmount = Number(correctionForm.correctedAmount);
    if (!Number.isFinite(correctedAmount) || correctedAmount < 0) {
      setCorrectionError('Enter a valid corrected amount.');
      return;
    }

    setIsSavingCorrection(true);
    setCorrectionError('');
    try {
      await apiFetchJson(`/api/payroll/run/${correctionForm.targetPayId}/adjustment/correction`, {
        method: 'POST',
        body: JSON.stringify({
          sourceItemId: correctionSourceItem.itemId,
          sourceLineType: selectedCorrectionLine.sourceLineType,
          sourceLineId: selectedCorrectionLine.sourceLineId,
          correctedAmount: correctionForm.correctedAmount,
        }),
      });

      await loadRuns(Number(correctionForm.targetPayId));
      await loadRunItems(Number(correctionForm.targetPayId));
      setRunMessage(
        `Created a correction for ${selectedCorrectionLine.label} on ${buildCorrectionSourceLabel(correctionSourceItem)}.`
      );
      closeCorrectionModal();
    } catch (error) {
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsSavingCorrection(false);
    }
  }

  async function postCurrentRun() {
    if (!currentRun?.payId) {
      setRunError('Create a payroll run first before posting it.');
      return;
    }

    setRunError('');
    setRunMessage('');
    setIsPostingRun(true);
    try {
      const postedRun = await apiFetchJson<PayrollRunDto>(`/api/payroll/run/${currentRun.payId}/post`, {
        method: 'PATCH',
      });
      await loadRuns(postedRun.payId);
      setCurrentRun(postedRun);
      setPostModalOpen(false);
      setRunMessage(`Payroll run #${postedRun.payId ?? '-'} has been posted and released to employees.`);
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsPostingRun(false);
    }
  }

  const runActionLabel = runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Generate Payroll';
  const runActionIntro =
    runForm.runType === 'ADJUSTMENT'
      ? 'Create an empty adjustment run that HR can use to stage corrections for specific posted payslip lines.'
      : 'Generate payroll items for every active employee in this cutoff period.';

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
              <span className="hrPayPill hrPayPill--count">{formatCount(currentRun.itemCount)}</span>
              <span className="hrPayPeriod__runId">Run ID #{currentRun.payId ?? '-'}</span>
            </div>
          )}
        </div>

        <div className="hrPayPeriod__actions">
          {currentRun?.payId && currentRun.payrollStatus !== 'POSTED' && (
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

      <section className="hrPayRunGrid">
        <article className="hrPayPanel">
          <header className="hrPayPanel__head">Payroll Runs</header>

          <div className="hrPayRunList">
            {isLoadingRuns ? (
              <div className="hrPayRunList__empty">Loading payroll runs...</div>
            ) : runs.length > 0 ? (
              runs.map((run) => (
                <button
                  key={run.payId ?? `${run.periodStart}-${run.periodEnd}`}
                  type="button"
                  className={`hrPayRunCard ${run.payId === currentRun?.payId ? 'is-active' : ''}`}
                  onClick={() => void selectRun(run.payId)}
                >
                  <div className="hrPayRunCard__top">
                    <strong>{formatRunType(run.runType)}</strong>
                    <span className="hrPayPill hrPayPill--status">{run.payrollStatus ?? 'IN_PROGRESS'}</span>
                  </div>
                  <div className="hrPayRunCard__period">
                    {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                  </div>
                  <div className="hrPayRunCard__meta">
                    <span>Run #{run.payId ?? '-'}</span>
                    <span>{formatCount(run.itemCount)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="hrPayRunList__empty">
                No payroll runs yet. Generate a regular run to create payslips, or create an adjustment run to stage payroll corrections.
              </div>
            )}
          </div>
        </article>

        <article className="hrPayPanel">
          <header className="hrPayPanel__head">Generated Payslips</header>
          {runItemsError && <p className="hrPay__message">{runItemsError}</p>}

          <div className="hrPayRunSummary">
            {currentRun ? (
              <>
                <strong>{formatRunType(currentRun.runType)}</strong>
                <span>
                  {formatDate(currentRun.periodStart)} - {formatDate(currentRun.periodEnd)}
                </span>
                <span>{formatCount(currentRun.itemCount)}</span>
                {canCorrectCurrentRun && (
                  <span>Click a payslip row to correct a specific posted line.</span>
                )}
                {isPostedRegularRun(currentRun) && !canStageCorrections && (
                  <span>Create an in-progress adjustment run first to enable payslip corrections.</span>
                )}
              </>
            ) : (
              <span>Select a payroll run to inspect its generated payslips.</span>
            )}
          </div>

          <div className="hrPayTable">
            <div className="hrPayTable__head hrPayTable__head--run">
              <span>Employee</span>
              <span>Item ID</span>
              <span>Gross Pay</span>
              <span>Net Pay</span>
            </div>
            <div className="hrPayTable__body">
              {isLoadingRunItems ? (
                <div className="hrPayRow hrPayRow--empty">
                  <span>Loading generated payslips...</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              ) : runItems.length > 0 ? (
                runItems.map((item) =>
                  canCorrectCurrentRun ? (
                    <button
                      key={item.itemId ?? `${item.empId}-${item.firstName}`}
                      type="button"
                      className="hrPayRow hrPayRow--action"
                      onClick={() => void openCorrectionModal(item.itemId)}
                    >
                      <span>{buildEmployeeLabel(item)}</span>
                      <span>#{item.itemId ?? '-'}</span>
                      <span>{formatMoney(item.grossPay)}</span>
                      <span>{formatMoney(item.netPay)}</span>
                    </button>
                  ) : (
                    <div key={item.itemId ?? `${item.empId}-${item.firstName}`} className="hrPayRow">
                      <span>{buildEmployeeLabel(item)}</span>
                      <span>#{item.itemId ?? '-'}</span>
                      <span>{formatMoney(item.grossPay)}</span>
                      <span>{formatMoney(item.netPay)}</span>
                    </div>
                  )
                )
              ) : (
                <div className="hrPayRow hrPayRow--empty">
                  <span>
                    {currentRun?.runType === 'ADJUSTMENT'
                      ? 'This adjustment run is still empty. Open a posted payslip from its source run to add linked corrections here.'
                      : 'No generated payslips were found for this run yet.'}
                  </span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              )}
            </div>
          </div>
        </article>
      </section>

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
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label="Create payroll run">
          <article className="hrPayModal hrPayModal--run">
            <h3>{runActionLabel}</h3>
            <div className="hrPayModal__rule" />

            <p className="hrPayModal__intro">{runActionIntro}</p>

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
              <button type="button" className="is-muted" onClick={() => setRunModalOpen(false)} disabled={isCreatingRun}>
                Cancel
              </button>
              <button type="button" onClick={() => void createPayrollRun()} disabled={isCreatingRun}>
                {isCreatingRun ? 'Working...' : runActionLabel}
              </button>
            </div>
          </article>
        </div>
      )}

      {correctionModalOpen && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true" aria-label="Create payslip correction">
          <article className="hrPayModal">
            <h3>Correct Specific Payslip Line</h3>
            <div className="hrPayModal__rule" />

            <p className="hrPayModal__intro">
              Choose the exact posted line that needs fixing, enter the corrected amount, and this will stage the audit-safe
              correction inside an adjustment run while updating the employee-facing version of the original payslip once that
              adjustment run is posted.
            </p>

            <div className="hrPayModal__split">
              <section className="hrPayModal__formStack">
                <div className="hrPayModal__summary">
                  <div className="hrPayModal__summaryRow">
                    <span>Source Payslip</span>
                    <strong>#{correctionSourceItem?.itemId ?? '-'}</strong>
                  </div>
                  <div className="hrPayModal__summaryRow">
                    <span>Employee</span>
                    <strong>{buildCorrectionSourceLabel(correctionSourceItem)}</strong>
                  </div>
                  <div className="hrPayModal__summaryRow">
                    <span>Source Period</span>
                    <strong>
                      {formatDate(correctionSourceItem?.runDetails?.periodStart)} - {formatDate(correctionSourceItem?.runDetails?.periodEnd)}
                    </strong>
                  </div>
                </div>

                {openAdjustmentRuns.length === 0 && (
                  <p className="hrPay__message">
                    Create an open adjustment run first. Once it exists, come back here and tie the correction to that run.
                  </p>
                )}

                <div className="hrPayModal__grid">
                  <label className="hrPayModal__fieldWide hrPayModal__fieldStacked">
                    <span>Target Adjustment Run:</span>
                    <select
                      value={correctionForm.targetPayId}
                      onChange={(event) =>
                        setCorrectionForm((prev) => ({
                          ...prev,
                          targetPayId: event.target.value,
                        }))
                      }
                      disabled={isLoadingCorrectionSource || isSavingCorrection || openAdjustmentRuns.length === 0}
                    >
                      <option value="">{openAdjustmentRuns.length > 0 ? 'Select adjustment run' : 'No open adjustment runs'}</option>
                      {openAdjustmentRuns.map((run) => (
                        <option key={run.payId ?? `${run.periodStart}-${run.periodEnd}`} value={run.payId ?? ''}>
                          #{run.payId ?? '-'} - {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="hrPayModal__fieldWide hrPayModal__fieldStacked">
                    <span>Source Line:</span>
                    <select
                      value={correctionForm.sourceLineKey}
                      onChange={(event) => {
                        const nextLine = correctionLines.find((line) => line.key === event.target.value) ?? null;
                        setCorrectionForm((prev) => ({
                          ...prev,
                          sourceLineKey: event.target.value,
                          correctedAmount: nextLine ? nextLine.originalAmount.toFixed(2) : prev.correctedAmount,
                        }));
                      }}
                      disabled={isLoadingCorrectionSource || isSavingCorrection || correctionLines.length === 0}
                    >
                      <option value="">{isLoadingCorrectionSource ? 'Loading posted lines...' : 'Select source line'}</option>
                      {correctionLines.map((line) => (
                        <option key={line.key} value={line.key}>
                          {line.label} - {line.formattedAmount}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Corrected Amount:</span>
                    <input
                      type="number"
                      min="0.00"
                      step="0.01"
                      placeholder="0.00"
                      value={correctionForm.correctedAmount}
                      onChange={(event) =>
                        setCorrectionForm((prev) => ({
                          ...prev,
                          correctedAmount: event.target.value,
                        }))
                      }
                      disabled={isLoadingCorrectionSource || isSavingCorrection}
                    />
                  </label>
                </div>

                {selectedCorrectionLine && (
                  <div className="hrPayModal__summary">
                    <div className="hrPayModal__summaryRow">
                      <span>Original Line</span>
                      <strong>{selectedCorrectionLine.label}</strong>
                    </div>
                    <div className="hrPayModal__summaryRow">
                      <span>Current Amount</span>
                      <strong>{selectedCorrectionLine.formattedAmount}</strong>
                    </div>
                    <div className="hrPayModal__summaryRow">
                      <span>Delta Preview</span>
                      <strong>{correctionDeltaPreview || 'Enter a corrected amount.'}</strong>
                    </div>
                  </div>
                )}

                {correctionError && <p className="hrPay__message">{correctionError}</p>}
              </section>

              <aside className="hrPayAdjustPreview">
                <div className="hrPayAdjustPreview__head">Posted Source Lines</div>
                {isLoadingCorrectionSource ? (
                  <div className="hrPayAdjustPreview__empty">Loading the posted payslip lines...</div>
                ) : correctionLines.length > 0 ? (
                  correctionLines.map((line) => (
                    <div
                      key={line.key}
                      className={`hrPayAdjustPreview__row ${line.key === correctionForm.sourceLineKey ? 'is-selected' : ''}`}
                    >
                      <span>{line.label}</span>
                      <strong>{line.formattedAmount}</strong>
                    </div>
                  ))
                ) : (
                  <div className="hrPayAdjustPreview__empty">
                    No source lines were found for this posted payslip item.
                  </div>
                )}
              </aside>
            </div>

            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={closeCorrectionModal} disabled={isSavingCorrection}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createLineCorrection()}
                disabled={isSavingCorrection || isLoadingCorrectionSource || openAdjustmentRuns.length === 0}
              >
                {isSavingCorrection ? 'Saving...' : 'Create Correction'}
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
              <strong> POSTED</strong>, and employees will be able to view the released payslips.
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
              <div className="hrPayModal__summaryRow">
                <span>Generated Payslips</span>
                <strong>{formatCount(currentRun.itemCount)}</strong>
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
                <input value={selectedDispute.status} readOnly />
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

            <div className="hrPayModal__line">
              <span>Administrative Approval:</span>
              <div className="hrPayModal__inlineBtns">
                <button type="button" disabled={isSaving} onClick={() => void updateDispute('APPROVED')}>
                  Approve
                </button>
                <button type="button" className="is-muted" disabled={isSaving} onClick={() => void updateDispute('REJECTED')}>
                  Deny
                </button>
              </div>
            </div>

            <p className="hrPay__message">
              If this dispute needs a payroll correction, open the related posted payslip from its payroll run and correct the
              specific line there.
            </p>

            <label className="hrPayModal__area">
              <span>Remarks:</span>
              <textarea
                placeholder="Enter review notes..."
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </label>
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
