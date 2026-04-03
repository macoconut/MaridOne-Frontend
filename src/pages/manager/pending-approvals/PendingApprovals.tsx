import { useEffect, useMemo, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import '../../hr/approvals/Approvals.css';

type EmployeeRow = {
  id: number;
  name: string;
};

type LeaveDto = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  isPaid?: boolean;
  leaveType?: string;
  approverReason?: string;
};

type OvertimeDto = {
  overtimeId?: number;
  employeeId?: number;
  requestStatus?: string;
  requestAt?: string;
  workDate?: string;
  startTime?: string;
  endTime?: string;
  overtimeType?: string;
  reason?: string;
  approveReason?: string;
};

type RequestType = 'Leave' | 'Overtime';
type SourceType = 'leave' | 'overtime';

type ManagerRequest = {
  id: string;
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
  leaveType?: string;
  isPaid?: boolean;
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  overtimeId?: number;
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

function formatPeriod(start?: string, end?: string) {
  const startLabel = formatDateOnly(start);
  const endLabel = formatDateOnly(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

function employeeLabel(employeeById: Map<number, EmployeeRow>, employeeId?: number) {
  if (typeof employeeId !== 'number') return 'Employee unavailable';
  return employeeById.get(employeeId)?.name || `Employee ID ${employeeId}`;
}

function rosterMap(payload: unknown) {
  const rows = toArray<Record<string, unknown>>(payload).map((row, idx) => ({
    id: Number(row.employeeId ?? row.id ?? idx + 1),
    name:
      [row.firstName, row.middleName, row.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ') || `Employee #${row.employeeId ?? row.id ?? idx + 1}`,
  }));

  return new Map(rows.filter((row) => Number.isFinite(row.id)).map((row) => [row.id, row] satisfies [number, EmployeeRow]));
}

export default function ManagerPendingApprovals() {
  const [requests, setRequests] = useState<ManagerRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');

  async function loadRequests() {
    try {
      setLoadError('');
      const [employeesRes, leaveRes, overtimeRes] = await Promise.all([
        apiFetchJson<unknown>('/api/employees/team'),
        apiFetchJson<unknown>('/api/leave/request/team?page=0&size=50'),
        apiFetchJson<unknown>('/api/overtime/team?page=0&size=50'),
      ]);

      const employeeById = rosterMap(employeesRes);

      const leaveRows = toArray<LeaveDto>(leaveRes).map((item, idx) => ({
        id: `leave-${item.requestId ?? idx}`,
        requestId: item.requestId,
        employee: employeeLabel(employeeById, item.empId),
        message: `${item.leaveType?.replaceAll('_', ' ') || 'Leave'} • ${item.isPaid ? 'Paid' : 'Unpaid'}`,
        time: formatDateOnly(item.startDateTime),
        type: 'Leave' as const,
        source: 'leave' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Leave Period',
        referenceValue: formatPeriod(item.startDateTime, item.endDateTime),
        decisionSummary: item.approverReason || '',
        sortStamp: item.startDateTime ? Date.parse(item.startDateTime) || 0 : 0,
        leaveType: item.leaveType,
        isPaid: item.isPaid,
        startDateTime: item.startDateTime,
        endDateTime: item.endDateTime,
      }));

      const overtimeRows = toArray<OvertimeDto>(overtimeRes).map((item, idx) => ({
        id: `overtime-${item.overtimeId ?? idx}`,
        overtimeId: item.overtimeId,
        employee: employeeLabel(employeeById, item.employeeId),
        message: `${item.overtimeType || 'Overtime'} request on ${formatDateOnly(item.workDate)}`,
        time: formatDateTime(item.requestAt),
        type: 'Overtime' as const,
        source: 'overtime' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Work Window',
        referenceValue: `${formatDateTime(item.startTime)} to ${formatDateTime(item.endTime)}`,
        decisionSummary: item.approveReason || '',
        sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
      }));

      const merged = [...leaveRows, ...overtimeRows].sort((a, b) => b.sortStamp - a.sortStamp || a.id.localeCompare(b.id));
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
    setPendingDecision(null);
  }, [selectedId]);

  async function submitDecision() {
    if (!selected) return;
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 5) {
      setSubmitError('Please enter at least 5 characters explaining the decision.');
      return;
    }

    if (selected.source === 'leave' && !selected.leaveType) {
      setSubmitError('This leave request is missing a leave type and cannot be processed yet.');
      return;
    }

    setSubmitError('');
    setIsSaving(true);
    try {
      if (selected.source === 'leave') {
        await apiFetchJson(`/api/leave/update/${selected.requestId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            startDateTime: selected.startDateTime,
            endDateTime: selected.endDateTime,
            reason: selected.reason,
            leaveType: selected.leaveType,
            requestStatus: pendingDecision,
            approverReason: trimmedReason,
          }),
        });
      } else {
        await apiFetchJson('/api/overtime/update', {
          method: 'PATCH',
          body: JSON.stringify({
            overtimeId: selected.overtimeId,
            updateStatus: pendingDecision,
            approveReason: trimmedReason,
          }),
        });
      }

      setSelectedId(null);
      await loadRequests();
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
          {selected ? 'Review Team Request' : 'Requests from Team Members'}
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
            <span className="hrApprRow__message">Waiting for team leave and overtime data.</span>
            <span className="hrApprRow__time">-</span>
          </div>
        )}
      </section>

      {selected && (
        <div className="hrApprModalBackdrop" role="dialog" aria-modal="true">
          <div className="hrApprModal">
            <div className="dashModal__top">
              <div>
                <h2 className="hrApprModal__title">
                  {selected.employee} - {selected.type}
                </h2>
                <p className="hrApprModal__subtitle">Review the team request, choose an approval outcome, and confirm it once the decision reason is ready.</p>
              </div>
              <button
                type="button"
                className="hrApprModal__close"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
              >
                <FiXCircle />
              </button>
            </div>

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
                <span>Recorded At:</span>
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

            {!canReviewSelected && (
              <p className="hrApprForm__hint">This request already has a final decision recorded.</p>
            )}

            {submitError && <p className="hrApprForm__error">{submitError}</p>}

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row">
              <label className="decisionPicker">
                <span>Manager Approval:</span>
                <div className="decisionPicker__actions">
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDecision === 'APPROVED' ? 'is-selected' : ''}`}
                    disabled={isSaving || !canReviewSelected}
                    onClick={() => setPendingDecision('APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDecision === 'REJECTED' ? 'is-selected' : ''}`}
                    disabled={isSaving || !canReviewSelected}
                    onClick={() => setPendingDecision('REJECTED')}
                  >
                    Deny
                  </button>
                </div>
                {canReviewSelected && (
                  <p className="decisionPicker__note">
                    Choose the outcome here first. The request will only be submitted after you click the confirm button.
                  </p>
                )}
              </label>
            </div>

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

            <div className="hrApprModal__footer">
              <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                Cancel
              </button>
              {canReviewSelected ? (
                <button type="button" onClick={() => void submitDecision()} disabled={isSaving || !pendingDecision}>
                  {isSaving
                    ? 'Saving...'
                    : pendingDecision === 'APPROVED'
                      ? 'Confirm Approval'
                      : pendingDecision === 'REJECTED'
                        ? 'Confirm Denial'
                        : 'Confirm Decision'}
                </button>
              ) : (
                <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
