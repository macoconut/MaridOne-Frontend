import type { CSSProperties } from 'react';

import type { FeedItem } from '../dashboardShared';

type AttendanceFeedPanelProps = {
  emptyStateLabel: string;
  feedPanelHeight: number | null;
  items: FeedItem[];
  selectedDateHeading: string;
  selectedIsHoliday: boolean;
  showHolidayEmptyState: boolean;
  title: string;
};

export default function AttendanceFeedPanel({
  emptyStateLabel,
  feedPanelHeight,
  items,
  selectedDateHeading,
  selectedIsHoliday,
  showHolidayEmptyState,
  title,
}: AttendanceFeedPanelProps) {
  return (
    <section
      className="hrPanel hrFeedPanel"
      style={feedPanelHeight ? ({ height: `${feedPanelHeight}px` } as CSSProperties) : undefined}
    >
      <div className="hrPanel__header">{title}</div>
      <div className="hrPeopleList">
        {items.length > 0 ? (
          items.map((item) => (
            <article key={item.id} className="hrPerson hrPerson--feed">
              <div className="hrPerson__row hrPerson__row--split">
                <div className="hrPerson__name">{item.name}</div>
                <span className={`hrPerson__indicator hrPerson__indicator--${item.directionTone}`}>
                  {item.directionLabel}
                </span>
              </div>
              <div className="hrPerson__row hrPerson__row--split">
                <span className="hrPerson__time">{item.time}</span>
                <span className="hrPerson__meta">{item.position}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="hrEmptyState">
            <div className="hrEmptyState__title">No attendance activity yet.</div>
            <div className="hrEmptyState__note">
              {selectedIsHoliday && showHolidayEmptyState
                ? `${selectedDateHeading} is a holiday, so no logs are expected unless someone worked.`
                : `There are no attendance logs for ${emptyStateLabel}.`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
