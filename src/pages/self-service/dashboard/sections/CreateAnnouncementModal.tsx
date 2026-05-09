import LargePopup from '@/components/dialog/LargePopup';

import type { AnnouncementDraft } from '../dashboardShared';

type CreateAnnouncementModalProps = {
  announcementDraft: AnnouncementDraft;
  createAnnouncementSubmitAttempted: boolean;
  creatingAnnouncement: boolean;
  onClose: () => void;
  onSetField: <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => void;
  onSetStartDateTime: (value: string) => void;
  onSubmit: () => void;
};

export default function CreateAnnouncementModal({
  announcementDraft,
  createAnnouncementSubmitAttempted,
  creatingAnnouncement,
  onClose,
  onSetField,
  onSetStartDateTime,
  onSubmit,
}: CreateAnnouncementModalProps) {
  return (
    <LargePopup
      open
      ariaLabel="Create announcement"
      title="Create Announcement"
      subtitle="Share a company-wide announcement on the calendar."
      size="lg"
      onClose={onClose}
      closeDisabled={creatingAnnouncement}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={creatingAnnouncement}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onSubmit} disabled={creatingAnnouncement}>
            {creatingAnnouncement ? 'Creating...' : 'Publish Announcement'}
          </button>
        </>
      }
    >
      <div className="dashModal__grid">
        <label className="dashModal__field dashModal__field--full">
          <span>Announcement Title</span>
          <input
            value={announcementDraft.title}
            maxLength={120}
            aria-invalid={
              createAnnouncementSubmitAttempted && announcementDraft.title.trim().length === 0 ? 'true' : undefined
            }
            onChange={(event) => onSetField('title', event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>Start Date and Time</span>
          <input
            type="datetime-local"
            value={announcementDraft.startDateTime}
            aria-invalid={createAnnouncementSubmitAttempted && !announcementDraft.startDateTime ? 'true' : undefined}
            onChange={(event) => onSetStartDateTime(event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>End Date and Time</span>
          <input
            type="datetime-local"
            value={announcementDraft.endDateTime}
            min={announcementDraft.startDateTime || undefined}
            aria-invalid={createAnnouncementSubmitAttempted && !announcementDraft.endDateTime ? 'true' : undefined}
            onChange={(event) => onSetField('endDateTime', event.target.value)}
          />
        </label>
        <label className="dashModal__field dashModal__field--full">
          <span>Description</span>
          <textarea
            value={announcementDraft.description}
            maxLength={500}
            rows={6}
            placeholder="Optional announcement details"
            onChange={(event) => onSetField('description', event.target.value)}
          />
        </label>
      </div>
    </LargePopup>
  );
}
