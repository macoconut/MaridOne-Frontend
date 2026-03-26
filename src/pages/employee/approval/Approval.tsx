import { useEffect, useState } from 'react';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
import './Approval.css';

type ApprovalItem = {
  id: string;
  dateOfRequest: string;
  requestType: string;
  category: string;
  startOfRequest: string;
  status: 'Pending' | 'Approved' | 'Denied';
  approvedBy: string;
  remarks: string;
  requestReason: string;
  decisionReason: string;
  decisionDate: string;
};

type OvertimeRow = {
  overtimeId?: number;
  requestAt?: string;
  workDate?: string;
  startTime?: string;
  approvedAt?: string;
  requestStatus?: string;
  approver?: string;
  reason?: string;
  approveReason?: string;
  overtimeType?: string;
};

type DisputeRow = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  statusReason?: string;
  itemId?: number;
};

function extractApprover(statusReason?: string) {
  if (!statusReason) return '-';
  const byMatch = statusReason.match(/\bby\s+(.+)$/i);
  if (byMatch?.[1]) return byMatch[1].trim();
  return statusReason.trim() || '-';
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Approval() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);

  useEffect(() => {
    if (selectedApproval) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selectedApproval]);

  useEffect(() => {
    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) throw new Error('Missing username');
        const userDetails = await apiFetchJson<Record<string, unknown>>(
          `/api/user/details/${encodeURIComponent(username)}`
        );
        const selfEmployee =
          userDetails.employee && typeof userDetails.employee === 'object'
            ? (userDetails.employee as Record<string, unknown>)
            : null;
        const empId =
          typeof userDetails.employeeId === 'number'
            ? userDetails.employeeId
            : typeof selfEmployee?.employeeId === 'number'
              ? selfEmployee.employeeId
              : typeof selfEmployee?.id === 'number'
                ? selfEmployee.id
                : null;

        if (!empId) throw new Error('Missing employee ID');
        const [otResponse, disputeResponse] = await Promise.all([
          apiFetchJson<unknown>(`/api/overtime/all/${empId}?page=0&size=20`),
          apiFetchJson<unknown>(`/api/payroll/item/dispute/self?empId=${empId}&page=0&size=20`),
        ]);

        const overtimeItems = toArray<OvertimeRow>(otResponse).map((row) => {
          const statusRaw = String(row.requestStatus ?? '').toUpperCase();
          const status: ApprovalItem['status'] =
            statusRaw === 'APPROVED'
              ? 'Approved'
              : statusRaw === 'REJECTED' || statusRaw === 'DENIED'
                ? 'Denied'
                : 'Pending';
          return {
            id: String(row.overtimeId ?? Math.random()),
            dateOfRequest: formatDateTime(row.requestAt),
            requestType: 'Overtime',
            category: row.overtimeType || 'OT',
            startOfRequest:
              row.startTime
                ? `${formatDate(row.workDate)} ${formatTime(row.startTime)}`
                : formatDate(row.workDate),
            status,
            approvedBy: row.approver ?? '-',
            remarks: row.approveReason ?? row.reason ?? '-',
            requestReason: row.reason ?? '-',
            decisionReason: row.approveReason ?? '-',
            decisionDate: formatDateTime(row.approvedAt),
          };
        });

        const disputeItems = toArray<DisputeRow>(disputeResponse).map((row) => {
          const statusRaw = String(row.status ?? '').toUpperCase();
          const status: ApprovalItem['status'] =
            statusRaw === 'APPROVED'
              ? 'Approved'
              : statusRaw === 'REJECTED' || statusRaw === 'DENIED'
                ? 'Denied'
                : 'Pending';
          return {
            id: `dispute-${String(row.id ?? Math.random())}`,
            dateOfRequest: formatDateTime(row.createdAt),
            requestType: 'Payslip Dispute',
            category: row.subject || 'Dispute',
            startOfRequest: `Item #${row.itemId ?? '-'}`,
            status,
            approvedBy: status === 'Pending' ? '-' : extractApprover(row.statusReason),
            remarks: row.statusReason ?? row.reason ?? '-',
            requestReason: row.reason ?? '-',
            decisionReason: row.statusReason ?? '-',
            decisionDate: '-',
          };
        });

        const merged = [...overtimeItems, ...disputeItems].sort((a, b) => {
          const aTime = Date.parse(a.dateOfRequest);
          const bTime = Date.parse(b.dateOfRequest);
          if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
          return bTime - aTime;
        });

        setApprovals(merged);
      } catch {
        setApprovals([]);
      }
    })();
  }, []);

  const approvedCount = approvals.filter((item) => item.status === 'Approved').length;
  const deniedCount = approvals.filter((item) => item.status === 'Denied').length;
  const pendingCount = approvals.filter((item) => item.status === 'Pending').length;
  const cards = [
    { label: 'Approved', value: approvedCount, cls: 'approved' },
    { label: 'Denied', value: deniedCount, cls: 'denied' },
    { label: 'Pending', value: pendingCount, cls: 'pending' },
  ] as const;

  return (
    <div className="appr">
      <div className="appr__head">
        <h1 className="appr__title">Approvals</h1>
      </div>

      <div className="appr__stats">
        {cards.map((card) => (
          <div key={card.label} className="apprCard">
            {card.value > 0 ? (
              <div className={`apprCard__ring apprCard__ring--${card.cls}`} />
            ) : (
              <div className="apprCard__empty" aria-hidden="true">
                -
              </div>
            )}
            <div className="apprCard__body">
              <div className="apprCard__label">{card.label}</div>
              <div className="apprCard__value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="apprTable">
        <div className="apprTable__head">
          <div>Date of Request</div>
          <div>Request Type</div>
          <div>Category</div>
          <div>Start of Request</div>
          <div>Status</div>
          <div>Approved By</div>
          <div>Remarks</div>
        </div>

        <div className="apprTable__body">
          {approvals.length > 0 ? (
            approvals.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`apprRow apprRow--button ${row.status !== 'Pending' ? 'is-openable' : ''}`}
                onClick={() => {
                  if (row.status === 'Pending') return;
                  setSelectedApproval(row);
                }}
                disabled={row.status === 'Pending'}
              >
                <div>{row.dateOfRequest}</div>
                <div>{row.requestType}</div>
                <div>{row.category}</div>
                <div>{row.startOfRequest}</div>
                <div className={`apprStatus apprStatus--${row.status.toLowerCase()}`}>
                  {row.status}
                </div>
                <div>{row.approvedBy}</div>
                <div>{row.remarks}</div>
              </button>
            ))
          ) : (
            <div className="apprRow">
              <div>No approval requests yet.</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </div>
          )}
        </div>
      </section>

      {selectedApproval && (
        <div className="apprModalBackdrop" role="dialog" aria-modal="true" aria-label="Approval details">
          <div className="apprModal">
            <div className="apprModal__top">
              <div>
                <div className="apprModal__eyebrow">Request Breakdown</div>
                <div className="apprModal__title">{selectedApproval.requestType}</div>
              </div>
              <button type="button" className="apprModal__close" onClick={() => setSelectedApproval(null)}>
                x
              </button>
            </div>

            <div className="apprModal__hero">
              <div>
                <div className="apprModal__heroLabel">Current Status</div>
                <div className={`apprModal__status apprModal__status--${selectedApproval.status.toLowerCase()}`}>
                  {selectedApproval.status}
                </div>
              </div>
              <div className="apprModal__heroMeta">
                <div>
                  <span>Category</span>
                  <strong>{selectedApproval.category}</strong>
                </div>
                <div>
                  <span>Handled By</span>
                  <strong>{selectedApproval.approvedBy}</strong>
                </div>
              </div>
            </div>

            <div className="apprModal__rule" />

            <div className="apprModal__summary">
              <div className="apprModal__card">
                <span>Date of Request</span>
                <strong>{selectedApproval.dateOfRequest}</strong>
              </div>
              <div className="apprModal__card">
                <span>Start of Request</span>
                <strong>{selectedApproval.startOfRequest}</strong>
              </div>
              <div className="apprModal__card">
                <span>Decision Timestamp</span>
                <strong>{selectedApproval.decisionDate}</strong>
              </div>
            </div>

            <div className="apprModal__body">
              <div className="apprModal__section">
                <div className="apprModal__sectionTitle">Request Reason</div>
                <p className="apprModal__sectionBody">{selectedApproval.requestReason}</p>
              </div>
              <div className="apprModal__section">
                <div className="apprModal__sectionTitle">Approval / Denial Reason</div>
                <p className="apprModal__sectionBody">{selectedApproval.decisionReason}</p>
              </div>
              <div className="apprModal__section apprModal__section--compact">
                <div className="apprModal__sectionTitle">Remarks Preview</div>
                <p className="apprModal__sectionBody">{selectedApproval.remarks}</p>
              </div>
            </div>

            <div className="apprModal__actions">
              <button type="button" onClick={() => setSelectedApproval(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
