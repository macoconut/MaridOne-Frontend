import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AttendanceHeader from './AttendanceHeader';

describe('AttendanceHeader', () => {
  it('renders controls and forwards interactions', () => {
    const onOpenSchedule = vi.fn();
    const onRequestAttendanceConfirmation = vi.fn();
    const onTimecardModeChange = vi.fn();

    render(
      <AttendanceHeader
        isClockOutAction={false}
        isClocking={false}
        onOpenSchedule={onOpenSchedule}
        onRequestAttendanceConfirmation={onRequestAttendanceConfirmation}
        onTimecardModeChange={onTimecardModeChange}
        timecardMode="calendar"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'My Schedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Time In' }));
    fireEvent.change(screen.getByLabelText('Attendance view').querySelector('select')!, {
      target: { value: 'timecard' },
    });

    expect(onOpenSchedule).toHaveBeenCalledTimes(1);
    expect(onRequestAttendanceConfirmation).toHaveBeenCalledTimes(1);
    expect(onTimecardModeChange).toHaveBeenCalledWith('timecard');
  });
});
