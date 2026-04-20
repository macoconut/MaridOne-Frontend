import type { CSSProperties } from 'react';

import { FiPlus } from 'react-icons/fi';

import type { CalendarDayEvent } from '../dashboardShared';

type CompanyEventsCalendarProps = {
  calendarEventsByDay: Map<number, CalendarDayEvent[]>;
  calendarGridStyle: CSSProperties;
  calendarMonthIndex: number;
  calendarYear: number;
  canManageAnnouncements: boolean;
  daysInMonth: number;
  monthLabel: string;
  sundayBasedStart: number;
  totalCells: number;
  onNextMonth: () => void;
  onOpenAnnouncementDay: (dayNumber: number, events: CalendarDayEvent[]) => void;
  onOpenCreateAnnouncementModal: () => void;
  onPreviousMonth: () => void;
};

export default function CompanyEventsCalendar({
  calendarEventsByDay,
  calendarGridStyle,
  calendarMonthIndex,
  calendarYear,
  canManageAnnouncements,
  daysInMonth,
  monthLabel,
  sundayBasedStart,
  totalCells,
  onNextMonth,
  onOpenAnnouncementDay,
  onOpenCreateAnnouncementModal,
  onPreviousMonth,
}: CompanyEventsCalendarProps) {
  return (
    <div className="cardX cardX--calendar">
      <div className="cardX__titleBar">
        <div className="cardX__title">Company Events</div>
        {canManageAnnouncements ? (
          <button type="button" className="cardX__manageBtn" onClick={onOpenCreateAnnouncementModal}>
            <FiPlus aria-hidden="true" />
            <span>Create Announcement</span>
          </button>
        ) : null}
      </div>
      <div className="calendarShell" aria-label="Company events calendar">
        <div className="calendarShell__top">
          <button type="button" className="calendarShell__navBtn" onClick={onPreviousMonth} aria-label="Previous month">
            ‹
          </button>
          <strong>{monthLabel}</strong>
          <button type="button" className="calendarShell__navBtn" onClick={onNextMonth} aria-label="Next month">
            ›
          </button>
        </div>

        <div className="calendarGrid" style={calendarGridStyle}>
          <div className="calHead">SU</div>
          <div className="calHead">MO</div>
          <div className="calHead">TU</div>
          <div className="calHead">WE</div>
          <div className="calHead">TH</div>
          <div className="calHead">FR</div>
          <div className="calHead">SA</div>

          {Array.from({ length: totalCells }).map((_, index) => {
            const dayNumber = index - sundayBasedStart + 1;
            const value = dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : '';
            const dayEvents = typeof value === 'number' ? calendarEventsByDay.get(value) ?? [] : [];
            const primaryDayEvent = dayEvents[0];
            const dayLabel =
              typeof value === 'number'
                ? new Date(calendarYear, calendarMonthIndex, value).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '';
            const cellTitle =
              dayEvents.length > 0
                ? `${dayEvents.map((event) => event.title).join(' • ')}. Click to view announcement details.`
                : undefined;
            const cellContent = (
              <>
                {typeof value === 'number' ? <span className="calCell__day">{value}</span> : null}
                {primaryDayEvent ? (
                  <div className="calCell__events">
                    <span className="calCell__event">{primaryDayEvent.title}</span>
                    {dayEvents.length > 1 ? <span className="calCell__more">+{dayEvents.length - 1} more</span> : null}
                  </div>
                ) : null}
              </>
            );

            if (dayEvents.length > 0 && typeof value === 'number') {
              return (
                <button
                  key={index}
                  type="button"
                  className="calCell calCell--button is-event"
                  title={cellTitle}
                  aria-label={`View ${dayEvents.length} company announcement${dayEvents.length === 1 ? '' : 's'} for ${dayLabel}`}
                  onClick={() => onOpenAnnouncementDay(value, dayEvents)}
                >
                  {cellContent}
                </button>
              );
            }

            return (
              <div key={index} className="calCell" title={cellTitle}>
                {cellContent}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
