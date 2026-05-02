import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getManilaNow } from '../../../lib/manilaTime';
import type {
  AttendanceEmployeeRow as EmployeeRow,
  AttendanceLeaveRequest as LeaveRequest,
  AttendanceLog,
  AttendanceOvertimeRequest as OvertimeRequest,
  DailyShift,
} from '../../../lib/types/attendance';
import {
  DEPARTMENTS_PER_PAGE,
  STATUS_CONFIG,
  buildAttendanceSummary,
  buildDailyRecords,
  buildOnLeaveSetForDate,
  dateFromKey,
  directionIndicator,
  directionIndicatorTone,
  formatDateLabel,
  formatFeedTimestamp,
  formatLongDateLabel,
  formatPeriodLabel,
  formatShortDateLabel,
  groupLeavesByEmployee,
  groupOvertimeByEmployee,
  hasScheduledWorkOnDate,
  employeeName,
  isInDirection,
  isLateForSchedule,
  isTodayWithin,
  isEmployeeScheduledToHaveStartedByNow,
  localDateKey,
  parseHolidayLookup,
  resolveDepartmentLabel,
  rosterRows,
  toDateKey,
  withPaging,
  withParams,
  type AttendanceOverviewDashboardProps,
  type AttendanceStatusKey,
  type DepartmentBreakdownItem,
  type FeedItem,
  type LeaveCardItem,
  type MetricCard,
  type WeeklyAttendanceItem,
} from './dashboardShared';
import AttendanceBreakdownPanel from './sections/AttendanceBreakdownPanel';
import AttendanceDashboardHeader from './sections/AttendanceDashboardHeader';
import AttendanceFeedPanel from './sections/AttendanceFeedPanel';
import AttendanceStatusPanels from './sections/AttendanceStatusPanels';
import DashboardSummaryCards from './sections/DashboardSummaryCards';
import './Dashboard.css';

export default function HrDashboard() {

  return <AttendanceOverviewDashboard audience="HR" />;
}

