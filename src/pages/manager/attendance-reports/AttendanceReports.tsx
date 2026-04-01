import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import './AttendanceReports.css';

type AttendanceLog = {
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

type DayCell = {
  day: number | null;
  activeCount: number;
  openCount: number;
  totalLogs: number;
};

type DailyEmployeeRecord = {
  employeeId: number;
  firstSeen?: string;
  lastSeen?: string;
  openSession: boolean;
  totalLogs: number;
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function localDateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function isOut(direction?: string) {
  return (direction ?? '').toUpperCase().includes('OUT');
}

function buildMonthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayStart = first.getDay();
  const cells: DayCell[] = [];

  for (let index = 0; index < sundayStart; index += 1) {
    cells.push({ day: null, activeCount: 0, openCount: 0, totalLogs: 0 });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, activeCount: 0, openCount: 0, totalLogs: 0 });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, activeCount: 0, openCount: 0, totalLogs: 0 });
  }
  return cells;
}

function buildDailyRecords(logs: AttendanceLog[]) {
  const grouped = new Map<number, AttendanceLog[]>();
  for (const log of logs) {
    if (typeof log.employeeId !== 'number') continue;
    const current = grouped.get(log.employeeId) ?? [];
    current.push(log);
    grouped.set(log.employeeId, current);
  }

  return [...grouped.entries()]
    .map(([employeeId, rows]) => {
      const sorted = [...rows].sort((a, b) => Date.parse(a.timestamp ?? '') - Date.parse(b.timestamp ?? ''));
      return {
        employeeId,
        firstSeen: sorted[0]?.timestamp,
        lastSeen: sorted[sorted.length - 1]?.timestamp,
        openSession: !isOut(sorted[sorted.length - 1]?.direction),
        totalLogs: sorted.length,
      } satisfies DailyEmployeeRecord;
    })
    .sort((a, b) => a.employeeId - b.employeeId);
}

