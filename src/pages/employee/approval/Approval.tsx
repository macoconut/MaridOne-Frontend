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
};

type OvertimeRow = {
  overtimeId?: number;
  requestedAt?: string;
  status?: string;
  requestStatus?: string;
  approvedBy?: string;
  approverName?: string;
  reason?: string;
  approveReason?: string;
};

export default function Approval() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);

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
        const response = await apiFetchJson<unknown>(`/api/overtime/all/${empId}?page=0&size=20`);
        const mapped = toArray<OvertimeRow>(response).map((row) => {
          const status: ApprovalItem['status'] =
            (row.status ?? row.requestStatus)?.toUpperCase() === 'APPROVED'
              ? 'Approved'
              : (row.status ?? row.requestStatus)?.toUpperCase() === 'REJECTED'
                ? 'Denied'
                : 'Pending';
          return {
            id: String(row.overtimeId ?? Math.random()),
            dateOfRequest: row.requestedAt ?? '-',
            requestType: 'Overtime',
            category: 'OT',
            startOfRequest: row.requestedAt ?? '-',
            status,
            approvedBy: row.approvedBy ?? row.approverName ?? '-',
            remarks: row.approveReason ?? row.reason ?? '-',
          };
        });
        setApprovals(mapped);
      } catch {
        setApprovals([]);
      }
    })();
  }, []);

  const approvedCount = approvals.filter((item) => item.status === 'Approved').length;
  const deniedCount = approvals.filter((item) => item.status === 'Denied').length;
  const pendingCount = approvals.filter((item) => item.status === 'Pending').length;

  return (
    <div className="appr">
      <div className="appr__head">
        <h1 className="appr__title">Approvals</h1>
      </div>

      <div className="appr__stats">
        <div className="apprCard">
          <div className="apprCard__ring apprCard__ring--approved" />
          <div className="apprCard__body">
            <div className="apprCard__label">Approved</div>
            <div className="apprCard__value">{approvedCount}</div>
          </div>
        </div>

        <div className="apprCard">
          <div className="apprCard__ring apprCard__ring--denied" />
          <div className="apprCard__body">
            <div className="apprCard__label">Denied</div>
            <div className="apprCard__value">{deniedCount}</div>
          </div>
        </div>

        <div className="apprCard">
          <div className="apprCard__ring apprCard__ring--pending" />
          <div className="apprCard__body">
            <div className="apprCard__label">Pending</div>
            <div className="apprCard__value">{pendingCount}</div>
          </div>
        </div>
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
              <div key={row.id} className="apprRow">
                <div>{row.dateOfRequest}</div>
                <div>{row.requestType}</div>
                <div>{row.category}</div>
                <div>{row.startOfRequest}</div>
                <div className={`apprStatus apprStatus--${row.status.toLowerCase()}`}>
                  {row.status}
                </div>
                <div>{row.approvedBy}</div>
                <div>{row.remarks}</div>
              </div>
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
    </div>
  );
}
