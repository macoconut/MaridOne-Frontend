export type RequestPresentationSource = 'leave' | 'overtime';

export function formatRequestTypeLabel(value?: string) {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRequestPeriodLabel(
  source: RequestPresentationSource,
  start?: string,
  end?: string,
  workDate?: string
) {
  const resolvedStart = source === 'overtime' ? start || workDate : start;
  const resolvedEnd = source === 'overtime' ? end || start || workDate : end;
  const startDateLabel = formatDateOnly(resolvedStart);
  const endDateLabel = formatDateOnly(resolvedEnd);
  if (startDateLabel === '-' && endDateLabel === '-') return '-';
  if (startDateLabel === endDateLabel) return startDateLabel;
  return `${startDateLabel} to ${endDateLabel}`;
}

export function formatRequestTimeRangeLabel(start?: string, end?: string) {
  const startTimeLabel = formatTimeOnly(start);
  const endTimeLabel = formatTimeOnly(end);
  if (startTimeLabel === '-' && endTimeLabel === '-') return '-';
  return `${startTimeLabel} to ${endTimeLabel}`;
}

export function formatLeaveDurationLabel(start?: string, end?: string) {
  if (!start || !end) return '-';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '-';

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diffDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);
  return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

export function buildRequestSummaryMessage(
  source: RequestPresentationSource,
  typeLabel: string,
  isPaid?: boolean
) {
  const payLabel = isPaid === false ? 'Unpaid' : 'Paid';
  if (source === 'leave') {
    return `${payLabel} ${typeLabel} request`;
  }
  return `${payLabel} ${typeLabel} request`;
}
