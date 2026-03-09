import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock } from 'react-icons/fi';
import './Attendance.css';

type StatCard = {
  label: string;
  value: number;
};

const statCards: StatCard[] = [
  { label: 'Present', value: 0 },
  { label: 'Absent', value: 0 },
  { label: 'On Time', value: 0 },
  { label: 'Late', value: 0 },
];

const feedItems: Array<{ id: string; name: string; dept: string; position: string; ago: string }> = [];

const lateTodayItems: Array<{
  id: string;
  name: string;
  dept: string;
  position: string;
  inTime: string;
  lateBy: string;
  streak: string;
}> = [];

const onLeaveItems: Array<{
  id: string;
  name: string;
  dept: string;
  position: string;
  range: string;
}> = [];

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

        <button type="button" className="mAtt__exportBtn" onClick={() => window.print()}>
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
                {lateTodayItems.length === 0 ? (
                  <div className="mAtt__listItem">No late attendance records yet.</div>
                ) : (
                  lateTodayItems.map((item) => (
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
                  ))
                )}
              </div>
            </section>

            <section className="mAtt__card">
              <header className="mAtt__cardHeader">On Leave</header>
              <div className="mAtt__list">
                {onLeaveItems.length === 0 ? (
                  <div className="mAtt__listItem">No leave records yet.</div>
                ) : (
                  onLeaveItems.map((item) => (
                    <div key={item.id} className="mAtt__listItem">
                      <PersonSummary name={item.name} dept={item.dept} position={item.position} />
                      <div className="mAtt__smallMeta">
                        <span>
                          <FiCalendar />
                          {item.range}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="mAtt__card mAtt__feedCard">
          <header className="mAtt__cardHeader">Attendance Feed</header>
          <div className="mAtt__feedList">
            {feedItems.length === 0 ? (
              <div className="mAtt__feedItem">No attendance feed data yet.</div>
            ) : (
              feedItems.map((item) => (
                <div key={item.id} className="mAtt__feedItem">
                  <PersonSummary
                    name={item.name}
                    dept={item.dept}
                    position={item.position}
                    rightText={item.ago}
                  />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
