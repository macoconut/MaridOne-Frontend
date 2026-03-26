import { useEffect, useMemo, useState } from 'react';
import './AttendanceDashboard.css';
import { apiFetchJson, toArray } from '../../../lib/api';

type AttendanceLog = {
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function localDateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function formatDirection(direction?: string) {
  const value = (direction ?? '').toUpperCase();
  if (value.includes('OUT')) return 'Time Out';
  if (value.includes('LATE')) return 'Late Time In';
  if (value.includes('IN')) return 'Time In';
  return value || 'Unknown';
}

function isOut(direction?: string) {
  return (direction ?? '').toUpperCase().includes('OUT');
}

export default function ManagerAttendanceDashboard() {
  const today = new Date();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    let cancelled = false;

    async function loadLogs() {
      setIsLoading(true);
      setError('');
      try {
        const response = await apiFetchJson<unknown>(
          `/api/logs/attendance/team?page=0&size=5000&timestampAfter=${encodeURIComponent(start.toISOString())}&timestampBefore=${encodeURIComponent(end.toISOString())}`
        );
        if (!cancelled) setLogs(toArray<AttendanceLog>(response));
      } catch (nextError) {
        if (!cancelled) {
          setLogs([]);
          setError(nextError instanceof Error ? nextError.message : 'Failed to load team attendance.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const todayKey = localDateKey(new Date().toISOString());
  const logsToday = useMemo(() => logs.filter((log) => localDateKey(log.timestamp) === todayKey), [logs, todayKey]);
  const activeToday = useMemo(
    () => new Set(logsToday.map((log) => log.employeeId).filter((id): id is number => typeof id === 'number')).size,
    [logsToday]
  );
  const outToday = useMemo(() => logsToday.filter((log) => isOut(log.direction)).length, [logsToday]);
  const openSessions = useMemo(() => {
    const latest = new Map<number, AttendanceLog>();
    for (const log of logsToday) {
      if (typeof log.employeeId !== 'number') continue;
      const current = latest.get(log.employeeId);
      if (!current || Date.parse(log.timestamp ?? '') >= Date.parse(current.timestamp ?? '')) latest.set(log.employeeId, log);
    }
    return [...latest.values()].filter((log) => !isOut(log.direction));
  }, [logsToday]);

  const recentActivity = useMemo(
    () => [...logs].filter((log) => typeof log.employeeId === 'number').sort((a, b) => Date.parse(b.timestamp ?? '') - Date.parse(a.timestamp ?? '')).slice(0, 8),
    [logs]
  );

  const dailyCards = useMemo(() => {
    return [2, 1, 0].map((offset) => {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      const key = localDateKey(day.toISOString());
      const dayLogs = logs.filter((log) => localDateKey(log.timestamp) === key);
      return {
        label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        active: new Set(dayLogs.map((log) => log.employeeId).filter((id): id is number => typeof id === 'number')).size,
        inLogs: dayLogs.filter((log) => !isOut(log.direction)).length,
        outLogs: dayLogs.filter((log) => isOut(log.direction)).length,
      };
    });
  }, [logs]);

  const topMembers = useMemo(() => {
    const totals = new Map<number, number>();
    for (const log of logs) {
      if (typeof log.employeeId !== 'number') continue;
      totals.set(log.employeeId, (totals.get(log.employeeId) ?? 0) + 1);
    }
    return [...totals.entries()]
      .map(([employeeId, total]) => ({ employeeId, total }))
      .sort((a, b) => b.total - a.total || a.employeeId - b.employeeId)
      .slice(0, 8);
  }, [logs]);

  return (
    <div className="mgrAtt">
      <div className="mgrAtt__top">
        <div>
          <h1>Attendance Dashboard</h1>
          <p>
            Log-based manager view for {today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
          </p>
        </div>
        <div className="mgrAtt__actions">
          <button type="button" className="mgrAtt__btn mgrAtt__btn--ghost" onClick={() => setRefreshTick((tick) => tick + 1)}>
            Refresh
          </button>
          <button type="button" className="mgrAtt__btn" onClick={() => window.print()}>
            Export Attendance
          </button>
        </div>
      </div>

      <p className="mgrAtt__hint">
        This page uses manager team attendance logs only. Employee names, departments, late tagging, and leave status are still not returned by the current backend.
      </p>

      {isLoading && <p className="mgrAtt__hint">Loading team attendance...</p>}
      {!isLoading && error && <p className="mgrAtt__error">{error}</p>}

      <div className="mgrAttStats">
        <article><span>Active Today</span><strong>{activeToday}</strong></article>
        <article><span>Logs Today</span><strong>{logsToday.length}</strong></article>
        <article><span>Clock Outs Today</span><strong>{outToday}</strong></article>
        <article><span>Open Sessions</span><strong>{openSessions.length}</strong></article>
      </div>

      <section className="mgrAttPanel">
        <div className="mgrAttPanel__head">Daily Team Activity</div>
        <div className="mgrAttDays">
          {dailyCards.map((card) => (
            <article key={card.label} className="mgrAttDay">
              <div className="mgrAttDay__label">{card.label}</div>
              <div className="mgrAttDay__value">{card.active}</div>
              <div className="mgrAttDay__meta">Employees with logs</div>
              <div className="mgrAttDay__breakdown">
                <span>IN/Late: {card.inLogs}</span>
                <span>OUT: {card.outLogs}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="mgrAttGrid">
        <section className="mgrAttPanel">
          <div className="mgrAttPanel__head">Latest Team Activity</div>
          <div className="mgrAttList">
            {recentActivity.length > 0 ? recentActivity.map((log, index) => (
              <article key={`${log.employeeId}-${log.timestamp}-${index}`} className="mgrAttRow">
                <div className="mgrAttRow__avatar">{log.employeeId}</div>
                <div>
                  <div className="mgrAttRow__title">Employee #{log.employeeId}</div>
                  <div className="mgrAttRow__meta">{formatDirection(log.direction)}</div>
                </div>
                <div className="mgrAttRow__time">{formatDateTime(log.timestamp)}</div>
              </article>
            )) : <div className="mgrAttList__empty">No team activity has been returned yet.</div>}
          </div>
        </section>

        <section className="mgrAttPanel">
          <div className="mgrAttPanel__head">Open Attendance Sessions</div>
          <div className="mgrAttList">
            {openSessions.length > 0 ? openSessions.map((log, index) => (
              <article key={`${log.employeeId}-${log.timestamp}-${index}`} className="mgrAttRow mgrAttRow--soft">
                <div className="mgrAttRow__avatar">{log.employeeId}</div>
                <div>
                  <div className="mgrAttRow__title">Employee #{log.employeeId}</div>
                  <div className="mgrAttRow__meta">{formatDirection(log.direction)}</div>
                </div>
                <div className="mgrAttRow__time">{formatDateTime(log.timestamp)}</div>
              </article>
            )) : <div className="mgrAttList__empty">No open sessions are visible today.</div>}
          </div>
        </section>
      </div>

      <section className="mgrAttPanel">
        <div className="mgrAttPanel__head">Most Active Team Members This Month</div>
        <div className="mgrAttLeaders">
          {topMembers.length > 0 ? topMembers.map((member) => (
            <article key={member.employeeId} className="mgrAttLeader">
              <span>Employee #{member.employeeId}</span>
              <strong>{member.total} logs</strong>
            </article>
          )) : <div className="mgrAttList__empty">Monthly team totals are not available yet.</div>}
        </div>
      </section>
    </div>
  );
}
