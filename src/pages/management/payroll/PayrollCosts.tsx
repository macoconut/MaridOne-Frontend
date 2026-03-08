import './PayrollCosts.css';

const summaryCards = [
  {
    title: 'Final Net Payout',
    value: 'PXXX,XXX.00',
    note: 'March 1 - 31, 2024 Payout',
  },
  {
    title: 'Total Employer Contributions',
    value: 'PXXX,XXX.00',
    note: 'Government and employer-side benefits',
  },
  {
    title: 'Total Gross Wages',
    value: 'PXXX,XXX.00',
    note: '+3.2% v.s. February',
  },
];

const historyData = [
  { month: 'Oct', value: 58, tone: 'light' },
  { month: 'Nov', value: 66, tone: 'dark' },
  { month: 'Dec', value: 78, tone: 'light' },
  { month: 'Jan', value: 82, tone: 'dark' },
  { month: 'Feb', value: 72, tone: 'light' },
  { month: 'Mar', value: 40, tone: 'dark' },
];

const deptLegend = [
  { label: 'People Operations', tone: 't1' },
  { label: 'Procurement', tone: 't2' },
  { label: 'Production', tone: 't3' },
  { label: 'R&D', tone: 't4' },
];

export default function ManagementPayrollCosts() {
  return (
    <section className="mPay">
      <div className="mPay__top">
        <div>
          <h1>Overall Payroll Costs</h1>
          <div className="mPay__controls">
            <select className="mPay__dateSelect" defaultValue="March 2024" aria-label="Date">
              <option>March 2024</option>
              <option>April 2024</option>
              <option>May 2024</option>
            </select>
          </div>
        </div>

        <button className="mPay__exportBtn" type="button" onClick={() => window.print()}>
          Export Payroll
          <br />
          Analytics
        </button>
      </div>

      <section className="mPaySummaryGrid">
        {summaryCards.map((card) => (
          <article key={card.title} className="mPaySummaryCard">
            <h3>{card.title}</h3>
            <div className="mPaySummaryCard__value">{card.value}</div>
            <p>{card.note}</p>
          </article>
        ))}
      </section>

      <section className="mPayChartsGrid">
        <article className="mPayPanel">
          <header className="mPayPanel__head">6 - Month Payroll Cost History</header>
          <div className="mPayHistory">
            {historyData.map((item) => (
              <div key={item.month} className="mPayHistory__barWrap">
                <div
                  className={`mPayHistory__bar mPayHistory__bar--${item.tone}`}
                  style={{ height: `${item.value}%` }}
                />
                <span>{item.month}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="mPayPanel">
          <header className="mPayPanel__head">March 2024 Cost Breakdown by Department</header>
          <div className="mPayDonutBlock">
            <div className="mPayLegend">
              {deptLegend.map((item) => (
                <div key={item.label} className="mPayLegend__item">
                  <i className={item.tone} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="mPayDonut" aria-hidden="true" />
          </div>
        </article>
      </section>
    </section>
  );
}
