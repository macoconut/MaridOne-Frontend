import {
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiFilter,
  FiPlus,
} from 'react-icons/fi';
import EmployeeSortMenu from '../../../../components/layout/EmployeeSortMenu';
import type { EmployeeSortKey } from '../../../../lib/utils/employeeSort';
import { formatDate } from '../../../../lib/utils/formatters';
import type { PayrollRunRow as PayrollRunDto } from '../../../../lib/types/payroll';
import { formatCurrency, formatRunType } from '../payslipsShared';
import type { RunItemViewRow } from '../types';

type PayslipRunPanelProps = {
  activeRunItemFilterCount: number;
  canAddManualAdjustmentLine: boolean;
  canPostCurrentRun: boolean;
  canViewNextInProgressRun: boolean;
  canViewPreviousInProgressRun: boolean;
  currentInProgressRunIndex: number;
  currentPayPeriod: string;
  currentRun: PayrollRunDto | null;
  displayedPeriodEnd: string;
  displayedPeriodStart: string;
  emptyRunHint: string;
  hasMultipleInProgressRuns: boolean;
  inProgressRunCount: number;
  isCurrentRunInProgress: boolean;
  isLoadingRunItems: boolean;
  isPostingRun: boolean;
  isSubmittingManualLine: boolean;
  onClearRunItemFilters: () => void;
  onOpenManualLineModal: () => void;
  onOpenPayrollItemDetail: (row: RunItemViewRow) => void | Promise<void>;
  onOpenPostModal: () => void;
  onOpenRunModal: () => void;
  onRunItemDepartmentFilterChange: (value: string) => void;
  onRunItemRoleFilterChange: (value: string) => void;
  onRunItemSortChange: (value: EmployeeSortKey) => void;
  onRunItemSortOpenChange: (open: boolean) => void;
  onShowNextRun: () => void;
  onShowPreviousRun: () => void;
  onToggleRunItemFilter: () => void;
  runItemDepartmentFilter: string;
  runItemDepartmentOptions: string[];
  runItemFilterOpen: boolean;
  runItemRoleFilter: string;
  runItemRoleOptions: string[];
  runItemSort: EmployeeSortKey;
  runItemSortOpen: boolean;
  runItemsCount: number;
  visibleRunItems: RunItemViewRow[];
};

