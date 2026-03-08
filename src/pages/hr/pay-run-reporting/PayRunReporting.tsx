import { useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import './PayRunReporting.css';

type ReportView = 'employee' | 'payType';

const employeeRows = [
  { name: 'Employee #1', amount: '0.00' },
  { name: 'Employee #2', amount: '0.00' },
  { name: 'Employee #3', amount: '0.00' },
  { name: 'Employee #4', amount: '0.00' },
  { name: 'Employee #5', amount: '0.00' },
  { name: 'Employee #67', amount: '0.00' },
];

const payTypeRows = [
  { label: 'Wages', amount: '0.00' },
  { label: 'Allowances', amount: '0.00' },
  { label: 'Deductions', amount: '0.00' },
  { label: 'Taxes', amount: '0.00' },
  { label: 'Non-taxable Allowances', amount: '0.00' },
  { label: 'Post-tax Deductions', amount: '0.00' },
  { label: 'Employer Contributions', amount: '0.00' },
];

export default function HrPayRunReporting() {
  const [view, setView] = useState<ReportView>('employee');
  const [filterValue, setFilterValue] = useState('All');

  const filterLabel = useMemo(() => (view === 'employee' ? 'Employee:' : 'Pay Type:'), [view]);

  return (
    <div className="hrRun">
      <div className="hrRun__top">
        <h1>Pay Run Reporting</h1>
        <select value={view} onChange={(e) => setView(e.target.value as ReportView)} aria-label="Report view">
          <option value="employee">By Employee</option>
          <option value="payType">By Pay Type</option>
        </select>
      </div>

      <div className="hrRunFilters">
        <div className="hrRunFilters__field hrRunFilters__field--search">
          <label>{filterLabel}</label>
          <div className="hrRunFilters__searchWrap">
            <FiSearch />
            <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
            <button type="button" aria-label="Clear filter" onClick={() => setFilterValue('')}>
              <FiXCircle />
            </button>
          </div>
        </div>

        <div className="hrRunFilters__field">
          <label>From:</label>
          <select aria-label="From date">
            <option>April 1, 2024</option>
          </select>
        </div>

        <div className="hrRunFilters__field">
          <label>To:</label>
          <select aria-label="To date">
            <option>April 30, 2024</option>
          </select>
        </div>

        <button
          className="hrRunFilters__refresh"
          type="button"
          aria-label="Refresh"
          onClick={() => setFilterValue((v) => v)}
        >
          <FiRefreshCw />
        </button>
      </div>

      {view === 'employee' ? (
        <section className="hrRunTable" aria-label="Pay run by employee">
          <div className="hrRunTable__head">
            <span>Employee Name</span>
            <span>Total</span>
          </div>

          <div className="hrRunTable__body">
            {employeeRows.map((row) => (
              <article key={row.name} className="hrRunEmployee">
                <div className="hrRunEmployee__name">{row.name}</div>
                <div className="hrRunEmployee__sub">NET PAY</div>
                <div className="hrRunEmployee__value">{row.amount}</div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="hrRunTable" aria-label="Pay run by pay type">
          <div className="hrRunTable__head">
            <span>Pay Type</span>
            <span>Total</span>
          </div>

          <div className="hrRunTable__body">
            {payTypeRows.map((row) => (
              <article key={row.label} className="hrRunTypeRow">
                <div>{row.label}</div>
                <div>{row.amount}</div>
              </article>
            ))}
            <article className="hrRunTypeRow hrRunTypeRow--total">
              <div>TOTAL</div>
              <div>0.00</div>
            </article>
          </div>
        </section>
      )}

      <div className="hrRunActions">
        <button type="button" onClick={() => window.print()}>Download Report</button>
        <button type="button" onClick={() => window.print()}>Print Report</button>
      </div>
    </div>
  );
}
