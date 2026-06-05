import { describe, expect, it } from 'vitest';
import { mapNotificationItem } from './notificationRouting';

describe('notificationRouting', () => {
  it('routes management leave and overtime review notifications to management approvals', () => {
    expect(
      mapNotificationItem('management', {
        notificationId: 1,
        message: 'New leave request from Ada Lovelace for 2026-06-08 to 2026-06-08.',
      }).destination
    ).toBe('/management/pending-approvals');

    expect(
      mapNotificationItem('management', {
        notificationId: 2,
        message: 'Overtime request from Ada Lovelace for 2026-06-08 is ready for review.',
      }).destination
    ).toBe('/management/pending-approvals');
  });

  it('keeps employee request-decision notifications on self-service approvals', () => {
    expect(
      mapNotificationItem('management', {
        notificationId: 3,
        message: 'Your leave request was endorsed by Management and is now waiting for HR review.',
      }).destination
    ).toBe('/management/self-service/approvals');
  });
});
