import './Payslips.css';

const linePoints = [
  72, 71, 72, 71, 73, 74, 78, 81, 79, 79, 76, 78, 80, 78, 78, 76, 75, 75, 74, 69, 65, 67, 70,
  69, 72, 74, 72, 71, 70, 71, 73, 75, 74, 77, 75, 76, 78, 79, 76, 77, 74, 70,
];

const barGroups = [28, 52, 29, 25, 44, 18];

export default function HrPayslips() {
  const polylinePoints = linePoints.map((value, index) => `${index * 6},${100 - value}`).join(' ');

  return (
    <div className="hrPay">
      <h1 className="hrPay__title">Manage Payslips</h1>

      <section className="hrPayBoard">
        <div className="hrPayBoard__left">
          <article className="hrPayCard">
            <div className="hrPayCard__head">
              <div>
                <h3>Business Bank Account</h3>
                <p>306-234-12345678</p>
              </div>
              <button type="button" aria-label="More">
                ⋮
              </button>
            </div>

            <div className="hrPayCard__meta">
              <span className="is-status">Reconciled</span>
              <span>Statement balance (Jul 17)</span>
              <strong>(100.00)</strong>
            </div>

            <div className="hrPayChart hrPayChart--line">
              <svg viewBox="0 0 250 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={polylinePoints} />
                {linePoints.map((value, index) => (
                  <circle key={index} cx={index * 6} cy={100 - value} r="1.9" />
                ))}
              </svg>
              <div className="hrPayChart__axis">
                <span>Jul 16</span>
                <span>Jul 23</span>
                <span>Jul 30</span>
                <span>Aug 6</span>
              </div>
            </div>
          </article>

          <article className="hrPayCard">
            <h3>Business Performance</h3>
            <div className="hrPayPerf">
              <div className="hrPayPerf__row">
                <span>Accounts Payable Days</span>
                <div className="hrPayPerf__spark">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <strong>1.60</strong>
              </div>
              <div className="hrPayPerf__row">
                <span>Accounts Receivable Days</span>
                <div className="hrPayPerf__spark">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <strong>1.60</strong>
              </div>
            </div>
          </article>

          <article className="hrPayCard hrPayCard--muted" />
        </div>

        <div className="hrPayBoard__right">
          <article className="hrPayCard">
            <h3>Account watchlist</h3>
            <table className="hrPayTable">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>This month</th>
                  <th>Year to date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Accounts payable (800)</td>
                  <td>2,400.00</td>
                  <td>234,567.00</td>
                </tr>
                <tr>
                  <td>Accounts receivable (610)</td>
                  <td>5,345.00</td>
                  <td>432,748.00</td>
                </tr>
                <tr>
                  <td>Advertising (640)</td>
                  <td>1,300.00</td>
                  <td>46,324.00</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article className="hrPayCard">
            <h3>Invoices owed to you</h3>
            <div className="hrPayInvoiceMeta">
              <button type="button">New Sales Invoice</button>
              <div>
                <p>
                  4 draft invoices <strong>2,058.00</strong>
                </p>
                <p>
                  10 awaiting payment <strong>18,073.95</strong>
                </p>
                <p className="is-overdue">
                  8 overdue <strong>14,653.95</strong>
                </p>
              </div>
            </div>

            <div className="hrPayChart hrPayChart--bar">
              {barGroups.map((height, index) => (
                <div key={index} style={{ height: `${height}%` }} />
              ))}
              <div className="hrPayChart__axis">
                <span>Older</span>
                <span>Oct 30 - Nov 5</span>
                <span>This week</span>
                <span>Nov 13 - 19</span>
                <span>Nov 20 - 26</span>
                <span>Future</span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
