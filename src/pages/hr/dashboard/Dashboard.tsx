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

type LeaveRequest = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  isPaid?: boolean;
};

type FeedItem = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  time: string;
};

type LeaveCardItem = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  period: string;
};

function localDateKey(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPeriodLabel(start?: string, end?: string) {
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

function isTodayWithin(start?: string, end?: string, today = new Date()) {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

  return startDate.getTime() <= dayEnd && endDate.getTime() >= dayStart;
}

export default function HrDashboard() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deptPage, setDeptPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData(silent = false) {
      if (!silent) setIsLoading(true);
      setLoadError(null);

      const [logsResult, leavesResult] = await Promise.allSettled([
        apiFetchJson<unknown>('/api/logs/attendance?page=0&size=400'),
        apiFetchJson<unknown>('/api/leave/request?page=0&size=200'),
      ]);

      if (cancelled) return;

      if (logsResult.status === 'fulfilled') {
        setLogs(toArray<AttendanceLog>(logsResult.value));
      } else {
        setLogs([]);
        setLoadError(logsResult.reason instanceof Error ? logsResult.reason.message : 'Failed to load attendance logs.');
      }

      if (leavesResult.status === 'fulfilled') {
        setLeaveRequests(toArray<LeaveRequest>(leavesResult.value));
      } else {
        setLeaveRequests([]);
      }

      if (!silent) setIsLoading(false);
    }

    void fetchDashboardData(false);
    const timer = window.setInterval(() => {
      void fetchDashboardData(true);
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
      { label: 'Attendance Logs', value: todayLogs.length },
      { label: 'On Time', value: Math.max(presentSet.size - lateSet.size, 0) },
      { label: 'Late', value: lateSet.size },
    ],
    [lateSet.size, presentSet.size, todayLogs.length]
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
        const direction = typeof log.direction === 'string' ? log.direction : 'Attendance log';
        return {
          id: String(log.attendanceId ?? idx),
          name: `Employee ID ${log.employeeId ?? '-'}`,
          summary: direction,
          detail: date
            ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recorded recently',
          time: date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        };
      });
  }, [logs]);

  const lateToday = useMemo(() => {
    return [...todayLogs]
      .filter((log) => typeof log.direction === 'string' && log.direction.toUpperCase().includes('LATE'))
      .slice(0, 6)
      .map((log, idx) => {
        const time = log.timestamp
          ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'N/A';

        return {
          id: String(log.attendanceId ?? idx),
          name: `Employee ID ${log.employeeId ?? '-'}`,
          summary: 'Late attendance entry',
          detail: `Direction: ${String(log.direction ?? 'UNKNOWN')}`,
          timeIn: time,
          duration: lateSet.has(log.employeeId ?? -1) ? 'Late flag active' : 'Under review',
          period: 'Today',
        };
      });
  }, [lateSet, todayLogs]);

  const onLeave: LeaveCardItem[] = useMemo(() => {
    return leaveRequests
      .filter((request) => String(request.requestStatus ?? '').toUpperCase() === 'APPROVED')
      .filter((request) => isTodayWithin(request.startDateTime, request.endDateTime, now))
      .slice(0, 6)
      .map((request, idx) => ({
        id: String(request.requestId ?? idx),
        name: `Employee ID ${request.empId ?? '-'}`,
        summary: request.isPaid ? 'Paid leave' : 'Unpaid leave',
        detail: request.reason?.trim() || 'Approved leave request',
        period: formatPeriodLabel(request.startDateTime, request.endDateTime),
      }));
  }, [leaveRequests, now]);

  const activityLeaders = useMemo(() => {
    const activity = new Map<number, { logCount: number; lateCount: number }>();

    for (const log of todayLogs) {
      if (typeof log.employeeId !== 'number') continue;
      const current = activity.get(log.employeeId) ?? { logCount: 0, lateCount: 0 };
      current.logCount += 1;
      if (String(log.direction ?? '').toUpperCase().includes('LATE')) current.lateCount += 1;
      activity.set(log.employeeId, current);
    }

    return [...activity.entries()]
      .sort((a, b) => b[1].logCount - a[1].logCount || b[1].lateCount - a[1].lateCount)
      .map(([employeeId, counts]) => ({
        id: String(employeeId),
        name: `Employee ID ${employeeId}`,
        logCount: counts.logCount,
        lateCount: counts.lateCount,
      }));
  }, [todayLogs]);

  const maxDeptPage = Math.max(Math.ceil(activityLeaders.length / 3) - 1, 0);
  const activeDeptPage = Math.min(deptPage, maxDeptPage);
  const visibleLeaders = activityLeaders.slice(activeDeptPage * 3, activeDeptPage * 3 + 3);

  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <div>
          <h1 className="hrDash__title">Attendance Dashboard</h1>
          <p className="hrDash__subtitle">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
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
            <div className="hrPanel__header">Most Active Employees Today</div>
            <div className="hrDept">
              <button
                className="hrCircleBtn"
                type="button"
                aria-label="Previous activity page"
                onClick={() => setDeptPage((p) => Math.max(0, p - 1))}
                disabled={activeDeptPage === 0}
              >
                <FiChevronLeft />
              </button>

              <div className="hrDept__cards">
                {visibleLeaders.length > 0 ? (
                  visibleLeaders.map((leader) => (
                    <div key={leader.id} className="hrDonutCard">
                      <div className="hrDonut" />
                      <div className="hrDonutCard__name">{leader.name}</div>
                      <div className="hrDonutCard__meta">
                        {leader.logCount} log{leader.logCount === 1 ? '' : 's'}
                        {leader.lateCount > 0 ? ` • ${leader.lateCount} late` : ' • on time today'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="hrDonutCard">
                    <div className="hrDonutCard__name">No attendance logs recorded yet.</div>
                  </div>
                )}
              </div>

              <button
                className="hrCircleBtn"
                type="button"
                aria-label="Next activity page"
                onClick={() => setDeptPage((p) => ((p + 1) * 3 < activityLeaders.length ? p + 1 : p))}
                disabled={(activeDeptPage + 1) * 3 >= activityLeaders.length}
              >
                <FiChevronRight />
              </button>
            </div>

            <div className="hrPager" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>

            <div className="hrLegend hrLegend--note">
              <span className="hrLegend__note">Leaderboard is based on today&apos;s attendance log activity only.</span>
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
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
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
                      <div className="hrPerson__name">No late attendance entries today.</div>
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
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
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
                      <div className="hrPerson__name">No approved leave requests covering today.</div>
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
                    <div className="hrPerson__meta">{item.summary}</div>
                    <div className="hrPerson__meta">{item.detail}</div>
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
