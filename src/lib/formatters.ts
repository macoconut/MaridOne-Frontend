export function toMoneyString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  if (typeof value === 'string' && value.trim().length > 0) return value
  return '0.00'
}

export function toOptionalMoneyString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  if (typeof value === 'string' && value.trim().length > 0) return value
  return undefined
}

export function toOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function formatDateTime(value?: string, fallback = 'Not available'): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(value?: string, fallback = 'Not available'): string {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function employeeLabel(employeeName?: string, employeeId?: number): string {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : ''
  if (trimmedName) return trimmedName
  return typeof employeeId === 'number' ? `Employee #${employeeId}` : 'Employee unavailable'
}

export function employeeLabelFromParts(
  firstName?: string,
  lastName?: string,
  employeeId?: number,
): string {
  const fullName = [firstName, lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .trim()
  if (fullName) return fullName
  if (typeof employeeId === 'number') return `EMP ID ${employeeId}`
  return 'Employee unavailable'
}
