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
};

type DisputeStatus = 'Open' | 'Clear';

type DisputeRow = {
  id: number;
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

function formatRunType(value?: string) {
  if (!value) return 'Regular Payroll';
  return value === 'ADJUSTMENT' ? 'Adjustment Payroll' : 'Regular Payroll';
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
  const [currentRun, setCurrentRun] = useState<PayrollRunDto | null>(null);

  useEffect(() => {
    if (selectedDispute || runModalOpen || postModalOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [postModalOpen, runModalOpen, selectedDispute]);

  useEffect(() => {
    const storedRun = readStoredRun();
    if (!storedRun) return;

    setCurrentRun(storedRun);
    setRunForm((prev) => ({
      periodStart: storedRun.periodStart ?? prev.periodStart,
      periodEnd: storedRun.periodEnd ?? prev.periodEnd,
      runType:
        storedRun.runType === 'ADJUSTMENT' || storedRun.runType === 'REGULAR'
          ? storedRun.runType
          : prev.runType,
    }));
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
    try {
      setLoadError('');
      const response = await apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=100');
      const mapped = toArray<DisputeDto>(response).map((item, idx) => ({
        id: item.id ?? idx + 1,
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

  useEffect(() => {
    void loadDisputes();
  }, []);

  const displayedPeriodStart = currentRun?.periodStart ?? runForm.periodStart;
  const displayedPeriodEnd = currentRun?.periodEnd ?? runForm.periodEnd;

  const currentPayPeriod = useMemo(() => {
    return formatDate(displayedPeriodEnd);
  }, [displayedPeriodEnd]);

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
      const createdRun = await apiFetchJson<PayrollRunDto>('/api/payroll/run/create', {
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
      setRunForm((prev) => ({
        periodStart: createdRun.periodStart ?? prev.periodStart,
        periodEnd: createdRun.periodEnd ?? prev.periodEnd,
        runType:
          createdRun.runType === 'ADJUSTMENT' || createdRun.runType === 'REGULAR'
            ? createdRun.runType
            : prev.runType,
      }));
      setRunModalOpen(false);
      setRunMessage(`Payroll run #${createdRun.payId ?? '-'} is ready.`);
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsCreatingRun(false);
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
            <h3>Create Payroll Run</h3>
            <div className="hrPayModal__rule" />

            <p className="hrPayModal__intro">
              Choose the cutoff period and run type for this payroll run.
            </p>

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
                {isCreatingRun ? 'Creating...' : 'Create Run'}
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
