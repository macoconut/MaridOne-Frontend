import { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiClock, FiCalendar } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import './Dashboard.css';

type AttendanceLog = {
  attendanceId?: number;
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

type FeedItem = {
  id: string;
  name: string;
  department: string;
  position: string;
  time: string;
};

function localDateKey(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function HrDashboard() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deptPage, setDeptPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs(silent = false) {
      if (!silent) setIsLoading(true);
      setLoadError(null);
      try {
        const response = await apiFetchJson<unknown>('/api/logs/attendance?page=0&size=400');
        if (!cancelled) setLogs(toArray<AttendanceLog>(response));
      } catch (error) {
        if (!cancelled) {
          setLogs([]);
          setLoadError(error instanceof Error ? error.message : 'Failed to load attendance logs.');
        }
      } finally {
        if (!cancelled && !silent) setIsLoading(false);
      }
    }

    void fetchLogs(false);
    const timer = window.setInterval(() => {
      void fetchLogs(true);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshTick]);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const todayLogs = useMemo(() => {
    return logs.filter((log) => localDateKey(log.timestamp) === todayKey);
  }, [logs, todayKey]);

  const presentSet = useMemo(() => {
    const ids = new Set<number>();
    for (const log of todayLogs) {
      if (typeof log.employeeId === 'number') ids.add(log.employeeId);
    }
    return ids;
  }, [todayLogs]);

  const lateSet = useMemo(() => {
    const ids = new Set<number>();
    for (const log of todayLogs) {
      if (typeof log.employeeId !== 'number') continue;
      if (typeof log.direction !== 'string') continue;
      if (log.direction.toUpperCase().includes('LATE')) ids.add(log.employeeId);
    }
    return ids;
  }, [todayLogs]);

  const metricCards = useMemo(
    () => [
      { label: 'Present', value: presentSet.size },
      { label: 'Absent', value: 0 },
      { label: 'On Time', value: Math.max(presentSet.size - lateSet.size, 0) },
      { label: 'Late', value: lateSet.size },
    ],
    [lateSet.size, presentSet.size]
  );

  const attendanceFeed: FeedItem[] = useMemo(() => {
    return [...logs]
      .sort((a, b) => {
        const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
        const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
        return bt - at;
      })
      .slice(0, 10)
      .map((log, idx) => {
        const date = typeof log.timestamp === 'string' ? new Date(log.timestamp) : null;
        const direction = typeof log.direction === 'string' ? log.direction : 'Log';
        return {
          id: String(log.attendanceId ?? idx),
          name: `Employee #${log.employeeId ?? '-'}`,
          department: 'From backend log',
          position: direction,
          time: date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        };
      });
  }, [logs]);
  const lateToday = useMemo(() => {
    return [...todayLogs]
      .filter((log) => typeof log.direction === 'string' && log.direction.toUpperCase().includes('LATE'))
      .slice(0, 6)
      .map((log, idx) => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        return {
          id: String(log.attendanceId ?? idx),
          name: `Employee #${log.employeeId ?? '-'}`,
          department: 'From backend logs',
          position: 'Late log',
          timeIn: time,
          duration: 'N/A',
          period: 'Today',
        };
      });
  }, [todayLogs]);

  const onLeave: Array<{
    id: string;
    name: string;
    department: string;
    position: string;
    period: string;
  }> = [];

  const departments = useMemo(() => {
    const counts = new Map<number, number>();
    for (const log of todayLogs) {
      if (typeof log.employeeId !== 'number') continue;
      counts.set(log.employeeId, (counts.get(log.employeeId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([empId]) => `Employee #${empId}`);
  }, [todayLogs]);
  const maxDeptPage = Math.max(Math.ceil(departments.length / 3) - 1, 0);
  const activeDeptPage = Math.min(deptPage, maxDeptPage);
  const visibleDepartments = departments.slice(activeDeptPage * 3, activeDeptPage * 3 + 3);

  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <div>
          <h1 className="hrDash__title">Attendance Dashboard</h1>
          <p className="hrDash__subtitle">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="hrDash__topActions">
          <button className="hrDash__refreshBtn" type="button" onClick={() => setRefreshTick((t) => t + 1)}>
            Refresh
          </button>
          <button className="hrDash__exportBtn" type="button" onClick={() => window.print()}>
            Export Attendance
            <br />
            Analytics
          </button>
        </div>
      </div>
      {isLoading && <p className="hrDash__subtitle">Loading HR dashboard data...</p>}
      {!isLoading && loadError && <p className="hrDash__subtitle">Failed to load attendance logs: {loadError}</p>}

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
              <button
                className="hrCircleBtn"
                type="button"
                aria-label="Previous department page"
                onClick={() => setDeptPage((p) => Math.max(0, p - 1))}
                disabled={activeDeptPage === 0}
              >
                <FiChevronLeft />
              </button>

              <div className="hrDept__cards">
                {visibleDepartments.length > 0 ? (
                  visibleDepartments.map((dept, idx) => (
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

              <button
                className="hrCircleBtn"
                type="button"
                aria-label="Next department page"
                onClick={() => setDeptPage((p) => (p + 1) * 3 < departments.length ? p + 1 : p)}
                disabled={(activeDeptPage + 1) * 3 >= departments.length}
              >
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
