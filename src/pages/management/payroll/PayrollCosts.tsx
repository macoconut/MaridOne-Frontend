import { FiCheckCircle, FiMoreVertical } from 'react-icons/fi';
import './PayrollCosts.css';

const accountRows = [
  { account: 'Accounts payable (800)', month: '2,400.00', ytd: '234,567.00' },
  { account: 'Accounts receivable (610)', month: '5,345.00', ytd: '432,748.00' },
  { account: 'Advertising (400)', month: '1,300.00', ytd: '6,324.00' },
];

const barData = [
  { label: 'Older', value: 45, tone: 'gray' },
  { label: 'Oct 30 - Nov 5', value: 82, tone: 'light' },
  { label: 'This week', value: 48, tone: 'strong' },
  { label: 'Nov 13 - 19', value: 41, tone: 'mid' },
  { label: 'Nov 20 - 26', value: 70, tone: 'light' },
  { label: 'Future', value: 30, tone: 'mid' },
];

export default function ManagementPayrollCosts() {
  return (
    <section className="mPay">
      <div className="mPay__top">
        <div>
          <h1>Overall Payroll Costs</h1>
          <div className="mPay__dateWrap">
            <select className="mPay__dateSelect" defaultValue="March 30, 2024" aria-label="Date">
              <option>March 30, 2024</option>
              <option>April 15, 2024</option>
              <option>April 30, 2024</option>
            </select>
          </div>
        </div>

        <button className="mPay__exportBtn" type="button">
          Export Attendance Analytics
        </button>
      </div>

      <div className="mPay__board">
        <div className="mPay__leftCol">
          <section className="mPay__card">
            <header className="mPay__cardHead">
              <div>
                <h3>Business Bank Account</h3>
                <p>306-234-12345678</p>
              </div>
              <button className="mPay__iconBtn" type="button" aria-label="More">
                <FiMoreVertical />
              </button>
            </header>

            <div className="mPay__bankMeta">
              <span className="mPay__ok">
                <FiCheckCircle />
                Reconciled
              </span>
              <span>Statement balance (Jul 17)</span>
              <strong>(100.00)</strong>
            </div>

            <div className="mPay__lineChart">
              <svg viewBox="0 0 640 170" preserveAspectRatio="none" aria-label="Bank trend line chart">
                <polyline
                  fill="none"
                  stroke="#4ea6e7"
                  strokeWidth="3"
                  points="0,120 20,120 40,120 60,120 80,120 100,120 120,92 140,75 160,58 180,66 200,76 220,72 240,60 260,77 280,70 300,78 320,86 340,82 360,86 380,112 400,138 420,126 440,112 460,96 480,110 500,110 520,96 540,82 560,92 580,86 600,80 620,86 640,110"
                />
                <polyline
                  fill="rgba(78,166,231,0.24)"
                  stroke="none"
                  points="0,120 20,120 40,120 60,120 80,120 100,120 120,92 140,75 160,58 180,66 200,76 220,72 240,60 260,77 280,70 300,78 320,86 340,82 360,86 380,112 400,138 420,126 440,112 460,96 480,110 500,110 520,96 540,82 560,92 580,86 600,80 620,86 640,110 640,170 0,170"
                />
              </svg>
            </div>

            <div className="mPay__xTicks">
              <span>Jul 16</span>
              <span>Jul 23</span>
              <span>Jul 30</span>
              <span>Aug 6</span>
            </div>
          </section>

          <section className="mPay__card">
            <header className="mPay__cardHead">
              <div>
                <h3>Business Performance</h3>
              </div>
            </header>

            <div className="mPay__perfRow">
              <span>Accounts Payable Days</span>
              <div className="mPay__spark">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i className="hi" />
                <i className="max" />
                <i />
                <i />
              </div>
              <strong>1.60</strong>
            </div>

            <div className="mPay__perfRow">
              <span>Accounts Receivable Days</span>
              <div className="mPay__spark">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i className="hi" />
                <i className="max" />
                <i />
                <i />
              </div>
              <strong>1.60</strong>
            </div>
          </section>
        </div>

        <div className="mPay__rightCol">
          <section className="mPay__card">
            <header className="mPay__cardHead">
              <div>
                <h3>Account watchlist</h3>
              </div>
            </header>

            <div className="mPay__watchHeader">
              <span>Account</span>
              <span>This month</span>
              <span>Year to date</span>
            </div>
            {accountRows.map((row) => (
              <div className="mPay__watchRow" key={row.account}>
                <span>{row.account}</span>
                <span>{row.month}</span>
                <span>{row.ytd}</span>
              </div>
            ))}
          </section>

          <section className="mPay__card">
            <header className="mPay__cardHead">
              <div>
                <h3>Invoices owed to you</h3>
              </div>
            </header>

            <div className="mPay__invoiceTop">
              <button className="mPay__newInvoice" type="button">
                New Sales Invoice
              </button>
              <div className="mPay__invoiceStats">
                <div>
                  <span>4 draft invoices</span>
                  <strong>2,058.00</strong>
                </div>
                <div>
                  <span>10 awaiting payment</span>
                  <strong>18,073.95</strong>
                </div>
                <div className="red">
                  <span>8 overdue</span>
                  <strong>14,653.95</strong>
                </div>
              </div>
            </div>

            <div className="mPay__bars">
              {barData.map((bar) => (
                <div className="mPay__barWrap" key={bar.label}>
                  <div className={`mPay__bar mPay__bar--${bar.tone}`} style={{ height: `${bar.value}%` }} />
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
