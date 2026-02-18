import './Dashboard.css';

export default function Dashboard() {
  return (
    <div className="dashPage">
      {/* INFO CARD */}
      <section className="infoCardX">
        <div className="infoCardX__header">
          <div className="infoCardX__title">Your Information</div>
          <button className="infoCardX__edit" type="button">Edit Info</button>
        </div>

        <div className="infoCardX__grid">
          {/* left */}
          <div className="infoCardX__left">
            <div className="infoCardX__photo" aria-hidden="true" />
            <div className="infoCardX__name">
              Juan Carlos
              <br />
              L. Dela Cruz
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* middle */}
          <div className="infoCardX__mid">
            <div className="infoRow">
              <span className="infoRow__icon">⌂</span>
              <span>UST, Sampaloc, Manila, Metro Manila, Philippines</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">✉</span>
              <span className="infoRow__link">employeenumber67@marid.com</span>
            </div>
            <div className="infoRow">
              <span className="infoRow__icon">☎</span>
              <span>+63 912 345 6789</span>
            </div>
          </div>

          <div className="infoCardX__divider" />

          {/* right */}
          <div className="infoCardX__right">
            <div className="statBlock">
              <div className="statBlock__label">Part of Marid since:</div>
              <div className="statBlock__value">February 28, 2023</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last Login:</div>
              <div className="statBlock__value">January 6, 2024; 12:59 PM</div>
            </div>

            <div className="statBlock">
              <div className="statBlock__label">Last attendance:</div>
              <div className="statBlock__value">January 6, 2024; 6:55 AM</div>
              <div className="statBlock__sub">Time-In</div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTION BUTTONS */}
      <section className="actionRowX">
        <button className="actionBtnX" type="button">
          <span>View Payslip</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>View Attendance</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>Request OT</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
        <button className="actionBtnX" type="button">
          <span>Request Leave</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
      </section>

      {/* LOWER */}
      <section className="lowerGridX">
        {/* left column */}
        <div className="lowerColX">
          {/* training */}
          <div className="cardX">
            <div className="cardX__title">Training and Onboarding Materials</div>

            <div className="miniFolders">
              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">Updated Training v1.5</div>
                  <ul>
                    <li>Lorem ipsum dolor sit amet</li>
                    <li>Lorem ipsum dolor sit amet</li>
                  </ul>
                  <button className="miniFolder__btn" type="button">View Training Materials</button>
                </div>
              </div>

              <div className="miniFolder">
                <div className="miniFolder__icon" />
                <div className="miniFolder__body">
                  <div className="miniFolder__name">Updated Onboarding v1.5</div>
                  <ul>
                    <li>Lorem ipsum dolor sit amet</li>
                    <li>Lorem ipsum dolor sit amet</li>
                  </ul>
                  <button className="miniFolder__btn" type="button">View Onboarding Materials</button>
                </div>
              </div>
            </div>
          </div>

          {/* handbook */}
          <div className="cardX">
            <div className="cardX__title">Employee Handbook</div>

            <div className="handbookRow">
              <div className="handbookRow__icon" />
              <div className="handbookRow__body">
                <div className="handbookRow__name">Updated Handbook v2.1</div>
                <ul>
                  <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
                  <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
                </ul>

                <div className="handbookRow__actions">
                  <button className="handbookBtn" type="button">View Handbook</button>
                  <button className="handbookBtn" type="button">Download Handbook</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* right calendar */}
        <div className="cardX cardX--calendar">
          <div className="cardX__title">Company Events</div>
          <div className="calendarShell" aria-label="Calendar placeholder">
            <div className="calendarShell__top">
              <span>‹</span>
              <strong>April 2024</strong>
              <span>›</span>
            </div>

            <div className="calendarGrid">
              <div className="calHead">MO</div><div className="calHead">TU</div><div className="calHead">WE</div>
              <div className="calHead">TH</div><div className="calHead">FR</div><div className="calHead">SA</div><div className="calHead">SU</div>

              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className={`calCell ${i === 24 ? 'is-event' : ''}`}>
                  {i > 2 && i < 33 ? i - 2 : ''}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
