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

  it('disables attendance tracking when verification is required', () => {
    const onRequestAttendanceConfirmation = vi.fn();

    render(
      <AttendanceHeader
        clockDisabledReason="Verify your account before starting attendance tracking."
        isClockOutAction={false}
        isClocking={false}
        onOpenSchedule={vi.fn()}
        onRequestAttendanceConfirmation={onRequestAttendanceConfirmation}
        onTimecardModeChange={vi.fn()}
        timecardMode="calendar"
      />
    );

    const button = screen.getByRole('button', { name: 'Time In' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Verify your account before starting attendance tracking.');

    fireEvent.click(button);
    expect(onRequestAttendanceConfirmation).not.toHaveBeenCalled();
  });

  it('disables attendance tracking while employee access is loading', () => {
    const onRequestAttendanceConfirmation = vi.fn();

    render(
      <AttendanceHeader
        clockDisabledReason="Preparing attendance access."
        isClockOutAction={false}
        isClocking={false}
        onOpenSchedule={vi.fn()}
        onRequestAttendanceConfirmation={onRequestAttendanceConfirmation}
        onTimecardModeChange={vi.fn()}
        timecardMode="calendar"
      />
    );

    const button = screen.getByRole('button', { name: 'Time In' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Preparing attendance access.');

    fireEvent.click(button);
    expect(onRequestAttendanceConfirmation).not.toHaveBeenCalled();
  });
});
