import type {
  AttendanceLeaveRequest as LeaveRequestRow,
  ShiftSchedule as ShiftScheduleRow,
} from '../../../../lib/types/attendance';
import type { LeaveBalanceRow } from '../../../../lib/types/employee';

import {
  calculateNextDayOff,
  formatBalanceHours,
  getLeaveMaxHours,
  getLeaveTypeLabel,
} from '../dashboardShared';

type TimeOffBalancesCardProps = {
  leaveBalances: LeaveBalanceRow[];
  nextLeave: LeaveRequestRow | null;
  shiftSchedule: ShiftScheduleRow[];
  onViewAllBalances: () => void;
};

export default function TimeOffBalancesCard({
  leaveBalances,
  nextLeave,
  shiftSchedule,
  onViewAllBalances,
}: TimeOffBalancesCardProps) {
  const nextOff = calculateNextDayOff(nextLeave ? [nextLeave] : [], shiftSchedule);

  return (
    <div className="cardX">
      <div className="cardX__title">Time-Off & Balances</div>

      <div className="leaveSplitLayout">
        <div className="leaveSplitLayout__next">
          {!nextOff ? (
            <div className="nextDayOffEmpty">
              <div className="nextDayOffEmpty__icon">📅</div>
              <p>No upcoming time-off scheduled.</p>
            </div>
          ) : (
            (() => {
              const dateObj = new Date(nextOff.date);
              const monthShort = dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
              const dayNum = dateObj.getDate();
              const dayShort = dateObj.toLocaleDateString(undefined, { weekday: 'short' });

              return (
                <div className="nextDayOff">
                  <div className="nextDayOff__label">
                    {nextOff.isLeave ? 'Next Approved Leave' : 'Next Day Off'}
                  </div>
                  <div className="nextDayOff__badge">
                    <div className="nextDayOff__badgeMonth">{monthShort}</div>
                    <div className="nextDayOff__badgeNum">{dayNum}</div>
                    <div className="nextDayOff__badgeDay">{dayShort}</div>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <div className="leaveSplitLayout__bars">
          {leaveBalances.length > 0 ? (
            [...leaveBalances]
              .sort((a, b) => {
                const priority: Record<string, number> = { SICK_LEAVE: 1, VACATION_LEAVE: 2 };
                return (priority[a.leaveType || ''] || 99) - (priority[b.leaveType || ''] || 99);
              })
              .slice(0, 4)
              .map((balance) => {
                const current =
                  typeof balance.balanceHours === 'number'
                    ? balance.balanceHours
                    : parseFloat(balance.balanceHours || '0');
                const max = getLeaveMaxHours(balance.leaveType);
                const percentage = Math.min(100, (current / max) * 100);

                return (
                  <div key={balance.leaveId || balance.leaveType} className="leaveProgress">
                    <div className="leaveProgress__top">
                      <span className="leaveProgress__type">{getLeaveTypeLabel(balance.leaveType)}</span>
                      <span className="leaveProgress__value">{formatBalanceHours(balance.balanceHours)}h</span>
                    </div>
                    <div className="leaveProgress__barWrap">
                      <div className="leaveProgress__bar" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })
          ) : (
            <div className="leaveBalancesX__empty">No leave balances available.</div>
          )}
          {leaveBalances.length > 4 ? (
            <button type="button" className="leaveBalancesX__more" onClick={onViewAllBalances}>
              View All Balances →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
