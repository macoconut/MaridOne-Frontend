import { describe, expect, it } from 'vitest';

import { buildDailyOverrideDraft, groupDailyShiftsByWorkDate } from './scheduleUtils';

describe('scheduleUtils daily override helpers', () => {
  it('builds a multi-segment custom override draft for broken shifts', () => {
    const employee = {
      id: 7,
      name: 'Alex Cruz',
      position: 'EMPLOYEE',
      status: 'REGULAR',
      department: 'Operations',
      shiftSchedules: [
        {
          shiftId: 10,
          employeeId: 7,
          dayOfWeek: 'MONDAY',
          startTime: '08:00:00',
          endTime: '17:00:00',
        },
      ],
    };

    const draft = buildDailyOverrideDraft(employee, '2026-05-04', [
      {
        dailyShiftId: 101,
        workDate: '2026-05-04',
        startDateTime: '2026-05-04T08:00:00',
        endDateTime: '2026-05-04T12:00:00',
        dayOff: false,
      },
      {
        dailyShiftId: 102,
        workDate: '2026-05-04',
        startDateTime: '2026-05-04T13:00:00',
        endDateTime: '2026-05-04T17:00:00',
        dayOff: false,
      },
    ]);

    expect(draft.isOverride).toBe(true);
    expect(draft.dayOff).toBe(false);
    expect(draft.hasTemplate).toBe(true);
    expect(draft.segments).toEqual([
      { dailyShiftId: 101, startTime: '08:00', endTime: '12:00' },
      { dailyShiftId: 102, startTime: '13:00', endTime: '17:00' },
    ]);
  });

  it('treats a saved day-off override as day off even when a template exists', () => {
    const employee = {
      id: 8,
      name: 'Mia Ramos',
      position: 'EMPLOYEE',
      status: 'REGULAR',
      department: 'Support',
      shiftSchedules: [
        {
          shiftId: 11,
          employeeId: 8,
          dayOfWeek: 'TUESDAY',
          startTime: '09:00:00',
          endTime: '18:00:00',
        },
      ],
    };

    const draft = buildDailyOverrideDraft(employee, '2026-05-05', [
      {
        dailyShiftId: 201,
        workDate: '2026-05-05',
        startDateTime: '2026-05-05T00:00:00',
        endDateTime: '2026-05-05T00:00:00',
        dayOff: true,
      },
    ]);

    expect(draft.isOverride).toBe(true);
    expect(draft.dayOff).toBe(true);
    expect(draft.hasTemplate).toBe(true);
    expect(draft.segments).toEqual([{ startTime: '09:00', endTime: '18:00' }]);
  });

  it('groups daily shifts by work date and keeps time order within each date', () => {
    const grouped = groupDailyShiftsByWorkDate([
      {
        dailyShiftId: 2,
        workDate: '2026-05-04',
        startDateTime: '2026-05-04T13:00:00',
        endDateTime: '2026-05-04T17:00:00',
      },
      {
        dailyShiftId: 1,
        workDate: '2026-05-04',
        startDateTime: '2026-05-04T08:00:00',
        endDateTime: '2026-05-04T12:00:00',
      },
      {
        dailyShiftId: 3,
        workDate: '2026-05-05',
        startDateTime: '2026-05-05T09:00:00',
        endDateTime: '2026-05-05T18:00:00',
      },
    ]);

    expect(grouped.get('2026-05-04')?.map((shift) => shift.dailyShiftId)).toEqual([1, 2]);
    expect(grouped.get('2026-05-05')?.map((shift) => shift.dailyShiftId)).toEqual([3]);
  });
});
