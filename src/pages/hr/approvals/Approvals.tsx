import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import './Approvals.css';

type DisputeDto = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  statusReason?: string;
  itemId?: number;
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

type RequestType = 'Leave' | 'OT';
type SourceType = 'dispute' | 'overtime';

type HrRequest = {
  id: string;
  employee: string;
  message: string;
  time: string;
  type: RequestType;
  source: SourceType;
  status: string;
  reason: string;
};

export default function HrApprovals() {
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadRequests() {
    try {
      const [disputesRes, overtimeRes] = await Promise.all([
        apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=50'),
        apiFetchJson<unknown>('/api/overtime/all?page=0&size=50'),
      ]);

      const disputeRows = toArray<DisputeDto>(disputesRes).map((item, idx) => ({
        id: `dispute-${item.id ?? idx}`,
        employee: `Item #${item.itemId ?? '-'}`,
        message: item.subject || 'Payroll dispute',
        time: item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        type: 'Leave' as const,
        source: 'dispute' as const,
        status: item.status || 'PENDING',
        reason: item.reason || '',
      }));

      const overtimeRows = toArray<OvertimeDto>(overtimeRes).map((item, idx) => ({
        id: `overtime-${item.overtimeId ?? idx}`,
        employee: `Employee #${item.employeeId ?? '-'}`,
        message: `${item.overtimeType || 'Overtime'} request${item.workDate ? ` - ${item.workDate}` : ''}`,
        time: item.requestAt ? new Date(item.requestAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        type: 'OT' as const,
        source: 'overtime' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
      }));

      const merged = [...disputeRows, ...overtimeRows].sort((a, b) => (a.id < b.id ? 1 : -1));
      setRequests(merged);
    } catch {
      setRequests([]);
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

  async function submitDecision(nextStatus: 'APPROVED' | 'REJECTED') {
    if (!selected) return;
    setIsSaving(true);
    try {
      if (selected.source === 'dispute') {
        const id = selected.id.replace('dispute-', '');
        await apiFetchJson(`/api/payroll/item/dispute/update/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
            statusReason: `${nextStatus} by HR`,
          }),
        });
      } else {
        const overtimeId = Number(selected.id.replace('overtime-', ''));
        await apiFetchJson('/api/overtime/update', {
          method: 'PATCH',
          body: JSON.stringify({
            overtimeId,
            updateStatus: nextStatus,
            approveReason: `${nextStatus} by HR`,
          }),
        });
      }

      setSelectedId(null);
      await loadRequests();
    } catch {
      // Keep modal open so HR can retry.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <h1 className="hrAppr__title">
          {selected ? 'Pending Approvals from Employees' : 'Requests from Employees'}
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
        {requests.length > 0 ? (
          requests.map((request) => (
            <button
              key={request.id}
              type="button"
              className="hrApprRow"
              onClick={() => setSelectedId(request.id)}
            >
              <span className="hrApprRow__employee">{request.employee}</span>
              <span className="hrApprRow__message">{request.message}</span>
              <span className="hrApprRow__time">{request.time}</span>
            </button>
          ))
        ) : (
          <div className="hrApprRow">
            <span className="hrApprRow__employee">No requests yet.</span>
            <span className="hrApprRow__message">Waiting for backend data.</span>
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
              {selected.employee} - {selected.type === 'Leave' ? 'Dispute Form' : 'OT Application Form'}
            </h2>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Department:</span>
                <input value="From backend profile" readOnly />
              </label>
              <label>
                <span>Current Status:</span>
                <input value={selected.status} readOnly />
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

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label className="hrApprForm__inline">
                <span>Administrative Approval:</span>
                <div className="hrApprForm__actions">
                  <button type="button" disabled={isSaving} onClick={() => void submitDecision('APPROVED')}>
                    Approve
                  </button>
                  <button type="button" disabled={isSaving} onClick={() => void submitDecision('REJECTED')}>
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
