import { FiSearch, FiXCircle } from 'react-icons/fi';
import './AttendanceReports.css';

const monthLabel = 'April 2024';
const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const timeNotes: Record<number, string[]> = {
  3: ['Time In: 6:55 AM', 'Time Out: 5:10 PM'],
  4: ['Time In: 6:55 AM', 'Time Out: 5:10 PM'],
  5: ['Time In: 6:55 AM', 'Time Out: 5:10 PM'],
  6: ['Time In: 6:55 AM', 'Time Out: N/A'],
};

function buildApril2024Cells() {
  const year = 2024;
  const monthIndex = 3;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayStart = (firstDay.getDay() + 6) % 7;

  return Array.from({ length: 35 }).map((_, idx) => {
    const date = idx - mondayStart + 1;
    return date > 0 && date <= daysInMonth ? date : null;
  });
}

export default function ManagerAttendanceReports() {
  const cells = buildApril2024Cells();

  return (
    <div className="mgrRpt">
      <h1>Attendance Report</h1>

      <div className="mgrRpt__filters">
        <div className="mgrRpt__search">
          <FiSearch />
          <input value="Employee#67" readOnly />
          <button type="button" aria-label="Clear search">
            <FiXCircle />
          </button>
        </div>

        <select className="mgrRpt__month" defaultValue={monthLabel}>
          <option>{monthLabel}</option>
        </select>
      </div>

      <section className="mgrRptCard">
        <div className="mgrRptCard__title">April2024</div>

        <div className="mgrRptCard__grid">
          {days.map((day) => (
            <div key={day} className="mgrRptCard__dow">
              {day}
            </div>
          ))}

          {cells.map((date, idx) => (
            <div key={idx} className={`mgrRptCard__cell ${date === 6 ? 'is-focus' : ''}`}>
              {date !== null && <div className="mgrRptCard__date">{date}</div>}
              {date !== null && timeNotes[date] && (
                <div className="mgrRptCard__notes">
                  {timeNotes[date].map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mgrRpt__actions">
        <button type="button">Export Attendance Report</button>
      </div>
    </div>
  );
}
