/**
 * Returns the current date and time parts in Asia/Manila timezone,
 * regardless of the user's local system time.
 */
export function getManilaNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  return {
    year,
    month,
    day,
    hour,
    minute,
    /** YYYY-MM-DD */
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    /** Total minutes from start of day (0-1439) */
    totalMinutes: hour * 60 + minute,
  };
}