export default function PayslipRunPanel({
  activeRunItemFilterCount,
  canAddManualAdjustmentLine,
  canPostCurrentRun,
  canViewNextInProgressRun,
  canViewPreviousInProgressRun,
  currentInProgressRunIndex,
  currentPayPeriod,
  currentRun,
  displayedPeriodEnd,
  displayedPeriodStart,
  emptyRunHint,
  hasMultipleInProgressRuns,
  inProgressRunCount,
  isCurrentRunInProgress,
  isLoadingRunItems,
  isPostingRun,
  isSubmittingManualLine,
  onClearRunItemFilters,
  onOpenManualLineModal,
  onOpenPayrollItemDetail,
  onOpenPostModal,
  onOpenRunModal,
  onRunItemDepartmentFilterChange,
  onRunItemRoleFilterChange,
  onRunItemSortChange,
  onRunItemSortOpenChange,
  onShowNextRun,
  onShowPreviousRun,
  onToggleRunItemFilter,
  runItemDepartmentFilter,
  runItemDepartmentOptions,
  runItemFilterOpen,
  runItemRoleFilter,
  runItemRoleOptions,
  runItemSort,
  runItemSortOpen,
  runItemsCount,
  visibleRunItems,
}: PayslipRunPanelProps) {
  return (
    <>
      <section className="hrPayPeriod">
        <div className="hrPayPeriod__copy">
          <h2>
            Current Pay Period: <span>{currentPayPeriod}</span>
          </h2>
          <p>
            <strong>Period from:</strong> {formatDate(displayedPeriodStart)} - {formatDate(displayedPeriodEnd)}
          </p>
        </div>

        <div className="hrPayPeriod__actions">
          {canPostCurrentRun && (
            <button
              type="button"
              className="hrPay__runBtn hrPay__runBtn--secondary"
              onClick={onOpenPostModal}
              disabled={isPostingRun}
            >
              <FiCheckCircle />
              <span>{isPostingRun ? 'Posting...' : 'Post Payroll Run'}</span>
            </button>
          )}
          <button type="button" className="hrPay__runBtn" onClick={onOpenRunModal}>
            <FiPlus />
            <span>Create New Payroll Run</span>
          </button>
        </div>
      </section>

      {emptyRunHint && <p className="hrPay__message">{emptyRunHint}</p>}

      {isCurrentRunInProgress && currentRun && (
        <section className="hrPayPanel hrPayPanel--runProgress">
          <div className="hrPayPanel__headRow hrPayPanel__headRow--centered">
            {hasMultipleInProgressRuns ? (
              <div className="hrPayPanel__runPager" aria-label="In-progress payroll run navigation">
                <button
                  type="button"
                  className="hrPayPanel__runPagerBtn"
                  onClick={onShowPreviousRun}
                  disabled={!canViewPreviousInProgressRun}
                  aria-label="Show previous in-progress payroll run"
                >
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <span className="hrPayPanel__runPagerLabel">
                  {currentInProgressRunIndex + 1} of {inProgressRunCount}
                </span>
                <button
                  type="button"
                  className="hrPayPanel__runPagerBtn"
                  onClick={onShowNextRun}
                  disabled={!canViewNextInProgressRun}
                  aria-label="Show next in-progress payroll run"
                >
                  <FiChevronRight aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <header className="hrPayPanel__head">Payroll Run in Progress</header>
            <div className="hrPayPanel__tools">
              {canAddManualAdjustmentLine && (
                <button
                  type="button"
                  className="hrPay__runBtn"
                  onClick={onOpenManualLineModal}
                  disabled={isSubmittingManualLine}
                >
                  <FiPlus />
                  <span>Add Manual Line</span>
                </button>
              )}
              <EmployeeSortMenu
                value={runItemSort}
                onChange={onRunItemSortChange}
                open={runItemSortOpen}
                onOpenChange={onRunItemSortOpenChange}
              />
              <div className="uFilter">
                <button
                  type="button"
                  className={`uFilter__toggle ${runItemFilterOpen ? 'is-open' : ''} ${
                    activeRunItemFilterCount > 0 ? 'is-active' : ''
                  }`}
                  onClick={onToggleRunItemFilter}
                >
                  <FiFilter />
                  <span>Filter</span>
                </button>

                {runItemFilterOpen ? (
                  <div className="uFilter__panel">
                    <label className="uFilter__field">
                      <span>Role</span>
                      <select value={runItemRoleFilter} onChange={(event) => onRunItemRoleFilterChange(event.target.value)}>
                        <option value="all">All Roles</option>
                        {runItemRoleOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="uFilter__field">
                      <span>Department</span>
                      <select
                        value={runItemDepartmentFilter}
                        onChange={(event) => onRunItemDepartmentFilterChange(event.target.value)}
                      >
                        <option value="all">All Departments</option>
                        {runItemDepartmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="uFilter__actions">
                      <button type="button" onClick={onClearRunItemFilters}>
                        Reset Filters
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hrPayRunSummary">
            <article className="hrPayRunSummary__card">
              <span>Payment Date</span>
              <strong>{formatDate(currentRun.paymentDate)}</strong>
            </article>
            <article className="hrPayRunSummary__card">
              <span>Coverage</span>
              <strong>{formatDate(currentRun.periodStart)} - {formatDate(currentRun.periodEnd)}</strong>
            </article>
            <article className="hrPayRunSummary__card">
              <span>Run Type</span>
              <strong>{formatRunType(currentRun.runType)}</strong>
            </article>
            <article className="hrPayRunSummary__card">
              <span>Payslips Generated</span>
              <strong>{currentRun.itemCount ?? 0}</strong>
            </article>
          </div>

          <div className="hrPayTableShell mgrPendTable">
            {isLoadingRunItems ? (
              <div className="mgrPendTable__empty">
                <span>Loading payroll item summaries.</span>
                <span>Checking the current run now.</span>
              </div>
            ) : visibleRunItems.length > 0 ? (
              <>
                <div className="hrPayRunTable__head hrPayRunTable__head--reporting" role="row">
                  <span>EMP ID</span>
                  <span>NAME</span>
                  <span>Gross Pay</span>
                  <span>Deductions</span>
                  <span>Net Pay</span>
                  <span className="hrPayRunTable__headCell--peek" aria-hidden="true" />
                </div>

                <div className="mgrPendTable__body">
                  {visibleRunItems.map((row) => (
                    <button
                      key={row.itemId}
                      type="button"
                      className="hrPayRunTable__row hrPayRunTable__row--reporting"
                      onClick={() => void onOpenPayrollItemDetail(row)}
                    >
                      <span className="mgrPendTable__cell">{row.empId ?? '-'}</span>
                      <span className="mgrPendTable__cell mgrPendTable__cell--name">{row.employee}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.grossPay)}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.deductions)}</span>
                      <span className="mgrPendTable__cell">{formatCurrency(row.netPay)}</span>
                      <span className="mgrPendTable__cell hrPayRunTable__cell--peek" aria-hidden="true">
                        <FiEye className="hrPayRunTable__peekIcon" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="uEmptyState">
                {runItemsCount > 0
                  ? 'No payroll items matched the selected role or department filters. Try clearing the filters to show more employees.'
                  : canAddManualAdjustmentLine
                    ? 'No payroll items yet for this in-progress run. Add a manual adjustment line to create the first payroll item.'
                    : 'No payroll items yet for this in-progress run. Process the payroll period or add adjustment items first.'}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
