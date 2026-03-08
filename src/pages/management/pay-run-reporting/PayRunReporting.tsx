import { useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import './PayRunReporting.css';

type ReportView = 'employee' | 'payType';

const employeeRows = [
  { name: 'Employee #1', amount: '0.00' },
  { name: 'Employee #1', amount: '0.00' },
  { name: 'Employee #1', amount: '0.00' },
  { name: 'Employee #1', amount: '0.00' },
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

export default function ManagementPayRunReporting() {
  const [view, setView] = useState<ReportView>('employee');
  const [filterValue, setFilterValue] = useState('All');
  const filterLabel = useMemo(() => (view === 'employee' ? 'Employee:' : 'Pay Type:'), [view]);

  return (
    <div className="mRun">
      <div className="mRun__top">
        <h1>Pay Run Reporting</h1>
        <select value={view} onChange={(e) => setView(e.target.value as ReportView)} aria-label="Report view">
          <option value="employee">By Employee</option>
          <option value="payType">By Pay Type</option>
        </select>
      </div>

      <div className="mRunFilters">
        <div className="mRunFilters__field">
          <label>{filterLabel}</label>
          <div className="mRunFilters__search">
            <FiSearch />
            <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
            <button type="button" aria-label="Clear filter" onClick={() => setFilterValue('')}>
              <FiXCircle />
            </button>
          </div>
        </div>

        <div className="mRunFilters__field">
          <label>From:</label>
          <select aria-label="From date">
            <option>April 1, 2024</option>
          </select>
        </div>

        <div className="mRunFilters__field">
          <label>To:</label>
          <select aria-label="To date">
            <option>April 30, 2024</option>
          </select>
        </div>

        <button
          type="button"
          className="mRunFilters__refresh"
          aria-label="Refresh"
          onClick={() => setFilterValue((prev) => prev)}
        >
          <FiRefreshCw />
        </button>
      </div>

      <section className="mRunTable">
        <div className="mRunTable__head">
          <span>{view === 'employee' ? 'Employee Name' : 'Pay Type'}</span>
          <span>Total</span>
        </div>
        <div className="mRunTable__body">
          {view === 'employee'
            ? employeeRows.map((row, idx) => (
                <article key={`${row.name}-${idx}`} className="mRunRow">
                  <div className="mRunRow__name">{row.name}</div>
                  <div className="mRunRow__meta">NET PAY</div>
                  <div className="mRunRow__value">{row.amount}</div>
                </article>
              ))
            : payTypeRows.map((row) => (
                <article key={row.label} className="mRunTypeRow">
                  <div>{row.label}</div>
                  <div>{row.amount}</div>
                </article>
              ))}
          {view === 'payType' && (
            <article className="mRunTypeRow mRunTypeRow--total">
              <div>TOTAL</div>
              <div>0.00</div>
            </article>
          )}
        </div>
      </section>

      <div className="mRunActions">
        <button type="button" onClick={() => window.print()}>Download Report</button>
        <button type="button" onClick={() => window.print()}>Print Report</button>
      </div>
    </div>
  );
}
