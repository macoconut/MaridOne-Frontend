type LabeledLine = {
  label?: string | null;
};

function normalizeRunType(value?: string | null) {
  return String(value ?? '').trim().toUpperCase();
}

function prettifyRunType(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isBonusLineLabel(value?: string | null) {
  return String(value ?? '').trim().replace(/[\s_-]+/g, '').toUpperCase() === 'BONUS';
}

export function hasBonusEarning(lines?: LabeledLine[] | null) {
  return Array.isArray(lines) && lines.some((line) => isBonusLineLabel(line?.label));
}

export function formatPayrollRunTypeLabel(
  runType?: string | null,
  options?: {
    bonusPayout?: boolean;
  }
) {
  const normalized = normalizeRunType(runType);

  if (!normalized || normalized === 'REGULAR') return 'Regular Payroll';
  if (normalized === 'ADJUSTMENT') {
    return options?.bonusPayout ? 'Adjustment Payroll - Bonus Payout' : 'Adjustment Payroll';
  }

  return prettifyRunType(runType ?? 'Regular Payroll') || 'Regular Payroll';
}

export function formatPayrollStatusLabel(status?: string | null) {
  const normalized = String(status ?? '').trim();
  if (!normalized) return '';
  return normalized.replaceAll('_', ' ');
}
