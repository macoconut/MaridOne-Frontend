import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiClock, FiCalendar } from 'react-icons/fi';
import PageHeader from '../../../components/layout/PageHeader';
import { apiFetchJson, toArray } from '../../../lib/api';
import { useRegisterPageRefresh } from '../../../lib/pageRefresh';
import './Dashboard.css';

type AttendanceLog = {
  attendanceId?: number;
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

const REGULAR_CLOCK_IN_WINDOW_START_HOUR = 4;
const REGULAR_CLOCK_IN_WINDOW_END_HOUR = 12;

type LeaveRequest = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  isPaid?: boolean;
};

type EmployeeRow = {
  id: number;
  name: string;
  status: string;
  position: string;
  department?: string;
};

type FeedItem = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  time: string;
};

type LeaveCardItem = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  period: string;
};

type DepartmentBreakdownItem = {
  id: string;
  name: string;
  headcount: number;
  present: number;
  late: number;
  onLeave: number;
};

type AttendanceOverviewDashboardProps = {
  audience?: string;
  logsUrl?: string;
  leavesUrl?: string;
  rosterUrl?: string;
};

function localDateKey(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(value?: string) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPeriodLabel(start?: string, end?: string) {
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

function isTodayWithin(start?: string, end?: string, today = new Date()) {
  if (!start || !end) return false;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;

  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

  return startDate.getTime() <= dayEnd && endDate.getTime() >= dayStart;
}

function withPaging(path: string, page: number, size: number) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}page=${page}&size=${size}`;
}

function employeeName(employee: EmployeeRow | undefined) {
  return employee?.name || 'Employee record unavailable';
}

function isInDirection(direction?: string) {
  return String(direction ?? '')
    .toUpperCase()
    .includes('IN');
}

function isLateDirection(direction?: string) {
  return String(direction ?? '')
    .toUpperCase()
    .includes('LATE');
}

function withinRegularClockInWindow(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const hour = date.getHours();
  return hour >= REGULAR_CLOCK_IN_WINDOW_START_HOUR && hour < REGULAR_CLOCK_IN_WINDOW_END_HOUR;
}

function rosterDisplayName(row: Record<string, unknown>) {
  const firstName = typeof row.firstName === 'string' ? row.firstName.trim() : '';
  const middleName = typeof row.middleName === 'string' ? row.middleName.trim() : '';
  const lastName = typeof row.lastName === 'string' ? row.lastName.trim() : '';
  const givenNames = [firstName, middleName].filter((part) => part.length > 0).join(' ');
  const label = [lastName, givenNames].filter((part) => part.length > 0).join(', ');
  return label || 'Employee record unavailable';
}

function rosterRows(payload: unknown) {
  return toArray<Record<string, unknown>>(payload).map((row, idx) => ({
    id: Number(row.employeeId ?? row.id ?? idx + 1),
    name: rosterDisplayName(row),
    status: String(row.employmentStatus ?? '-'),
    position: String(row.position ?? '-'),
    department: typeof row.department === 'string' ? row.department.trim() : '',
  }));
}

function resolveDepartmentLabel(employee: EmployeeRow) {
  const value = String(employee.department ?? '').trim();
  return value || 'Unassigned';
}

export default function HrDashboard() {
  return <AttendanceOverviewDashboard audience="HR" />;
}

export function AttendanceOverviewDashboard({
  audience = 'HR',
  logsUrl = '/api/logs/attendance',
  leavesUrl = '/api/leave/request',
  rosterUrl = '/api/employees',
}: AttendanceOverviewDashboardProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deptPage, setDeptPage] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useRegisterPageRefresh(handlePageRefresh);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardData(silent = false) {
      if (!silent) setIsLoading(true);
      setLoadError(null);

      const [logsResult, leavesResult, rosterResult] = await Promise.allSettled([
        apiFetchJson<unknown>(withPaging(logsUrl, 0, 400)),
        apiFetchJson<unknown>(withPaging(leavesUrl, 0, 200)),
        rosterUrl ? apiFetchJson<unknown>(withPaging(rosterUrl, 0, 500)) : Promise.resolve([]),
      ]);

      if (cancelled) return;

      if (logsResult.status === 'fulfilled') {
        setLogs(toArray<AttendanceLog>(logsResult.value));
      } else {
        setLogs([]);
        setLoadError(logsResult.reason instanceof Error ? logsResult.reason.message : 'Failed to load attendance logs.');
      }

      if (leavesResult.status === 'fulfilled') {
        setLeaveRequests(toArray<LeaveRequest>(leavesResult.value));
      } else {
        setLeaveRequests([]);
      }

      if (rosterResult.status === 'fulfilled') {
        setEmployees(rosterRows(rosterResult.value).filter((row) => Number.isFinite(row.id)));
      } else {
        setEmployees([]);
      }

      if (!silent) setIsLoading(false);
    }

    void fetchDashboardData(false);
    const timer = window.setInterval(() => {
      void fetchDashboardData(true);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [leavesUrl, logsUrl, refreshTick, rosterUrl]);

  const employeeById = useMemo(() => {
    const map = new Map<number, EmployeeRow>();
    for (const employee of employees) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employees]);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const todayLogs = useMemo(() => {
    return logs.filter((log) => localDateKey(log.timestamp) === todayKey);
  }, [logs, todayKey]);

  const firstClockInByEmployee = useMemo(() => {
    const byEmployee = new Map<number, AttendanceLog>();
    for (const log of [...todayLogs].sort((a, b) => {
      const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
      const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
      return at - bt;
    })) {
      if (typeof log.employeeId !== 'number') continue;
      if (!isInDirection(log.direction)) continue;
      if (!byEmployee.has(log.employeeId)) {
        byEmployee.set(log.employeeId, log);
      }
    }
    return byEmployee;
  }, [todayLogs]);

  const presentSet = useMemo(() => {
    const ids = new Set<number>();
    for (const log of todayLogs) {
      if (typeof log.employeeId === 'number') ids.add(log.employeeId);
    }
    return ids;
  }, [todayLogs]);

  const lateSet = useMemo(() => {
    const ids = new Set<number>();
    for (const log of todayLogs) {
      if (typeof log.employeeId !== 'number') continue;
      if (isLateDirection(log.direction)) ids.add(log.employeeId);
    }
    return ids;
  }, [todayLogs]);

  const onTimeSet = useMemo(() => {
    const ids = new Set<number>();
    for (const [employeeId, clockInLog] of firstClockInByEmployee.entries()) {
      if (isLateDirection(clockInLog.direction)) continue;
      if (!withinRegularClockInWindow(clockInLog.timestamp)) continue;
      ids.add(employeeId);
    }
    return ids;
  }, [firstClockInByEmployee]);

  const metricCards = useMemo(
    () => [
      { label: 'Present', value: presentSet.size },
      { label: 'Attendance Logs', value: todayLogs.length },
      { label: 'On Time', value: onTimeSet.size },
      { label: 'Late', value: lateSet.size },
    ],
    [lateSet.size, onTimeSet.size, presentSet.size, todayLogs.length]
  );

  const activeEmployees = useMemo(() => {
    return employees.filter((employee) => employee.status.toUpperCase() !== 'TERMINATED');
  }, [employees]);

  const attendanceFeed: FeedItem[] = useMemo(() => {
    return [...logs]
      .sort((a, b) => {
        const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
        const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
        return bt - at;
      })
      .slice(0, 10)
      .map((log, idx) => {
        const date = typeof log.timestamp === 'string' ? new Date(log.timestamp) : null;
        const direction = typeof log.direction === 'string' ? log.direction : 'Attendance log';
        return {
          id: String(log.attendanceId ?? idx),
          name: employeeName(employeeById.get(log.employeeId ?? -1)),
          summary: direction,
          detail: date
            ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Recorded recently',
          time: date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        };
      });
  }, [employeeById, logs]);

  const lateToday = useMemo(() => {
    return [...todayLogs]
      .filter((log) => typeof log.direction === 'string' && log.direction.toUpperCase().includes('LATE'))
      .map((log, idx) => {
        const time = log.timestamp
          ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'N/A';
        const employee = employeeById.get(log.employeeId ?? -1);

        return {
          id: String(log.attendanceId ?? idx),
          name: employeeName(employee),
          summary: employee?.position ? `${employee.position} • Late attendance entry` : 'Late attendance entry',
          detail: `Direction: ${String(log.direction ?? 'UNKNOWN')}`,
          timeIn: time,
          duration: lateSet.has(log.employeeId ?? -1) ? 'Late flag active' : 'Under review',
          period: 'Today',
        };
      });
  }, [employeeById, lateSet, todayLogs]);

  const onLeave: LeaveCardItem[] = useMemo(() => {
    return leaveRequests
      .filter((request) => String(request.requestStatus ?? '').toUpperCase() === 'APPROVED')
      .filter((request) => isTodayWithin(request.startDateTime, request.endDateTime, now))
      .map((request, idx) => {
        const employee = employeeById.get(request.empId ?? -1);
        return {
          id: String(request.requestId ?? idx),
          name: employeeName(employee),
          summary: request.isPaid ? 'Paid leave' : 'Unpaid leave',
          detail: request.reason?.trim() || 'Approved leave request',
          period: formatPeriodLabel(request.startDateTime, request.endDateTime),
        };
      });
  }, [employeeById, leaveRequests, now]);

  const employeesOnLeaveToday = useMemo(() => {
    const ids = new Set<number>();
    for (const request of leaveRequests) {
      if (typeof request.empId !== 'number') continue;
      if (String(request.requestStatus ?? '').toUpperCase() !== 'APPROVED') continue;
      if (!isTodayWithin(request.startDateTime, request.endDateTime, now)) continue;
      ids.add(request.empId);
    }
    return ids;
  }, [leaveRequests, now]);

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
        onLeave: 0,
      };

      current.headcount += 1;
      if (presentSet.has(employee.id)) current.present += 1;
      if (lateSet.has(employee.id)) current.late += 1;
      if (employeesOnLeaveToday.has(employee.id)) current.onLeave += 1;
      grouped.set(label, current);
    }

    return [...grouped.values()].sort(
      (a, b) => b.present - a.present || b.headcount - a.headcount || a.name.localeCompare(b.name)
    );
  }, [activeEmployees, employeesOnLeaveToday, lateSet, presentSet]);

  const maxDeptPage = Math.max(departmentBreakdown.length - 1, 0);
  const activeDeptPage = Math.min(deptPage, maxDeptPage);
  const visibleDepartments = departmentBreakdown.slice(activeDeptPage, activeDeptPage + 1);
  const attendanceDashboardDescription =
    audience === 'Manager'
      ? 'Track team attendance activity, late logs, and department trends from the latest records.'
      : 'Track attendance activity, late logs, and department trends from the latest records.';

  return (
    <div className="hrDash">
      <div className="hrDash__top">
        <PageHeader
          title="Attendance Dashboard"
          description={attendanceDashboardDescription}
          meta={
            <span>
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          }
        />
        <div className="hrDash__topActions">
          <button className="hrDash__exportBtn" type="button" onClick={() => window.print()}>
            Export Attendance
            <br />
            Analytics
          </button>
        </div>
      </div>
      {isLoading && <p className="hrDash__subtitle">Loading {audience.toLowerCase()} dashboard data...</p>}
      {!isLoading && loadError && <p className="hrDash__subtitle">Failed to load attendance logs: {loadError}</p>}

      <div className="hrDash__grid">
        <div className="hrDash__mainCol">
          <section className="hrStatRow">
            {metricCards.map((card) => (
              <article key={card.label} className="hrStatCard">
                <div className="hrStatCard__ring" />
                <div className="hrStatCard__body">
                  <div className="hrStatCard__label">{card.label}</div>
                  <div className="hrStatCard__value">{card.value}</div>
                </div>
              </article>
            ))}
          </section>

          <section className="hrPanel">
            <div className="hrPanel__header">Attendance by Department</div>
            {departmentBreakdown.length > 0 ? (
              <>
                <div className="hrDept">
                  <button
                    className="hrCircleBtn"
                    type="button"
                    aria-label="Previous department page"
                    onClick={() => setDeptPage((page) => Math.max(0, page - 1))}
                    disabled={activeDeptPage === 0}
                  >
                    <FiChevronLeft />
                  </button>

                  <div className="hrDeptGrid">
                    {visibleDepartments.map((department, index) => {
                      const availableToday = Math.max(department.headcount - department.onLeave, 0);
                      const coverage = department.headcount > 0 ? Math.round((department.present / department.headcount) * 100) : 0;

                      return (
                      <article key={department.id} className="hrDeptCard">
                        <div className="hrDeptCard__top">
                          <div>
                            <div className="hrDeptCard__eyebrow">Department Overview</div>
                            <div className="hrDeptCard__name">{department.name}</div>
                          </div>
                          <span className="hrDeptCard__pageTag">
                            {activeDeptPage + index + 1} / {departmentBreakdown.length}
                          </span>
                        </div>
                        <div className="hrDeptCard__metaRow">
                          <span className="hrDeptCard__meta">
                            {department.headcount} active employee{department.headcount === 1 ? '' : 's'}
                          </span>
                          <span className="hrDeptCard__meta hrDeptCard__meta--accent">{coverage}% attendance coverage</span>
                        </div>
                        <div className="hrDeptCard__stats">
                          <div className="hrDeptStat hrDeptStat--present">
                            <span>Present</span>
                            <strong>{department.present}</strong>
                          </div>
                          <div className="hrDeptStat hrDeptStat--late">
                            <span>Late</span>
                            <strong>{department.late}</strong>
                          </div>
                          <div className="hrDeptStat hrDeptStat--leave">
                            <span>On Leave</span>
                            <strong>{department.onLeave}</strong>
                          </div>
                        </div>
                        <div className="hrDeptCard__footer">
                          <span>Available today: {availableToday}</span>
                          <span>Slide through departments</span>
                        </div>
                      </article>
                      );
                    })}
                  </div>

                  <button
                    className="hrCircleBtn"
                    type="button"
                    aria-label="Next department page"
                    onClick={() => setDeptPage((page) => (page + 1 < departmentBreakdown.length ? page + 1 : page))}
                    disabled={activeDeptPage + 1 >= departmentBreakdown.length}
                  >
                    <FiChevronRight />
                  </button>
                </div>

                {maxDeptPage > 0 && (
                  <div className="hrPager" aria-hidden="true">
                    {Array.from({ length: maxDeptPage + 1 }).map((_, index) => (
                      <span key={`dept-page-${index}`} className={index === activeDeptPage ? 'is-active' : ''} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="hrDeptGrid">
                <div className="hrDeptCard hrDeptCard--empty">
                  <div className="hrDeptCard__name">No department attendance data yet.</div>
                </div>
              </div>
            )}
            <div className="hrLegend hrLegend--note">
              <span className="hrLegend__note">
                Department totals are grouped from the employee department data returned by the backend roster.
              </span>
            </div>
          </section>

          <div className="hrDash__bottomRow">
            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header hrPanel__header--split">
                <span>Late Today</span>
                <span className="hrPanel__badge">{lateToday.length}</span>
              </div>
              <div className="hrPeopleList">
                {lateToday.length > 0 ? (
                  lateToday.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__avatar" />
                      <div className="hrPerson__body">
                        <div className="hrPerson__name">{item.name}</div>
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
                        <div className="hrPerson__infoRow">
                          <span>
                            <FiClock /> {item.timeIn}
                          </span>
                          <span>
                            <FiClock /> {item.duration}
                          </span>
                          <span>
                            <FiCalendar /> {item.period}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="hrPerson">
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">No late attendance entries today.</div>
                    </div>
                  </article>
                )}
              </div>
            </section>

            <section className="hrPanel hrListPanel">
              <div className="hrPanel__header hrPanel__header--split">
                <span>On Leave</span>
                <span className="hrPanel__badge">{onLeave.length}</span>
              </div>
              <div className="hrPeopleList">
                {onLeave.length > 0 ? (
                  onLeave.map((item) => (
                    <article key={item.id} className="hrPerson">
                      <div className="hrPerson__avatar" />
                      <div className="hrPerson__body">
                        <div className="hrPerson__name">{item.name}</div>
                        <div className="hrPerson__meta">{item.summary}</div>
                        <div className="hrPerson__meta">{item.detail}</div>
                        <div className="hrPerson__infoRow">
                          <span>
                            <FiCalendar /> {item.period}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="hrPerson">
                    <div className="hrPerson__body">
                      <div className="hrPerson__name">No approved leave requests covering today.</div>
                    </div>
                  </article>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="hrPanel hrFeedPanel">
          <div className="hrPanel__header">Attendance Feed</div>
          <div className="hrPeopleList">
            {attendanceFeed.length > 0 ? (
              attendanceFeed.map((item) => (
                <article key={item.id} className="hrPerson">
                  <div className="hrPerson__avatar" />
                  <div className="hrPerson__body">
                    <div className="hrPerson__name">{item.name}</div>
                    <div className="hrPerson__meta">{item.summary}</div>
                    <div className="hrPerson__meta">{item.detail}</div>
                  </div>
                  <div className="hrPerson__time">{item.time}</div>
                </article>
              ))
            ) : (
              <article className="hrPerson">
                <div className="hrPerson__body">
                  <div className="hrPerson__name">No attendance feed yet.</div>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
