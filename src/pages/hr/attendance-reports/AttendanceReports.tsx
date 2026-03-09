import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import './AttendanceReports.css';

type AttendanceLog = {
  attendanceId?: number;
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function monthCells(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayStart = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }).map((_, idx) => {
    const date = idx - mondayStart + 1;
    return date > 0 && date <= daysInMonth ? date : null;
  });
  return cells;
}

export default function HrAttendanceReports() {
  const now = new Date();
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiFetchJson<unknown>('/api/logs/attendance?page=0&size=1000');
        setLogs(toArray<AttendanceLog>(response));
      } catch {
        setLogs([]);
      }
    })();
  }, []);

  const notesByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    const month = monthIndex + 1;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    for (const log of logs) {
      if (typeof log.timestamp !== 'string') continue;
      if (!log.timestamp.startsWith(monthKey)) continue;

      const day = Number(log.timestamp.slice(8, 10));
      if (!Number.isFinite(day)) continue;
      const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const direction = log.direction || 'LOG';
      const line = `${direction}: ${time}`;

      const current = map.get(day) ?? [];
      if (current.length < 2) current.push(line);
      map.set(day, current);
    }
    return map;
  }, [logs, monthIndex, year]);

  const cells = monthCells(year, monthIndex);

  function onMonthChange(value: string) {
    const [mLabel, yLabel] = value.split(' ');
    const parsedYear = Number(yLabel);
    const date = new Date(`${mLabel} 1, ${yLabel}`);
    if (!Number.isFinite(parsedYear) || Number.isNaN(date.getTime())) return;
    setMonthIndex(date.getMonth());
    setYear(parsedYear);
  }

  const monthOptions = [
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth(), 1),
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  ].map((d) =>
    d.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  );

  return (
    <div className="hrAtt">
      <div className="hrAtt__head">
        <h1 className="hrAtt__title">
          Attendance Report
          <span className="hrAtt__tools">
            <FiSearch />
            <FiFilter />
          </span>
        </h1>
      </div>

      <div className="hrAtt__monthWrap">
        <select className="hrAtt__month" value={monthLabel} onChange={(e) => onMonthChange(e.target.value)}>
          {monthOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <section className="hrAtt__card">
        <div className="hrAtt__monthTitle">{monthLabel.replace(' ', '')}</div>

        <div className="hrAtt__grid">
          {days.map((day) => (
            <div key={day} className="hrAtt__dow">
              {day}
            </div>
          ))}

          {cells.map((date, idx) => (
            <div key={idx} className={`hrAtt__cell ${date === now.getDate() ? 'is-focus' : ''}`}>
              {date !== null && <div className="hrAtt__date">{date}</div>}
              {date !== null && (notesByDay.get(date) ?? []).length > 0 && (
                <div className="hrAtt__notes">
                  {(notesByDay.get(date) ?? []).map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="hrAtt__actions">
        <button className="hrAtt__exportBtn" type="button" onClick={() => window.print()}>
          Export Attendance Report
        </button>
      </div>
    </div>
  );
}
