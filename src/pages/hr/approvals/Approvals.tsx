import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './Approvals.css';

type DisputeDto = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  statusReason?: string;
  itemId?: number;
  employeeId?: number;
  employeeName?: string;
};

type OvertimeDto = {
  overtimeId?: number;
  employeeId?: number;
  requestStatus?: string;
  requestAt?: string;
  workDate?: string;
  overtimeType?: string;
  reason?: string;
  approveReason?: string;
};

type RequestType = 'Dispute' | 'Overtime';
type SourceType = 'dispute' | 'overtime';

type HrRequest = {
  id: string;
  disputeId?: number;
  itemId?: number;
  employee: string;
  message: string;
  time: string;
  type: RequestType;
  source: SourceType;
  status: string;
  reason: string;
  referenceLabel: string;
  referenceValue: string;
  decisionSummary?: string;
  sortStamp: number;
};

type CorrectionIntent = {
  disputeId: number;
  itemId: number;
  employee: string;
  message: string;
  disputeReason: string;
  decisionReason: string;
};

function formatDateTime(value?: string) {
  if (!value) return '-';
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

function formatDateOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function employeeLabel(employeeName?: string, employeeId?: number) {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : '';
  if (trimmedName) return trimmedName;
  return typeof employeeId === 'number' ? `Employee ID ${employeeId}` : 'Employee unavailable';
}

export default function HrApprovals() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function loadRequests() {
    try {
      setLoadError('');
      const [disputesRes, overtimeRes] = await Promise.all([
        apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=50'),
        apiFetchJson<unknown>('/api/overtime/all?page=0&size=50'),
      ]);

      const disputeRows = toArray<DisputeDto>(disputesRes).map((item, idx) => ({
        id: `dispute-${item.id ?? idx}`,
        disputeId: item.id,
        itemId: item.itemId,
        employee: employeeLabel(item.employeeName, item.employeeId),
        message: item.subject?.trim() || `Payroll dispute for payslip item #${item.itemId ?? '-'}`,
        time: formatDateTime(item.createdAt),
        type: 'Dispute' as const,
        source: 'dispute' as const,
        status: item.status || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Payslip Item',
        referenceValue: typeof item.itemId === 'number' ? `#${item.itemId}` : 'Unavailable',
        decisionSummary: item.statusReason || '',
        sortStamp: item.createdAt ? Date.parse(item.createdAt) || 0 : 0,
      }));

      const overtimeRows = toArray<OvertimeDto>(overtimeRes).map((item, idx) => ({
        id: `overtime-${item.overtimeId ?? idx}`,
        employee: employeeLabel(undefined, item.employeeId),
        message: `${item.overtimeType || 'Overtime'} request on ${formatDateOnly(item.workDate)}`,
        time: formatDateTime(item.requestAt),
        type: 'Overtime' as const,
        source: 'overtime' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Work Date',
        referenceValue: formatDateOnly(item.workDate),
        decisionSummary: item.approveReason || '',
        sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
      }));

      const merged = [...disputeRows, ...overtimeRows].sort((a, b) => b.sortStamp - a.sortStamp || a.id.localeCompare(b.id));
      setRequests(merged);
    } catch (error) {
      setRequests([]);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const cards = useMemo(() => {
    const approved = requests.filter((r) => r.status.toUpperCase() === 'APPROVED').length;
    const denied = requests.filter((r) => ['DENIED', 'REJECTED'].includes(r.status.toUpperCase())).length;
    const pending = requests.filter((r) => r.status.toUpperCase() === 'PENDING').length;
    return [
      { label: 'Approved', value: approved },
      { label: 'Denied', value: denied },
      { label: 'Pending', value: pending },
    ];
  }, [requests]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId, requests]
  );
  const canReviewSelected = selected ? selected.status.toUpperCase() === 'PENDING' : false;

  useEffect(() => {
    setDecisionReason('');
    setSubmitError('');
  }, [selectedId]);

  async function submitDecision(nextStatus: 'APPROVED' | 'REJECTED') {
    if (!selected) return;
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 5) {
      setSubmitError('Please enter at least 5 characters explaining the decision.');
      return;
    }

    setSubmitError('');
    setIsSaving(true);
    try {
      let correctionIntent: CorrectionIntent | null = null;

      if (selected.source === 'dispute') {
        const id = selected.id.replace('dispute-', '');
        await apiFetchJson(`/api/payroll/item/dispute/update/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
            statusReason: trimmedReason,
          }),
        });

        if (
          nextStatus === 'APPROVED' &&
          typeof selected.disputeId === 'number' &&
          typeof selected.itemId === 'number'
        ) {
          correctionIntent = {
            disputeId: selected.disputeId,
            itemId: selected.itemId,
            employee: selected.employee,
            message: selected.message,
            disputeReason: selected.reason,
            decisionReason: trimmedReason,
          };
        }
      } else {
        const overtimeId = Number(selected.id.replace('overtime-', ''));
        await apiFetchJson('/api/overtime/update', {
          method: 'PATCH',
          body: JSON.stringify({
            overtimeId,
            updateStatus: nextStatus,
            approveReason: trimmedReason,
          }),
        });
      }

      setSelectedId(null);
      await loadRequests();

      if (correctionIntent) {
        navigate('/hr/payslips', {
          state: {
            correctionIntent,
          },
        });
      }
    } catch (error) {
      setSubmitError(getFriendlyErrorMessage(error, 'approval-decision'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <h1 className="hrAppr__title">
          {selected ? 'Review Employee Request' : 'Requests from Employees'}
          <span className="hrAppr__tools">
            <FiSearch />
            <FiFilter />
          </span>
        </h1>
      </div>

      <div className="hrAppr__cards">
        {cards.map((card) => (
          <article key={card.label} className="hrApprCard">
            <div className="hrApprCard__ring" />
            <div className="hrApprCard__body">
              <div className="hrApprCard__label">{card.label}</div>
              <div className="hrApprCard__value">{card.value}</div>
            </div>
          </article>
        ))}
      </div>

      <section className="hrApprTable">
        {loadError && <p className="hrApprForm__error">{loadError}</p>}
        {requests.length > 0 ? (
          requests.map((request) => (
            <button
              key={request.id}
              type="button"
              className="hrApprRow"
              onClick={() => setSelectedId(request.id)}
            >
              <span className="hrApprRow__employee">{request.employee}</span>
              <span className="hrApprRow__message">
                {request.type} • {request.message}
              </span>
              <span className="hrApprRow__time">{request.time}</span>
            </button>
          ))
        ) : (
          <div className="hrApprRow">
            <span className="hrApprRow__employee">No requests yet.</span>
            <span className="hrApprRow__message">Waiting for overtime and dispute data.</span>
            <span className="hrApprRow__time">-</span>
          </div>
        )}
      </section>

      {selected && (
        <div className="hrApprModalBackdrop" role="dialog" aria-modal="true">
          <div className="hrApprModal">
            <button
              type="button"
              className="hrApprModal__close"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
            >
              <FiXCircle />
            </button>

            <h2 className="hrApprModal__title">
              {selected.employee} - {selected.type}
            </h2>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Reference:</span>
                <input value={`${selected.referenceLabel}: ${selected.referenceValue}`} readOnly />
              </label>
              <label>
                <span>Current Status:</span>
                <input value={selected.status} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Requested At:</span>
                <input value={selected.time} readOnly />
              </label>
              <label>
                <span>Type:</span>
                <input value={selected.type} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Request Message:</span>
                <input value={selected.message} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Reason:</span>
                <textarea value={selected.reason || 'No reason provided.'} readOnly />
              </label>
            </div>

            {selected.decisionSummary && (
              <div className="hrApprForm__row">
                <label>
                  <span>Latest Decision Note:</span>
                  <textarea value={selected.decisionSummary} readOnly />
                </label>
              </div>
            )}

            <div className="hrApprForm__row">
              <label>
                <span>Reason for Approval / Denial:</span>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Type the reason for approving or denying this request"
                  readOnly={!canReviewSelected}
                />
              </label>
            </div>

            {selected.source === 'dispute' && (
              <p className="hrApprForm__hint">
                Approving a payroll dispute opens the correction workspace so HR can stage the actual adjustment.
              </p>
            )}
            {!canReviewSelected && (
              <p className="hrApprForm__hint">This request already has a final decision recorded.</p>
            )}

            {submitError && <p className="hrApprForm__error">{submitError}</p>}

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label className="hrApprForm__inline">
                <span>Administrative Approval:</span>
                <div className="hrApprForm__actions">
                  <button type="button" disabled={isSaving || !canReviewSelected} onClick={() => void submitDecision('APPROVED')}>
                    Approve
                  </button>
                  <button type="button" disabled={isSaving || !canReviewSelected} onClick={() => void submitDecision('REJECTED')}>
                    Deny
                  </button>
                </div>
              </label>
            </div>

            <div className="hrApprModal__footer">
              <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
