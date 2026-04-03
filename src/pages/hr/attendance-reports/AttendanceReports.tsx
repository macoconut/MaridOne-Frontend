import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiUsers, FiX } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import { useRegisterPageRefresh } from '../../../lib/pageRefresh';
import './AttendanceReports.css';

type AttendanceLog = {
  attendanceId?: number;
  employeeId?: number;
  timestamp?: string;
  direction?: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  status: string;
  position: string;
};

type DayCell = {
  day: number | null;
  presentCount: number;
  lateCount: number;
  incompleteCount: number;
  absentCount: number | null;
};

type DailyEmployeeRecord = {
  employeeId: number;
  name: string;
  position: string;
  status: string;
  inTime?: string;
  outTime?: string;
  logCount: number;
  isLate: boolean;
  isIncomplete: boolean;
};

type AttendanceReportsBoardProps = {
  audienceLabel?: string;
  logsUrl?: string;
  rosterUrl?: string;
};

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function localDateKey(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function localTimeLabel(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isInDirection(direction?: string) {
  const value = (direction ?? '').toUpperCase();
  return value.includes('IN') || value.includes('LATE');
}

function isOutDirection(direction?: string) {
  return (direction ?? '').toUpperCase().includes('OUT');
}

function isLateDirection(direction?: string) {
  return (direction ?? '').toUpperCase().includes('LATE');
}

function monthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBased = first.getDay();
  const cells: DayCell[] = [];

  for (let i = 0; i < sundayBased; i++) {
    cells.push({ day: null, presentCount: 0, lateCount: 0, incompleteCount: 0, absentCount: null });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, presentCount: 0, lateCount: 0, incompleteCount: 0, absentCount: null });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: null, presentCount: 0, lateCount: 0, incompleteCount: 0, absentCount: null });
  }

  return cells;
}

function employeeName(employee: EmployeeRow | undefined, employeeId: number) {
  return employee?.name || `Employee #${employeeId}`;
}

function buildDailyRecords(logs: AttendanceLog[], employeeById: Map<number, EmployeeRow>) {
  const grouped = new Map<number, AttendanceLog[]>();

  for (const log of logs) {
    if (typeof log.employeeId !== 'number') continue;
    const current = grouped.get(log.employeeId) ?? [];
    current.push(log);
    grouped.set(log.employeeId, current);
  }

  return [...grouped.entries()]
    .map(([employeeId, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        const at = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
        const bt = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
        return at - bt;
      });
      const firstIn = sorted.find((row) => isInDirection(row.direction));
      const lastOut = [...sorted].reverse().find((row) => isOutDirection(row.direction));
      const isLate = sorted.some((row) => isLateDirection(row.direction));
      const hasIn = sorted.some((row) => isInDirection(row.direction));
      const hasOut = sorted.some((row) => isOutDirection(row.direction));
      const employee = employeeById.get(employeeId);

      return {
        employeeId,
        name: employeeName(employee, employeeId),
        position: employee?.position || '-',
        status: employee?.status || '-',
        inTime: localTimeLabel(firstIn?.timestamp),
        outTime: localTimeLabel(lastOut?.timestamp),
        logCount: sorted.length,
        isLate,
        isIncomplete: !(hasIn && hasOut),
      } satisfies DailyEmployeeRecord;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function withParams(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${query}`;
}

function rosterRows(payload: unknown) {
  return toArray<Record<string, unknown>>(payload).map((row, idx) => ({
    id: Number(row.employeeId ?? row.id ?? idx + 1),
    name:
      [row.firstName, row.middleName, row.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ') || `Employee #${row.employeeId ?? row.id ?? idx + 1}`,
    status: String(row.employmentStatus ?? '-'),
    position: String(row.position ?? '-'),
  }));
}

export default function HrAttendanceReports() {
  return <AttendanceReportsBoard audienceLabel="HR" />;
}

