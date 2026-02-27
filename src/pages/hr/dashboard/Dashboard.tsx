import { FiChevronLeft, FiChevronRight, FiClock, FiCalendar } from 'react-icons/fi';
import './Dashboard.css';

const metricCards = [
  { label: 'Present', value: 67 },
  { label: 'Absent', value: 67 },
  { label: 'On Time', value: 34 },
  { label: 'Late', value: 33 },
];

const departments = ['People Operations', 'Product Manufacturing', 'Product Manufacturing'];

const attendanceFeed = Array.from({ length: 9 }).map((_, idx) => ({
  id: `feed-${idx}`,
  name: 'Name',
  department: 'Department',
  position: 'Position',
  time: '30m Ago',
}));

const lateToday = Array.from({ length: 3 }).map((_, idx) => ({
  id: `late-${idx}`,
  name: 'Name',
  department: 'Department',
  position: 'Position',
  timeIn: '8:32 AM',
  duration: '32m',
  period: 'This Month - 6 days',
}));

const onLeave = Array.from({ length: 3 }).map((_, idx) => ({
  id: `leave-${idx}`,
  name: 'Name',
  department: 'Department',
  position: 'Position',
  period: 'April 16, 2024 - April 17, 2024',
}));

export default function HrDashboard() {
  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <div>
          <h1 className="hrDash__title">Attendance Dashboard</h1>
          <p className="hrDash__subtitle">Thursday, April 6, 2024</p>
        </div>

        <button className="hrDash__exportBtn" type="button">
          Export Attendance
          <br />
          Analytics
        </button>
      </div>

      <div className="hrDash__grid">
        <div className="hrDash__mainCol">
          <section className="hrStatRow">
            {metricCards.map((card) => (
              <article key={card.label} className="hrStatCard">
                <div className="hrStatCard__ring" />
                <div className="hrStatCard__body">
                  <div className="hrStatCard__label">{card.label}</div>
                  <div className="hrStatCard__value">{card.value}</div>
                </div>
              </article>
            ))}
          </section>

          <section className="hrPanel">
            <div className="hrPanel__header">Departmental Attendance</div>
            <div className="hrDept">
              <button className="hrCircleBtn" type="button" aria-label="Previous department page">
                <FiChevronLeft />
              </button>

              <div className="hrDept__cards">
                {departments.map((dept, idx) => (
                  <div key={`${dept}-${idx}`} className="hrDonutCard">
                    <div className="hrDonut" />
                    <div className="hrDonutCard__name">{dept}</div>
                  </div>
                ))}
              </div>

              <button className="hrCircleBtn" type="button" aria-label="Next department page">
                <FiChevronRight />
              </button>
            </div>

            <div className="hrPager" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>

            <div className="hrLegend">
              <span className="hrLegend__item">On Time</span>
              <span className="hrLegend__item">Late</span>
              <span className="hrLegend__item">Absent</span>
              <span className="hrLegend__item">On Leave</span>
              <span className="hrLegend__item">Day Off</span>
            </div>
          </section>

          <div className="hrDash__bottomRow">
            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header">Late Today</div>
              <div className="hrPeopleList">
                {lateToday.map((item) => (
                  <article key={item.id} className="hrPerson">
                    <div className="hrPerson__avatar" />
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">{item.name}</div>
                      <div className="hrPerson__meta">{item.department}</div>
                      <div className="hrPerson__meta">{item.position}</div>
                      <div className="hrPerson__infoRow">
                        <span>
                          <FiClock /> {item.timeIn}
                        </span>
                        <span>
                          <FiClock /> {item.duration}
                        </span>
                        <span>
                          <FiCalendar /> {item.period}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header">On Leave</div>
              <div className="hrPeopleList">
                {onLeave.map((item) => (
                  <article key={item.id} className="hrPerson">
                    <div className="hrPerson__avatar" />
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">{item.name}</div>
                      <div className="hrPerson__meta">{item.department}</div>
                      <div className="hrPerson__meta">{item.position}</div>
                      <div className="hrPerson__infoRow">
                        <span>
                          <FiCalendar /> {item.period}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className="hrPanel hrFeedPanel">
          <div className="hrPanel__header">Attendance Feed</div>
          <div className="hrPeopleList">
            {attendanceFeed.map((item) => (
              <article key={item.id} className="hrPerson">
                <div className="hrPerson__avatar" />
                <div className="hrPerson__body">
                  <div className="hrPerson__name">{item.name}</div>
                  <div className="hrPerson__meta">{item.department}</div>
                  <div className="hrPerson__meta">{item.position}</div>
                </div>
                <div className="hrPerson__time">{item.time}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
