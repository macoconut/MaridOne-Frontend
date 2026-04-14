import { useEffect, useMemo, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import ApprovalStatusSummary from '../../../components/approvals/ApprovalStatusSummary';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './Approval.css';

type ApprovalSource = 'leave' | 'overtime' | 'dispute';
type ApprovalStatus =
  | 'Pending Manager Review'
  | 'Pending HR Review'
  | 'Approved'
  | 'Denied'
  | 'Cancelled';

type ApprovalItem = {
  id: string;
  source: ApprovalSource;
  sourceId: number;
  sortStamp: number;
  dateOfRequest: string;
  requestType: string;
  requestDetail: string;
  requestTarget: string;
  status: ApprovalStatus;
  approvedBy: string;
  requestReason: string;
  decisionReason: string;
  decisionDate: string;
};

type ApprovalTypeFilter = 'all' | 'Leave' | 'Overtime' | 'Payslip Dispute';
type ApprovalStatusFilter = 'all' | 'Pending' | 'Approved' | 'Denied' | 'Cancelled';

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
  paid?: boolean;
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

function buildOvertimeDetail(overtimeType?: string, isPaid?: boolean) {
  const payLabel = isPaid === false ? ' - Unpaid' : ' - Paid';
  return `${formatLeaveType(overtimeType || 'OT')}${payLabel}`;
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

function mapApprovalStatus(status?: string): ApprovalStatus {
  const normalized = String(status ?? '').toUpperCase();
  if (normalized === 'PENDING_HR') return 'Pending HR Review';
  if (normalized === 'PENDING_MANAGER' || normalized === 'PENDING') return 'Pending Manager Review';
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED' || normalized === 'DENIED') return 'Denied';
  if (normalized === 'CANCELLED') return 'Cancelled';
  return 'Pending Manager Review';
}

function approvalStatusTone(status: ApprovalStatus) {
  if (status === 'Approved') return 'approved';
  if (status === 'Denied') return 'denied';
  if (status === 'Cancelled') return 'cancelled';
  return 'pending';
}

function displayRequestDate(item: ApprovalItem) {
  return item.requestType === 'Overtime' || item.requestType === 'Payslip Dispute'
    ? formatDate(item.dateOfRequest)
    : item.dateOfRequest;
}

export default function Approval() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  useEscapeDismiss(Boolean(selectedApprovalId), () => setSelectedApprovalId(null), 10);
  const [typeFilter, setTypeFilter] = useState<ApprovalTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatusFilter>('all');
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const { showSuccess } = useUiDialog();
  useErrorDialogEffect(cancelError, 'Request could not be cancelled');
  const selectedApproval = useMemo(
    () => approvals.find((item) => item.id === selectedApprovalId) ?? null,
    [approvals, selectedApprovalId]
  );
  const canCancelSelected = selectedApproval?.status.startsWith('Pending');

  useEffect(() => {
    if (selectedApproval) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selectedApproval]);

  useEffect(() => {
    setConfirmCancelOpen(false);
    setCancelError('');
  }, [selectedApprovalId]);

  async function loadApprovals() {
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
      const requests = await Promise.allSettled([
        apiFetchJson<unknown>(`/api/leave/request/${empId}?page=0&size=100&sort=requestId,desc`),
        apiFetchJson<unknown>(`/api/overtime/all/${empId}?page=0&size=100&sort=requestAt,desc`),
        apiFetchJson<unknown>(`/api/payroll/item/dispute/self?empId=${empId}&page=0&size=100&sort=createdAt,desc`),
        apiFetchJson<unknown>(`/api/payroll/item/${empId}`),
      ]);

      const leaveResponse = requests[0].status === 'fulfilled' ? requests[0].value : [];
      const otResponse = requests[1].status === 'fulfilled' ? requests[1].value : [];
      const disputeResponse = requests[2].status === 'fulfilled' ? requests[2].value : [];
      const payrollItemsResponse = requests[3].status === 'fulfilled' ? requests[3].value : [];

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
        const status = mapApprovalStatus(row.requestStatus);
        const requestStamp = row.startDateTime ? Date.parse(row.startDateTime) || 0 : 0;
        const requestId = row.requestId ?? index;
        return {
          id: `leave-${String(requestId)}`,
          source: 'leave' as const,
          sourceId: requestId,
          sortStamp: requestStamp,
          dateOfRequest: formatDate(row.startDateTime),
          requestType: 'Leave',
          requestDetail: buildLeaveDetail(row.leaveType, row.paid ?? row.isPaid),
          requestTarget: `${formatDate(row.startDateTime)} to ${formatDate(row.endDateTime)}`,
          status,
          approvedBy: status.startsWith('Pending') ? '-' : status === 'Cancelled' ? '-' : row.approver?.trim() || '-',
          requestReason: row.reason ?? '-',
          decisionReason: status === 'Cancelled' ? 'Request cancelled by employee.' : row.approverReason ?? '-',
          decisionDate: formatDateTime(row.approvedAt),
        };
      });

      const overtimeItems = toArray<OvertimeRow>(otResponse).map((row, index) => {
        const status = mapApprovalStatus(row.requestStatus);
        const overtimeId = row.overtimeId ?? index;
        return {
          id: `overtime-${String(overtimeId)}`,
          source: 'overtime' as const,
          sourceId: overtimeId,
          sortStamp: row.requestAt ? Date.parse(row.requestAt) || 0 : 0,
          dateOfRequest: formatDate(row.requestAt),
          requestType: 'Overtime',
          requestDetail: buildOvertimeDetail(row.overtimeType, row.paid),
          requestTarget:
            row.startTime
              ? `${formatDate(row.workDate)} at ${formatTime(row.startTime)}`
              : formatDate(row.workDate),
          status,
          approvedBy: status.startsWith('Pending') ? '-' : status === 'Cancelled' ? '-' : row.approver ?? '-',
          requestReason: row.reason ?? '-',
          decisionReason: status === 'Cancelled' ? 'Request cancelled by employee.' : row.approveReason ?? '-',
          decisionDate: formatDateTime(row.approvedAt),
        };
      });

      const disputeItems = toArray<DisputeRow>(disputeResponse).map((row, index) => {
        const status = mapApprovalStatus(row.status);
        const disputeId = row.id ?? index;
        return {
          id: `dispute-${String(disputeId)}`,
          source: 'dispute' as const,
          sourceId: disputeId,
          sortStamp: row.createdAt ? Date.parse(row.createdAt) || 0 : 0,
          dateOfRequest: formatDate(row.createdAt),
          requestType: 'Payslip Dispute',
          requestDetail: buildDisputeDetail(row.subject),
          requestTarget:
            typeof row.itemId === 'number'
              ? payrollPeriodByItemId.get(row.itemId) ?? 'Payroll period unavailable'
              : 'Payroll period unavailable',
          status,
          approvedBy: status.startsWith('Pending') ? '-' : status === 'Cancelled' ? '-' : resolveDisputeApprover(row),
          requestReason: row.reason ?? '-',
          decisionReason: status === 'Cancelled' ? 'Request cancelled by employee.' : row.statusReason ?? '-',
          decisionDate: formatDateTime(row.updatedAt),
        };
      });

      const merged = [...leaveItems, ...overtimeItems, ...disputeItems].sort(
        (a, b) => b.sortStamp - a.sortStamp || a.id.localeCompare(b.id)
      );

      setApprovals(merged);
      setSelectedApprovalId((current) => (current && merged.some((item) => item.id === current) ? current : null));
    } catch {
      setApprovals([]);
      setSelectedApprovalId(null);
    }
  }

  const refreshApprovals = useAutoRefreshingPage(loadApprovals, { intervalMs: 10000 });

  useEffect(() => {
    void refreshApprovals();
  }, [refreshApprovals]);

  async function cancelSelectedApproval() {
    if (!selectedApproval || !canCancelSelected) return;

    setCancelError('');
    setIsCancelling(true);
    try {
      const path =
        selectedApproval.source === 'leave'
          ? `/api/leave/request/cancel/${selectedApproval.sourceId}`
          : selectedApproval.source === 'overtime'
            ? `/api/overtime/cancel/${selectedApproval.sourceId}`
            : `/api/payroll/item/dispute/cancel/${selectedApproval.sourceId}`;

      await apiFetchJson(path, { method: 'PATCH' });
      setConfirmCancelOpen(false);
      setSelectedApprovalId(null);
      await loadApprovals();
      showSuccess(`${selectedApproval.requestType} request cancelled successfully.`, 'Request Cancelled');
    } catch (error) {
      const context =
        selectedApproval.source === 'leave'
          ? 'leave-request'
          : selectedApproval.source === 'overtime'
            ? 'overtime-request'
            : 'payroll-dispute';
      setCancelError(getFriendlyErrorMessage(error, context));
    } finally {
      setIsCancelling(false);
    }
  }

  const normalizedSearch = searchValue.trim().toLowerCase();
  const visibleApprovals = useMemo(() => {
    return approvals.filter((item) => {
      if (typeFilter !== 'all' && item.requestType !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'Pending') {
          if (!item.status.startsWith('Pending')) {
            return false;
          }
        } else if (item.status !== statusFilter) {
          return false;
        }
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
    () => [
      {
        label: 'Approved',
        value: visibleApprovals.filter((item) => item.status === 'Approved').length,
        tone: 'approved' as const,
      },
      {
        label: 'Denied',
        value: visibleApprovals.filter((item) => item.status === 'Denied').length,
        tone: 'denied' as const,
      },
      {
        label: 'Pending',
        value: visibleApprovals.filter((item) => item.status.startsWith('Pending')).length,
        tone: 'pending' as const,
      },
      {
        label: 'Cancelled',
        value: visibleApprovals.filter((item) => item.status === 'Cancelled').length,
        tone: 'cancelled' as const,
      },
    ],
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
                  <option value="Cancelled">Cancelled</option>
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

      <ApprovalStatusSummary items={cards} />

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
                onClick={() => setSelectedApprovalId(row.id)}
              >
                <div>{displayRequestDate(row)}</div>
                <div>{row.requestType}</div>
                <div>{row.requestDetail}</div>
                <div>{row.requestTarget}</div>
                <div className={`apprStatus apprStatus--${approvalStatusTone(row.status)}`}>
                  {row.status}
                </div>
                <div>{row.approvedBy}</div>
                <div>{row.decisionDate}</div>
              </button>
            ))
          ) : (
            <div className="uEmptyState">
              No matching approval requests.
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
              <ModalCloseButton className="apprModal__close" onClick={() => setSelectedApprovalId(null)} />
            </div>

            <div className="apprModal__hero">
              <div>
                <div className="apprModal__heroLabel">Current Status</div>
                <div className={`apprModal__status apprModal__status--${approvalStatusTone(selectedApproval.status)}`}>
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
                <strong>{displayRequestDate(selectedApproval)}</strong>
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
                <div className="apprModal__sectionTitle">
                  {selectedApproval.status === 'Cancelled' ? 'Cancellation Note' : 'Approval / Denial Reason'}
                </div>
                <p className="apprModal__sectionBody">{selectedApproval.decisionReason}</p>
              </div>
            </div>

            <div className="apprModal__actions">
              <button type="button" className="is-secondary" onClick={() => setSelectedApprovalId(null)}>
                Close
              </button>
              {canCancelSelected && (
                <button type="button" className="is-danger" onClick={() => setConfirmCancelOpen(true)}>
                  Cancel Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmCancelOpen}
        title="Cancel Request"
        message={
          selectedApproval
            ? `Cancel your pending ${selectedApproval.requestType.toLowerCase()} request for ${selectedApproval.requestTarget}?`
            : 'Cancel this pending request?'
        }
        confirmLabel="Cancel Request"
        cancelLabel="Go Back"
        isBusy={isCancelling}
        onConfirm={() => void cancelSelectedApproval()}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
}
