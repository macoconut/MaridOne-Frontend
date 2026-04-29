export type ShiftSchedule = {
  shiftId?: number;
  employeeId?: number;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string;
};

export type TeamEmployee = {
  id: number;
  name: string;
  position: string;
  status: string;
  department: string;
  shiftSchedules: ShiftSchedule[];
};

export type ShiftDraft = {
  startTime: string;
  endTime: string;
  shiftId?: number;
};

export type DailyShift = {
  dailyShiftId?: number;
  employeeId?: number;
  workDate?: string;
  startDateTime?: string;
  endDateTime?: string;
  dayOff?: boolean;
};

export type DailyShiftSegmentDraft = {
  startTime: string;
  endTime: string;
  dailyShiftId?: number;
};

export type DailyOverrideDraft = {
  workDate: string;
  segments: DailyShiftSegmentDraft[];
  isOverride: boolean;
  dayOff: boolean;
  hasTemplate: boolean;
};

export const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

export function toTimeInputValue(value?: string) {
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length < 2) return '';
  return `${parts[0]}:${parts[1]}`;
}

export function formatDayLabel(day: string) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

export function getWeekStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function getMonthStart(value: Date) {
  const date = new Date(value.getFullYear(), value.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toMonthValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

export function normalizeWeekStart(value: string) {
  if (!value) {
    return toIsoDate(getWeekStart(new Date()));
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return toIsoDate(getWeekStart(date));
}

export function normalizeMonthStart(value: string) {
  if (!value) {
    return toIsoDate(getMonthStart(new Date()));
  }
  const [year, month] = value.split('-').map(Number);
  return toIsoDate(new Date(year, (month ?? 1) - 1, 1));
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function addMonths(isoMonthStart: string, months: number) {
  const [year, month] = isoMonthStart.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1 + months, 1);
  return toIsoDate(date);
}

export function formatNextOccurrenceLabel(day: string) {
  const targetDay = DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number]);
  if (targetDay < 0) {
    return formatDayLabel(day);
  }

  const today = new Date();
  const currentDay = today.getDay();
  const currentNormalized = currentDay === 0 ? 6 : currentDay - 1;
  const offset = (targetDay - currentNormalized + 7) % 7;

  const nextDate = new Date(today);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(today.getDate() + offset);

  return nextDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatSpecificDateLabel(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatWeekRangeLabel(weekStart: string) {
  const startLabel = formatSpecificDateLabel(weekStart);
  const endLabel = formatSpecificDateLabel(addDays(weekStart, 6));
  return `${startLabel} to ${endLabel}`;
}

export function formatMonthLabel(monthStart: string) {
  const date = parseIsoDate(monthStart);
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function timeFromDateTime(value?: string) {
  if (!value) return '';
  const [, timePart = ''] = value.split('T');
  return timePart.slice(0, 5);
}

export function groupDailyShiftsByWorkDate(dailyShifts: DailyShift[]) {
  const grouped = new Map<string, DailyShift[]>();

  for (const shift of dailyShifts) {
    if (!shift.workDate) continue;
    const current = grouped.get(shift.workDate) ?? [];
    current.push(shift);
    grouped.set(shift.workDate, current);
  }

  for (const [workDate, shifts] of grouped.entries()) {
    grouped.set(
      workDate,
      [...shifts].sort((left, right) => String(left.startDateTime ?? '').localeCompare(String(right.startDateTime ?? '')))
    );
  }

  return grouped;
}

export function resolveTemplateShiftForDate(employee: TeamEmployee | null, workDate: string) {
  const dayName = parseIsoDate(workDate).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const template = employee?.shiftSchedules.find((item) => String(item.dayOfWeek ?? '').toUpperCase() === dayName);

  return {
    hasTemplate: Boolean(template),
    segments:
      template?.startTime && template?.endTime
        ? [
            {
              startTime: template.startTime.slice(0, 5),
              endTime: template.endTime.slice(0, 5),
            },
          ]
        : [],
  };
}

export function toDailyShiftSegments(dailyShifts: DailyShift[]) {
  return dailyShifts
    .filter((shift) => !shift.dayOff)
    .map((shift) => ({
      dailyShiftId: shift.dailyShiftId,
      startTime: timeFromDateTime(shift.startDateTime),
      endTime: timeFromDateTime(shift.endDateTime),
    }))
    .filter((segment) => segment.startTime && segment.endTime);
}

export function buildDailyOverrideDraft(
  employee: TeamEmployee | null,
  workDate: string,
  dailyShiftsForDate: DailyShift[] = []
): DailyOverrideDraft {
  const template = resolveTemplateShiftForDate(employee, workDate);
  const hasDayOffOverride = dailyShiftsForDate.some((shift) => Boolean(shift.dayOff));
  const overrideSegments = toDailyShiftSegments(dailyShiftsForDate);

  return {
    workDate,
    segments: overrideSegments.length > 0 ? overrideSegments : template.segments,
    isOverride: dailyShiftsForDate.length > 0,
    dayOff: hasDayOffOverride ? true : !template.hasTemplate && dailyShiftsForDate.length === 0,
    hasTemplate: template.hasTemplate,
  };
}

export function formatShiftSegmentsLabel(segments: DailyShiftSegmentDraft[], formatTimeLabel: (value: string) => string) {
  if (segments.length === 0) return 'Day off';
  return segments.map((segment) => `${formatTimeLabel(segment.startTime)} - ${formatTimeLabel(segment.endTime)}`).join(', ');
}

export function parseTeamEmployees(payload: unknown, toArray: <T>(input: unknown) => T[]): TeamEmployee[] {
  const rows =
    payload && typeof payload === 'object' && !Array.isArray(payload) && 'content' in payload
      ? toArray<Record<string, unknown>>((payload as { content?: unknown }).content)
      : toArray<Record<string, unknown>>(payload);

  return rows
    .map((row, index) => ({
      id: Number(row.employeeId ?? row.id ?? index + 1),
      name:
        [row.firstName, row.middleName, row.lastName]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          .join(' ') || `Employee #${row.employeeId ?? row.id ?? index + 1}`,
      position: typeof row.position === 'string' ? row.position : '-',
      status: typeof row.employmentStatus === 'string' ? row.employmentStatus : '-',
      department: typeof row.department === 'string' ? row.department.trim() : '',
      shiftSchedules: toArray<Record<string, unknown>>(row.shiftSchedules).map((schedule) => ({
        shiftId: typeof schedule.shiftId === 'number' ? schedule.shiftId : undefined,
        employeeId: typeof schedule.employeeId === 'number' ? schedule.employeeId : undefined,
        startTime: typeof schedule.startTime === 'string' ? schedule.startTime : undefined,
        endTime: typeof schedule.endTime === 'string' ? schedule.endTime : undefined,
        dayOfWeek: typeof schedule.dayOfWeek === 'string' ? schedule.dayOfWeek : undefined,
      })),
    }))
    .filter((employee) => Number.isFinite(employee.id));
}

export function parseDailyShifts(payload: unknown, toArray: <T>(input: unknown) => T[]): DailyShift[] {
  return toArray<Record<string, unknown>>(payload).map((row) => ({
    dailyShiftId: typeof row.dailyShiftId === 'number' ? row.dailyShiftId : undefined,
    employeeId: typeof row.employeeId === 'number' ? row.employeeId : undefined,
    workDate: typeof row.workDate === 'string' ? row.workDate : undefined,
    startDateTime: typeof row.startDateTime === 'string' ? row.startDateTime : undefined,
    endDateTime: typeof row.endDateTime === 'string' ? row.endDateTime : undefined,
    dayOff: typeof row.dayOff === 'boolean' ? row.dayOff : undefined,
  }));
}

export function buildTemplateDrafts(employee: TeamEmployee | null): Record<string, ShiftDraft> {
  const next: Record<string, ShiftDraft> = {};

  for (const day of DAY_ORDER) {
    const schedule = employee?.shiftSchedules.find((item) => String(item.dayOfWeek ?? '').toUpperCase() === day);
    next[day] = {
      shiftId: schedule?.shiftId,
      startTime: toTimeInputValue(schedule?.startTime),
      endTime: toTimeInputValue(schedule?.endTime),
    };
  }

  return next;
}

export function buildWeekOverrideDrafts(
  employee: TeamEmployee | null,
  weekStart: string,
  dailyShifts: DailyShift[]
): Record<string, DailyOverrideDraft> {
  const dailyShiftMap = groupDailyShiftsByWorkDate(dailyShifts);

  return DAY_ORDER.reduce<Record<string, DailyOverrideDraft>>((next, day, index) => {
    const workDate = addDays(weekStart, index);
    next[workDate] = buildDailyOverrideDraft(employee, workDate, dailyShiftMap.get(workDate) ?? []);

    return next;
  }, {});
}

export function getMonthDates(monthStart: string) {
  const [year, month] = monthStart.split('-').map(Number);
  const daysInMonth = new Date(year, month ?? 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => addDays(monthStart, index));
}
