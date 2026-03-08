import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const actionCards = [
  { label: 'View Payslip', route: '/manager/attendance-reports' },
  { label: 'View Attendance', route: '/manager/attendance-dashboard' },
  { label: 'Request Leave', route: '/manager/pending-approvals' },
  { label: 'Request OT', route: '/manager/pending-approvals' },
];

export default function ManagerDashboard() {
  const navigate = useNavigate();

  return (
    <div className="mgrUser">
      <section className="mgrInfo">
        <div className="mgrInfo__head">
          <h1>Your Information</h1>
          <button type="button" onClick={() => navigate('/manager/dashboard')}>Edit Info</button>
        </div>

        <div className="mgrInfo__grid">
          <div className="mgrInfo__identity">
            <div className="mgrInfo__avatar" />
            <h2>
              Juan Carlos
              <br />
              L. Dela Cruz
            </h2>
          </div>

          <div className="mgrInfo__contacts">
            <p>UST, Sampaloc, Manila, Metro Manila, Philippines</p>
            <p>employeenumber67@marid.com</p>
            <p>+63 912 345 6789</p>
          </div>

          <div className="mgrInfo__meta">
            <p>
              <strong>Part of Marid since:</strong>
              <span>February 28, 2023</span>
            </p>
            <p>
              <strong>Last Login:</strong>
              <span>January 6, 2024; 12:59 PM</span>
            </p>
            <p>
              <strong>Last attendance:</strong>
              <span>January 6, 2024; 6:55 AM</span>
            </p>
          </div>
        </div>
      </section>

      <div className="mgrUser__grid">
        <div className="mgrUser__left">
          <div className="mgrActionGrid">
            {actionCards.map((action) => (
              <button
                key={action.label}
                type="button"
                className="mgrActionCard"
                onClick={() => navigate(action.route)}
              >
                <span>{action.label}</span>
                <i aria-hidden="true">→</i>
              </button>
            ))}
          </div>

          <section className="mgrPanel">
            <div className="mgrPanel__head">Training and Onboarding Materials</div>
            <div className="mgrPanel__body mgrDocs">
              <article className="mgrDoc">
                <div className="mgrDoc__thumb" />
                <div>
                  <h4>Updated Training v1.5</h4>
                  <ul>
                    <li>Lorem ipsum dolor sit amet</li>
                    <li>Lorem ipsum dolor sit amet</li>
                  </ul>
                  <button type="button" onClick={() => navigate('/manager/attendance-reports')}>
                    View Training Materials
                  </button>
                </div>
              </article>
              <article className="mgrDoc">
                <div className="mgrDoc__thumb" />
                <div>
                  <h4>Updated Onboarding v1.5</h4>
                  <ul>
                    <li>Lorem ipsum dolor sit amet</li>
                    <li>Lorem ipsum dolor sit amet</li>
                  </ul>
                  <button type="button" onClick={() => navigate('/manager/attendance-reports')}>
                    View Onboarding Materials
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section className="mgrPanel">
            <div className="mgrPanel__head">Employee Handbook</div>
            <div className="mgrPanel__body">
              <article className="mgrDoc">
                <div className="mgrDoc__thumb" />
                <div>
                  <h4>Updated Handbook v2.1</h4>
                  <ul>
                    <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
                    <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
                  </ul>
                  <div className="mgrDoc__actions">
                    <button type="button" onClick={() => navigate('/manager/attendance-reports')}>
                      View Handbook
                    </button>
                    <button type="button" onClick={() => navigate('/manager/attendance-reports')}>
                      Download Handbook
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div className="mgrUser__right">
          <section className="mgrPanel">
            <div className="mgrPanel__head">Company Announcements and Events</div>
            <div className="mgrPanel__body">
              <div className="mgrCalendar">
                <div className="mgrCalendar__head">
                  <span>‹</span>
                  <strong>April 2024</strong>
                  <span>›</span>
                </div>
                <div className="mgrCalendar__grid">
                  {Array.from({ length: 35 }, (_, idx) => (
                    <div key={idx} className={`mgrCalendar__cell ${idx > 24 && idx < 30 ? 'is-event' : ''}`} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mgrPanel">
            <div className="mgrPanel__head">Today, April 6, 2024:</div>
            <div className="mgrAnnounceGrid">
              <article className="mgrAnnounce">
                <h4>Announcement / Event 1</h4>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </article>
              <article className="mgrAnnounce">
                <h4>Announcement / Event 2</h4>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </article>
              <article className="mgrAnnounce">
                <h4>Announcement / Event 3</h4>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
