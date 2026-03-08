import { useState } from 'react';
import './Payslips.css';

type DisputeStatus = 'Open' | 'Clear';

type DisputeRow = {
  id: number;
  employee: string;
  department: string;
  payrollPeriod: string;
  status: DisputeStatus;
};

const disputes: DisputeRow[] = [
  { id: 1, employee: 'Employee #1', department: 'R&D', payrollPeriod: 'March 30, 2024', status: 'Open' },
  { id: 2, employee: 'Employee #2', department: 'R&D', payrollPeriod: 'March 30, 2024', status: 'Clear' },
  { id: 3, employee: 'Employee #3', department: 'R&D', payrollPeriod: 'March 30, 2024', status: 'Clear' },
  { id: 4, employee: 'Employee #4', department: 'R&D', payrollPeriod: 'March 30, 2024', status: 'Clear' },
  { id: 5, employee: 'Employee #5', department: 'R&D', payrollPeriod: 'March 30, 2024', status: 'Clear' },
];

export default function HrPayslips() {
  const [selectedDispute, setSelectedDispute] = useState<DisputeRow | null>(null);

  return (
    <div className="hrPay">
      <h1 className="hrPay__title">Manage Payslips</h1>

      <section className="hrPayPeriod">
        <div>
          <h2>Current Pay Period: April 15, 2024</h2>
          <p>
            Period from: <span>March 26, 2024 - April 11, 2024</span>
          </p>
        </div>
        <button type="button">Run Pay for this Period</button>
      </section>

      <section className="hrPayPanel">
        <header className="hrPayPanel__head">Payroll Dispute from Employees</header>

        <div className="hrPayTable">
          <div className="hrPayTable__head">
            <span>Employee Name</span>
            <span>Department</span>
            <span>Payroll Period</span>
            <span>Status</span>
          </div>
          <div className="hrPayTable__body">
            {disputes.map((row) => (
              <button key={row.id} className="hrPayRow" type="button" onClick={() => setSelectedDispute(row)}>
                <span>{row.employee}</span>
                <span>{row.department}</span>
                <span>{row.payrollPeriod}</span>
                <span className={row.status === 'Open' ? 'is-open' : ''}>{row.status}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {selectedDispute && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true">
          <article className="hrPayModal">
            <h3>{selectedDispute.employee} - Payslip Dispute</h3>
            <div className="hrPayModal__rule" />

            <div className="hrPayModal__grid">
              <label>
                <span>Department:</span>
                <input value="Research and Development" readOnly />
              </label>
              <label>
                <span>Position:</span>
                <input value="Head of Research" readOnly />
              </label>
              <label>
                <span>Payroll Period:</span>
                <input value="March 1, 2024" readOnly />
              </label>
              <label>
                <span>Dispute Type:</span>
                <input value="Overtime Pay Dispute" readOnly />
              </label>
            </div>

            <label className="hrPayModal__area">
              <span>Reason for Dispute:</span>
              <textarea
                value="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam blandit turpis vel sapien suscipit."
                readOnly
              />
            </label>

            <div className="hrPayModal__line">
              <span>Supporting Documents:</span>
              <button type="button">Click to View</button>
            </div>

            <div className="hrPayModal__line">
              <span>Administrative Approval:</span>
              <div className="hrPayModal__inlineBtns">
                <button type="button">Approve</button>
                <button type="button" className="is-muted">
                  Deny
                </button>
              </div>
            </div>

            <label className="hrPayModal__area">
              <span>Remarks:</span>
              <textarea placeholder="Enter review notes..." />
            </label>

            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={() => setSelectedDispute(null)}>
                Cancel
              </button>
              <button type="button" onClick={() => setSelectedDispute(null)}>
                Submit
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
