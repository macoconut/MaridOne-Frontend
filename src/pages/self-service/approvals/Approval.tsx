import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import PageHeader from '../../../components/layout/PageHeader';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
import './Approval.css';

type ApprovalItem = {
  id: string;
  sortStamp: number;
  dateOfRequest: string;
  requestType: string;
  requestDetail: string;
  requestTarget: string;
  status: 'Pending' | 'Approved' | 'Denied';
  approvedBy: string;
  requestReason: string;
  decisionReason: string;
  decisionDate: string;
};

type ApprovalTypeFilter = 'all' | 'Leave' | 'Overtime' | 'Payslip Dispute';
type ApprovalStatusFilter = 'all' | 'Pending' | 'Approved' | 'Denied';

type LeaveRow = {
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  leaveType?: string;
  approver?: string;
  approverReason?: string;
  approvedAt?: string;
  paid?: boolean;
  isPaid?: boolean;
};

type OvertimeRow = {
  overtimeId?: number;
  requestAt?: string;
  workDate?: string;
  startTime?: string;
  approvedAt?: string;
  requestStatus?: string;
  approver?: string;
  reason?: string;
  approveReason?: string;
  overtimeType?: string;
};

type DisputeRow = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  statusReason?: string;
  approver?: string;
  approverName?: string;
  reviewedBy?: string;
  handledBy?: string;
  decidedBy?: string;
  itemId?: number;
};

type PayrollItemRow = {
  id?: number;
  itemId?: number;
  runDetails?: {
    periodStart?: string;
    periodEnd?: string;
  };
};

