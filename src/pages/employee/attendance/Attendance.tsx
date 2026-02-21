import { useEffect, useMemo, useState } from 'react';
import './Attendance.css';
import { FiPlusSquare, FiX, FiUpload, FiCalendar } from 'react-icons/fi';

type LeaveType = 'Sick Leave' | 'Vacation Leave' | 'Emergency Leave' | 'Others';

type DayCell = {
  day: number | null;
  note?: string;
  variant?: 'approved' | 'pending' | 'holiday';
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toISODate(year: number, monthIndex: number, day: number) {
  // monthIndex: 0-based
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export default function Attendance() {
  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const [monthValue, setMonthValue] = useState(monthLabel);

  // Leave modal state
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [leaveType, setLeaveType] = useState<LeaveType>('Sick Leave');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (leaveOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [leaveOpen]);

  const calendarCells = useMemo(() => {
    // Build a Sunday-last calendar (MO..SU) like your screenshot
    const first = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // JS getDay(): 0=Sun..6=Sat
    // We want Monday-based: MO=0..SU=6
    const jsDay = first.getDay();
    const mondayBased = (jsDay + 6) % 7; // convert so Mon=0

    const cells: DayCell[] = [];
    // leading blanks
    for (let i = 0; i < mondayBased; i++) cells.push({ day: null });

    // actual days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d });
    }

    // trailing blanks to fill full weeks
    while (cells.length % 7 !== 0) cells.push({ day: null });

    return cells;
  }, [monthIndex, year]);

  function openLeaveForDay(day: number) {
    setSelectedDay(day);
    const iso = toISODate(year, monthIndex, day);
    setStartDate(iso);
    setEndDate(iso);
    setLeaveType('Sick Leave');
    setReason('');
    setFile(null);
    setLeaveOpen(true);
  }

  function closeLeave() {
    setLeaveOpen(false);
  }

  function submitLeave() {
    console.log('LEAVE SUBMIT', {
      leaveType,
      startDate,
      endDate,
      reason,
      fileName: file?.name ?? null,
      selectedDay,
    });
    setLeaveOpen(false);
  }

  return (
    <div className="att">
      {/* Title row */}
      <div className="att__head">
        <div className="att__titleWrap">
          <h1 className="att__title">Attendance</h1>

          <div className="att__monthSelectWrap">
            <select
              className="att__monthSelect"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
            >
              <option>{monthLabel}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar card */}
      <section className="attCard">
        <div className="attCard__monthBar">
          <div className="attCard__monthLabel">{monthValue}</div>
        </div>

        <div className="cal">
          <div className="cal__dow">MO</div>
          <div className="cal__dow">TU</div>
          <div className="cal__dow">WE</div>
          <div className="cal__dow">TH</div>
          <div className="cal__dow">FR</div>
          <div className="cal__dow">SA</div>
          <div className="cal__dow">SU</div>

          {calendarCells.map((c, idx) => {
            const clickable = c.day !== null;
            const cls = [
              'cal__cell',
              clickable ? 'cal__cell--click' : 'cal__cell--empty',
              c.variant ? `cal__cell--${c.variant}` : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={idx}
                type="button"
                className={cls}
                disabled={!clickable}
                onClick={() => c.day && openLeaveForDay(c.day)}
                aria-label={c.day ? `Open leave form for ${monthValue} ${c.day}` : 'Empty'}
              >
                {c.day && <div className="cal__day">{c.day}</div>}
                {c.note && <div className="cal__note">{c.note}</div>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom buttons like figma */}
      <div className="attActions">
        <button className="attBtn" type="button" onClick={() => openLeaveForDay(selectedDay ?? 7)}>
          <span>Request Leave</span>
          <span className="attBtn__icon">
            <FiPlusSquare />
          </span>
        </button>

        <button
          className="attBtn"
          type="button"
          disabled
        >
          <span>Request OT</span>
          <span className="attBtn__icon">
            <FiPlusSquare />
          </span>
        </button>
      </div>

      {/* Leave Modal */}
      {leaveOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="Leave Application">
          <div className="modal">
            <div className="modal__top">
              <div className="modal__title">LEAVE APPLICATION FORM</div>
              <button className="modal__close" type="button" onClick={closeLeave} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="modal__rule" />

            <div className="form">
              <div className="formRow">
                <label className="label">Type of Leave Requested:</label>
                <select
                  className="input"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                >
                  <option>Sick Leave</option>
                  <option>Vacation Leave</option>
                  <option>Emergency Leave</option>
                  <option>Others</option>
                </select>
              </div>

              <div className="formRow formRow--2">
                <div className="field">
                  <label className="label">Start Date:</label>
                  <div className="inputIcon">
                    <input
                      className="input"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>

                <div className="field">
                  <label className="label">End Date:</label>
                  <div className="inputIcon">
                    <input
                      className="input"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                    <FiCalendar className="inputIcon__icon" />
                  </div>
                </div>
              </div>

              <div className="formRow">
                <label className="label">Reason for Leave:</label>
                <textarea
                  className="textarea"
                  placeholder="Enter reason for leave"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="formRow">
                <label className="label">Supporting Documents (if any):</label>
                <div className="upload">
                  <label className="uploadBtn">
                    <FiUpload />
                    <span>{file ? file.name : 'Upload Here'}</span>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <div className="modalActions">
                <button className="btn btn--ghost" type="button" onClick={closeLeave}>
                  Cancel
                </button>
                <button className="btn" type="button" onClick={submitLeave}>
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
