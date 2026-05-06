import { describe, it, expect } from 'vitest'
import {
  toMoneyString,
  toOptionalMoneyString,
  toOptionalText,
  formatDateTime,
  formatDate,
  employeeLabel
} from '../utils/formatters'

describe('toMoneyString', () => {
  it('formats finite numbers to 2dp', () => {
    expect(toMoneyString(1234.5)).toBe('1234.50')
    expect(toMoneyString(0)).toBe('0.00')
  })
  it('passes through non-empty strings', () => {
    expect(toMoneyString('42.00')).toBe('42.00')
  })
  it('returns "0.00" for nullish / invalid', () => {
    expect(toMoneyString(null)).toBe('0.00')
    expect(toMoneyString(undefined)).toBe('0.00')
    expect(toMoneyString('')).toBe('0.00')
    expect(toMoneyString(Number.NaN)).toBe('0.00')
  })
})

describe('toOptionalMoneyString', () => {
  it('returns undefined for nullish / invalid', () => {
    expect(toOptionalMoneyString(null)).toBeUndefined()
    expect(toOptionalMoneyString(undefined)).toBeUndefined()
    expect(toOptionalMoneyString('')).toBeUndefined()
    expect(toOptionalMoneyString(Number.NaN)).toBeUndefined()
  })
  it('formats finite numbers to 2dp', () => {
    expect(toOptionalMoneyString(10)).toBe('10.00')
    expect(toOptionalMoneyString(0)).toBe('0.00')
  })
  it('passes through non-empty strings', () => {
    expect(toOptionalMoneyString('42.00')).toBe('42.00')
  })
})

describe('toOptionalText', () => {
  it('returns undefined for nullish / empty / whitespace', () => {
    expect(toOptionalText(null)).toBeUndefined()
    expect(toOptionalText(undefined)).toBeUndefined()
    expect(toOptionalText('')).toBeUndefined()
    expect(toOptionalText('   ')).toBeUndefined()
  })
  it('returns undefined for non-string input', () => {
    expect(toOptionalText(42)).toBeUndefined()
    expect(toOptionalText({})).toBeUndefined()
  })
  it('trims non-empty strings', () => {
    expect(toOptionalText('  hi  ')).toBe('hi')
    expect(toOptionalText('hi')).toBe('hi')
  })
})

describe('formatDateTime', () => {
  it('returns default fallback "Not available" for empty', () => {
    expect(formatDateTime('')).toBe('Not available')
    expect(formatDateTime(undefined)).toBe('Not available')
  })
  it('uses caller fallback when provided', () => {
    expect(formatDateTime('', '-')).toBe('-')
    expect(formatDateTime(undefined, 'Unknown time')).toBe('Unknown time')
  })
  it('returns the input when unparseable', () => {
    expect(formatDateTime('not a date')).toBe('not a date')
  })
  it('formats valid ISO strings', () => {
    const out = formatDateTime('2026-01-02T03:04:05Z')
    expect(typeof out).toBe('string')
    expect(out).not.toBe('Not available')
    expect(out).toMatch(/\d{4}/)
  })
})

describe('formatDate', () => {
  it('returns default fallback "Not available" for empty', () => {
    expect(formatDate('')).toBe('Not available')
    expect(formatDate(undefined)).toBe('Not available')
  })
  it('uses caller fallback when provided', () => {
    expect(formatDate('', '-')).toBe('-')
    expect(formatDate(undefined, '')).toBe('')
  })
  it('returns the input when unparseable', () => {
    expect(formatDate('not a date')).toBe('not a date')
  })
  it('formats valid ISO strings', () => {
    const out = formatDate('2026-01-02T00:00:00Z')
    expect(typeof out).toBe('string')
    expect(out).not.toBe('Not available')
    expect(out).toMatch(/\d{4}/)
  })
})

describe('employeeLabel', () => {
  it('prefers trimmed name', () => {
    expect(employeeLabel('  Alice  ', 7)).toBe('Alice')
    expect(employeeLabel('Bob', 3)).toBe('Bob')
  })
  it('falls back to #id when name empty', () => {
    expect(employeeLabel('', 7)).toBe('Employee #7')
    expect(employeeLabel('   ', 7)).toBe('Employee #7')
    expect(employeeLabel(undefined, 7)).toBe('Employee #7')
  })
  it('final fallback when both missing', () => {
    expect(employeeLabel(undefined, undefined)).toBe('Employee unavailable')
    expect(employeeLabel('', undefined)).toBe('Employee unavailable')
  })
})
