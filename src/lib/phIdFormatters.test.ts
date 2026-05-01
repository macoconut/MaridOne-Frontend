import { describe, it, expect } from 'vitest'
import {
  formatSss,
  formatPhilHealth,
  formatPagibig,
  formatTin,
  formatPhone,
  formatBankAccount,
} from './phIdFormatters'

describe('formatSss', () => {
  it('returns empty string for empty input', () => {
    expect(formatSss('')).toBe('')
  })
  it('strips non-digit characters', () => {
    expect(formatSss('ab12cd34567890xyz')).toBe('12-3456789-0')
  })
  it('formats partial input', () => {
    expect(formatSss('1')).toBe('1')
    expect(formatSss('12')).toBe('12')
    expect(formatSss('123')).toBe('12-3')
    expect(formatSss('123456789')).toBe('12-3456789')
    expect(formatSss('1234567890')).toBe('12-3456789-0')
  })
  it('clamps to 10 digits', () => {
    expect(formatSss('123456789099')).toBe('12-3456789-0')
  })
  it('re-formats already-formatted input', () => {
    expect(formatSss('12-3456789-0')).toBe('12-3456789-0')
  })
})

describe('formatPhilHealth', () => {
  it('returns empty string for empty input', () => {
    expect(formatPhilHealth('')).toBe('')
  })
  it('formats full 12-digit input', () => {
    expect(formatPhilHealth('123456789012')).toBe('12-345678901-2')
  })
  it('formats partial input', () => {
    expect(formatPhilHealth('12')).toBe('12')
    expect(formatPhilHealth('123')).toBe('12-3')
    expect(formatPhilHealth('12345678901')).toBe('12-345678901')
  })
  it('clamps to 12 digits', () => {
    expect(formatPhilHealth('12345678901299')).toBe('12-345678901-2')
  })
  it('re-formats already-formatted input', () => {
    expect(formatPhilHealth('12-345678901-2')).toBe('12-345678901-2')
  })
})

describe('formatPagibig', () => {
  it('returns empty string for empty input', () => {
    expect(formatPagibig('')).toBe('')
  })
  it('formats full 12-digit input', () => {
    expect(formatPagibig('123456789012')).toBe('1234-5678-9012')
  })
  it('formats partial input', () => {
    expect(formatPagibig('1234')).toBe('1234')
    expect(formatPagibig('12345')).toBe('1234-5')
    expect(formatPagibig('12345678')).toBe('1234-5678')
    expect(formatPagibig('123456789')).toBe('1234-5678-9')
  })
  it('clamps to 12 digits', () => {
    expect(formatPagibig('1234567890129')).toBe('1234-5678-9012')
  })
  it('re-formats already-formatted input', () => {
    expect(formatPagibig('1234-5678-9012')).toBe('1234-5678-9012')
  })
})

describe('formatTin', () => {
  it('returns empty string for empty input', () => {
    expect(formatTin('')).toBe('')
  })
  it('formats 9-digit TIN', () => {
    expect(formatTin('123456789')).toBe('123-456-789')
  })
  it('formats 11-digit TIN', () => {
    expect(formatTin('12345678901')).toBe('123-456-789-01')
  })
  it('formats 12-digit TIN', () => {
    expect(formatTin('123456789000')).toBe('123-456-789-000')
  })
  it('expands to 4-segment format at the 10th digit', () => {
    expect(formatTin('1234567890')).toBe('123-456-789-0')
  })
  it('formats partial input', () => {
    expect(formatTin('123')).toBe('123')
    expect(formatTin('1234')).toBe('123-4')
    expect(formatTin('123456')).toBe('123-456')
    expect(formatTin('1234567')).toBe('123-456-7')
  })
  it('clamps to 12 digits', () => {
    expect(formatTin('1234567890129')).toBe('123-456-789-012')
  })
  it('re-formats already-formatted input', () => {
    expect(formatTin('123-456-789')).toBe('123-456-789')
    expect(formatTin('123-456-789-000')).toBe('123-456-789-000')
  })
})

describe('formatPhone', () => {
  it('returns empty string for empty input', () => {
    expect(formatPhone('')).toBe('')
  })
  it('strips non-digit characters', () => {
    expect(formatPhone('0917 123 4567')).toBe('09171234567')
  })
  it('clamps to 11 digits', () => {
    expect(formatPhone('091712345678')).toBe('09171234567')
  })
  it('returns raw digits with no dashes', () => {
    expect(formatPhone('09171234567')).toBe('09171234567')
  })
})

describe('formatBankAccount', () => {
  it('returns empty string for empty input', () => {
    expect(formatBankAccount('')).toBe('')
  })
  it('strips non-digit characters', () => {
    expect(formatBankAccount('1234 5678 9012')).toBe('123456789012')
  })
  it('clamps to 15 digits', () => {
    expect(formatBankAccount('1234567890123456')).toBe('123456789012345')
  })
  it('returns raw digits with no dashes', () => {
    expect(formatBankAccount('1234567890')).toBe('1234567890')
  })
})
