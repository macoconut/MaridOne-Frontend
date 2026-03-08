import './Payslips.css';

const linePoints: number[] = [];

const barGroups: number[] = [];

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
                <p>Not connected</p>
              </div>
              <button type="button" aria-label="More">
                ⋮
              </button>
            </div>

            <div className="hrPayCard__meta">
              <span className="is-status">No data</span>
              <span>Statement balance</span>
              <strong>(0.00)</strong>
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
                <strong>0.00</strong>
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
                <strong>0.00</strong>
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
                  <td>0.00</td>
                  <td>0.00</td>
                </tr>
                <tr>
                  <td>Accounts receivable (610)</td>
                  <td>0.00</td>
                  <td>0.00</td>
                </tr>
                <tr>
                  <td>Advertising (640)</td>
                  <td>0.00</td>
                  <td>0.00</td>
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
                  0 draft invoices <strong>0.00</strong>
                </p>
                <p>
                  0 awaiting payment <strong>0.00</strong>
                </p>
                <p className="is-overdue">
                  0 overdue <strong>0.00</strong>
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
