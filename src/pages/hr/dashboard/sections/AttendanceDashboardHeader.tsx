import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import PageHeader from '@/components/layout/PageHeader';

type AttendanceDashboardHeaderProps = {
  description?: string;
  isSelectedDateToday: boolean;
  selectedDateHeading: string;
  selectedDateKey: string;
  todayKey: string;
  onSelectDate: (value: string) => void;
  onShiftDate: (days: number) => void;
};

export default function AttendanceDashboardHeader({
  description,
  isSelectedDateToday,
  selectedDateHeading,
  selectedDateKey,
  todayKey,
  onSelectDate,
  onShiftDate,
}: AttendanceDashboardHeaderProps) {
  return (
    <div className="hrDash__top">
      <PageHeader title="Attendance Dashboard" description={description} />
      <div className="hrDash__topActions">
        <div className="hrDash__dateFilter">
          <div className="hrDash__dateNav">
            <button
              className="hrDash__dateArrow"
              type="button"
              aria-label="Previous date"
              onClick={() => onShiftDate(-1)}
            >
              <FiChevronLeft />
            </button>
            <div className="hrDash__dateLabel">
              <strong>{selectedDateHeading}</strong>
            </div>
            <label className="hrDash__calendarTrigger" aria-label="Select a specific date">
              <FiCalendar />
              <input
                type="date"
                value={selectedDateKey}
                max={todayKey}
                onChange={(event) => onSelectDate(event.target.value || todayKey)}
              />
            </label>
            <button
              className="hrDash__dateArrow"
              type="button"
              aria-label="Next date"
              onClick={() => onShiftDate(1)}
              disabled={isSelectedDateToday}
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
