import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import { apiRequest, asArray } from '../../../lib/api';
import './Approvals.css';

type RequestType = 'OT';

type HrRequest = {
  id: string;
  employee: string;
  message: string;
  time: string;
  type: RequestType;
  overtimeId: number;
  status: 'APPROVED' | 'DENIED' | 'PENDING';
  remarks: string;
};

type OvertimeRecord = {
  overtimeId?: number;
  id?: number;
  employeeId?: number | string;
  employeeName?: string;
  reason?: string;
  requestedAt?: string;
  createdAt?: string;
  status?: string;
  remarks?: string;
};

export default function HrApprovals() {
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');

  async function loadRequests() {
    setIsLoading(true);
    setMessage('');
    try {
      const payload = await apiRequest<unknown>('/api/overtime/all?page=0&size=100');
      const mapped = asArray<OvertimeRecord>(payload).map((item, idx) => {
        const overtimeId = item.overtimeId ?? item.id ?? idx;
        const createdAt = item.createdAt ?? item.requestedAt;
        const time = createdAt ? new Date(createdAt).toLocaleString() : 'N/A';
        const statusRaw = (item.status ?? 'PENDING').toUpperCase();
        const status: 'APPROVED' | 'DENIED' | 'PENDING' =
          statusRaw.includes('APPROV') ? 'APPROVED' : statusRaw.includes('DEN') ? 'DENIED' : 'PENDING';
        return {
          id: String(overtimeId),
          overtimeId: Number(overtimeId),
          employee: item.employeeName?.trim() || `Employee #${item.employeeId ?? 'N/A'}`,
          message: item.reason?.trim() || 'Overtime request',
          time,
          type: 'OT' as const,
          status,
          remarks: item.remarks ?? '',
        };
      });
      setRequests(mapped);
    } catch (error) {
      setRequests([]);
      setMessage(`Failed to load requests: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  );
  const cards = useMemo(() => {
    const approved = requests.filter((request) => request.status === 'APPROVED').length;
    const denied = requests.filter((request) => request.status === 'DENIED').length;
    const pending = requests.filter((request) => request.status === 'PENDING').length;
    return [
      { label: 'Approved', value: approved },
      { label: 'Denied', value: denied },
      { label: 'Pending', value: pending },
    ];
  }, [requests]);

  async function updateRequest(status: 'APPROVED' | 'DENIED') {
    if (!selected) return;
    try {
      await apiRequest(`/api/overtime/update`, {
        method: 'PATCH',
        body: {
          overtimeId: selected.overtimeId,
          status,
          remarks: actionRemarks.trim() || undefined,
        },
      });
      setMessage(`Request #${selected.overtimeId} updated to ${status}.`);
      setSelectedId(null);
      setActionRemarks('');
      await loadRequests();
    } catch (error) {
      setMessage(`Failed to update request: ${String(error)}`);
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
          <button type="button" className="hrApprRow" disabled>
            <span className="hrApprRow__employee">No requests available.</span>
            <span className="hrApprRow__message">Waiting for backend data</span>
            <span className="hrApprRow__time">-</span>
          </button>
        )}
      </section>
      {(isLoading || message) && <p>{isLoading ? 'Loading requests...' : message}</p>}

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
              {selected.employee} - OT Application Form
            </h2>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Department:</span>
                <input value="From employee profile endpoint" readOnly />
              </label>
              <label>
                <span>Position:</span>
                <input value="From employee profile endpoint" readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Type of OT Requested:</span>
                <input value={selected.type} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Date of OT:</span>
                <input value={selected.time} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Reason for OT:</span>
                <textarea value={selected.message} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row hrApprForm__row--2">
              <label className="hrApprForm__inline">
                <span>Supporting Documents:</span>
                <button type="button">Click to View</button>
              </label>
              <label className="hrApprForm__inline">
                <span>Signature:</span>
                <div className="hrApprForm__signature">◌</div>
              </label>
            </div>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label className="hrApprForm__inline">
                <span>Administrative Approval:</span>
                <div className="hrApprForm__actions">
                  <button type="button" onClick={() => void updateRequest('APPROVED')}>Approve</button>
                  <button type="button" onClick={() => void updateRequest('DENIED')}>Deny</button>
                </div>
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Remarks:</span>
                <textarea value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)} />
              </label>
            </div>

            <div className="hrApprModal__footer">
              <button type="button" onClick={() => setSelectedId(null)}>
                Cancel
              </button>
              <button type="button" onClick={() => void updateRequest('APPROVED')}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
