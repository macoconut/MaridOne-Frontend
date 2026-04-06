import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiClock, FiRefreshCw, FiUsers } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import {
  addDays,
  buildTemplateDrafts,
  buildWeekOverrideDrafts,
  DAY_ORDER,
  formatDayLabel,
  formatNextOccurrenceLabel,
  formatSpecificDateLabel,
  formatWeekRangeLabel,
  normalizeWeekStart,
  parseDailyShifts,
  parseTeamEmployees,
  toIsoDate,
} from './scheduleUtils';
import type { DailyOverrideDraft, DailyShift, ShiftDraft, TeamEmployee } from './scheduleUtils';
import './TeamShiftSchedules.css';

export default function ManagerTeamShiftSchedules() {
  const { showSuccess } = useUiDialog();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ShiftDraft>>({});
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => normalizeWeekStart(toIsoDate(new Date())));
  const [dailyShifts, setDailyShifts] = useState<DailyShift[]>([]);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, DailyOverrideDraft>>({});
  const [showOverrides, setShowOverrides] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const [savingOverrideDate, setSavingOverrideDate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useErrorDialogEffect(loadError, 'Team schedules could not be loaded');
  useErrorDialogEffect(saveError, 'Shift schedule could not be saved');

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId]
  );

  async function loadTeamSchedules() {
    setLoading(true);
    setLoadError('');

    try {
      const payload = await apiFetchJson<unknown>('/api/employees/team');
      const mapped = parseTeamEmployees(payload, toArray);
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
      setDrafts({});
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    } finally {
      setLoading(false);
    }
  }

  const refreshTeamSchedules = useAutoRefreshingPage(loadTeamSchedules, {
    intervalMs: 15000,
    enabled: !savingDay && !savingOverrideDate,
  });

  useEffect(() => {
    void refreshTeamSchedules();
  }, [refreshTeamSchedules]);

  useEffect(() => {
    setDrafts(buildTemplateDrafts(selectedEmployee));
  }, [selectedEmployee]);

  useEffect(() => {
    setShowOverrides(false);
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployee || !showOverrides) {
      setDailyShifts([]);
      setOverrideDrafts({});
      return;
    }

    const employeeId = selectedEmployee.id;
    let cancelled = false;

    async function loadDailyOverrides() {
      setLoadingOverrides(true);
      try {
        const weekEnd = addDays(selectedWeekStart, 6);
        const payload = await apiFetchJson<unknown>(
          `/api/employee/schedule/daily/${employeeId}?startDate=${selectedWeekStart}&endDate=${weekEnd}`
        );
        if (cancelled) return;
        setDailyShifts(parseDailyShifts(payload, toArray));
      } catch (error) {
        if (cancelled) return;
        setDailyShifts([]);
        setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
      } finally {
        if (!cancelled) {
          setLoadingOverrides(false);
        }
      }
    }

    void loadDailyOverrides();

    return () => {
      cancelled = true;
    };
  }, [selectedEmployee, selectedWeekStart, showOverrides]);

  useEffect(() => {
    setOverrideDrafts(buildWeekOverrideDrafts(selectedEmployee, selectedWeekStart, dailyShifts));
  }, [selectedEmployee, selectedWeekStart, dailyShifts]);

  function updateDraft(day: string, key: 'startTime' | 'endTime', value: string) {
    setDrafts((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [key]: value,
      },
    }));
  }

  function updateOverrideDraft(workDate: string, key: 'startTime' | 'endTime', value: string) {
    setOverrideDrafts((current) => ({
      ...current,
      [workDate]: {
        ...current[workDate],
        [key]: value,
      },
    }));
  }

  async function saveSchedule(day: string) {
    if (!selectedEmployee) return;

    const draft = drafts[day];
    if (!draft?.startTime || !draft?.endTime) {
      setSaveError('Start time and end time are both required.');
      return;
    }

    setSaveError('');
    setSavingDay(day);

    try {
      if (draft.shiftId) {
        await apiFetchJson('/api/employee/schedule/update', {
          method: 'PATCH',
          body: JSON.stringify({
            shiftId: draft.shiftId,
            startTime: draft.startTime,
            endTime: draft.endTime,
            dayOfWeek: day,
          }),
        });
      } else {
        await apiFetchJson('/api/employee/schedule/add', {
          method: 'POST',
          body: JSON.stringify({
            empId: selectedEmployee.id,
            startTime: draft.startTime,
            endTime: draft.endTime,
            dayOfWeek: day,
          }),
        });
      }

      await loadTeamSchedules();
      showSuccess(`${formatDayLabel(day)} schedule updated for ${selectedEmployee.name}.`, 'Shift Saved');
    } catch (error) {
      setSaveError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setSavingDay(null);
    }
  }

  async function saveOverride(workDate: string) {
    if (!selectedEmployee) return;

    const draft = overrideDrafts[workDate];
    if (!draft?.startTime || !draft?.endTime) {
      setSaveError('Start time and end time are both required.');
      return;
    }

    setSaveError('');
    setSavingOverrideDate(workDate);
    const employeeId = selectedEmployee.id;
    const employeeName = selectedEmployee.name;

    try {
      const payload = await apiFetchJson<DailyShift>(
        '/api/employee/schedule/daily/override',
        {
          method: 'PUT',
          body: JSON.stringify({
            empId: employeeId,
            workDate,
            dayOff: false,
            startTime: draft.startTime,
            endTime: draft.endTime,
          }),
        }
      );

      setDailyShifts((current) => {
        const next = current.filter((shift) => shift.workDate !== workDate);
        const parsed = parseDailyShifts([payload], toArray);
        return [...next, ...parsed].sort((left, right) => String(left.workDate).localeCompare(String(right.workDate)));
      });

      showSuccess(`${formatSpecificDateLabel(workDate)} override saved for ${employeeName}.`, 'Override Saved');
    } catch (error) {
      setSaveError(getFriendlyErrorMessage(error, 'employee-save'));
    } finally {
      setSavingOverrideDate(null);
    }
  }

  function shiftWeek(days: number) {
    setSelectedWeekStart((current) => addDays(current, days));
  }

  return (
    <div className="mgrShift">
      <div className="mgrShift__top">
        <PageHeader
          title="Team Shift Schedules"
          description="Keep the repeating weekly template here, then use the shift calendar when you need to plan actual dates for a month."
        />
        <button
          type="button"
          className="mgrShift__refresh"
          onClick={() => void loadTeamSchedules()}
          disabled={loading || Boolean(savingDay)}
          aria-label={loading ? 'Refreshing team schedules' : 'Refresh team schedules'}
          title={loading ? 'Refreshing team schedules' : 'Refresh team schedules'}
        >
          <FiRefreshCw />
        </button>
      </div>

      <section className="mgrShift__shell">
        <aside className="mgrShift__list">
          <div className="mgrShift__listHead">
            <FiUsers />
            <span>Team Members</span>
          </div>

          {employees.length > 0 ? (
            employees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                className={`mgrShift__employee ${employee.id === selectedEmployeeId ? 'is-selected' : ''}`}
                onClick={() => setSelectedEmployeeId(employee.id)}
              >
                <strong>{employee.name}</strong>
                <span>{employee.position}</span>
                <span>{employee.status}</span>
              </button>
            ))
          ) : (
            <div className="mgrShift__empty">
              {loading ? 'Loading team members...' : 'No team employees are assigned to you yet.'}
            </div>
          )}
        </aside>

        <section className="mgrShift__editor">
          {selectedEmployee ? (
            <>
              <div className="mgrShift__editorHead">
                <div>
                  <h2>{selectedEmployee.name}</h2>
                  <p>
                    Use the weekly template for the normal recurring pattern. Only open specific week overrides when this employee needs a temporary exception.
                  </p>
                </div>
                <div className="mgrShift__headActions">
                  <button
                    type="button"
                    className="mgrShift__altAction"
                    onClick={() => navigate('/manager/monthly-team-schedule')}
                  >
                    Open Shift Calendar
                  </button>
                  <div className="mgrShift__badge">
                    <FiClock />
                    <span>Blank day means no weekly routine</span>
                  </div>
                </div>
              </div>

              <section className="mgrShift__section">
                <div className="mgrShift__sectionHead">
                  <div>
                    <h3>Weekly Template</h3>
                    <p>This repeating pattern applies to future weeks. Leave a weekday blank when it should stay off by default.</p>
                  </div>
                  <div className="mgrShift__sectionActions">
                    <button
                      type="button"
                      className="mgrShift__altAction"
                      onClick={() => navigate('/manager/monthly-team-schedule')}
                    >
                      Shift Calendar
                    </button>
                    <button
                      type="button"
                      className="mgrShift__altAction"
                      onClick={() => setShowOverrides((current) => !current)}
                    >
                      {showOverrides ? 'Hide Specific Week Override' : 'Override Specific Week'}
                    </button>
                  </div>
                </div>

                <div className="mgrShift__rows">
                  {DAY_ORDER.map((day) => {
                    const draft = drafts[day] ?? { startTime: '', endTime: '' };
                    const isSaving = savingDay === day;

                    return (
                      <article key={day} className="mgrShift__row">
                        <div className="mgrShift__day">
                          <strong>{formatDayLabel(day)}</strong>
                          <span>
                            {draft.shiftId
                              ? `Repeats weekly. Next occurrence: ${formatNextOccurrenceLabel(day)}`
                              : 'No weekly routine set. This day is currently off until you add a shift.'}
                          </span>
                        </div>

                        <label className="mgrShift__field">
                          <span>Start</span>
                          <input
                            type="time"
                            value={draft.startTime}
                            onChange={(event) => updateDraft(day, 'startTime', event.target.value)}
                            disabled={isSaving}
                          />
                        </label>

                        <label className="mgrShift__field">
                          <span>End</span>
                          <input
                            type="time"
                            value={draft.endTime}
                            onChange={(event) => updateDraft(day, 'endTime', event.target.value)}
                            disabled={isSaving}
                          />
                        </label>

                        <button
                          type="button"
                          className="mgrShift__save"
                          onClick={() => void saveSchedule(day)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : draft.shiftId ? 'Save Changes' : 'Add Shift'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>

              {showOverrides ? (
                <section className="mgrShift__section mgrShift__section--override">
                  <div className="mgrShift__sectionHead">
                    <div>
                      <h3>Specific Week Override</h3>
                      <p>Choose the week that should behave differently, then save only the dates that need a temporary change.</p>
                    </div>
                    <div className="mgrShift__badge">
                      <FiCalendar />
                      <span>{formatWeekRangeLabel(selectedWeekStart)}</span>
                    </div>
                  </div>

                  <div className="mgrShift__weekBar">
                    <button type="button" className="mgrShift__weekNav" onClick={() => shiftWeek(-7)}>
                      Previous Week
                    </button>
                    <label className="mgrShift__field mgrShift__field--week">
                      <span>Week starting</span>
                      <input
                        type="date"
                        value={selectedWeekStart}
                        onChange={(event) => setSelectedWeekStart(normalizeWeekStart(event.target.value))}
                      />
                    </label>
                    <button type="button" className="mgrShift__weekNav" onClick={() => shiftWeek(7)}>
                      Next Week
                    </button>
                  </div>

                  <div className="mgrShift__rows">
                    {DAY_ORDER.map((_, index) => {
                      const workDate = addDays(selectedWeekStart, index);
                      const draft = overrideDrafts[workDate] ?? {
                        workDate,
                        startTime: '',
                        endTime: '',
                        isOverride: false,
                        dayOff: false,
                        hasTemplate: false,
                      };
                      const isSaving = savingOverrideDate === workDate;

                      return (
                        <article key={workDate} className={`mgrShift__row ${draft.isOverride ? 'is-override' : ''}`}>
                          <div className="mgrShift__day">
                            <strong>{formatSpecificDateLabel(workDate)}</strong>
                            <span>
                              {draft.dayOff
                                ? draft.isOverride
                                  ? 'This date is marked as day off in the shift calendar'
                                  : 'No weekly routine is set for this weekday, so this date is currently off'
                                : draft.isOverride
                                ? 'Specific-date override already exists'
                                : draft.hasTemplate
                                  ? 'Uses the weekly template until you save an override'
                                  : 'No weekly routine is set for this weekday yet'}
                            </span>
                          </div>

                          <label className="mgrShift__field">
                            <span>Start</span>
                            <input
                              type="time"
                              value={draft.startTime}
                              onChange={(event) => updateOverrideDraft(workDate, 'startTime', event.target.value)}
                              disabled={isSaving || loadingOverrides}
                            />
                          </label>

                          <label className="mgrShift__field">
                            <span>End</span>
                            <input
                              type="time"
                              value={draft.endTime}
                              onChange={(event) => updateOverrideDraft(workDate, 'endTime', event.target.value)}
                              disabled={isSaving || loadingOverrides}
                            />
                          </label>

                          <button
                            type="button"
                            className="mgrShift__save"
                            onClick={() => void saveOverride(workDate)}
                            disabled={isSaving || loadingOverrides}
                          >
                            {isSaving ? 'Saving...' : draft.isOverride ? 'Update Override' : 'Save Override'}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="mgrShift__section mgrShift__section--hint">
                  <div className="mgrShift__hint">
                    Need to change only next week or next-next week?
                    <button type="button" className="mgrShift__hintButton" onClick={() => setShowOverrides(true)}>
                      Open Specific Week Override
                    </button>
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="mgrShift__empty mgrShift__empty--editor">
              Select a team member to view and edit their weekly template shift schedule.
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
