import { useState } from 'react';

export function useAttendanceRequestForm() {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [otOpen, setOtOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmClockAction, setConfirmClockAction] = useState<'TIME_IN' | 'TIME_OUT' | null>(null);
  const [confirmLeaveSubmit, setConfirmLeaveSubmit] = useState(false);
  const [confirmOtSubmit, setConfirmOtSubmit] = useState(false);

  function openLeave() {
    setLeaveOpen(true);
  }

  function closeLeave() {
    setLeaveOpen(false);
    setConfirmLeaveSubmit(false);
  }

  function openOvertime() {
    setOtOpen(true);
  }

  function closeOvertime() {
    setOtOpen(false);
    setConfirmOtSubmit(false);
  }

  function openSchedule() {
    setScheduleOpen(true);
  }

  function closeSchedule() {
    setScheduleOpen(false);
  }

  return {
    closeLeave,
    closeOvertime,
    closeSchedule,
    confirmClockAction,
    confirmLeaveSubmit,
    confirmOtSubmit,
    leaveOpen,
    openLeave,
    openOvertime,
    openSchedule,
    otOpen,
    scheduleOpen,
    setConfirmClockAction,
    setConfirmLeaveSubmit,
    setConfirmOtSubmit,
    setLeaveOpen,
    setOtOpen,
    setScheduleOpen,
  };
}

export type UseAttendanceRequestFormReturn = ReturnType<typeof useAttendanceRequestForm>;