function resolveDisputeApprover(row: DisputeRow) {
  const directApprover =
    row.approver?.trim() ||
    row.approverName?.trim() ||
    row.reviewedBy?.trim() ||
    row.handledBy?.trim() ||
    row.decidedBy?.trim();

  return directApprover || '-';
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
}

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatLeaveType(value?: string) {
  if (!value) return 'Leave';
  if (value.toUpperCase() === 'OT') return 'OT';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildLeaveDetail(leaveType?: string, isPaid?: boolean) {
  const payLabel = isPaid === false ? ' - Unpaid' : ' - Paid';
  return `${formatLeaveType(leaveType)}${payLabel}`;
}

function buildDisputeDetail(subject?: string) {
  const trimmed = typeof subject === 'string' ? subject.trim() : '';
  return trimmed.length > 0 ? trimmed : 'Payroll dispute';
}

function buildPayrollPeriodLabel(start?: string, end?: string) {
  if (!start && !end) return 'Payroll period unavailable';
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
}

export default function Approval() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ApprovalTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('all');

  useEffect(() => {
    if (selectedApproval) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selectedApproval]);

  useEffect(() => {
    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) throw new Error('Missing username');
        const userDetails = await apiFetchJson<Record<string, unknown>>(
          `/api/user/details/${encodeURIComponent(username)}`
        );
        const selfEmployee =
          userDetails.employee && typeof userDetails.employee === 'object'
            ? (userDetails.employee as Record<string, unknown>)
            : null;
        const empId =
          typeof userDetails.employeeId === 'number'
            ? userDetails.employeeId
            : typeof selfEmployee?.employeeId === 'number'
              ? selfEmployee.employeeId
              : typeof selfEmployee?.id === 'number'
                ? selfEmployee.id
                : null;

        if (!empId) throw new Error('Missing employee ID');
        const [leaveResponse, otResponse, disputeResponse, payrollItemsResponse] = await Promise.all([
          apiFetchJson<unknown>(`/api/leave/request/${empId}?page=0&size=20`),
          apiFetchJson<unknown>(`/api/overtime/all/${empId}?page=0&size=20`),
          apiFetchJson<unknown>(`/api/payroll/item/dispute/self?empId=${empId}&page=0&size=20`),
          apiFetchJson<unknown>(`/api/payroll/item/${empId}`),
        ]);

        const payrollPeriodByItemId = new Map<number, string>();
        for (const row of toArray<PayrollItemRow>(payrollItemsResponse)) {
          const itemId = typeof row.id === 'number' ? row.id : typeof row.itemId === 'number' ? row.itemId : null;
          if (itemId == null) continue;

          payrollPeriodByItemId.set(
            itemId,
            buildPayrollPeriodLabel(row.runDetails?.periodStart, row.runDetails?.periodEnd)
          );
        }

        const leaveItems = toArray<LeaveRow>(leaveResponse).map((row, index) => {
          const statusRaw = String(row.requestStatus ?? '').toUpperCase();
          const status: ApprovalItem['status'] =
            statusRaw === 'APPROVED'
              ? 'Approved'
              : statusRaw === 'REJECTED' || statusRaw === 'DENIED'
                ? 'Denied'
                : 'Pending';
          const requestStamp = row.startDateTime ? Date.parse(row.startDateTime) || 0 : 0;
          return {
            id: `leave-${String(row.requestId ?? index)}`,
            sortStamp: requestStamp,
            dateOfRequest: formatDate(row.startDateTime),
            requestType: 'Leave',
            requestDetail: buildLeaveDetail(row.leaveType, row.paid ?? row.isPaid),
            requestTarget: `${formatDate(row.startDateTime)} to ${formatDate(row.endDateTime)}`,
            status,
            approvedBy: status === 'Pending' ? '-' : row.approver?.trim() || '-',
            requestReason: row.reason ?? '-',
            decisionReason: row.approverReason ?? '-',
            decisionDate: formatDateTime(row.approvedAt),
          };
        });

        const overtimeItems = toArray<OvertimeRow>(otResponse).map((row) => {
          const statusRaw = String(row.requestStatus ?? '').toUpperCase();
          const status: ApprovalItem['status'] =
            statusRaw === 'APPROVED'
              ? 'Approved'
              : statusRaw === 'REJECTED' || statusRaw === 'DENIED'
                ? 'Denied'
                : 'Pending';
          return {
            id: String(row.overtimeId ?? Math.random()),
            sortStamp: row.requestAt ? Date.parse(row.requestAt) || 0 : 0,
            dateOfRequest: formatDateTime(row.requestAt),
            requestType: 'Overtime',
            requestDetail: formatLeaveType(row.overtimeType || 'OT'),
            requestTarget:
              row.startTime
                ? `${formatDate(row.workDate)} at ${formatTime(row.startTime)}`
                : formatDate(row.workDate),
            status,
            approvedBy: row.approver ?? '-',
            requestReason: row.reason ?? '-',
            decisionReason: row.approveReason ?? '-',
            decisionDate: formatDateTime(row.approvedAt),
          };
        });

        const disputeItems = toArray<DisputeRow>(disputeResponse).map((row) => {
          const statusRaw = String(row.status ?? '').toUpperCase();
          const status: ApprovalItem['status'] =
            statusRaw === 'APPROVED'
              ? 'Approved'
              : statusRaw === 'REJECTED' || statusRaw === 'DENIED'
                ? 'Denied'
                : 'Pending';
          return {
            id: `dispute-${String(row.id ?? Math.random())}`,
            sortStamp: row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
            dateOfRequest: formatDateTime(row.createdAt),
            requestType: 'Payslip Dispute',
            requestDetail: buildDisputeDetail(row.subject),
            requestTarget:
              typeof row.itemId === 'number'
                ? payrollPeriodByItemId.get(row.itemId) ?? 'Payroll period unavailable'
                : 'Payroll period unavailable',
            status,
            approvedBy: status === 'Pending' ? '-' : resolveDisputeApprover(row),
            requestReason: row.reason ?? '-',
            decisionReason: row.statusReason ?? '-',
            decisionDate: formatDateTime(row.updatedAt),
          };
        });

        const merged = [...leaveItems, ...overtimeItems, ...disputeItems].sort(
          (a, b) => b.sortStamp - a.sortStamp || a.id.localeCompare(b.id)
        );

        setApprovals(merged);
      } catch {
        setApprovals([]);
      }
    })();
  }, []);

  const normalizedSearch = searchValue.trim().toLowerCase();
  const visibleApprovals = useMemo(() => {
    return approvals.filter((item) => {
      if (typeFilter !== 'all' && item.requestType !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.dateOfRequest,
        item.requestType,
        item.requestDetail,
        item.requestTarget,
        item.status,
        item.approvedBy,
        item.requestReason,
        item.decisionReason,
        item.decisionDate,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [approvals, normalizedSearch, statusFilter, typeFilter]);
  const activeFilterCount = [typeFilter, statusFilter].filter((value) => value !== 'all').length;
  const cards = useMemo(
    () =>
      [
        {
          label: 'Approved',
          value: visibleApprovals.filter((item) => item.status === 'Approved').length,
          cls: 'approved',
        },
        {
          label: 'Denied',
          value: visibleApprovals.filter((item) => item.status === 'Denied').length,
          cls: 'denied',
        },
        {
          label: 'Pending',
          value: visibleApprovals.filter((item) => item.status === 'Pending').length,
          cls: 'pending',
        },
      ].map((card) => ({
        ...card,
        progress:
          visibleApprovals.length > 0
            ? Math.max((card.value / visibleApprovals.length) * 100, card.value > 0 ? 8 : 0)
            : 0,
      })),
    [visibleApprovals]
  );

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
  }

  return (
    <div className="appr">
      <PageHeader
        title="View Approvals"
        description="Track leave, overtime, and payslip dispute decisions from one place."
      />

      <div className="appr__toolbar">
        <label className="apprSearch" aria-label="Search approvals">
          <FiSearch />
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search request, type, status, or decision"
          />
          {searchValue && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
              <FiXCircle />
            </button>
          )}
        </label>

        <div className="apprFilter">
          <button
            type="button"
            className={`apprFilter__toggle ${filterOpen ? 'is-open' : ''} ${
              activeFilterCount > 0 ? 'is-active' : ''
            }`}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <FiFilter />
            <span>Filter</span>
            {activeFilterCount > 0 && <span className="apprFilter__count">{activeFilterCount}</span>}
          </button>

          {filterOpen && (
            <div className="apprFilter__panel">
              <label className="apprFilter__field">
                <span>Request Type</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as ApprovalTypeFilter)}
                >
                  <option value="all">All Requests</option>
                  <option value="Leave">Leave</option>
                  <option value="Overtime">Overtime</option>
                  <option value="Payslip Dispute">Payslip Dispute</option>
                </select>
              </label>

              <label className="apprFilter__field">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ApprovalStatusFilter)}
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Denied">Denied</option>
                </select>
              </label>

              <div className="apprFilter__actions">
                <button type="button" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="appr__stats">
        {cards.map((card) => (
          <div key={card.label} className="apprCard">
            {card.value > 0 ? (
              <div
                className={`apprCard__ring apprCard__ring--${card.cls}`}
                style={{ '--appr-ring-progress': `${card.progress}%` } as CSSProperties}
              />
            ) : (
              <div className="apprCard__empty" aria-hidden="true">
                -
              </div>
            )}
            <div className="apprCard__body">
              <div className="apprCard__label">{card.label}</div>
              <div className="apprCard__value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="apprTable">
        <div className="apprTable__head">
          <div>Date of Request</div>
          <div>Request Type</div>
          <div>Type / Topic</div>
          <div>Period / Target</div>
          <div>Status</div>
          <div>Approved By</div>
          <div>Decision Date</div>
        </div>

        <div className="apprTable__body">
          {visibleApprovals.length > 0 ? (
            visibleApprovals.map((row) => (
              <button
                key={row.id}
                type="button"
                className="apprRow apprRow--button is-openable"
                onClick={() => setSelectedApproval(row)}
              >
                <div>{row.dateOfRequest}</div>
                <div>{row.requestType}</div>
                <div>{row.requestDetail}</div>
                <div>{row.requestTarget}</div>
                <div className={`apprStatus apprStatus--${row.status.toLowerCase()}`}>
                  {row.status}
                </div>
                <div>{row.approvedBy}</div>
                <div>{row.decisionDate}</div>
              </button>
            ))
          ) : (
            <div className="apprRow">
              <div>No matching approval requests.</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </div>
          )}
        </div>
      </section>

      {selectedApproval && (
        <div className="apprModalBackdrop" role="dialog" aria-modal="true" aria-label="Approval details">
          <div className="apprModal">
            <div className="apprModal__top">
              <div>
                <div className="apprModal__eyebrow">Request Breakdown</div>
                <div className="apprModal__title">{selectedApproval.requestType}</div>
                <p className="apprModal__subtitle">
                  Review the request timeline, current status, and recorded decision notes for this approval item.
                </p>
              </div>
              <button type="button" className="apprModal__close" onClick={() => setSelectedApproval(null)}>
                x
              </button>
            </div>

            <div className="apprModal__hero">
              <div>
                <div className="apprModal__heroLabel">Current Status</div>
                <div className={`apprModal__status apprModal__status--${selectedApproval.status.toLowerCase()}`}>
                  {selectedApproval.status}
                </div>
              </div>
              <div className="apprModal__heroMeta">
                <div>
                  <span>Type / Topic</span>
                  <strong>{selectedApproval.requestDetail}</strong>
                </div>
                <div>
                  <span>Handled By</span>
                  <strong>{selectedApproval.approvedBy}</strong>
                </div>
              </div>
            </div>

            <div className="apprModal__rule" />

            <div className="apprModal__summary">
              <div className="apprModal__card">
                <span>Date of Request</span>
                <strong>{selectedApproval.dateOfRequest}</strong>
              </div>
              <div className="apprModal__card">
                <span>Period / Target</span>
                <strong>{selectedApproval.requestTarget}</strong>
              </div>
              <div className="apprModal__card">
                <span>Decision Timestamp</span>
                <strong>{selectedApproval.decisionDate}</strong>
              </div>
            </div>

            <div className="apprModal__body">
              <div className="apprModal__section">
                <div className="apprModal__sectionTitle">Request Reason</div>
                <p className="apprModal__sectionBody">{selectedApproval.requestReason}</p>
              </div>
              <div className="apprModal__section">
                <div className="apprModal__sectionTitle">Approval / Denial Reason</div>
                <p className="apprModal__sectionBody">{selectedApproval.decisionReason}</p>
              </div>
            </div>

            <div className="apprModal__actions">
              <button type="button" onClick={() => setSelectedApproval(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