export default function ManagerAttendanceReports() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [searchValue, setSearchValue] = useState('');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState(toIsoDate(today.getFullYear(), today.getMonth(), today.getDate()));
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const trimmed = searchValue.trim();
    const numericId = Number(trimmed.replace(/[^\d]/g, ''));
    const searchQuery =
      trimmed.length === 0
        ? ''
        : Number.isFinite(numericId) && numericId > 0
          ? `&employeeId=${numericId}`
          : `&firstName=${encodeURIComponent(trimmed)}`;
    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      setError('');
      try {
        const response = await apiFetchJson<unknown>(
          `/api/logs/attendance/team?page=0&size=5000&timestampAfter=${encodeURIComponent(start.toISOString())}&timestampBefore=${encodeURIComponent(end.toISOString())}${searchQuery}`
        );
        if (!cancelled) setLogs(toArray<AttendanceLog>(response));
      } catch (nextError) {
        if (!cancelled) {
          setLogs([]);
          setError(nextError instanceof Error ? nextError.message : 'Failed to load manager attendance reports.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [monthIndex, refreshTick, searchValue, year]);

  useEffect(() => {
    if (year === currentYear && monthIndex === currentMonth) {
      setSelectedDateKey(toIsoDate(currentYear, currentMonth, currentDay));
      return;
    }
    setSelectedDateKey(toIsoDate(year, monthIndex, 1));
  }, [currentDay, currentMonth, currentYear, monthIndex, year]);

  const monthLabel = useMemo(
    () => new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [monthIndex, year]
  );

  const logsByDate = useMemo(() => {
    const grouped = new Map<string, AttendanceLog[]>();
    for (const log of logs) {
      const key = localDateKey(log.timestamp);
      if (!key) continue;
      const current = grouped.get(key) ?? [];
      current.push(log);
      grouped.set(key, current);
    }
    return grouped;
  }, [logs]);

  const calendarCells = useMemo(() => {
    return buildMonthCells(year, monthIndex).map((cell) => {
      if (cell.day === null) return cell;
      const dateKey = toIsoDate(year, monthIndex, cell.day);
      const records = buildDailyRecords(logsByDate.get(dateKey) ?? []);
      return {
        day: cell.day,
        activeCount: records.length,
        openCount: records.filter((record) => record.openSession).length,
        totalLogs: (logsByDate.get(dateKey) ?? []).length,
      } satisfies DayCell;
    });
  }, [logsByDate, monthIndex, year]);

  const selectedRecords = useMemo(() => buildDailyRecords(logsByDate.get(selectedDateKey) ?? []), [logsByDate, selectedDateKey]);
  const selectedSummary = useMemo(
    () => ({
      activeEmployees: selectedRecords.length,
      openSessions: selectedRecords.filter((record) => record.openSession).length,
      totalLogs: (logsByDate.get(selectedDateKey) ?? []).length,
    }),
    [logsByDate, selectedDateKey, selectedRecords]
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, index) =>
        new Date(currentYear, index, 1).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
      ),
    [currentYear]
  );

  function parseMonthValue(value: string) {
    const parsed = new Date(`1 ${value}`);
    if (!Number.isNaN(parsed.getTime())) {
      setMonthIndex(parsed.getMonth());
      setYear(parsed.getFullYear());
    }
  }

  return (
    <div className="mgrRpt">
      <div className="mgrRpt__top">
        <div>
          <h1>Attendance Report</h1>
          <p>
            Search by employee ID or first name. The current manager endpoint still returns logs only, so names are not displayed in the results yet.
          </p>
        </div>
        <div className="mgrRpt__actions">
          <button type="button" className="mgrRpt__action mgrRpt__action--ghost" onClick={() => setRefreshTick((tick) => tick + 1)}>
            Refresh
          </button>
          <button type="button" className="mgrRpt__action" onClick={() => window.print()}>
            Export Report
          </button>
        </div>
      </div>

      <div className="mgrRpt__filters">
        <div className="mgrRpt__search">
          <FiSearch />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Employee ID or first name"
          />
          <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
            <FiXCircle />
          </button>
        </div>

        <select className="mgrRpt__month" value={monthLabel} onChange={(event) => parseMonthValue(event.target.value)}>
          {monthOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="mgrRpt__hint">Loading attendance report...</p>}
      {!loading && error && <p className="mgrRpt__error">{error}</p>}

      <section className="mgrRptCard">
        <div className="mgrRptCard__title">{monthLabel}</div>
        <div className="mgrRptCard__grid">
          {DAYS.map((day) => (
            <div key={day} className="mgrRptCard__dow">
              {day}
            </div>
          ))}

          {calendarCells.map((cell, index) => {
            if (cell.day === null) {
              return <div key={`empty-${index}`} className="mgrRptCard__cell mgrRptCard__cell--disabled" aria-hidden="true" />;
            }

            const dateKey = toIsoDate(year, monthIndex, cell.day);
            const isSelected = dateKey === selectedDateKey;

            return (
              <button
                key={dateKey}
                type="button"
                className={`mgrRptCard__cell mgrRptCard__cell--click ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelectedDateKey(dateKey)}
              >
                <div className="mgrRptCard__date">{cell.day}</div>
                <div className="mgrRptCard__stats">
                  <span>Employees: {cell.activeCount}</span>
                  <span>Open: {cell.openCount}</span>
                  <span>Logs: {cell.totalLogs}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mgrRptBreakdown">
        <div className="mgrRptBreakdown__top">
          <div>
            <div className="mgrRptBreakdown__eyebrow">Selected Date</div>
            <h2>{selectedDateKey}</h2>
          </div>
          <div className="mgrRptSummary">
            <article><span>Employees</span><strong>{selectedSummary.activeEmployees}</strong></article>
            <article><span>Open Sessions</span><strong>{selectedSummary.openSessions}</strong></article>
            <article><span>Total Logs</span><strong>{selectedSummary.totalLogs}</strong></article>
          </div>
        </div>

        <div className="mgrRptRows">
          {selectedRecords.length > 0 ? (
            selectedRecords.map((record) => (
              <article key={`${selectedDateKey}-${record.employeeId}`} className="mgrRptRow">
                <div className="mgrRptRow__avatar">{record.employeeId}</div>
                <div>
                  <div className="mgrRptRow__title">Employee #{record.employeeId}</div>
                  <div className="mgrRptRow__meta">
                    First log: {formatDateTime(record.firstSeen)} • Last log: {formatDateTime(record.lastSeen)}
                  </div>
                </div>
                <div className={`mgrRptRow__badge ${record.openSession ? 'is-open' : 'is-complete'}`}>
                  {record.openSession ? 'Open Session' : 'Closed'}
                </div>
              </article>
            ))
          ) : (
            <div className="mgrRptRows__empty">No team attendance logs were returned for the selected day.</div>
          )}
        </div>
      </section>
    </div>
  );
}
