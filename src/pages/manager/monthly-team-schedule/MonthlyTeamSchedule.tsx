import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiRefreshCw, FiSave, FiUsers } from 'react-icons/fi';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import '../../hr/attendance-reports/AttendanceReports.css';
import {
  addMonths,
  formatMonthLabel,
  formatSpecificDateLabel,
  getMonthDates,
  normalizeMonthStart,
  parseDailyShifts,
  parseIsoDate,
  parseTeamEmployees,
  timeFromDateTime,
  toIsoDate,
  toMonthValue,
} from '../team-shift-schedules/scheduleUtils';
import type { DailyShift, TeamEmployee } from '../team-shift-schedules/scheduleUtils';
import './MonthlyTeamSchedule.css';

const CALENDAR_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

type EditorDraft = {
  startTime: string;
  endTime: string;
  dayOff: boolean;
  isOverride: boolean;
  templateStartTime: string;
  templateEndTime: string;
};

function buildCalendarCells(monthStart: string) {
  const monthDates = getMonthDates(monthStart);
  const firstDate = parseIsoDate(monthStart);
  const leadingBlanks = Array.from({ length: firstDate.getDay() }, (_, index) => `blank-start-${index}`);
  const totalCells = leadingBlanks.length + monthDates.length;
  const trailingCount = (7 - (totalCells % 7)) % 7;
  const trailingBlanks = Array.from({ length: trailingCount }, (_, index) => `blank-end-${index}`);
  return [...leadingBlanks, ...monthDates, ...trailingBlanks];
}

function formatTimeLabel(value: string) {
  const [hoursText = '0', minutesText = '00'] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const meridiem = safeHours >= 12 ? 'PM' : 'AM';
  const normalizedHour = safeHours % 12 === 0 ? 12 : safeHours % 12;
  return `${normalizedHour}:${String(safeMinutes).padStart(2, '0')} ${meridiem}`;
}

