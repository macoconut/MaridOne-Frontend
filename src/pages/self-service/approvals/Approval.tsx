import { useLoading } from '../../../context/useLoading';
import { useEffect, useMemo, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import ApprovalStatusSummary from '../../../components/approvals/ApprovalStatusSummary';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import LargePopup from '../../../components/dialog/LargePopup';
import { useUiDialog } from '../../../components/dialog/useUiDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getManilaNow } from '../../../lib/manilaTime';
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
  durationLabel?: string;
  status: ApprovalStatus;
  approvedBy: string;
  requestReason: string;
  decisionReason: string;
  decisionDate: string;
  managerApprover?: string;
  managerDecisionReason?: string;
  managerDecisionDate?: string;
  rawWorkDate?: string;
  rawStartTime?: string;
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
  managerApprover?: string;
  managerApproverReason?: string;
  managerApprovedAt?: string;
};

type OvertimeRow = {
  overtimeId?: number;
  requestAt?: string;
  workDate?: string;
  startTime?: string;
  endTime?: string;
  approvedAt?: string;
  requestStatus?: string;
  approver?: string;
  reason?: string;
  approveReason?: string;
  overtimeType?: string;
  paid?: boolean;
  managerApprover?: string;
  managerApproveReason?: string;
  managerApprovedAt?: string;
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

function formatLeaveDuration(start?: string, end?: string) {
  if (!start || !end) return '-';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '-';

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diffDays = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);
  return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

function formatClockWindow(start?: string, end?: string) {
  if (!start || !end) return '-';
  const startStr = formatTime(start);
  const endStr = formatTime(end);
  if (startStr === '-' && endStr === '-') return '-';
  return `${startStr} to ${endStr}`;
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

function parseDateParts(value?: string) {
  if (!value) return null;

  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if ([year, month, day].every(Number.isFinite)) {
      return { year, month, day };
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function parseTimeParts(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, hourText, minuteText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

function getOvertimeStartStamp(item: ApprovalItem) {
  const dateParts = parseDateParts(item.rawWorkDate);
  const timeParts = parseTimeParts(item.rawStartTime);
  if (!dateParts || !timeParts) return null;

  return Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute
  );
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
  const { showLoading, hideLoading } = useLoading();

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
  const canCancelSelected = useMemo(() => {
    if (!selectedApproval) return false;
    const isPending = selectedApproval.status.toLowerCase().startsWith('pending');
    const isApproved = selectedApproval.status.toLowerCase() === 'approved';
    if (!isPending && !isApproved) return false;

    const now = new Date();
    if (selectedApproval.source === 'leave') {
      const startDate = new Date(selectedApproval.dateOfRequest);
      const deadline = new Date(startDate);
      deadline.setDate(deadline.getDate() - 2);
      return now < deadline;
    } else if (selectedApproval.source === 'overtime') {
      const otStartStamp = getOvertimeStartStamp(selectedApproval);
      if (otStartStamp == null) return false;

      const manilaNow = getManilaNow();
      const nowStamp = Date.UTC(
        manilaNow.year,
        manilaNow.month - 1,
        manilaNow.day,
        manilaNow.hour,
        manilaNow.minute
      );

      return otStartStamp - nowStamp > 60 * 60 * 1000;
    }
    return true;
  }, [selectedApproval]);

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
        const startDateStr = formatDate(row.startDateTime);
        const endDateStr = formatDate(row.endDateTime);
        const requestTarget = startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`;

        const managerNote = (row.managerApproverReason || '').trim();
        const rawDecisionNote = (row.approverReason || '').trim();
        const hasHrApprover = row.approver && row.approver !== '-' && row.approver !== row.managerApprover;

        let finalDecisionReason = '';
        if (status === 'Cancelled') {
          finalDecisionReason = 'Request cancelled by employee.';
        } else if (status.startsWith('Pending')) {
          finalDecisionReason = '';
        } else if (status === 'Denied' && !hasHrApprover) {
          finalDecisionReason = '';
        } else if (rawDecisionNote === '-' || rawDecisionNote === managerNote) {
          finalDecisionReason = '';
        } else {
          finalDecisionReason = rawDecisionNote;
        }

        return {
          id: `leave-${String(requestId)}`,
          source: 'leave' as const,
          sourceId: requestId,
          sortStamp: requestStamp,
          dateOfRequest: formatDate(row.startDateTime),
          requestType: 'Leave',
          requestDetail: buildLeaveDetail(row.leaveType, row.paid ?? row.isPaid),
          requestTarget,
          durationLabel: formatLeaveDuration(row.startDateTime, row.endDateTime),
          status,
          approvedBy: status.startsWith('Pending') ? '-' : status === 'Cancelled' ? '-' : row.approver?.trim() || '-',
          requestReason: row.reason ?? '-',
          decisionReason: finalDecisionReason,
          decisionDate: formatDateTime(row.approvedAt),
          managerApprover: row.managerApprover,
          managerDecisionReason: managerNote,
          managerDecisionDate: formatDateTime(row.managerApprovedAt),
        };
      });

      const overtimeItems = toArray<OvertimeRow>(otResponse).map((row, index) => {
        const status = mapApprovalStatus(row.requestStatus);
        const overtimeId = row.overtimeId ?? index;
        const workDateStr = formatDate(row.workDate);

        const managerNote = (row.managerApproveReason || '').trim();
        const rawDecisionNote = (row.approveReason || '').trim();
        const hasHrApprover = row.approver && row.approver !== '-' && row.approver !== row.managerApprover;

        let finalDecisionReason = '';
        if (status === 'Cancelled') {
          finalDecisionReason = 'Request cancelled by employee.';
        } else if (status.startsWith('Pending')) {
          finalDecisionReason = '';
        } else if (status === 'Denied' && !hasHrApprover) {
          finalDecisionReason = '';
        } else if (rawDecisionNote === '-' || rawDecisionNote === managerNote) {
          finalDecisionReason = '';
        } else {
          finalDecisionReason = rawDecisionNote;
        }

        return {
          id: `overtime-${String(overtimeId)}`,
          source: 'overtime' as const,
          sourceId: overtimeId,
          sortStamp: row.requestAt ? Date.parse(row.requestAt) || 0 : 0,
          dateOfRequest: formatDate(row.requestAt),
          requestType: 'Overtime',
          requestDetail: buildOvertimeDetail(row.overtimeType, row.paid),
          requestTarget: workDateStr,
          rawWorkDate: row.workDate,
          rawStartTime: row.startTime,
          durationLabel: formatClockWindow(row.startTime, row.endTime),
          status,
          approvedBy: status.startsWith('Pending') ? '-' : status === 'Cancelled' ? '-' : row.approver ?? '-',
          requestReason: row.reason ?? '-',
          decisionReason: finalDecisionReason,
          decisionDate: formatDateTime(row.approvedAt),
          managerApprover: row.managerApprover,
          managerDecisionReason: managerNote,
          managerDecisionDate: formatDateTime(row.managerApprovedAt),
        };
      });

      const disputeItems = toArray<DisputeRow>(disputeResponse).map((row, index) => {
        const status = mapApprovalStatus(row.status);
        const disputeId = row.id ?? index;
        const rawDecisionNote = (row.statusReason || '').trim();

        let finalDecisionReason = '';
        if (status === 'Cancelled') {
          finalDecisionReason = 'Request cancelled by employee.';
        } else if (status.startsWith('Pending')) {
          finalDecisionReason = '';
        } else if (rawDecisionNote === '-') {
          finalDecisionReason = '';
        } else {
          finalDecisionReason = rawDecisionNote;
        }

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
          decisionReason: finalDecisionReason,
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
    showLoading();
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
      hideLoading();
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

      <LargePopup
        open={Boolean(selectedApproval)}
        ariaLabel="Approval details"
        title={
          selectedApproval
            ? selectedApproval.requestType === 'Payslip Dispute'
              ? selectedApproval.requestType
              : `${selectedApproval.requestType} Request`
            : 'Approval details'
        }
        subtitle="Review the request timeline, current status, and recorded decision notes for this approval item."
        size="md"
        onClose={() => setSelectedApprovalId(null)}
        footer={(
          <>
            <button type="button" className="btn btn--ghost is-secondary" onClick={() => setSelectedApprovalId(null)}>
              Close
            </button>
            {canCancelSelected && (
              <button type="button" className="btn is-danger" onClick={() => setConfirmCancelOpen(true)}>
                Cancel Request
              </button>
            )}
          </>
        )}
      >
        {selectedApproval ? (
          <>
            <div className={`apprModal__statusTone apprModal__statusTone--${approvalStatusTone(selectedApproval.status)}`} />

            <div className="apprModal__content">
              <div className="apprModal__tilesWrapper">
                <div className="apprModal__tilesRow">
                  <div className="apprModal__tile apprModal__tile--status">
                    <span>Current Status</span>
                    <div className={`apprModal__badge apprModal__badge--${approvalStatusTone(selectedApproval.status)}`}>
                      {selectedApproval.status}
                    </div>
                  </div>
                  <div className="apprModal__tile apprModal__tile--type">
                    <span>Request Type</span>
                    <div className="apprModal__typeValue">
                      <strong>{selectedApproval.requestDetail.split(' - ')[0]}</strong>
                      {selectedApproval.requestDetail.includes(' - ') && (
                        <span className={`apprModal__payBadge apprModal__payBadge--${selectedApproval.requestDetail.split(' - ')[1].toLowerCase()}`}>
                          {selectedApproval.requestDetail.split(' - ')[1]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="apprModal__tilesRow">
                  <div className="apprModal__tile">
                    <span>Date of Request</span>
                    <strong>{displayRequestDate(selectedApproval)}</strong>
                  </div>
                  <div className="apprModal__tile">
                    <span>Period / Target</span>
                    <strong>{selectedApproval.requestTarget}</strong>
                  </div>
                  {selectedApproval.durationLabel && (
                    <div className="apprModal__tile">
                      <span>Duration</span>
                      <strong>{selectedApproval.durationLabel}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="apprModal__messages">
                <div className="apprModal__message">
                  <span>Request Reason</span>
                  <p>{selectedApproval.requestReason}</p>
                </div>

                {selectedApproval.managerDecisionReason && selectedApproval.managerDecisionReason.trim() !== '' && (
                  <div className="apprModal__message apprModal__message--manager">
                    <span>MANAGER REMARKS</span>
                    <p>
                      {selectedApproval.managerDecisionReason}
                      {selectedApproval.managerApprover && (
                        <span className="apprModal__subNote">
                          Reviewed by <strong>{selectedApproval.managerApprover}</strong> {selectedApproval.managerDecisionDate && <>on <strong>{selectedApproval.managerDecisionDate}</strong></>}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {selectedApproval.decisionReason && selectedApproval.decisionReason.trim() !== '' && (
                  <div className="apprModal__message apprModal__message--hr">
                    <span>{selectedApproval.status === 'Cancelled' ? 'CANCELLATION NOTE' : 'HR REMARKS'}</span>
                    <p>
                      {selectedApproval.decisionReason}
                      {selectedApproval.approvedBy && selectedApproval.approvedBy !== '-' && (
                        <span className="apprModal__subNote">
                          Reviewed by <strong>{selectedApproval.approvedBy}</strong> {selectedApproval.decisionDate && <>on <strong>{selectedApproval.decisionDate}</strong></>}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </LargePopup>
      <ConfirmDialog
        open={confirmCancelOpen}
        title="Cancel Request"
        message={
          selectedApproval
            ? `Cancel your ${selectedApproval.status.toLowerCase()} ${selectedApproval.requestType.toLowerCase()} request for ${selectedApproval.requestTarget}?`
            : 'Cancel this request?'
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
