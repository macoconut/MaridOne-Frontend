import { FiHome, FiMail, FiPhone, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './Dashboard.css';

const quickActions = [
  'View Payslip',
  'View Attendance',
  'Request OT',
  'Request Leave',
];

const calendarDays = Array.from({ length: 30 }, (_, i) => i + 1);

function ActionCard({ label }: { label: string }) {
  return (
    <button type="button" className="mQuickCard">
      <span>{label}</span>
      <i aria-hidden="true" />
    </button>
  );
}

function MaterialSection({
  title,
  actionA,
  actionB,
}: {
  title: string;
  actionA: string;
  actionB?: string;
}) {
  return (
    <section className="mPanel">
      <div className="mPanel__head">{title}</div>
      <div className="mPanel__body">
        <article className="mMaterial">
          <div className="mMaterial__thumb" aria-hidden="true" />
          <div>
            <h4>Updated {title.includes('Handbook') ? 'Handbook' : 'Training'} v1.5</h4>
            <ul>
              <li>Lorem ipsum dolor sit amet</li>
              <li>Lorem ipsum dolor sit amet</li>
            </ul>
            <div className="mMaterial__actions">
              <button type="button">{actionA}</button>
              {actionB && <button type="button">{actionB}</button>}
            </div>
          </div>
        </article>
        {!title.includes('Handbook') && (
          <article className="mMaterial">
            <div className="mMaterial__thumb" aria-hidden="true" />
            <div>
              <h4>Updated Onboarding v1.5</h4>
              <ul>
                <li>Lorem ipsum dolor sit amet</li>
                <li>Lorem ipsum dolor sit amet</li>
              </ul>
              <div className="mMaterial__actions">
                <button type="button">View Onboarding Materials</button>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

export default function ManagementDashboard() {
  return (
    <section className="mDash">
      <section className="mPanel mInfo">
        <div className="mPanel__head mPanel__head--inline">
          <span>Your Information</span>
          <button type="button">Edit Info</button>
        </div>

        <div className="mInfo__body">
          <div className="mInfo__identity">
            <div className="mInfo__avatar" />
            <h2>
              Juan Carlos
              <br />
              L. Dela Cruz
            </h2>
          </div>

          <div className="mInfo__contacts">
            <p>
              <FiHome /> UST, Sampaloc, Manila, Metro Manila, Philippines
            </p>
            <p>
              <FiMail /> employeenumber67@marid.com
            </p>
            <p>
              <FiPhone /> +63 912 345 6789
            </p>
          </div>

          <div className="mInfo__meta">
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

      <div className="mDash__grid">
        <div className="mDash__left">
          <div className="mQuickGrid">
            {quickActions.map((action) => (
              <ActionCard key={action} label={action} />
            ))}
          </div>

          <MaterialSection
            title="Training and Onboarding Materials"
            actionA="View Training Materials"
          />
          <MaterialSection
            title="Employee Handbook"
            actionA="View Handbook"
            actionB="Download Handbook"
          />
        </div>

        <div className="mDash__right">
          <section className="mPanel">
            <div className="mPanel__head">Company Announcements and Events</div>
            <div className="mCal">
              <div className="mCal__toolbar">
                <FiChevronLeft />
                <span>April 2024</span>
                <FiChevronRight />
              </div>
              <div className="mCal__grid">
                {calendarDays.map((day) => (
                  <div key={day} className={`mCal__cell ${day >= 19 && day <= 23 ? 'is-marked' : ''}`}>
                    {day}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mPanel">
            <div className="mPanel__head">Today, April 6, 2024:</div>
            <div className="mAnnounceGrid">
              <article className="mAnnounce">
                <h4>Announcement / Event 1</h4>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </article>
              <article className="mAnnounce">
                <h4>Announcement / Event 2</h4>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </article>
              <article className="mAnnounce">
                <h4>Announcement / Event 3</h4>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
