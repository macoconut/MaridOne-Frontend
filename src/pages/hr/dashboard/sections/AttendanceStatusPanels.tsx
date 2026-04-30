import { FiCalendar } from 'react-icons/fi';

import type { LeaveCardItem } from '../dashboardShared';

type PeoplePanelItem = {
  detail: string;
  id: string;
  name: string;
  summary: string;
};

type LatePanelItem = PeoplePanelItem & {
  timeIn: string;
};

type AttendanceStatusPanelsProps = {
  absentItems: PeoplePanelItem[];
  lateItems: LatePanelItem[];
  leaveItems: LeaveCardItem[];
  scheduledEmployeeCountSelected: number;
  selectedDateHeading: string;
  selectedDateShortLabel: string;
  selectedHolidayName: string;
  selectedIsHoliday: boolean;
  isSelectedDateToday: boolean;
};

function AbsentPanelEmptyState({
  scheduledEmployeeCountSelected,
  selectedDateHeading,
  selectedHolidayName,
  selectedIsHoliday,
}: Pick<
  AttendanceStatusPanelsProps,
  'scheduledEmployeeCountSelected' | 'selectedDateHeading' | 'selectedHolidayName' | 'selectedIsHoliday'
>) {
  return (
    <div className="hrEmptyState">
      <div className="hrEmptyState__title">
        {selectedIsHoliday
          ? 'No absences on holiday.'
          : scheduledEmployeeCountSelected > 0
            ? 'Everyone is accounted for.'
            : 'No absences on scheduled day off.'}
      </div>
      <div className="hrEmptyState__note">
        {selectedIsHoliday
          ? `${selectedDateHeading} is marked as ${selectedHolidayName} in the dashboard.`
          : scheduledEmployeeCountSelected > 0
            ? `No absences were recorded for ${selectedDateHeading}.`
            : `${selectedDateHeading} is treated as a day off in the dashboard schedule.`}
      </div>
    </div>
  );
}

export default function AttendanceStatusPanels({
  absentItems,
  lateItems,
  leaveItems,
  scheduledEmployeeCountSelected,
  selectedDateHeading,
  selectedDateShortLabel,
  selectedHolidayName,
  selectedIsHoliday,
  isSelectedDateToday,
}: AttendanceStatusPanelsProps) {
  return (
    <div className="hrDash__bottomRow">
      <section className="hrPanel hrListPanel">
        <div className="hrPanel__header hrPanel__header--split">
          <span>{isSelectedDateToday ? 'Absent Today' : `Absent on ${selectedDateShortLabel}`}</span>
          <span className="hrPanel__badge">{absentItems.length}</span>
        </div>
        <div className="hrPeopleList">
          {absentItems.length > 0 ? (
            absentItems.map((item) => (
              <article key={item.id} className="hrPerson">
                <div className="hrPerson__name">{item.name}</div>
                <div className="hrPerson__row hrPerson__row--split">
                  <span className="hrPerson__sub">{item.summary}</span>
                  <span className="hrPerson__meta">{item.detail}</span>
                </div>
              </article>
            ))
          ) : (
            <AbsentPanelEmptyState
              scheduledEmployeeCountSelected={scheduledEmployeeCountSelected}
              selectedDateHeading={selectedDateHeading}
              selectedHolidayName={selectedHolidayName}
              selectedIsHoliday={selectedIsHoliday}
            />
          )}
        </div>
      </section>

      <section className="hrPanel hrListPanel">
        <div className="hrPanel__header hrPanel__header--split">
          <span>{isSelectedDateToday ? 'Late Today' : `Late on ${selectedDateShortLabel}`}</span>
          <span className="hrPanel__badge">{lateItems.length}</span>
        </div>
        <div className="hrPeopleList">
          {lateItems.length > 0 ? (
            lateItems.map((item) => (
              <article key={item.id} className="hrPerson">
                <div className="hrPerson__row hrPerson__row--split">
                  <div className="hrPerson__name">{item.name}</div>
                  <div className="hrPerson__time">{item.timeIn}</div>
                </div>
                <div className="hrPerson__row hrPerson__row--split">
                  <span className="hrPerson__sub">{item.summary}</span>
                  <span className="hrPerson__meta">{item.detail}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="hrEmptyState">
              <div className="hrEmptyState__title">No late arrivals logged.</div>
              <div className="hrEmptyState__note">
                Everyone who checked in for {selectedDateHeading} arrived on time.
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="hrPanel hrListPanel">
        <div className="hrPanel__header hrPanel__header--split">
          <span>{isSelectedDateToday ? 'On Leave Today' : `On Leave on ${selectedDateShortLabel}`}</span>
          <span className="hrPanel__badge">{leaveItems.length}</span>
        </div>
        <div className="hrPeopleList">
          {leaveItems.length > 0 ? (
            leaveItems.map((item) => (
              <article key={item.id} className="hrPerson">
                <div className="hrPerson__name">{item.name}</div>
                <div className="hrPerson__row hrPerson__row--split">
                  <span className="hrPerson__sub">{item.summary}</span>
                  <div className="hrPerson__metaGroup">
                    <span className="hrPerson__meta">{item.detail}</span>
                    <span className="hrPerson__meta">
                      <FiCalendar /> {item.period}
                    </span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="hrEmptyState">
              <div className="hrEmptyState__title">No approved leave on file.</div>
              <div className="hrEmptyState__note">
                No paid or unpaid leave request covers {selectedDateHeading}.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