function formatShortDateLabel(workDate: string) {
  return parseIsoDate(workDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function resolveTemplateTimes(employee: TeamEmployee | null, workDate: string) {
  const dayName = parseIsoDate(workDate).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const template = employee?.shiftSchedules.find((item) => String(item.dayOfWeek ?? '').toUpperCase() === dayName);

  return {
    startTime: template?.startTime?.slice(0, 5) || '08:00',
    endTime: template?.endTime?.slice(0, 5) || '17:00',
  };
}

function buildEditorDraft(
  employee: TeamEmployee | null,
  workDate: string,
  shiftMap: Map<string, DailyShift>
): EditorDraft {
  const template = resolveTemplateTimes(employee, workDate);
  const override = shiftMap.get(workDate);

  return {
    startTime: override && !override.dayOff ? timeFromDateTime(override.startDateTime) || template.startTime : template.startTime,
    endTime: override && !override.dayOff ? timeFromDateTime(override.endDateTime) || template.endTime : template.endTime,
    dayOff: Boolean(override?.dayOff),
    isOverride: Boolean(override?.dailyShiftId),
    templateStartTime: template.startTime,
    templateEndTime: template.endTime,
  };
}

export default function ManagerMonthlyTeamSchedule() {
  const { showSuccess } = useUiDialog();
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedMonthStart, setSelectedMonthStart] = useState(() => normalizeMonthStart(toIsoDate(new Date())));
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useErrorDialogEffect(loadError, 'Shift calendar could not be loaded');
  useErrorDialogEffect(saveError, 'Shift calendar could not be saved');

  const todayKey = useMemo(() => toIsoDate(new Date()), []);

  const sortedEmployees = useMemo(
    () => [...employees].sort((left, right) => left.name.localeCompare(right.name)),
    [employees]
  );

  const selectedEmployee = useMemo(
    () => sortedEmployees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [selectedEmployeeId, sortedEmployees]
  );

  const calendarCells = useMemo(() => buildCalendarCells(selectedMonthStart), [selectedMonthStart]);
  const calendarStyle = useMemo(
    () =>
      ({
        '--calendar-week-rows': String(Math.max(1, calendarCells.length / 7)),
      }) as CSSProperties,
    [calendarCells.length]
  );

  const shiftMap = useMemo(
    () =>
      new Map(
        dailyShifts
          .filter((shift): shift is DailyShift & { workDate: string } => Boolean(shift.workDate))
          .map((shift) => [shift.workDate, shift])
      ),
    [dailyShifts]
  );

  async function loadTeamSchedules() {
    setLoadingTeam(true);
    setLoadError('');

    try {
      const payload = await apiFetchJson<unknown>('/api/employees/team');
      const mapped = parseTeamEmployees(payload, toArray).sort((left, right) => left.name.localeCompare(right.name));
      setEmployees(mapped);
      setSelectedEmployeeId((current) => {
        if (current && mapped.some((employee) => employee.id === current)) {
          return current;
        }
        return mapped[0]?.id ?? null;
      });
    } catch (error) {
      setEmployees([]);
      setSelectedEmployeeId(null);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    } finally {
      setLoadingTeam(false);
    }
  }

  const refreshMonthlyPlanner = useAutoRefreshingPage(loadTeamSchedules, {
    intervalMs: 15000,
    enabled: !savingDate,
  });

  useEffect(() => {
    void refreshMonthlyPlanner();
  }, [refreshMonthlyPlanner]);

  useEffect(() => {
    if (!selectedEmployee) {
      setDailyShifts([]);
      return;
    }

    const employeeId = selectedEmployee.id;
    let cancelled = false;

    async function loadMonthPlan() {
      setLoadingMonth(true);
      try {
        const monthDates = getMonthDates(selectedMonthStart);
        const monthEnd = monthDates[monthDates.length - 1] ?? selectedMonthStart;
        const payload = await apiFetchJson<unknown>(
          `/api/employee/schedule/daily/${employeeId}?startDate=${selectedMonthStart}&endDate=${monthEnd}`
        );

        if (cancelled) return;
        setDailyShifts(parseDailyShifts(payload, toArray));
      } catch (error) {
        if (cancelled) return;
        setDailyShifts([]);
        setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
      } finally {
        if (!cancelled) {
          setLoadingMonth(false);
        }
      }
    }

    void loadMonthPlan();

    return () => {
      cancelled = true;
    };
  }, [selectedEmployee, selectedMonthStart]);

  useEffect(() => {
    if (!selectedEmployee) {
      setSelectedDateKey(null);
      return;
    }

    const monthDates = getMonthDates(selectedMonthStart);
    const fallbackDate = monthDates.find((dateKey) => dateKey >= todayKey) ?? monthDates[0] ?? null;

    setSelectedDateKey((current) => {
      if (current && monthDates.includes(current)) {
        return current;
      }
      return fallbackDate;
    });
  }, [selectedEmployee, selectedMonthStart, todayKey]);

  useEffect(() => {
    if (!selectedEmployee || !selectedDateKey) {
      setEditorDraft(null);
      return;
    }

    setEditorDraft(buildEditorDraft(selectedEmployee, selectedDateKey, shiftMap));
  }, [selectedDateKey, selectedEmployee, shiftMap]);

  function selectDate(workDate: string) {
    setSelectedDateKey(workDate);
    setSaveError('');
  }

  function updateDraft(key: 'startTime' | 'endTime', value: string) {
    setEditorDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateDayOff(value: boolean) {
    setEditorDraft((current) => (current ? { ...current, dayOff: value } : current));
  }

  function applyTemplateHours() {
    setEditorDraft((current) =>
      current
        ? {
            ...current,
            dayOff: false,
            startTime: current.templateStartTime,
            endTime: current.templateEndTime,
          }
        : current
    );
  }

  async function saveSelectedDate() {
    if (!selectedEmployee || !selectedDateKey || !editorDraft) return;

    if (selectedDateKey < todayKey) {
      setSaveError('Past schedule dates can no longer be changed.');
      return;
    }

    if (!editorDraft.dayOff && (!editorDraft.startTime || !editorDraft.endTime)) {
      setSaveError('Start time and end time are both required unless the date is marked as day off.');
      return;
    }

    if (!editorDraft.dayOff && editorDraft.startTime === editorDraft.endTime) {
      setSaveError('Start time and end time cannot be the same unless the date is marked as day off.');
      return;
    }

    setSaveError('');
    setSavingDate(true);

    try {
      const payload = await apiFetchJson<DailyShift>('/api/employee/schedule/daily/override', {
        method: 'PUT',
        body: JSON.stringify({
          empId: selectedEmployee.id,
          workDate: selectedDateKey,
          dayOff: editorDraft.dayOff,
          startTime: editorDraft.dayOff ? null : editorDraft.startTime,
          endTime: editorDraft.dayOff ? null : editorDraft.endTime,
        }),
      });

      const [savedShift] = parseDailyShifts([payload], toArray);
      if (savedShift) {
        setDailyShifts((current) => {
          const next = current.filter((shift) => shift.workDate !== selectedDateKey);
          return [...next, savedShift].sort((left, right) => String(left.workDate).localeCompare(String(right.workDate)));
        });
      }

      showSuccess(
        editorDraft.dayOff
          ? `${selectedEmployee.name} is now marked as day off on ${formatSpecificDateLabel(selectedDateKey)}.`
          : `${selectedEmployee.name}'s shift was saved for ${formatSpecificDateLabel(selectedDateKey)}.`,
        editorDraft.dayOff ? 'Day Off Saved' : 'Shift Saved'
      );
    } catch (error) {
      setSaveError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setSavingDate(false);
    }
  }

  function shiftMonth(offset: number) {
    setSelectedMonthStart((current) => addMonths(current, offset));
  }

  return (
    <div className="mgrMonth">
      <div className="mgrMonth__top">
        <PageHeader
          title="Shift Calendar"
          description="Pick a month, choose a team member, then click any future calendar date to set working hours or mark it as day off."
        />
        <button
          type="button"
          className="mgrMonth__refresh"
          onClick={() => void loadTeamSchedules()}
          disabled={loadingTeam || savingDate}
        >
          <FiRefreshCw />
          <span>{loadingTeam ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      <section className="mgrMonth__shell">
        <div className="mgrMonth__content">
          <section className="mgrMonth__calendarPanel hrAttCalendarShell">
            <div className="hrAttCalendarShell__top">
              <button type="button" className="hrAttCalendarShell__navBtn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <FiChevronLeft />
              </button>
              <div className="hrAttCalendarShell__month">{formatMonthLabel(selectedMonthStart)}</div>
              <button type="button" className="hrAttCalendarShell__navBtn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <FiChevronRight />
              </button>
            </div>

            <div className="mgrMonth__controls">
              <label className="mgrMonth__field mgrMonth__field--employee">
                <span>
                  <FiUsers />
                  Team Member
                </span>
                <select
                  value={selectedEmployeeId ?? ''}
                  onChange={(event) => setSelectedEmployeeId(event.target.value ? Number(event.target.value) : null)}
                  disabled={loadingTeam || sortedEmployees.length === 0}
                >
                  {sortedEmployees.length === 0 ? (
                    <option value="">No team members assigned</option>
                  ) : (
                    sortedEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} - {employee.position}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="mgrMonth__field mgrMonth__field--month">
                <span>
                  <FiCalendar />
                  Jump to Month
                </span>
                <input
                  type="month"
                  value={toMonthValue(parseIsoDate(selectedMonthStart))}
                  onChange={(event) => setSelectedMonthStart(normalizeMonthStart(event.target.value))}
                />
              </label>
            </div>

            {selectedEmployee ? (
              <>
                <div className="hrAttCalendarShell__focus">
                  <div className="hrAttCalendarShell__focusName">{selectedEmployee.name}</div>
                  <div className="hrAttCalendarShell__focusMeta">
                    <span>{selectedEmployee.position}</span>
                    <span>{selectedEmployee.status}</span>
                    <span>Default template 8:00 AM - 5:00 PM</span>
                    <span>Past dates stay read-only</span>
                  </div>
                </div>

                <div className="hrAttCalendarShell__legend">
                  <span className="hrAttCalendarShell__legendItem">
                    <span className="hrAttCalendarShell__legendSwatch mgrMonth__legendSwatch--template" />
                    Weekly template
                  </span>
                  <span className="hrAttCalendarShell__legendItem">
                    <span className="hrAttCalendarShell__legendSwatch mgrMonth__legendSwatch--saved" />
                    Saved shift
                  </span>
                  <span className="hrAttCalendarShell__legendItem">
                    <span className="hrAttCalendarShell__legendSwatch mgrMonth__legendSwatch--dayoff" />
                    Day off
                  </span>
                  <span className="hrAttCalendarShell__legendItem">
                    <span className="hrAttCalendarShell__legendSwatch mgrMonth__legendSwatch--locked" />
                    Past date locked
                  </span>
                </div>

                <div className="mgrMonth__calendarViewport">
                  <div className="hrCal" style={calendarStyle}>
                    {CALENDAR_DAYS.map((day) => (
                      <div key={day} className="hrCal__dow">
                        {day}
                      </div>
                    ))}

                    {calendarCells.map((cell) => {
                      if (cell.startsWith('blank-')) {
                        return <div key={cell} className="hrCal__cell hrCal__cell--disabled mgrMonth__cell--blank" aria-hidden="true" />;
                      }

                      const template = resolveTemplateTimes(selectedEmployee, cell);
                      const override = shiftMap.get(cell);
                      const isLocked = cell < todayKey;
                      const isSelected = cell === selectedDateKey;
                      const isToday = cell === todayKey;
                      const dayNumber = parseIsoDate(cell).getDate();
                      const statusLabel = override?.dayOff
                        ? 'Day off'
                        : override?.dailyShiftId
                          ? 'Saved shift'
                          : 'Template hours';
                      const noteClass = isLocked
                        ? 'mgrMonth__note--locked'
                        : override?.dayOff
                          ? 'mgrMonth__note--dayoff'
                          : override?.dailyShiftId
                            ? 'mgrMonth__note--saved'
                            : 'mgrMonth__note--template';
                      const timeLabel = override?.dayOff
                        ? 'No working hours'
                        : override?.dailyShiftId
                          ? `${formatTimeLabel(timeFromDateTime(override.startDateTime) || template.startTime)} - ${formatTimeLabel(
                              timeFromDateTime(override.endDateTime) || template.endTime
                            )}`
                          : `${formatTimeLabel(template.startTime)} - ${formatTimeLabel(template.endTime)}`;

                      const cellClass = [
                        'hrCal__cell',
                        'hrCal__cell--click',
                        override?.dayOff ? 'hrCal__cell--dayOff mgrMonth__cell--dayoff' : '',
                        override?.dailyShiftId && !override?.dayOff ? 'hrCal__cell--ot mgrMonth__cell--saved' : '',
                        isLocked ? 'mgrMonth__cell--locked' : '',
                        isSelected ? 'hrCal__cell--selected' : '',
                        isToday ? 'hrCal__cell--today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <button key={cell} type="button" className={cellClass} onClick={() => selectDate(cell)}>
                          <div className="hrCal__cellTop">
                            <div className="hrCal__day">{dayNumber}</div>
                            <span className="mgrMonth__cellDate">{formatShortDateLabel(cell)}</span>
                          </div>

                          <div className="hrCal__statusNotes">
                            <span className={`hrCal__note ${noteClass}`}>{statusLabel}</span>
                            {isLocked && <span className="hrCal__note mgrMonth__note--locked">Past date locked</span>}
                            {isToday && <span className="hrCal__note mgrMonth__note--today">Today</span>}
                          </div>

                          <div className="hrCal__detailNotes">
                            <span className="hrCal__detail">{timeLabel}</span>
                            {!override?.dayOff && override?.dailyShiftId && <span className="hrCal__detail">Custom date override</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="hrAttCalendarShell__empty">
                <div>
                  <div className="hrAttCalendarShell__emptyTitle">
                    {loadingTeam ? 'Loading team members...' : 'No team member selected'}
                  </div>
                  <p className="hrAttCalendarShell__emptyText">
                    {loadingTeam
                      ? 'The shift calendar will appear once the team roster finishes loading.'
                      : 'Pick a team member from the dropdown to start planning future shifts for a month.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="mgrMonth__editorPanel">
            {selectedEmployee && selectedDateKey && editorDraft ? (
              <>
                <div className="mgrMonth__panelTop">
                  <div>
                    <h2>{formatSpecificDateLabel(selectedDateKey)}</h2>
                    <p>
                      {editorDraft.isOverride
                        ? 'This date already has a saved daily schedule.'
                        : 'This date is still following the weekly template preview.'}
                    </p>
                  </div>
                  <div className="mgrMonth__statusPill">
                    {selectedDateKey < todayKey ? 'Past date locked' : editorDraft.dayOff ? 'Day off planned' : 'Editable day'}
                  </div>
                </div>

                <div className="mgrMonth__detailGrid">
                  <article className="mgrMonth__detailCard">
                    <span>Team Member</span>
                    <strong>{selectedEmployee.name}</strong>
                  </article>
                  <article className="mgrMonth__detailCard">
                    <span>Template Hours</span>
                    <strong>
                      {formatTimeLabel(editorDraft.templateStartTime)} - {formatTimeLabel(editorDraft.templateEndTime)}
                    </strong>
                  </article>
                </div>

                <label className={`mgrMonth__dayOffToggle ${selectedDateKey < todayKey ? 'is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={editorDraft.dayOff}
                    onChange={(event) => updateDayOff(event.target.checked)}
                    disabled={savingDate || loadingMonth || selectedDateKey < todayKey}
                  />
                  <div>
                    <strong>Mark this date as day off</strong>
                    <span>No working hours will be saved for this calendar date.</span>
                  </div>
                </label>

                <div className="mgrMonth__timeGrid">
                  <label className="mgrMonth__field">
                    <span>Start Time</span>
                    <input
                      type="time"
                      value={editorDraft.startTime}
                      onChange={(event) => updateDraft('startTime', event.target.value)}
                      disabled={savingDate || loadingMonth || selectedDateKey < todayKey || editorDraft.dayOff}
                    />
                  </label>

                  <label className="mgrMonth__field">
                    <span>End Time</span>
                    <input
                      type="time"
                      value={editorDraft.endTime}
                      onChange={(event) => updateDraft('endTime', event.target.value)}
                      disabled={savingDate || loadingMonth || selectedDateKey < todayKey || editorDraft.dayOff}
                    />
                  </label>
                </div>

                {selectedDateKey < todayKey ? (
                  <div className="mgrMonth__lockedNote">
                    This day already belongs to the past, so the schedule stays read-only now.
                  </div>
                ) : (
                  <div className="mgrMonth__actions">
                    <button type="button" className="mgrMonth__ghostBtn" onClick={applyTemplateHours} disabled={savingDate || loadingMonth}>
                      Reapply Template Hours
                    </button>
                    <button type="button" className="mgrMonth__save" onClick={() => void saveSelectedDate()} disabled={savingDate || loadingMonth}>
                      <FiSave />
                      <span>{savingDate ? 'Saving...' : 'Save This Date'}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="mgrMonth__empty">
                {loadingTeam ? 'Loading team members...' : 'Choose a team member, then click a calendar day to edit that date.'}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
