import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import type { DisputeRow, DisputeStatusFilter, DisputeTypeFilter } from '../types';

type PayslipDisputesPanelProps = {
  activeDisputeFilterCount: number;
  disputeFilterOpen: boolean;
  disputeSearchValue: string;
  disputeStatusFilter: DisputeStatusFilter;
  disputeTypeFilter: DisputeTypeFilter;
  disputesCount: number;
  onClearDisputeFilters: () => void;
  onClearDisputeSearch: () => void;
  onDisputeSearchChange: (value: string) => void;
  onDisputeStatusFilterChange: (value: DisputeStatusFilter) => void;
  onDisputeTypeFilterChange: (value: DisputeTypeFilter) => void;
  onOpenDisputeRow: (row: DisputeRow) => void | Promise<void>;
  onToggleDisputeFilter: () => void;
  visibleDisputes: DisputeRow[];
};

export default function PayslipDisputesPanel({
  activeDisputeFilterCount,
  disputeFilterOpen,
  disputeSearchValue,
  disputeStatusFilter,
  disputeTypeFilter,
  disputesCount,
  onClearDisputeFilters,
  onClearDisputeSearch,
  onDisputeSearchChange,
  onDisputeStatusFilterChange,
  onDisputeTypeFilterChange,
  onOpenDisputeRow,
  onToggleDisputeFilter,
  visibleDisputes,
}: PayslipDisputesPanelProps) {
  return (
    <section className="hrPayPanel">
      <header className="hrPayPanel__head">Payroll Dispute from Employees</header>

      <div className="hrPayToolbar">
        <label className="uSearch" aria-label="Search payroll disputes">
          <FiSearch />
          <input
            value={disputeSearchValue}
            onChange={(event) => onDisputeSearchChange(event.target.value)}
            placeholder="Search employee, dispute type, reason, or status"
          />
          {disputeSearchValue && (
            <button type="button" aria-label="Clear search" onClick={onClearDisputeSearch}>
              <FiXCircle />
            </button>
          )}
        </label>

        <div className="uFilter">
          <button
            type="button"
            className={`uFilter__toggle ${disputeFilterOpen ? 'is-open' : ''} ${
              activeDisputeFilterCount > 0 ? 'is-active' : ''
            }`}
            onClick={onToggleDisputeFilter}
          >
            <FiFilter />
            <span>Filter</span>
          </button>

          {disputeFilterOpen && (
            <div className="uFilter__panel">
              <label className="uFilter__field">
                <span>Dispute Type</span>
                <select value={disputeTypeFilter} onChange={(event) => onDisputeTypeFilterChange(event.target.value as DisputeTypeFilter)}>
                  <option value="all">All Types</option>
                  <option value="Overtime">Overtime</option>
                  <option value="Attendance Issue">Attendance Issue</option>
                  <option value="Absent Deduction">Absent Deduction</option>
                  <option value="General">General</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label className="uFilter__field">
                <span>Status</span>
                <select
                  value={disputeStatusFilter}
                  onChange={(event) => onDisputeStatusFilterChange(event.target.value as DisputeStatusFilter)}
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="WAITING_ADJUSTMENT">Waiting for Adjustment</option>
                </select>
              </label>

              <div className="uFilter__actions">
                <button type="button" onClick={onClearDisputeFilters}>
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hrPayTableShell mgrPendTable">
        {visibleDisputes.length > 0 ? (
          <>
            <div className="mgrPendTable__head hrPayDisputeTable__head" role="row">
              <span>Name</span>
              <span>Request</span>
              <span>Specific Type</span>
              <span>Payroll Period</span>
              <span>Submitted At</span>
              <span className="mgrPendTable__headCell--status">Status</span>
            </div>

            <div className="mgrPendTable__body">
              {visibleDisputes.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`mgrPendTable__row mgrPendTable__row--${row.statusTone}`}
                  onClick={() => void onOpenDisputeRow(row)}
                >
                  <span className="mgrPendTable__cell mgrPendTable__cell--name">{row.employee}</span>
                  <span className="mgrPendTable__cell">Payroll Dispute</span>
                  <span className="mgrPendTable__cell">{row.subject}</span>
                  <span className="mgrPendTable__cell">{row.payrollPeriod}</span>
                  <span className="mgrPendTable__cell">{row.submittedAt}</span>
                  <span className="mgrPendTable__cell mgrPendTable__cell--status">
                    <span className={`hrApprRow__status hrApprRow__status--${row.statusTone}`}>{row.statusLabel}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="uEmptyState">
            {disputesCount > 0
              ? 'No matching disputes found for your search or filters.'
              : 'No payroll disputes have been submitted yet. New employee disputes will show up here.'}
          </div>
        )}
      </div>
    </section>
  );
}
