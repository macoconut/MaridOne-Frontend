export type AttendanceStatus = 'PRESENT' | 'INCOMPLETE' | 'ABSENT';

export type AttendanceLogLike = {
  timestamp?: string;
  direction?: string;
};

export type DailyShiftLike = {
  startDateTime?: string;
  endDateTime?: string;
  dayOff?: boolean;
};

type IntervalMs = { startMs: number; endMs: number };

export type EvaluatedDailyAttendance = {
  status: AttendanceStatus;
  hasAnyLog: boolean;
  hasCompleteSession: boolean;
  scheduledMinutes: number;
  coveredScheduledMinutes: number;
  isLate: boolean;
  isEarlyOut: boolean;
  lateMinutes: number;
  earlyOutMinutes: number;
};

export function isInDirection(direction?: string) {
  const value = String(direction ?? '').toUpperCase();
  return value.includes('IN') || value.includes('LATE');
}

export function isOutDirection(direction?: string) {
  return String(direction ?? '').toUpperCase().includes('OUT');
}

function safeParseMs(value?: string) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeShiftInterval(shift: DailyShiftLike): IntervalMs | null {
  if (shift.dayOff === true) return null;
  const startMs = safeParseMs(shift.startDateTime);
  const rawEndMs = safeParseMs(shift.endDateTime);
  if (startMs == null || rawEndMs == null) return null;
  const endMs = rawEndMs <= startMs ? rawEndMs + 24 * 60 * 60 * 1000 : rawEndMs;
  return endMs > startMs ? { startMs, endMs } : null;
}

function mergeIntervals(intervals: IntervalMs[]) {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: IntervalMs[] = [];

  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (!last || current.startMs > last.endMs) {
      merged.push({ ...current });
      continue;
    }
    if (current.endMs > last.endMs) {
      last.endMs = current.endMs;
    }
  }

  return merged;
}

function minutesBetween(startMs: number, endMs: number) {
  if (endMs <= startMs) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function intersect(a: IntervalMs, b: IntervalMs): IntervalMs | null {
  const startMs = Math.max(a.startMs, b.startMs);
  const endMs = Math.min(a.endMs, b.endMs);
  return endMs > startMs ? { startMs, endMs } : null;
}

export function resolveScheduledIntervals(shifts: DailyShiftLike[]) {
  return shifts.map(normalizeShiftInterval).filter((value): value is IntervalMs => value !== null);
}

export function buildAttendanceSessions(logs: AttendanceLogLike[]) {
  const sorted = [...logs].sort((a, b) => (safeParseMs(a.timestamp) ?? 0) - (safeParseMs(b.timestamp) ?? 0));
  const sessions: IntervalMs[] = [];
  let openInMs: number | null = null;

  for (const log of sorted) {
    if (isInDirection(log.direction)) {
      openInMs = safeParseMs(log.timestamp);
      continue;
    }

    if (isOutDirection(log.direction) && openInMs !== null) {
      const outMs = safeParseMs(log.timestamp);
      if (outMs != null && outMs > openInMs) {
        sessions.push({ startMs: openInMs, endMs: outMs });
      }
      openInMs = null;
    }
  }

  return sessions;
}

function coveredMinutesInWindow(sessions: IntervalMs[], window: IntervalMs) {
  const overlaps = sessions
    .map((session) => intersect(session, window))
    .filter((value): value is IntervalMs => value !== null);
  const merged = mergeIntervals(overlaps);
  return merged.reduce((sum, interval) => sum + minutesBetween(interval.startMs, interval.endMs), 0);
}

function coversEntireWindow(sessions: IntervalMs[], window: IntervalMs) {
  return coveredMinutesInWindow(sessions, window) >= minutesBetween(window.startMs, window.endMs);
}

export function evaluateDailyAttendanceCoverage(params: {
  logs: AttendanceLogLike[];
  scheduledShifts: DailyShiftLike[];
}) : EvaluatedDailyAttendance {
  const hasAnyLog = params.logs.length > 0;
  const sessions = buildAttendanceSessions(params.logs);
  const hasCompleteSession = sessions.length > 0;

  const scheduleWindows = resolveScheduledIntervals(params.scheduledShifts);
  const scheduledMinutes = scheduleWindows.reduce(
    (sum, interval) => sum + minutesBetween(interval.startMs, interval.endMs),
    0
  );
  const coveredScheduledMinutes = scheduleWindows.reduce(
    (sum, interval) => sum + coveredMinutesInWindow(sessions, interval),
    0
  );

  const scheduleStartMs =
    scheduleWindows.length > 0 ? Math.min(...scheduleWindows.map((interval) => interval.startMs)) : null;
  const scheduleEndMs =
    scheduleWindows.length > 0 ? Math.max(...scheduleWindows.map((interval) => interval.endMs)) : null;

  const overlapIntervals = scheduleWindows.flatMap((window) =>
    sessions
      .map((session) => intersect(session, window))
      .filter((value): value is IntervalMs => value !== null)
  );
  const relevantOverlapStartMs =
    overlapIntervals.length > 0 ? Math.min(...overlapIntervals.map((interval) => interval.startMs)) : null;
  const relevantOverlapEndMs =
    overlapIntervals.length > 0 ? Math.max(...overlapIntervals.map((interval) => interval.endMs)) : null;

  const isLate =
    scheduleStartMs != null && relevantOverlapStartMs != null ? relevantOverlapStartMs > scheduleStartMs : false;
  const isEarlyOut =
    scheduleEndMs != null && relevantOverlapEndMs != null ? relevantOverlapEndMs < scheduleEndMs : false;

  const lateMinutes =
    isLate && scheduleStartMs != null && relevantOverlapStartMs != null
      ? minutesBetween(scheduleStartMs, relevantOverlapStartMs)
      : 0;
  const earlyOutMinutes =
    isEarlyOut && scheduleEndMs != null && relevantOverlapEndMs != null
      ? minutesBetween(relevantOverlapEndMs, scheduleEndMs)
      : 0;

  let status: AttendanceStatus = 'ABSENT';
  if (!hasAnyLog) {
    status = 'ABSENT';
  } else if (!hasCompleteSession) {
    status = 'INCOMPLETE';
  } else if (scheduleWindows.length === 0) {
    status = 'ABSENT';
  } else if (scheduleWindows.every((window) => coversEntireWindow(sessions, window))) {
    status = 'PRESENT';
  } else {
    status = 'ABSENT';
  }

  return {
    status,
    hasAnyLog,
    hasCompleteSession,
    scheduledMinutes,
    coveredScheduledMinutes,
    isLate,
    isEarlyOut,
    lateMinutes,
    earlyOutMinutes,
  };
}

