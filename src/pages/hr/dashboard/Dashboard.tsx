import { FiChevronLeft, FiChevronRight, FiClock, FiCalendar } from 'react-icons/fi';
import './Dashboard.css';

const metricCards = [
  { label: 'Present', value: 0 },
  { label: 'Absent', value: 0 },
  { label: 'On Time', value: 0 },
  { label: 'Late', value: 0 },
];

const departments: string[] = [];

const attendanceFeed: Array<{
  id: string;
  name: string;
  department: string;
  position: string;
  time: string;
}> = [];

const lateToday: Array<{
  id: string;
  name: string;
  department: string;
  position: string;
  timeIn: string;
  duration: string;
  period: string;
}> = [];

const onLeave: Array<{
  id: string;
  name: string;
  department: string;
  position: string;
  period: string;
}> = [];

export default function HrDashboard() {
  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <div>
          <h1 className="hrDash__title">Attendance Dashboard</h1>
          <p className="hrDash__subtitle">Thursday, April 6, 2024</p>
        </div>

        <button className="hrDash__exportBtn" type="button" onClick={() => window.print()}>
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
                {departments.length > 0 ? (
                  departments.map((dept, idx) => (
                    <div key={`${dept}-${idx}`} className="hrDonutCard">
                      <div className="hrDonut" />
                      <div className="hrDonutCard__name">{dept}</div>
                    </div>
                  ))
                ) : (
                  <div className="hrDonutCard">
                    <div className="hrDonutCard__name">No department data yet.</div>
                  </div>
                )}
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
                {lateToday.length > 0 ? (
                  lateToday.map((item) => (
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
                  ))
                ) : (
                  <article className="hrPerson">
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">No late attendance data yet.</div>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header">On Leave</div>
              <div className="hrPeopleList">
                {onLeave.length > 0 ? (
                  onLeave.map((item) => (
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
                  ))
                ) : (
                  <article className="hrPerson">
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">No leave data yet.</div>
                    </div>
                  </article>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="hrPanel hrFeedPanel">
          <div className="hrPanel__header">Attendance Feed</div>
          <div className="hrPeopleList">
            {attendanceFeed.length > 0 ? (
              attendanceFeed.map((item) => (
                <article key={item.id} className="hrPerson">
                  <div className="hrPerson__avatar" />
                  <div className="hrPerson__body">
                    <div className="hrPerson__name">{item.name}</div>
                    <div className="hrPerson__meta">{item.department}</div>
                    <div className="hrPerson__meta">{item.position}</div>
                  </div>
                  <div className="hrPerson__time">{item.time}</div>
                </article>
              ))
            ) : (
              <article className="hrPerson">
                <div className="hrPerson__body">
                  <div className="hrPerson__name">No attendance feed yet.</div>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
