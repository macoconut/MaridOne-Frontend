import { useState } from 'react';
import { FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import './PayrollReview.css';

const reviewRows = Array.from({ length: 16 }).map((_, idx) => ({
  id: idx + 1,
  employee: 'Employee #1',
  gross: '0.00',
  taxes: '0.00',
  deductions: '0.00',
  net: '0.00',
}));

export default function AccountingPayrollReview() {
  const [filterValue, setFilterValue] = useState('All');
  return (
    <section className="aReviewPay">
      <h1>Review Employees&apos; Payslips</h1>

      <div className="aReviewPay__filters">
        <div className="aReviewPay__field">
          <label>Employee:</label>
          <div className="aReviewPay__search">
            <FiSearch />
            <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
            <button type="button" aria-label="Clear" onClick={() => setFilterValue('')}>
              <FiXCircle />
            </button>
          </div>
        </div>

        <div className="aReviewPay__field">
          <label>Payout Period:</label>
          <select aria-label="Payout period">
            <option>April 15, 2024</option>
          </select>
        </div>

        <button type="button" className="aReviewPay__refresh" aria-label="Refresh" onClick={() => setFilterValue((v) => v)}>
          <FiRefreshCw />
        </button>
      </div>

      <section className="aReviewPayTable">
        <div className="aReviewPayTable__head">
          <span>Employee Name</span>
          <span>Gross Pay</span>
          <span>Taxes Withheld</span>
          <span>Deductions</span>
          <span>Net Pay</span>
          <span>Action</span>
        </div>

        <div className="aReviewPayTable__body">
          {reviewRows.map((row) => (
            <article key={row.id} className="aReviewPayRow">
              <span className="is-name">{row.employee}</span>
              <span>{row.gross}</span>
              <span>{row.taxes}</span>
              <span>{row.deductions}</span>
              <span className="is-net">{row.net}</span>
              <button type="button" onClick={() => window.print()}>View Payslip</button>
            </article>
          ))}

          <article className="aReviewPayRow aReviewPayRow--total">
            <span className="is-name">TOTAL</span>
            <span>0.00</span>
            <span>0.00</span>
            <span>0.00</span>
            <span className="is-net">0.00</span>
            <span />
          </article>
        </div>
      </section>
    </section>
  );
}
