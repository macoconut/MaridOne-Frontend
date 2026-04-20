import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAttendanceReportFilters } from './useAttendanceReportFilters';

describe('useAttendanceReportFilters', () => {
  it('starts from the provided date and defaults', () => {
    const { result } = renderHook(() =>
      useAttendanceReportFilters({
        todayDateKey: '2026-04-20',
        todayMonthIndex: 3,
        todayYear: 2026,
      })
    );

    expect(result.current.selectedDateKey).toBe('2026-04-20');
    expect(result.current.departmentFilter).toBe('all');
    expect(result.current.searchValue).toBe('');
  });

  it('opens a day and shifts the month', () => {
    const { result } = renderHook(() =>
      useAttendanceReportFilters({
        todayDateKey: '2026-04-20',
        todayMonthIndex: 3,
        todayYear: 2026,
      })
    );

    act(() => result.current.openDayDetails(5));
    act(() => result.current.shiftCalendarMonth(1));

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.selectedDateKey).toBe('2026-04-05');
    expect(result.current.monthIndex).toBe(4);
  });
});
