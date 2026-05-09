import { FiTrash2 } from 'react-icons/fi';

import LargePopup from '@/components/dialog/LargePopup';

import {
  formatAnnouncementEventDuration,
  formatAnnouncementMeta,
  type CalendarDayEvent,
  type SelectedAnnouncementDay,
} from '../dashboardShared';

type AnnouncementDayModalProps = {
  announcementHeaderEvent: CalendarDayEvent | null;
  canDeleteSingleAnnouncement: boolean;
  canManageAnnouncements: boolean;
  deletingAnnouncementId: number | null;
  hasSingleAnnouncement: boolean;
  selectedAnnouncementDay: SelectedAnnouncementDay;
  selectedAnnouncementEvents: CalendarDayEvent[];
  onClose: () => void;
  onRequestDelete: (event: CalendarDayEvent) => void;
};

export default function AnnouncementDayModal({
  announcementHeaderEvent,
  canDeleteSingleAnnouncement,
  canManageAnnouncements,
  deletingAnnouncementId,
  hasSingleAnnouncement,
  selectedAnnouncementDay,
  selectedAnnouncementEvents,
  onClose,
  onRequestDelete,
}: AnnouncementDayModalProps) {
  return (
    <LargePopup
      open
      ariaLabel="Company announcements"
      title={announcementHeaderEvent?.title || selectedAnnouncementDay.label}
      subtitle={
        announcementHeaderEvent
          ? formatAnnouncementMeta(announcementHeaderEvent.employeeName, announcementHeaderEvent.createdAt)
          : `${selectedAnnouncementEvents.length} company announcement${selectedAnnouncementEvents.length === 1 ? '' : 's'}`
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          {canDeleteSingleAnnouncement && announcementHeaderEvent ? (
            <button
              type="button"
              className="announcementModal__deleteIconButton"
              onClick={() => onRequestDelete(announcementHeaderEvent)}
              disabled={deletingAnnouncementId === announcementHeaderEvent.calendarId}
              aria-label="Delete Announcement"
              title="Delete Announcement"
            >
              <FiTrash2 aria-hidden="true" />
            </button>
          ) : null}
          {canDeleteSingleAnnouncement ? <span className="announcementModal__footerSpacer" aria-hidden="true" /> : null}
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="announcementModal__list">
        {selectedAnnouncementEvents.map((event) => {
          const isDeleting = deletingAnnouncementId === event.calendarId;
          const showInlineHeader = !hasSingleAnnouncement;
          const showInlineDelete = showInlineHeader && canManageAnnouncements && typeof event.calendarId === 'number';

          return (
            <article key={event.key} className="announcementModal__card">
              {showInlineHeader ? (
                <header className="announcementModal__header">
                  <h3 className="announcementModal__title">{event.title}</h3>
                  <p className="announcementModal__meta">
                    {formatAnnouncementMeta(event.employeeName, event.createdAt)}
                  </p>
                </header>
              ) : null}
              <div className="announcementModal__details">
                <div className="announcementModal__detailRow">
                  <strong className="announcementModal__detailLabel">Event Duration:</strong>
                  <strong className="announcementModal__detailValue">
                    {formatAnnouncementEventDuration(event.startDate, event.endDate)}
                  </strong>
                </div>
                <div className="announcementModal__detailRow announcementModal__detailRow--description">
                  <strong className="announcementModal__detailLabel">Description:</strong>
                  <p className="announcementModal__detailValue announcementModal__detailValue--description">
                    {event.description || 'No description provided for this announcement yet.'}
                  </p>
                </div>
              </div>
              {showInlineDelete ? (
                <div className="announcementModal__cardFooter">
                  <button
                    type="button"
                    className="announcementModal__deleteIconButton announcementModal__deleteIconButton--inline"
                    onClick={() => onRequestDelete(event)}
                    disabled={isDeleting}
                    aria-label={`Delete announcement ${event.title}`}
                    title="Delete announcement"
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </LargePopup>
  );
}