export function AttendanceReportsBoard({
  audienceLabel = 'HR',
  logsUrl = '/api/logs/attendance',
  rosterUrl = '/api/employees',
}: AttendanceReportsBoardProps) {
  const today = useMemo(() => new Date(), []);
  const todayYear = today.getFullYear();
  const todayMonthIndex = today.getMonth();
  const todayDateKey = toISODate(todayYear, todayMonthIndex, today.getDate());
  const [year, setYear] = useState(todayYear);
  const [monthIndex, setMonthIndex] = useState(todayMonthIndex);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const [monthValue, setMonthValue] = useState(
    new Date(todayYear, todayMonthIndex, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  );
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [hasFullRoster, setHasFullRoster] = useState(false);
  const [rosterMessage, setRosterMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [detailOpen, setDetailOpen] = useState(false);
  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useRegisterPageRefresh(handlePageRefresh);

  useEffect(() => {
    if (detailOpen) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [detailOpen]);

  useEffect(() => {
    setMonthValue(
      new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [monthIndex, year]);

  useEffect(() => {
    if (year === todayYear && monthIndex === todayMonthIndex) {
      setSelectedDateKey(todayDateKey);
    } else {
      setSelectedDateKey('');
    }
  }, [monthIndex, todayDateKey, todayMonthIndex, todayYear, year]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setIsLoading(true);
      setLoadError('');
      try {
        const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        const logResponse = await apiFetchJson<unknown>(
          withParams(logsUrl, {
            page: '0',
            size: '5000',
            timestampAfter: start.toISOString(),
            timestampBefore: end.toISOString(),
          })
        );
        if (cancelled) return;

        const nextLogs = toArray<AttendanceLog>(logResponse);
        setLogs(nextLogs);

        try {
          const employeeResponse = await apiFetchJson<unknown>(withParams(rosterUrl, { page: '0', size: '500' }));
          if (cancelled) return;

          setEmployees(rosterRows(employeeResponse).filter((row) => Number.isFinite(row.id)));
          setHasFullRoster(true);
          setRosterMessage('');
        } catch {
          const ids = new Set<number>();
          for (const log of nextLogs) {
            if (typeof log.employeeId === 'number') ids.add(log.employeeId);
          }
          setEmployees(
            [...ids]
              .sort((a, b) => a - b)
              .map((id) => ({
                id,
                name: `Employee #${id}`,
                status: 'Unknown',
                position: '-',
              }))
          );
          setHasFullRoster(false);
          setRosterMessage(
            `${audienceLabel} can load attendance logs, but full employee roster access is restricted.`
          );
        }
      } catch (error) {
        if (cancelled) return;
        setLogs([]);
        setEmployees([]);
        setHasFullRoster(false);
        setRosterMessage('');
        setLoadError(error instanceof Error ? error.message : 'Failed to load attendance data.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPageData();
    return () => {
      cancelled = true;
    };
  }, [audienceLabel, logsUrl, monthIndex, refreshTick, rosterUrl, year]);

  const employeeById = useMemo(() => {
    const map = new Map<number, EmployeeRow>();
    for (const employee of employees) {
      map.set(employee.id, employee);
    }
    return map;
  }, [employees]);

  const activeEmployeeIds = useMemo(() => {
    return employees
      .filter((employee) => employee.status.toUpperCase() !== 'TERMINATED')
      .map((employee) => employee.id);
  }, [employees]);

  const logsByDate = useMemo(() => {
    const grouped = new Map<string, AttendanceLog[]>();
    for (const log of logs) {
      const key = localDateKey(log.timestamp);
      if (!key) continue;
      const current = grouped.get(key) ?? [];
      current.push(log);
      grouped.set(key, current);
    }
    return grouped;
  }, [logs]);

  const calendarCells = useMemo(() => {
    const cells = monthCells(year, monthIndex);
    return cells.map((cell) => {
      if (cell.day === null) return cell;
      const dateKey = toISODate(year, monthIndex, cell.day);
      const isFutureDate = dateKey > todayDateKey;
      const records = buildDailyRecords(logsByDate.get(dateKey) ?? [], employeeById);
      const presentCount = records.length;
      const lateCount = records.filter((record) => record.isLate).length;
      const incompleteCount = records.filter((record) => record.isIncomplete).length;
      const absentCount = hasFullRoster && !isFutureDate ? Math.max(activeEmployeeIds.length - presentCount, 0) : null;

      return {
        day: cell.day,
        presentCount,
        lateCount,
        incompleteCount,
        absentCount,
      } satisfies DayCell;
    });
  }, [activeEmployeeIds.length, employeeById, hasFullRoster, logsByDate, monthIndex, todayDateKey, year]);

  const selectedRecords = useMemo(() => {
    if (!selectedDateKey) return [];
    return buildDailyRecords(logsByDate.get(selectedDateKey) ?? [], employeeById);
  }, [employeeById, logsByDate, selectedDateKey]);

  const selectedIsFuture = useMemo(() => {
    return Boolean(selectedDateKey) && selectedDateKey > todayDateKey;
  }, [selectedDateKey, todayDateKey]);

  const selectedAbsent = useMemo(() => {
    if (!hasFullRoster || selectedIsFuture) return [];
    const presentIds = new Set(selectedRecords.map((record) => record.employeeId));
    return employees
      .filter((employee) => employee.status.toUpperCase() !== 'TERMINATED')
      .filter((employee) => !presentIds.has(employee.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, hasFullRoster, selectedIsFuture, selectedRecords]);

  const selectedSummary = useMemo(() => {
    const late = selectedRecords.filter((record) => record.isLate).length;
    const incomplete = selectedRecords.filter((record) => record.isIncomplete).length;
    return {
      present: selectedRecords.length,
      late,
      incomplete,
      absent: hasFullRoster && !selectedIsFuture ? selectedAbsent.length : null,
      totalLogs: (logsByDate.get(selectedDateKey) ?? []).length,
    };
  }, [hasFullRoster, logsByDate, selectedAbsent.length, selectedDateKey, selectedIsFuture, selectedRecords]);

  const monthOptions = useMemo(() => {
    const startYear = Math.min(todayYear, year) - 5;
    const endYear = Math.max(todayYear, year) + 5;
    const totalMonths = (endYear - startYear + 1) * 12;

    return Array.from({ length: totalMonths }, (_, index) =>
      new Date(startYear, index, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    );
  }, [todayYear, year]);

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const sundayBasedStart = new Date(year, monthIndex, 1).getDay();
  const calendarWeekRows = Math.ceil((sundayBasedStart + daysInMonth) / 7);
  const calendarGridStyle = { '--calendar-week-rows': calendarWeekRows } as CSSProperties;

  function parseMonthValue(value: string) {
    const parsed = new Date(`1 ${value}`);
    if (Number.isNaN(parsed.getTime())) return;
    setMonthIndex(parsed.getMonth());
    setYear(parsed.getFullYear());
  }

  function shiftCalendarMonth(offset: number) {
    const next = new Date(year, monthIndex + offset, 1);
    setMonthIndex(next.getMonth());
    setYear(next.getFullYear());
  }

  function openDayDetails(day: number) {
    const key = toISODate(year, monthIndex, day);
    setSelectedDateKey(key);
    setDetailOpen(true);
  }

  return (
    <div className="hrAtt">
      <div className="hrAtt__head">
        <div className="hrAtt__titleWrap">
          <h1 className="hrAtt__title">Attendance Report</h1>
          <p className="hrAtt__subtitle">
            Review daily attendance activity, late entries, incomplete logs, and gaps in one monthly calendar.
          </p>
        </div>

        <div className="hrAtt__controls">
          <div className="hrAtt__monthSelectWrap">
            <select
              className="hrAtt__monthSelect"
              value={monthValue}
              onChange={(event) => {
                setMonthValue(event.target.value);
                parseMonthValue(event.target.value);
              }}
            >
              {monthOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="hrAtt__topActions">
            <button className="hrAtt__actionBtn" type="button" onClick={() => window.print()}>
              <FiCalendar />
              Export Attendance
            </button>
          </div>
        </div>
      </div>

      {isLoading && <p className="hrAtt__hint">Loading attendance data...</p>}
      {!isLoading && loadError && <p className="hrAtt__error">{loadError}</p>}
      {!isLoading && !loadError && rosterMessage && <p className="hrAtt__hint">{rosterMessage}</p>}

      <section className="hrAttCard">
        <div className="hrAttCalendarShell" aria-label="Attendance report calendar">
          <div className="hrAttCalendarShell__top">
            <button
              type="button"
              className="hrAttCalendarShell__navBtn"
              onClick={() => shiftCalendarMonth(-1)}
              aria-label="Previous month"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <strong className="hrAttCalendarShell__month">{monthLabel}</strong>
            <button
              type="button"
              className="hrAttCalendarShell__navBtn"
              onClick={() => shiftCalendarMonth(1)}
              aria-label="Next month"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="hrAttCalendarShell__legend" aria-hidden="true">
            <span className="hrAttCalendarShell__legendItem">
              <span className="hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--present" />
              Present
            </span>
            <span className="hrAttCalendarShell__legendItem">
              <span className="hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--late" />
              Late
            </span>
            <span className="hrAttCalendarShell__legendItem">
              <span className="hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--incomplete" />
              Incomplete
            </span>
            <span className="hrAttCalendarShell__legendItem">
              <span className="hrAttCalendarShell__legendSwatch hrAttCalendarShell__legendSwatch--absent" />
              Absent
            </span>
          </div>

          <div className="hrCal" style={calendarGridStyle}>
          {DAYS.map((day) => (
            <div key={day} className="hrCal__dow">
              {day}
            </div>
          ))}

          {calendarCells.map((cell, index) => {
            if (cell.day === null) {
              return <div key={`empty-${index}`} className="hrCal__cell hrCal__cell--disabled" aria-hidden="true" />;
            }

            const day = cell.day;
            const dateKey = toISODate(year, monthIndex, day);
            const isFutureDate = dateKey > todayDateKey;
            const isToday = dateKey === todayDateKey;
            const isSelected = dateKey === selectedDateKey;
            const showIndicators = !isFutureDate;
            const hasAttention =
              showIndicators && (cell.lateCount > 0 || cell.incompleteCount > 0 || (cell.absentCount ?? 0) > 0);
            const cellClass = [
              'hrCal__cell',
              'hrCal__cell--click',
              isToday ? 'hrCal__cell--today' : '',
              isSelected ? 'hrCal__cell--selected' : '',
              hasAttention ? 'hrCal__cell--attention' : '',
              showIndicators && cell.presentCount > 0 ? 'hrCal__cell--active' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={dateKey}
                type="button"
                className={cellClass}
                onClick={() => openDayDetails(day)}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`Attendance details for ${dateKey}`}
              >
                <div className="hrCal__cellTop">
                  <div className="hrCal__day">{day}</div>
                </div>
                {showIndicators && (
                  <div className="hrCal__stats">
                    <div className="hrCal__stat hrCal__stat--present">
                      <span>Present</span>
                      <strong>{cell.presentCount}</strong>
                    </div>
                    <div className="hrCal__stat hrCal__stat--late">
                      <span>Late</span>
                      <strong>{cell.lateCount}</strong>
                    </div>
                    <div className="hrCal__stat hrCal__stat--incomplete">
                      <span>Incomplete</span>
                      <strong>{cell.incompleteCount}</strong>
                    </div>
                    <div className="hrCal__stat hrCal__stat--absent">
                      <span>Absent</span>
                      <strong>{hasFullRoster ? cell.absentCount ?? 0 : '-'}</strong>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </section>

      {detailOpen && (
        <div className="hrAttModalBackdrop" role="dialog" aria-modal="true" aria-label="Attendance breakdown">
          <div className="hrAttModal">
            <div className="hrAttModal__top">
              <div>
                <div className="hrAttModal__eyebrow">Daily Attendance Breakdown</div>
                <div className="hrAttModal__title">{selectedDateKey}</div>
                <p className="hrAttModal__subtitle">Inspect the daily attendance summary, present employees, and missing logs for the selected date.</p>
              </div>
              <button className="hrAttModal__close" type="button" onClick={() => setDetailOpen(false)} aria-label="Close">
                <FiX />
              </button>
            </div>

            <div className="hrAttModal__rule" />

            <div className="hrAttSummary">
              <article className="hrAttSummary__card">
                <span>Present</span>
                <strong>{selectedSummary.present}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>Late</span>
                <strong>{selectedSummary.late}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>Incomplete</span>
                <strong>{selectedSummary.incomplete}</strong>
              </article>
              <article className="hrAttSummary__card">
                <span>{hasFullRoster ? 'Absent' : 'Total Logs'}</span>
                <strong>{hasFullRoster ? selectedSummary.absent ?? '-' : selectedSummary.totalLogs}</strong>
              </article>
            </div>

            {!hasFullRoster && (
              <p className="hrAtt__hint">
                Absent counts are not shown because the full employee roster is not available on this screen.
              </p>
            )}

            <div className="hrAttBreakdown">
              <section className="hrAttBreakdown__section">
                <div className="hrAttBreakdown__title">
                  <FiUsers />
                  Present Employees
                </div>

                <div className="hrAttBreakdown__list">
                  {selectedRecords.length > 0 ? (
                    selectedRecords.map((record) => (
                      <article key={`${selectedDateKey}-${record.employeeId}`} className="hrAttPerson">
                        <div className="hrAttPerson__avatar" aria-hidden="true">
                          {record.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="hrAttPerson__body">
                          <div className="hrAttPerson__topLine">
                            <div className="hrAttPerson__name">{record.name}</div>
                            <div
                              className={`hrAttPerson__badge ${
                                record.isIncomplete
                                  ? 'is-incomplete'
                                  : record.isLate
                                    ? 'is-late'
                                    : 'is-on-time'
                              }`}
                            >
                              {record.isIncomplete ? 'Incomplete' : record.isLate ? 'Late' : 'On Time'}
                            </div>
                          </div>
                          <div className="hrAttPerson__meta">
                            Employee #{record.employeeId} • {record.position} • {record.status}
                          </div>
                          <div className="hrAttPerson__times">
                            <span>Time In: {record.inTime ?? 'N/A'}</span>
                            <span>Time Out: {record.outTime ?? 'N/A'}</span>
                            <span>Logs: {record.logCount}</span>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : selectedIsFuture ? (
                    <div className="hrAttBreakdown__empty">This date has not happened yet.</div>
                  ) : (
                    <div className="hrAttBreakdown__empty">No attendance logs recorded for this day.</div>
                  )}
                </div>
              </section>

              {hasFullRoster && (
                <section className="hrAttBreakdown__section">
                  <div className="hrAttBreakdown__title">
                    <FiCalendar />
                    No Logs Recorded
                  </div>

                  <div className="hrAttBreakdown__list">
                    {selectedAbsent.length > 0 ? (
                      selectedAbsent.map((employee) => (
                        <article key={`absent-${selectedDateKey}-${employee.id}`} className="hrAttPerson hrAttPerson--soft">
                          <div className="hrAttPerson__avatar" aria-hidden="true">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="hrAttPerson__body">
                            <div className="hrAttPerson__topLine">
                              <div className="hrAttPerson__name">{employee.name}</div>
                              <div className="hrAttPerson__badge is-muted">No Logs</div>
                            </div>
                            <div className="hrAttPerson__meta">
                              Employee #{employee.id} • {employee.position} • {employee.status}
                            </div>
                          </div>
                        </article>
                      ))
                    ) : selectedIsFuture ? (
                      <div className="hrAttBreakdown__empty">Absent employees will only be shown after this date passes.</div>
                    ) : (
                      <div className="hrAttBreakdown__empty">All active employees recorded attendance for this day.</div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="hrAttModal__actions">
              <button className="hrAtt__actionBtn hrAtt__actionBtn--ghost" type="button" onClick={() => setDetailOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
