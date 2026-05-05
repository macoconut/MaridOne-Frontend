import { FiCalendar, FiPlusSquare } from 'react-icons/fi';
import PageHeader from '@/components/layout/PageHeader';

type AttendanceHeaderProps = {
  isClockOutAction: boolean;
  isClocking: boolean;
  onOpenSchedule: () => void;
  onRequestAttendanceConfirmation: () => void;
  onTimecardModeChange: (value: 'calendar' | 'timecard') => void;
  timecardMode: 'calendar' | 'timecard';
};

export default function AttendanceHeader({
  isClockOutAction,
  isClocking,
  onOpenSchedule,
  onRequestAttendanceConfirmation,
  onTimecardModeChange,
  timecardMode,
}: AttendanceHeaderProps) {
  return (
    <div className="att__head">
      <PageHeader
        title="Attendance"
        description="Review your work logs through the monthly calendar or a downloadable timecard."
      />
      <div className="att__controls">
        <label className="attModeSelect attModeSelect--view" aria-label="Attendance view">
          <select value={timecardMode} onChange={(event) => onTimecardModeChange(event.target.value as 'calendar' | 'timecard')}>
            <option value="calendar">By Calendar</option>
            <option value="timecard">By Timecard</option>
          </select>
        </label>
        <button className="attClockBtn attClockBtn--schedule" type="button" onClick={onOpenSchedule} title="View My Schedule">
          <span>My Schedule</span>
          <span className="attClockBtn__icon">
            <FiCalendar />
          </span>
        </button>
        <button
          className="attClockBtn"
          type="button"
          onClick={onRequestAttendanceConfirmation}
          disabled={isClocking}
          title={isClocking ? 'Submitting attendance' : isClockOutAction ? 'Time Out' : 'Time In'}
        >
          <span>{isClocking ? 'Submitting...' : isClockOutAction ? 'Time Out' : 'Time In'}</span>
          <span className="attClockBtn__icon">
            <FiPlusSquare />
          </span>
        </button>
      </div>
    </div>
  );
}
