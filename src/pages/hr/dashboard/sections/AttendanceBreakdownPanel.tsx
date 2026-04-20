import type { CSSProperties, ReactNode } from 'react';

import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import {
  STATUS_CONFIG,
  buildDonutBackground,
  donutPoints,
  type AttendanceStatusKey,
  type AttendanceStatusSummary,
  type DepartmentBreakdownItem,
  type WeeklyAttendanceItem,
} from '../dashboardShared';

type AttendanceBreakdownPanelProps = {
  activeDeptPage: number;
  activeWeekPage: number;
  departmentBreakdown: DepartmentBreakdownItem[];
  isWeeklyPrimaryPanel: boolean;
  showDepartmentNav: boolean;
  showWeeklyNav: boolean;
  title: string;
  totalDeptPages: number;
  totalWeekPages: number;
  visibleDepartments: DepartmentBreakdownItem[];
  visibleWeeklyAttendance: WeeklyAttendanceItem[];
  weeklyAttendance: WeeklyAttendanceItem[];
  onNextDepartmentPage: () => void;
  onNextWeekPage: () => void;
  onPreviousDepartmentPage: () => void;
  onPreviousWeekPage: () => void;
};

type SummaryCardProps = {
  headcount: number;
  id: string;
  name: ReactNode;
  summary: AttendanceStatusSummary;
  variant?: 'department' | 'weekly';
};