export function AttendanceOverviewDashboard({
  audience = 'HR',
  logsUrl = '/api/logs/attendance',
  leavesUrl = '/api/leave/request',
  rosterUrl = '/api/employees',
  overtimeUrl,
  feedWindowDays = 1,
  primaryPanelMode = 'department',
  feedScope = 'window',
  feedTitleOverride,
  feedTimeDisplay = 'auto',
  descriptionOverride,
  weeklyWindowAnchor = 'today',
  weeklyWindowIncludesSelectedDate = true,
}: AttendanceOverviewDashboardProps) {
  const todayKey = useMemo(() => getManilaNow().dateKey, []);
  const todayDate = useMemo(() => dateFromKey(todayKey), [todayKey]);
  const includeWeeklyFeed = feedWindowDays > 1;
  const isWeeklyPrimaryPanel = primaryPanelMode === 'weekly';
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [feedLogs, setFeedLogs] = useState<AttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [approvedOvertime, setApprovedOvertime] = useState<OvertimeRequest[]>([]);
  const [holidayDateKeys, setHolidayDateKeys] = useState<string[]>([]);
  const [holidayNamesByDate, setHolidayNamesByDate] = useState<Record<string, string>>({});
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  useErrorDialogEffect(loadError, 'HR dashboard attendance logs could not be loaded');
  const [deptPage, setDeptPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [feedPanelHeight, setFeedPanelHeight] = useState<number | null>(null);
  const mainColRef = useRef<HTMLDivElement | null>(null);
  const silentRefreshRef = useRef(false);
  const effectiveSelectedDateKey = selectedDateKey && selectedDateKey <= todayKey ? selectedDateKey : todayKey;
  const selectedDate = useMemo(() => dateFromKey(effectiveSelectedDateKey), [effectiveSelectedDateKey]);
  const isSelectedDateToday = effectiveSelectedDateKey === todayKey;
  const selectedDateHeading = useMemo(() => formatLongDateLabel(selectedDate), [selectedDate]);
  const selectedDateShortLabel = useMemo(() => formatShortDateLabel(selectedDate), [selectedDate]);
  const weeklyWindowAnchorDate = useMemo(() => {
    if (!includeWeeklyFeed) return selectedDate;
    return weeklyWindowAnchor === 'selected-date' ? selectedDate : todayDate;
  }, [includeWeeklyFeed, selectedDate, todayDate, weeklyWindowAnchor]);
  const feedStartDate = useMemo(() => {
    if (!includeWeeklyFeed) {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    const start = new Date(weeklyWindowAnchorDate);
    if (!weeklyWindowIncludesSelectedDate) {
      start.setDate(start.getDate() - 1);
    }
    start.setDate(start.getDate() - Math.max(feedWindowDays - 1, 0));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [
    feedWindowDays,
    includeWeeklyFeed,
    selectedDate,
    weeklyWindowAnchorDate,
    weeklyWindowIncludesSelectedDate,
  ]);
  const feedEndDate = useMemo(() => {
    if (!includeWeeklyFeed) {
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
      return end;
    }

    const end = new Date(weeklyWindowAnchorDate);
    if (!weeklyWindowIncludesSelectedDate) {
      end.setDate(end.getDate() - 1);
    }
    end.setHours(23, 59, 59, 999);
    return end;
  }, [includeWeeklyFeed, selectedDate, weeklyWindowAnchorDate, weeklyWindowIncludesSelectedDate]);
  const feedStartDateKey = useMemo(() => toDateKey(feedStartDate), [feedStartDate]);
  const feedEndDateKey = useMemo(() => toDateKey(feedEndDate), [feedEndDate]);
  const holidayLookupStartKey = useMemo(
    () => (feedStartDateKey < effectiveSelectedDateKey ? feedStartDateKey : effectiveSelectedDateKey),
    [effectiveSelectedDateKey, feedStartDateKey]
  );
  const holidayLookupEndKey = useMemo(
    () => (feedEndDateKey > effectiveSelectedDateKey ? feedEndDateKey : effectiveSelectedDateKey),
    [effectiveSelectedDateKey, feedEndDateKey]
  );
  const dailyShiftLookupStartKey = useMemo(() => {
    const startKey = feedStartDateKey < effectiveSelectedDateKey ? feedStartDateKey : effectiveSelectedDateKey;
    const startDate = dateFromKey(startKey);
    startDate.setDate(startDate.getDate() - 1);
    return toDateKey(startDate);
  }, [effectiveSelectedDateKey, feedStartDateKey]);
  const dailyShiftLookupEndKey = useMemo(
    () => (feedEndDateKey > effectiveSelectedDateKey ? feedEndDateKey : effectiveSelectedDateKey),
    [effectiveSelectedDateKey, feedEndDateKey]
  );
  const feedRangeLabel = useMemo(() => {
    if (!includeWeeklyFeed) return formatLongDateLabel(selectedDate);
    return `${formatDateLabel(feedStartDate.toISOString())} to ${formatDateLabel(feedEndDate.toISOString())}`;
  }, [feedEndDate, feedStartDate, includeWeeklyFeed, selectedDate]);
  const overtimeEndpoint = useMemo(
    () => overtimeUrl ?? (audience.toLowerCase() === 'manager' ? '/api/overtime/team' : '/api/overtime/all'),
    [audience, overtimeUrl]
  );
  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  function shiftSelectedDate(days: number) {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + days);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(
      next.getDate()
    ).padStart(2, '0')}`;
    if (nextKey > todayKey) return;
    setSelectedDateKey(nextKey);
  }

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    const element = mainColRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateHeight = () => {
      setFeedPanelHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData() {
      const isSilentRefresh = silentRefreshRef.current;
      if (!isSilentRefresh) {
        setLoadError(null);
      }

      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      const [logsResult, feedLogsResult, leavesResult, rosterResult, holidayResult, dailyShiftResult, overtimeResult] =
        await Promise.allSettled([
          apiFetchJson<unknown>(
            withParams(logsUrl, {
              page: '0',
              size: '5000',
              timestampAfter: dayStart.toISOString(),
              timestampBefore: dayEnd.toISOString(),
            })
          ),
          apiFetchJson<unknown>(
            withParams(logsUrl, {
              page: '0',
              size: '5000',
              timestampAfter: feedStartDate.toISOString(),
              timestampBefore: feedEndDate.toISOString(),
            })
          ),
          apiFetchJson<unknown>(
            withParams(leavesUrl, {
              page: '0',
              size: '500',
              sort: 'requestId,desc',
            })
          ),
          rosterUrl ? apiFetchJson<unknown>(withPaging(rosterUrl, 0, 500)) : Promise.resolve([]),
          apiFetchJson<unknown>(
            withParams('/api/holidays', {
              startDate: holidayLookupStartKey,
              endDate: holidayLookupEndKey,
            })
          ),
          apiFetchJson<unknown>(
            withParams('/api/employee/schedule/daily', {
              startDate: dailyShiftLookupStartKey,
              endDate: dailyShiftLookupEndKey,
            })
          ),
          apiFetchJson<unknown>(
            withParams(overtimeEndpoint, {
              page: '0',
              size: '4000',
              requestStatus: 'APPROVED',
            })
          ),
        ]);

      if (cancelled) return;

      if (logsResult.status === 'fulfilled') {
        setLogs(toArray<AttendanceLog>(logsResult.value));
        setLoadError(null);
      } else if (!isSilentRefresh) {
        setLogs([]);
        setLoadError(logsResult.reason instanceof Error ? logsResult.reason.message : 'Failed to load attendance logs.');
      }

      if (feedLogsResult.status === 'fulfilled') {
        setFeedLogs(toArray<AttendanceLog>(feedLogsResult.value));
      } else if (!isSilentRefresh) {
        setFeedLogs([]);
      }

      if (leavesResult.status === 'fulfilled') {
        setLeaveRequests(toArray<LeaveRequest>(leavesResult.value));
      } else if (!isSilentRefresh) {
        setLeaveRequests([]);
      }

      if (rosterResult.status === 'fulfilled') {
        setEmployees(rosterRows(rosterResult.value).filter((row) => Number.isFinite(row.id)));
      } else if (!isSilentRefresh) {
        setEmployees([]);
      }

      if (holidayResult.status === 'fulfilled') {
        const parsedHolidayLookup = parseHolidayLookup(holidayResult.value);
        setHolidayDateKeys(parsedHolidayLookup.holidayDates);
        setHolidayNamesByDate(parsedHolidayLookup.holidayNames);
      } else if (!isSilentRefresh) {
        setHolidayDateKeys([]);
        setHolidayNamesByDate({});
      }

      if (dailyShiftResult.status === 'fulfilled') {
        setDailyShifts(toArray<DailyShift>(dailyShiftResult.value));
      } else if (!isSilentRefresh) {
        setDailyShifts([]);
      }

      if (overtimeResult.status === 'fulfilled') {
        const nextApprovedOvertime = toArray<OvertimeRequest>(overtimeResult.value).filter((request) => {
          const employeeId = Number(request.employeeId);
          const workDateKey = localDateKey(request.workDate);
          return (
            Number.isFinite(employeeId) &&
            Boolean(workDateKey) &&
            workDateKey >= holidayLookupStartKey &&
            workDateKey <= holidayLookupEndKey &&
            String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
          );
        });
        setApprovedOvertime(nextApprovedOvertime);
      } else if (!isSilentRefresh) {
        setApprovedOvertime([]);
      }

      silentRefreshRef.current = false;
    }

    void fetchDashboardData();

    return () => {
      cancelled = true;
      silentRefreshRef.current = false;
    };
  }, [
    effectiveSelectedDateKey,
    feedEndDate,
    feedStartDate,
    holidayLookupEndKey,
    holidayLookupStartKey,
    dailyShiftLookupEndKey,
    dailyShiftLookupStartKey,
    leavesUrl,
    logsUrl,
    overtimeEndpoint,
    refreshTick,
    rosterUrl,
    selectedDate,
  ]);

  const employeeById = useMemo(() => {
    const map = new Map<number, EmployeeRow>();
    for (const employee of employees) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employees]);

  const holidayDateSet = useMemo(() => new Set(holidayDateKeys), [holidayDateKeys]);
  const selectedIsHoliday = holidayDateSet.has(effectiveSelectedDateKey);
  const selectedHolidayName = holidayNamesByDate[effectiveSelectedDateKey] ?? 'Holiday';

  const scheduledShiftsByEmployeeAndDate = useMemo(() => {
    const grouped = new Map<string, DailyShift[]>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !workDateKey) continue;
      if (shift.dayOff === true) continue;

      const key = `${employeeId}:${workDateKey}`;
      const current = grouped.get(key) ?? [];
      current.push(shift);
      grouped.set(key, current);
    }

    return grouped;
  }, [dailyShifts]);

  const dailyShiftDateKeysByEmployee = useMemo(() => {
    const grouped = new Map<number, Set<string>>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !workDateKey || shift.dayOff === true) continue;

      const current = grouped.get(employeeId) ?? new Set<string>();
      current.add(workDateKey);
      grouped.set(employeeId, current);
    }

    return grouped;
  }, [dailyShifts]);

  const explicitDayOffDateKeysByEmployee = useMemo(() => {
    const grouped = new Map<number, Set<string>>();

    for (const shift of dailyShifts) {
      const employeeId = Number(shift.employeeId);
      const workDateKey = localDateKey(shift.workDate ?? shift.startDateTime);
      if (!Number.isFinite(employeeId) || !workDateKey || shift.dayOff !== true) continue;

      const current = grouped.get(employeeId) ?? new Set<string>();
      current.add(workDateKey);
      grouped.set(employeeId, current);
    }

    return grouped;
  }, [dailyShifts]);

  const selectedDateLogs = useMemo(() => {
    return logs.filter((log) => {
      if (localDateKey(log.timestamp) !== effectiveSelectedDateKey) return false;
      const employee = employeeById.get(log.employeeId ?? -1);
      if (!employee) return false;
      return String(employee.status).toUpperCase() !== 'TERMINATED';
    });
  }, [effectiveSelectedDateKey, employeeById, logs]);

  const selectedApprovedLeaves = useMemo(() => {
    return leaveRequests.filter((request) => {
      if (String(request.requestStatus ?? '').toUpperCase() !== 'APPROVED') return false;
      return isTodayWithin(request.startDateTime, request.endDateTime, selectedDate);
    });
  }, [leaveRequests, selectedDate]);

  const selectedLeaveRequestsByEmployee = useMemo(
    () => groupLeavesByEmployee(selectedApprovedLeaves),
    [selectedApprovedLeaves]
  );

  const approvedOvertimeByDate = useMemo(() => {
    const grouped = new Map<string, OvertimeRequest[]>();

    for (const request of approvedOvertime) {
      const dateKey = localDateKey(request.workDate);
      if (!dateKey) continue;
      const current = grouped.get(dateKey) ?? [];
      current.push(request);
      grouped.set(dateKey, current);
    }

    return grouped;
  }, [approvedOvertime]);

  const selectedApprovedOvertimeByEmployee = useMemo(
    () => groupOvertimeByEmployee(approvedOvertimeByDate.get(effectiveSelectedDateKey) ?? []),
    [approvedOvertimeByDate, effectiveSelectedDateKey]
  );

  const dailyRecords = useMemo(
    () =>
      buildDailyRecords(
        selectedDateLogs,
        employeeById,
        effectiveSelectedDateKey,
        scheduledShiftsByEmployeeAndDate,
        selectedApprovedOvertimeByEmployee
      ),
    [
      effectiveSelectedDateKey,
      employeeById,
      scheduledShiftsByEmployeeAndDate,
      selectedDateLogs,
      selectedApprovedOvertimeByEmployee,
    ]
  );

  const dailyRecordByEmployeeId = useMemo(
    () => new Map(dailyRecords.map((record) => [record.employeeId, record] as const)),
    [dailyRecords]
  );

  const lateSet = useMemo(
    () =>
      new Set(
        dailyRecords
          .filter((record) => record.attendanceStatus === 'PRESENT' && record.isLate)
          .map((record) => record.employeeId)
      ),
    [dailyRecords]
  );

  const presentSet = useMemo(
    () =>
      new Set(
        dailyRecords
          .filter((record) => record.attendanceStatus === 'PRESENT' && !record.isLate)
          .map((record) => record.employeeId)
      ),
    [dailyRecords]
  );

  const outsideScheduleSet = useMemo(
    () =>
      new Set(
        dailyRecords
          .filter((record) => record.attendanceStatus === 'OUTSIDE_SCHEDULE')
          .map((record) => record.employeeId)
      ),
    [dailyRecords]
  );

  const lateClockInByEmployee = useMemo(
    () =>
      new Map(
        dailyRecords
          .filter((record) => record.attendanceStatus === 'PRESENT' && record.isLate)
          .map((record) => [record.employeeId, record.inTime || 'Late clock-in logged'])
      ),
    [dailyRecords]
  );

  const activeEmployees = useMemo(() => {
    return employees.filter((employee) => employee.status.toUpperCase() !== 'TERMINATED');
  }, [employees]);

  const activeEmployeeIds = useMemo(() => activeEmployees.map((employee) => employee.id), [activeEmployees]);
  const scheduledEmployeeCountSelected = useMemo(
    () =>
      selectedIsHoliday
        ? 0
        : activeEmployees.filter((employee) =>
            hasScheduledWorkOnDate(
              employee,
              effectiveSelectedDateKey,
              dailyShiftDateKeysByEmployee,
              explicitDayOffDateKeysByEmployee
            )
          ).length,
    [
      activeEmployees,
      dailyShiftDateKeysByEmployee,
      effectiveSelectedDateKey,
      explicitDayOffDateKeysByEmployee,
      selectedIsHoliday,
    ]
  );

  const attendanceFeed: FeedItem[] = useMemo(() => {
    const feedSourceLogs = feedScope === 'selected-date' ? selectedDateLogs : feedLogs;

    return [...feedSourceLogs]
      .sort((a, b) => {
        const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
        const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
        return bt - at;
      })
      .filter((log) => {
        const employee = employeeById.get(log.employeeId ?? -1);
        if (!employee) return false;
        return String(employee.status).toUpperCase() !== 'TERMINATED';
      })
      .map((log, idx) => {
        const employee = employeeById.get(log.employeeId ?? -1);
        const logDateKey = localDateKey(log.timestamp);
        const derivedLate =
          isInDirection(log.direction) &&
          isLateForSchedule(log.timestamp, employee, logDateKey, log.direction);
        return {
          id: String(log.attendanceId ?? idx),
          name: employeeName(employee),
          directionLabel: derivedLate ? 'LATE' : directionIndicator(log.direction),
          directionTone: derivedLate ? 'late' : directionIndicatorTone(log.direction),
          position: employee?.position || 'Position unavailable',
          time: formatFeedTimestamp(log.timestamp, feedTimeDisplay === 'time-only' ? false : includeWeeklyFeed),
        };
      });
  }, [employeeById, feedLogs, feedScope, feedTimeDisplay, includeWeeklyFeed, selectedDateLogs]);

  const onLeave: LeaveCardItem[] = useMemo(() => {
    return selectedApprovedLeaves.map((request, idx) => {
        const employee = employeeById.get(request.empId ?? -1);
        return {
          id: String(request.requestId ?? idx),
          name: employeeName(employee),
          summary: request.isPaid ? 'Paid leave' : 'Unpaid leave',
          detail: request.reason?.trim() || 'Approved leave request',
          period: formatPeriodLabel(request.startDateTime, request.endDateTime),
        };
      });
  }, [employeeById, selectedApprovedLeaves]);

  const employeesOnLeaveToday = useMemo(() => {
    const ids = new Set<number>();
    for (const request of selectedApprovedLeaves) {
      if (typeof request.empId !== 'number') continue;
      ids.add(request.empId);
    }
    return ids;
  }, [selectedApprovedLeaves]);

  const absentToday = useMemo(() => {
    if (selectedIsHoliday) return [];
    return activeEmployees
      .filter((employee) =>
        hasScheduledWorkOnDate(
          employee,
          effectiveSelectedDateKey,
          dailyShiftDateKeysByEmployee,
          explicitDayOffDateKeysByEmployee
        )
      )
      .filter((employee) =>
        isEmployeeScheduledToHaveStartedByNow(
          employee,
          effectiveSelectedDateKey,
          todayKey,
          selectedLeaveRequestsByEmployee.get(employee.id) || []
        )
      )
      .filter((employee) => !employeesOnLeaveToday.has(employee.id))
      .filter((employee) => {
        const record = dailyRecordByEmployeeId.get(employee.id);
        return !record || (record.attendanceStatus !== 'PRESENT' && record.attendanceStatus !== 'OUTSIDE_SCHEDULE');
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((employee) => ({
        id: String(employee.id),
        name: employee.name,
        summary: employee.position || 'No position assigned',
        detail: resolveDepartmentLabel(employee),
      }));
  }, [
    activeEmployees,
    dailyShiftDateKeysByEmployee,
    effectiveSelectedDateKey,
    dailyRecordByEmployeeId,
    employeesOnLeaveToday,
    explicitDayOffDateKeysByEmployee,
    selectedIsHoliday,
    selectedLeaveRequestsByEmployee,
    todayKey,
  ]);

  const lateToday = useMemo(() => {
    return activeEmployees
      .filter((employee) => lateSet.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((employee) => ({
        id: String(employee.id),
        name: employee.name,
        summary: employee.position || 'No position assigned',
        detail: resolveDepartmentLabel(employee),
        timeIn: lateClockInByEmployee.get(employee.id) || 'Late clock-in logged',
      }));
  }, [activeEmployees, lateClockInByEmployee, lateSet]);

  const overallSummary = useMemo(
    () =>
      buildAttendanceSummary(
        activeEmployeeIds,
        presentSet,
        lateSet,
        outsideScheduleSet,
        employeesOnLeaveToday,
        employeeById,
        effectiveSelectedDateKey,
        todayKey,
        selectedIsHoliday,
        selectedLeaveRequestsByEmployee,
        {
          dailyShiftDateKeysByEmployee,
          explicitDayOffDateKeysByEmployee,
        }
      ),
    [
      activeEmployeeIds,
      dailyShiftDateKeysByEmployee,
      effectiveSelectedDateKey,
      employeeById,
      employeesOnLeaveToday,
      explicitDayOffDateKeysByEmployee,
      lateSet,
      outsideScheduleSet,
      presentSet,
      selectedIsHoliday,
      selectedLeaveRequestsByEmployee,
      todayKey,
    ]
  );

  const metricCards = useMemo(() => {
    const total = overallSummary.headcount;
    const entries = (Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => {
      const value = overallSummary[key];
      const percent = total > 0 ? Math.round((value / total) * 100) : 0;
      const ringStyle =
        total > 0
          ? ({
              '--ring-fill': `${Math.max((value / total) * 360, value > 0 ? 18 : 0)}deg`,
              '--ring-color': STATUS_CONFIG[key].color,
            } as CSSProperties)
          : undefined;

      return [
        key,
        {
          key,
          label: STATUS_CONFIG[key].label,
          value,
          helper: `${percent}% of ${total} active`,
          ringStyle,
        },
      ] as const;
    });

    return Object.fromEntries(entries) as Record<AttendanceStatusKey, MetricCard>;
  }, [overallSummary]);

  const departmentBreakdown = useMemo(() => {
    const grouped = new Map<string, DepartmentBreakdownItem>();

    for (const employee of activeEmployees) {
      const label = resolveDepartmentLabel(employee);
      const current = grouped.get(label) ?? {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: label,
        headcount: 0,
        present: 0,
        late: 0,
        outsideSchedule: 0,
        absent: 0,
        onLeave: 0,
        dayOff: 0,
        upcoming: 0,
      };

      current.headcount += 1;

      const employeeSummary = buildAttendanceSummary(
        [employee.id],
        presentSet,
        lateSet,
        outsideScheduleSet,
        employeesOnLeaveToday,
        employeeById,
        effectiveSelectedDateKey,
        todayKey,
        selectedIsHoliday,
        selectedLeaveRequestsByEmployee,
        {
          dailyShiftDateKeysByEmployee,
          explicitDayOffDateKeysByEmployee,
        }
      );

      current.present += employeeSummary.present;
      current.late += employeeSummary.late;
      current.outsideSchedule += employeeSummary.outsideSchedule;
      current.absent += employeeSummary.absent;
      current.onLeave += employeeSummary.onLeave;
      current.dayOff += employeeSummary.dayOff;
      current.upcoming += employeeSummary.upcoming;
      grouped.set(label, current);
    }

    return [...grouped.values()].sort(
      (a, b) =>
        b.headcount - a.headcount ||
        b.present + b.late - (a.present + a.late) ||
        a.name.localeCompare(b.name)
    );
  }, [
    activeEmployees,
    dailyShiftDateKeysByEmployee,
    effectiveSelectedDateKey,
    employeeById,
    employeesOnLeaveToday,
    explicitDayOffDateKeysByEmployee,
    lateSet,
    outsideScheduleSet,
    presentSet,
    selectedIsHoliday,
    selectedLeaveRequestsByEmployee,
    todayKey,
  ]);

  const weeklyAttendance = useMemo(() => {
    if (!isWeeklyPrimaryPanel) return [] as WeeklyAttendanceItem[];

    const logsByDate = new Map<string, AttendanceLog[]>();
    const approvedLeaveRequests = leaveRequests.filter(
      (request) => String(request.requestStatus ?? '').toUpperCase() === 'APPROVED'
    );
    const approvedLeavesByEmployee = groupLeavesByEmployee(approvedLeaveRequests);

    for (const log of feedLogs) {
      const dateKey = localDateKey(log.timestamp);
      if (!dateKey) continue;

      const employee = employeeById.get(log.employeeId ?? -1);
      if (!employee || String(employee.status).toUpperCase() === 'TERMINATED') continue;

      const current = logsByDate.get(dateKey) ?? [];
      current.push(log);
      logsByDate.set(dateKey, current);
    }

    const items: WeeklyAttendanceItem[] = [];
    const cursor = new Date(feedStartDate);

    while (cursor.getTime() <= feedEndDate.getTime()) {
      const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate()
      ).padStart(2, '0')}`;
      const dayLogs = logsByDate.get(dateKey) ?? [];
      const dayIsHoliday = holidayDateSet.has(dateKey);
      const dayApprovedOvertimeByEmployee = groupOvertimeByEmployee(approvedOvertimeByDate.get(dateKey) ?? []);
      const dayDailyRecords = buildDailyRecords(
        dayLogs,
        employeeById,
        dateKey,
        scheduledShiftsByEmployeeAndDate,
        dayApprovedOvertimeByEmployee
      );
      const dayLateSet = new Set(
        dayDailyRecords
          .filter((record) => record.attendanceStatus === 'PRESENT' && record.isLate)
          .map((record) => record.employeeId)
      );
      const dayPresentSet = new Set(
        dayDailyRecords
          .filter((record) => record.attendanceStatus === 'PRESENT' && !record.isLate)
          .map((record) => record.employeeId)
      );
      const dayOutsideScheduleSet = new Set(
        dayDailyRecords
          .filter((record) => record.attendanceStatus === 'OUTSIDE_SCHEDULE')
          .map((record) => record.employeeId)
      );
      const dayOnLeaveSet = buildOnLeaveSetForDate(approvedLeaveRequests, cursor);

      items.push({
        id: dateKey,
        dateKey,
        dayLabel: cursor.toLocaleDateString(undefined, { weekday: 'short' }),
        dateLabel: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        summary: buildAttendanceSummary(
          activeEmployeeIds,
          dayPresentSet,
          dayLateSet,
          dayOutsideScheduleSet,
          dayOnLeaveSet,
          employeeById,
          dateKey,
          todayKey,
          dayIsHoliday,
          approvedLeavesByEmployee,
          {
            dailyShiftDateKeysByEmployee,
            explicitDayOffDateKeysByEmployee,
          }
        ),
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return items;
  }, [
    activeEmployeeIds,
    approvedOvertimeByDate,
    dailyShiftDateKeysByEmployee,
    employeeById,
    feedEndDate,
    feedLogs,
    feedStartDate,
    holidayDateSet,
    isWeeklyPrimaryPanel,
    leaveRequests,
    scheduledShiftsByEmployeeAndDate,
    explicitDayOffDateKeysByEmployee,
    todayKey,
  ]);

  const totalDeptPages = Math.max(Math.ceil(departmentBreakdown.length / DEPARTMENTS_PER_PAGE), 1);
  const activeDeptPage = Math.min(deptPage, totalDeptPages - 1);
  const visibleDepartments = departmentBreakdown.slice(
    activeDeptPage * DEPARTMENTS_PER_PAGE,
    (activeDeptPage + 1) * DEPARTMENTS_PER_PAGE
  );
  const showDepartmentNav = totalDeptPages > 1;
  const totalWeekPages = Math.max(Math.ceil(weeklyAttendance.length / DEPARTMENTS_PER_PAGE), 1);
  const activeWeekPage = Math.min(deptPage, totalWeekPages - 1);
  const visibleWeeklyAttendance = weeklyAttendance.slice(
    activeWeekPage * DEPARTMENTS_PER_PAGE,
    (activeWeekPage + 1) * DEPARTMENTS_PER_PAGE
  );
  const showWeeklyNav = totalWeekPages > 1;
  const attendanceDashboardDescription =
    descriptionOverride ?? (
      audience.toLowerCase() === 'manager'
        ? undefined
        : 'Track attendance activity, late logs, and department trends from the latest records.'
    );
  const centerPanelTitle = isWeeklyPrimaryPanel ? 'Weekly Attendance' : 'Attendance by Department';
  const selectedDateFeedTitle = isSelectedDateToday ? 'Attendance Today' : `Attendance on ${selectedDateShortLabel}`;
  const feedPanelTitle =
    feedScope === 'selected-date'
      ? selectedDateFeedTitle
      : isWeeklyPrimaryPanel
        ? 'Attendance Activity'
        : includeWeeklyFeed
          ? 'Weekly Attendance'
          : selectedDateFeedTitle;
  const resolvedFeedPanelTitle = feedTitleOverride ?? feedPanelTitle;
  const feedEmptyStateLabel =
    feedScope === 'selected-date'
      ? selectedDateHeading
      : includeWeeklyFeed
        ? feedRangeLabel
        : selectedDateHeading;

  return (
    <div className="hrDash">
      <AttendanceDashboardHeader
        description={attendanceDashboardDescription}
        isSelectedDateToday={isSelectedDateToday}
        selectedDateHeading={selectedDateHeading}
        selectedDateKey={effectiveSelectedDateKey}
        todayKey={todayKey}
        onSelectDate={(value) => setSelectedDateKey(value)}
        onShiftDate={shiftSelectedDate}
      />
      <div className="hrDash__grid">
        <div className="hrDash__mainCol" ref={mainColRef}>
          <DashboardSummaryCards metricCards={metricCards} />
          <AttendanceBreakdownPanel
            activeDeptPage={activeDeptPage}
            activeWeekPage={activeWeekPage}
            departmentBreakdown={departmentBreakdown}
            isWeeklyPrimaryPanel={isWeeklyPrimaryPanel}
            showDepartmentNav={showDepartmentNav}
            showWeeklyNav={showWeeklyNav}
            title={centerPanelTitle}
            totalDeptPages={totalDeptPages}
            totalWeekPages={totalWeekPages}
            visibleDepartments={visibleDepartments}
            visibleWeeklyAttendance={visibleWeeklyAttendance}
            weeklyAttendance={weeklyAttendance}
            onNextDepartmentPage={() => setDeptPage((page) => (page + 1 < totalDeptPages ? page + 1 : page))}
            onNextWeekPage={() => setDeptPage((page) => (page + 1 < totalWeekPages ? page + 1 : page))}
            onPreviousDepartmentPage={() => setDeptPage((page) => Math.max(0, page - 1))}
            onPreviousWeekPage={() => setDeptPage((page) => Math.max(0, page - 1))}
          />
          <AttendanceStatusPanels
            absentItems={absentToday}
            lateItems={lateToday}
            leaveItems={onLeave}
            scheduledEmployeeCountSelected={scheduledEmployeeCountSelected}
            selectedDateHeading={selectedDateHeading}
            selectedDateShortLabel={selectedDateShortLabel}
            selectedHolidayName={selectedHolidayName}
            selectedIsHoliday={selectedIsHoliday}
            isSelectedDateToday={isSelectedDateToday}
          />
        </div>
        <AttendanceFeedPanel
          emptyStateLabel={feedEmptyStateLabel}
          feedPanelHeight={feedPanelHeight}
          items={attendanceFeed}
          selectedDateHeading={selectedDateHeading}
          selectedHolidayName={selectedHolidayName}
          selectedIsHoliday={selectedIsHoliday}
          showHolidayEmptyState={feedScope === 'selected-date'}
          title={resolvedFeedPanelTitle}
        />
      </div>
    </div>
  );
}
