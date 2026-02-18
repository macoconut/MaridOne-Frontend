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

const mockApprovals: ApprovalItem[] = [
  {
    id: '1',
    dateOfRequest: 'April 6, 2024',
    requestType: 'Leave',
    category: 'Sick Leave',
    startOfRequest: 'April 7, 2024',
    status: 'Pending',
    approvedBy: 'HR67',
    remarks: 'None',
  },
  {
    id: '2',
    dateOfRequest: 'April 6, 2024',
    requestType: 'Leave',
    category: 'Sick Leave',
    startOfRequest: 'April 7, 2024',
    status: 'Pending',
    approvedBy: 'HR67',
    remarks: 'None',
  },
  {
    id: '3',
    dateOfRequest: 'April 6, 2024',
    requestType: 'Leave',
    category: 'Sick Leave',
    startOfRequest: 'April 7, 2024',
    status: 'Pending',
    approvedBy: 'HR67',
    remarks: 'None',
  },
  {
    id: '4',
    dateOfRequest: 'April 6, 2024',
    requestType: 'Leave',
    category: 'Sick Leave',
    startOfRequest: 'April 7, 2024',
    status: 'Pending',
    approvedBy: 'HR67',
    remarks: 'None',
  },
  {
    id: '5',
    dateOfRequest: 'April 6, 2024',
    requestType: 'Leave',
    category: 'Sick Leave',
    startOfRequest: 'April 7, 2024',
    status: 'Pending',
    approvedBy: 'HR67',
    remarks: 'None',
  },
];

export default function Approval() {
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
            <div className="apprCard__value">67</div>
          </div>
        </div>

        <div className="apprCard">
          <div className="apprCard__ring apprCard__ring--denied" />
          <div className="apprCard__body">
            <div className="apprCard__label">Denied</div>
            <div className="apprCard__value">67</div>
          </div>
        </div>

        <div className="apprCard">
          <div className="apprCard__ring apprCard__ring--pending" />
          <div className="apprCard__body">
            <div className="apprCard__label">Pending</div>
            <div className="apprCard__value">67</div>
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
          {mockApprovals.map((row) => (
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
          ))}
        </div>
      </section>
    </div>
  );
}
