import { FiChevronLeft, FiChevronRight, FiClock, FiCalendar } from 'react-icons/fi';
import './AttendanceDashboard.css';

const metricCards = [
  { label: 'Present', value: 67 },
  { label: 'Absent', value: 67 },
  { label: 'On Time', value: 34 },
  { label: 'Late', value: 33 },
];

const feedRows = Array.from({ length: 9 }).map((_, idx) => ({
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
  duration: '1h 32m',
  period: 'This Month - 6 days',
}));

const onLeave = Array.from({ length: 3 }).map((_, idx) => ({
  id: `leave-${idx}`,
  name: 'Name',
  department: 'Department',
  position: 'Position',
  period: 'April 6, 2024 - April 7, 2024',
}));

const dailyAttendance = ['April 4, 2024', 'April 5, 2024', 'April 6, 2024'];

export default function ManagerAttendanceDashboard() {
  return (
    <div className="mgrAtt">
      <div className="mgrAtt__top">
        <div className="mgrAtt__titleWrap">
          <h1>Attendance Dashboard</h1>
          <p>Thursday, April 6, 2024</p>
        </div>

        <button type="button" className="mgrAtt__export">
          Export Attendance
          <br />
          Analytics
        </button>
      </div>

      <div className="mgrAtt__grid">
        <div className="mgrAtt__mainCol">
          <section className="mgrAttStatRow">
            {metricCards.map((card) => (
              <article key={card.label} className="mgrAttStat">
                <div className="mgrAttStat__icon" />
                <div>
                  <div className="mgrAttStat__label">{card.label}</div>
                  <div className="mgrAttStat__value">{card.value}</div>
                </div>
              </article>
            ))}
          </section>

          <section className="mgrAttPanel">
            <div className="mgrAttPanel__head">Attendance per day:</div>
            <div className="mgrAttPerDay">
              <button type="button" className="mgrAttPerDay__arrow" aria-label="Previous">
                <FiChevronLeft />
              </button>
              <div className="mgrAttPerDay__boxes">
                {dailyAttendance.map((day) => (
                  <div key={day} className="mgrAttPerDay__card">
                    <div className="mgrAttPerDay__donut" />
                    <div className="mgrAttPerDay__date">{day}</div>
                  </div>
                ))}
              </div>
              <button type="button" className="mgrAttPerDay__arrow" aria-label="Next">
                <FiChevronRight />
              </button>
            </div>
            <div className="mgrAttLegend">
              <span>On Time</span>
              <span>Late</span>
              <span>Absent</span>
              <span>On Leave</span>
              <span>Day Off</span>
            </div>
          </section>

          <div className="mgrAtt__bottom">
            <section className="mgrAttPanel">
              <div className="mgrAttPanel__head">Late Today</div>
              <div className="mgrAttList">
                {lateToday.map((row) => (
                  <article key={row.id} className="mgrAttPerson">
                    <div className="mgrAttPerson__avatar" />
                    <div>
                      <div className="mgrAttPerson__name">{row.name}</div>
                      <div className="mgrAttPerson__meta">{row.department}</div>
                      <div className="mgrAttPerson__meta">{row.position}</div>
                      <div className="mgrAttPerson__extra">
                        <span>
                          <FiClock /> {row.timeIn}
                        </span>
                        <span>
                          <FiClock /> {row.duration}
                        </span>
                        <span>
                          <FiCalendar /> {row.period}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mgrAttPanel">
              <div className="mgrAttPanel__head">On Leave</div>
              <div className="mgrAttList">
                {onLeave.map((row) => (
                  <article key={row.id} className="mgrAttPerson">
                    <div className="mgrAttPerson__avatar" />
                    <div>
                      <div className="mgrAttPerson__name">{row.name}</div>
                      <div className="mgrAttPerson__meta">{row.department}</div>
                      <div className="mgrAttPerson__meta">{row.position}</div>
                      <div className="mgrAttPerson__extra">
                        <span>
                          <FiCalendar /> {row.period}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className="mgrAttPanel mgrAttFeed">
          <div className="mgrAttPanel__head">Attendance Feed</div>
          <div className="mgrAttList">
            {feedRows.map((row) => (
              <article key={row.id} className="mgrAttPerson">
                <div className="mgrAttPerson__avatar" />
                <div>
                  <div className="mgrAttPerson__name">{row.name}</div>
                  <div className="mgrAttPerson__meta">{row.department}</div>
                  <div className="mgrAttPerson__meta">{row.position}</div>
                </div>
                <div className="mgrAttPerson__time">{row.time}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