function AttendanceSummaryCard({ headcount, id, name, summary, variant = 'department' }: SummaryCardProps) {
  const chartPoints = donutPoints(summary);
  const donutBackground = buildDonutBackground(chartPoints);
  const donutStyle = donutBackground ? ({ background: donutBackground } as CSSProperties) : undefined;

  return (
    <article key={id} className={variant === 'weekly' ? 'hrDeptCard hrWeekDeptCard' : 'hrDeptCard'}>
      <div className={variant === 'weekly' ? 'hrDeptCard__name hrWeekDeptCard__name' : 'hrDeptCard__name'}>
        {name}
      </div>
      <div className="hrDeptCard__body">
        <div className="hrDeptCard__chartWrap">
          <div
            className={`hrDeptDonut${chartPoints.length === 0 ? ' hrDeptDonut--empty' : ''}`}
            style={donutStyle}
            aria-hidden="true"
          >
            <div className="hrDeptDonut__center">
              <strong>{headcount}</strong>
            </div>
          </div>
        </div>
        <div className="hrDeptCard__stats">
          {(Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => (
            <div
              key={`${id}-${key}`}
              className="hrDeptStatRow"
              aria-label={`${STATUS_CONFIG[key].label}: ${summary[key]}`}
              title={STATUS_CONFIG[key].label}
            >
              <span className={`hrDeptStatRow__dot hrDeptStatRow__dot--${key}`} />
              <strong className="hrDeptStatRow__value">{summary[key]}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function PaginationDots({ activePage, totalPages, prefix }: { activePage: number; totalPages: number; prefix: string }) {
  if (totalPages <= 1) return null;

  return (
    <div className="hrPager" aria-hidden="true">
      {Array.from({ length: totalPages }).map((_, index) => (
        <span key={`${prefix}-${index}`} className={index === activePage ? 'is-active' : ''} />
      ))}
    </div>
  );
}

function AttendanceLegend() {
  return (
    <div className="hrLegend hrLegend--note">
      {(Object.keys(STATUS_CONFIG) as AttendanceStatusKey[]).map((key) => (
        <span key={key} className={`hrLegend__item hrLegend__item--${key}`}>
          {STATUS_CONFIG[key].label}
        </span>
      ))}
    </div>
  );
}

function WeeklyAttendanceView({
  activeWeekPage,
  showWeeklyNav,
  totalWeekPages,
  visibleWeeklyAttendance,
  weeklyAttendance,
  onNextWeekPage,
  onPreviousWeekPage,
}: Pick<
  AttendanceBreakdownPanelProps,
  | 'activeWeekPage'
  | 'showWeeklyNav'
  | 'totalWeekPages'
  | 'visibleWeeklyAttendance'
  | 'weeklyAttendance'
  | 'onNextWeekPage'
  | 'onPreviousWeekPage'
>) {
  if (weeklyAttendance.length === 0) {
    return (
      <div className="hrDeptGrid">
        <div className="hrDeptCard hrDeptCard--empty">
          <div className="hrDeptCard__name">No weekly attendance data yet.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`hrDept${showWeeklyNav ? '' : ' hrDept--single'}`}>
        {showWeeklyNav ? (
          <button
            className="hrCircleBtn"
            type="button"
            aria-label="Previous weekly attendance page"
            onClick={onPreviousWeekPage}
            disabled={activeWeekPage === 0}
          >
            <FiChevronLeft />
          </button>
        ) : null}

        <div className={`hrDeptGrid${visibleWeeklyAttendance.length === 1 ? ' hrDeptGrid--single' : ''}`}>
          {visibleWeeklyAttendance.map((item) => (
            <AttendanceSummaryCard
              key={item.id}
              id={item.id}
              name={
                <>
                  <span>{item.dayLabel}</span>
                  <small>{item.dateLabel}</small>
                </>
              }
              headcount={item.summary.headcount}
              summary={item.summary}
              variant="weekly"
            />
          ))}
        </div>

        {showWeeklyNav ? (
          <button
            className="hrCircleBtn"
            type="button"
            aria-label="Next weekly attendance page"
            onClick={onNextWeekPage}
            disabled={activeWeekPage + 1 >= totalWeekPages}
          >
            <FiChevronRight />
          </button>
        ) : null}
      </div>

      <PaginationDots activePage={activeWeekPage} totalPages={totalWeekPages} prefix="week-page" />
    </>
  );
}

function DepartmentAttendanceView({
  activeDeptPage,
  departmentBreakdown,
  showDepartmentNav,
  totalDeptPages,
  visibleDepartments,
  onNextDepartmentPage,
  onPreviousDepartmentPage,
}: Pick<
  AttendanceBreakdownPanelProps,
  | 'activeDeptPage'
  | 'departmentBreakdown'
  | 'showDepartmentNav'
  | 'totalDeptPages'
  | 'visibleDepartments'
  | 'onNextDepartmentPage'
  | 'onPreviousDepartmentPage'
>) {
  if (departmentBreakdown.length === 0) {
    return (
      <div className="hrDeptGrid">
        <div className="hrDeptCard hrDeptCard--empty">
          <div className="hrDeptCard__name">No department attendance data yet.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`hrDept${showDepartmentNav ? '' : ' hrDept--single'}`}>
        {showDepartmentNav ? (
          <button
            className="hrCircleBtn"
            type="button"
            aria-label="Previous department page"
            onClick={onPreviousDepartmentPage}
            disabled={activeDeptPage === 0}
          >
            <FiChevronLeft />
          </button>
        ) : null}

        <div className={`hrDeptGrid${visibleDepartments.length === 1 ? ' hrDeptGrid--single' : ''}`}>
          {visibleDepartments.map((department) => {
            const summary: AttendanceStatusSummary = {
              headcount: department.headcount,
              present: department.present,
              late: department.late,
              outsideSchedule: department.outsideSchedule,
              absent: department.absent,
              onLeave: department.onLeave,
              dayOff: department.dayOff,
              upcoming: department.upcoming,
            };

            return (
              <AttendanceSummaryCard
                key={department.id}
                id={department.id}
                name={department.name}
                headcount={department.headcount}
                summary={summary}
              />
            );
          })}
        </div>

        {showDepartmentNav ? (
          <button
            className="hrCircleBtn"
            type="button"
            aria-label="Next department page"
            onClick={onNextDepartmentPage}
            disabled={activeDeptPage + 1 >= totalDeptPages}
          >
            <FiChevronRight />
          </button>
        ) : null}
      </div>

      <PaginationDots activePage={activeDeptPage} totalPages={totalDeptPages} prefix="dept-page" />
    </>
  );
}

export default function AttendanceBreakdownPanel({
  activeDeptPage,
  activeWeekPage,
  departmentBreakdown,
  isWeeklyPrimaryPanel,
  showDepartmentNav,
  showWeeklyNav,
  title,
  totalDeptPages,
  totalWeekPages,
  visibleDepartments,
  visibleWeeklyAttendance,
  weeklyAttendance,
  onNextDepartmentPage,
  onNextWeekPage,
  onPreviousDepartmentPage,
  onPreviousWeekPage,
}: AttendanceBreakdownPanelProps) {
  return (
    <section className="hrPanel">
      <div className="hrPanel__header">{title}</div>
      {isWeeklyPrimaryPanel ? (
        <WeeklyAttendanceView
          activeWeekPage={activeWeekPage}
          showWeeklyNav={showWeeklyNav}
          totalWeekPages={totalWeekPages}
          visibleWeeklyAttendance={visibleWeeklyAttendance}
          weeklyAttendance={weeklyAttendance}
          onNextWeekPage={onNextWeekPage}
          onPreviousWeekPage={onPreviousWeekPage}
        />
      ) : (
        <DepartmentAttendanceView
          activeDeptPage={activeDeptPage}
          departmentBreakdown={departmentBreakdown}
          showDepartmentNav={showDepartmentNav}
          totalDeptPages={totalDeptPages}
          visibleDepartments={visibleDepartments}
          onNextDepartmentPage={onNextDepartmentPage}
          onPreviousDepartmentPage={onPreviousDepartmentPage}
        />
      )}
      <AttendanceLegend />
    </section>
  );
}
