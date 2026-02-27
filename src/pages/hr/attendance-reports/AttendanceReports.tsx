import { FiSearch, FiFilter } from 'react-icons/fi';
import './AttendanceReports.css';

const monthLabel = 'Select Month';
const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const timeNotes: Record<number, string[]> = {};

function buildApril2024Cells() {
  const year = 2024;
  const monthIndex = 3;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayStart = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: 35 }).map((_, idx) => {
    const date = idx - mondayStart + 1;
    return date > 0 && date <= daysInMonth ? date : null;
  });
  return cells;
}

export default function HrAttendanceReports() {
  const cells = buildApril2024Cells();

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
        <select className="hrAtt__month" defaultValue={monthLabel}>
          <option>{monthLabel}</option>
        </select>
      </div>

      <section className="hrAtt__card">
        <div className="hrAtt__monthTitle">No month selected</div>

        <div className="hrAtt__grid">
          {days.map((day) => (
            <div key={day} className="hrAtt__dow">
              {day}
            </div>
          ))}

          {cells.map((date, idx) => (
            <div key={idx} className={`hrAtt__cell ${date === 6 ? 'is-focus' : ''}`}>
              {date !== null && <div className="hrAtt__date">{date}</div>}
              {date !== null && timeNotes[date] && (
                <div className="hrAtt__notes">
                  {timeNotes[date].map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="hrAtt__actions">
        <button className="hrAtt__exportBtn" type="button">
          Export Attendance Report
        </button>
      </div>
    </div>
  );
}
