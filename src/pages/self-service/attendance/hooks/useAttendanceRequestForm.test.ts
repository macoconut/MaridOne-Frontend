import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAttendanceRequestForm } from './useAttendanceRequestForm';

describe('useAttendanceRequestForm', () => {
  it('opens and closes each modal surface', () => {
    const { result } = renderHook(() => useAttendanceRequestForm());

    act(() => {
      result.current.openLeave();
      result.current.openOvertime();
      result.current.openSchedule();
      result.current.setConfirmClockAction('TIME_IN');
    });

    expect(result.current.leaveOpen).toBe(true);
    expect(result.current.otOpen).toBe(true);
    expect(result.current.scheduleOpen).toBe(true);
    expect(result.current.confirmClockAction).toBe('TIME_IN');

    act(() => {
      result.current.closeLeave();
      result.current.closeOvertime();
      result.current.closeSchedule();
    });

    expect(result.current.leaveOpen).toBe(false);
    expect(result.current.otOpen).toBe(false);
    expect(result.current.scheduleOpen).toBe(false);
  });
});
