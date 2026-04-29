import { describe, expect, it } from 'vitest';
import { formatAnnouncementMeta } from './dashboardShared';

describe('formatAnnouncementMeta', () => {
  it('uses an ASCII separator for the created-at label', () => {
    const result = formatAnnouncementMeta('Emily Anne Davis', '2026-02-18T09:40:00+08:00');

    expect(result).toContain('Posted by Emily Anne Davis | ');
    expect(result).not.toMatch(/[Ãâ]/);
  });

  it('falls back to author-only text when the created date is unavailable', () => {
    expect(formatAnnouncementMeta('Emily Anne Davis')).toBe('Posted by Emily Anne Davis');
  });
});
