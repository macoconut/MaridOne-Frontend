import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock } from 'react-icons/fi';
import './Attendance.css';

type StatCard = {
  label: string;
  value: number;
};

const statCards: StatCard[] = [
  { label: 'Present', value: 67 },
  { label: 'Absent', value: 67 },
  { label: 'On Time', value: 34 },
  { label: 'Late', value: 33 },
];

const feedItems = Array.from({ length: 8 }, (_, i) => ({
  id: `feed-${i}`,
  name: 'Name',
  dept: 'Department',
  position: 'Position',
  ago: '30m Ago',
}));

const lateTodayItems = Array.from({ length: 3 }, (_, i) => ({
  id: `late-${i}`,
  name: 'Name',
  dept: 'Department',
  position: 'Position',
  inTime: '8:32 AM',
  lateBy: '1h 32m',
  streak: 'This Month - 6 days',
}));

const onLeaveItems = Array.from({ length: 3 }, (_, i) => ({
  id: `leave-${i}`,
  name: 'Name',
  dept: 'Department',
  position: 'Position',
  range: 'April 16, 2024 - April 17, 2024',
}));

function PersonSummary(props: { name: string; dept: string; position: string; rightText?: string }) {
  const { name, dept, position, rightText } = props;
  return (
    <div className="mAtt__personRow">
      <div className="mAtt__avatar" aria-hidden="true" />
      <div className="mAtt__personBody">
        <div className="mAtt__personName">{name}</div>
        <div className="mAtt__personMeta">{dept}</div>
        <div className="mAtt__personMeta">{position}</div>
      </div>
      {rightText && <div className="mAtt__personRight">{rightText}</div>}
    </div>
  );
}

export default function ManagementAttendance() {
  return (
    <section className="mAtt">
      <div className="mAtt__top">
        <div>
          <h1>Attendance Dashboard</h1>
          <p>Thursday, April 6, 2024</p>
        </div>

        <button type="button" className="mAtt__exportBtn">
          Export Attendance Analytics
        </button>
      </div>

      <div className="mAtt__grid">
        <div className="mAtt__mainCol">
          <div className="mAtt__stats">
            {statCards.map((item) => (
              <article key={item.label} className="mAtt__statCard">
                <div className="mAtt__statIcon" />
                <div>
                  <div className="mAtt__statLabel">{item.label}</div>
                  <div className="mAtt__statValue">{item.value}</div>
                </div>
              </article>
            ))}
          </div>

          <section className="mAtt__card">
            <header className="mAtt__cardHeader">Attendance per day:</header>
            <div className="mAtt__deptBody">
              <button className="mAtt__navBtn" type="button" aria-label="Previous department">
                <FiChevronLeft />
              </button>

              <div className="mAtt__deptCharts">
                <div className="mAtt__deptIcon" />
                <div className="mAtt__deptIcon" />
                <div className="mAtt__deptIcon" />
              </div>

              <button className="mAtt__navBtn" type="button" aria-label="Next department">
                <FiChevronRight />
              </button>
            </div>
            <div className="mAtt__pager" aria-hidden="true">
              <span />
              <span className="is-active" />
              <span />
            </div>
            <div className="mAtt__legend">
              <span className="mAtt__legendItem">
                <i className="c1" />
                On Time
              </span>
              <span className="mAtt__legendItem">
                <i className="c2" />
                Late
              </span>
              <span className="mAtt__legendItem">
                <i className="c3" />
                Absent
              </span>
              <span className="mAtt__legendItem">
                <i className="c4" />
                On Leave
              </span>
              <span className="mAtt__legendItem">
                <i className="c5" />
                Day Off
              </span>
            </div>
          </section>

          <div className="mAtt__bottomCards">
            <section className="mAtt__card">
              <header className="mAtt__cardHeader">Late Today</header>
              <div className="mAtt__list">
                {lateTodayItems.map((item) => (
                  <div key={item.id} className="mAtt__listItem">
                    <PersonSummary name={item.name} dept={item.dept} position={item.position} />
                    <div className="mAtt__smallMeta">
                      <span>
                        <FiClock />
                        {item.inTime}
                      </span>
                      <span>
                        <FiClock />
                        {item.lateBy}
                      </span>
                      <span>
                        <FiCalendar />
                        {item.streak}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mAtt__card">
              <header className="mAtt__cardHeader">On Leave</header>
              <div className="mAtt__list">
                {onLeaveItems.map((item) => (
                  <div key={item.id} className="mAtt__listItem">
                    <PersonSummary name={item.name} dept={item.dept} position={item.position} />
                    <div className="mAtt__smallMeta">
                      <span>
                        <FiCalendar />
                        {item.range}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <section className="mAtt__card mAtt__feedCard">
          <header className="mAtt__cardHeader">Attendance Feed</header>
          <div className="mAtt__feedList">
            {feedItems.map((item) => (
              <div key={item.id} className="mAtt__feedItem">
                <PersonSummary
                  name={item.name}
                  dept={item.dept}
                  position={item.position}
                  rightText={item.ago}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
