import { describe, expect, it } from 'vitest';
import { applyStandardPaymentDate, getStandardPaymentDate } from './payslipsShared';

describe('payslipsShared payroll payment defaults', () => {
  it('defaults a 26th-to-10th payroll period to the 15th of the ending month', () => {
    expect(getStandardPaymentDate('2026-03-26', '2026-04-10')).toBe('2026-04-15');
  });

  it('defaults an 11th-to-25th payroll period to the 30th of the same month', () => {
    expect(getStandardPaymentDate('2026-04-11', '2026-04-25')).toBe('2026-04-30');
  });

  it('keeps the payment date editable when the period does not match a standard payroll window', () => {
    expect(
      applyStandardPaymentDate({
        periodStart: '2026-04-01',
        periodEnd: '2026-04-20',
        paymentDate: '2026-04-21',
        runType: 'REGULAR',
      })
    ).toEqual({
      periodStart: '2026-04-01',
      periodEnd: '2026-04-20',
      paymentDate: '2026-04-21',
      runType: 'REGULAR',
    });
  });
});
