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

const approvals: ApprovalItem[] = [];

export default function Approval() {
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
