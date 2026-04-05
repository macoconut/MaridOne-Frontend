import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import ApprovalStatusSummary from '../../../components/approvals/ApprovalStatusSummary';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { extractAttachmentReference, openDocumentAttachment } from '../../../lib/documentAttachments';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './Approvals.css';

type OvertimeDto = {
  overtimeId?: number;
  employeeId?: number;
  requestStatus?: string;
  requestAt?: string;
  workDate?: string;
  startTime?: string;
  endTime?: string;
  overtimeType?: string;
  reason?: string;
  approveReason?: string;
};

type LeaveDto = {
  requestId?: number;
  empId?: number;
  firstName?: string;
  lastName?: string;
  startDateTime?: string;
  endDateTime?: string;
  requestAt?: string;
  requestStatus?: string;
  reason?: string;
  leaveType?: string;
  approverReason?: string;
  paid?: boolean;
};

type EmployeeDirectoryRow = {
  employeeId?: number;
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
};

type RequestType = 'Overtime' | 'Leave';
type SourceType = 'overtime' | 'leave';
type RequestTypeFilter = 'all' | SourceType;
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';
type LeavePaidFilter = 'all' | 'paid' | 'unpaid';
type OvertimeTypeFilter =
  | 'all'
  | 'BASIC'
  | 'OVERTIME'
  | 'DOUBLE_OVERTIME'
  | 'TRIPLE_OVERTIME'
  | 'HOLIDAY'
  | 'ALLOWANCE'
  | 'NIGHTDIFF'
  | 'FIXED';

type HrRequest = {
  id: string;
  leaveRequestId?: number;
  employeeId?: number;
  employee: string;
  message: string;
  submittedAt: string;
  type: RequestType;
  source: SourceType;
  status: string;
  reason: string;
  referenceLabel: string;
  referenceValue: string;
  requestLabel: string;
  requestKind: string;
  durationLabel: string;
  requestDateTime: string;
  decisionSummary?: string;
  isPaid?: boolean;
  overtimeType?: string;
  leaveType?: string;
  attachmentPathId?: number;
  sortStamp: number;
};

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRequestType(value?: string) {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '-';
  }

  const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  if (minutes > 0) return `${minutes} min`;
  return '0 min';
}

function formatRequestDateTime(source: SourceType, start?: string, end?: string, workDate?: string) {
  const resolvedStart = source === 'overtime' ? start || workDate : start;
  const resolvedEnd = source === 'overtime' ? end || start || workDate : end;
  const startDateLabel = formatDateOnly(resolvedStart);
  const endDateLabel = formatDateOnly(resolvedEnd);
  const startTimeLabel = formatTimeOnly(start);
  const endTimeLabel = formatTimeOnly(end);
  if (startDateLabel === '-' && endDateLabel === '-') return '-';
  return `${startDateLabel} to ${endDateLabel} (${startTimeLabel} - ${endTimeLabel})`;
}

function employeeLabel(employeeName?: string, _employeeId?: number) {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : '';
  if (trimmedName) return trimmedName;
  return 'Employee unavailable';
}

function employeeDirectoryLabel(row?: EmployeeDirectoryRow) {
  if (!row) return '';
  const fullName = [row.firstName, row.middleName, row.lastName]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value!.trim())
    .join(' ');
  return fullName;
}

function leaveEmployeeLabel(item: LeaveDto) {
  const fullName = [item.firstName, item.lastName]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value!.trim())
    .join(' ');
  return fullName;
}

function resolvedEmployeeLabel(
  employeeNameById: Map<number, string>,
  employeeId?: number,
  preferredLabel?: string
) {
  const mappedLabel = typeof employeeId === 'number' ? employeeNameById.get(employeeId) : '';
  if (mappedLabel && mappedLabel.trim().length > 0) return mappedLabel.trim();
  return employeeLabel(preferredLabel, employeeId);
}

function requestStatusPriority(status: string) {
  const normalized = toStatusCode(status);
  if (normalized === 'PENDING') return 0;
  if (normalized === 'APPROVED') return 1;
  if (normalized === 'REJECTED') return 2;
  return 3;
}

function statusLabel(status: string) {
  const normalized = toStatusCode(status);
  if (normalized === 'PENDING') return 'Pending';
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Denied';
  return status;
}

function toStatusCode(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'DENIED') return 'REJECTED';
  return normalized;
}

function buildApiPath(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function normalizeText(value?: string) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export default function HrApprovals() {
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [confirmDecisionOpen, setConfirmDecisionOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [openingAttachmentId, setOpeningAttachmentId] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [leavePaidFilter, setLeavePaidFilter] = useState<LeavePaidFilter>('all');
  const [overtimeTypeFilter, setOvertimeTypeFilter] = useState<OvertimeTypeFilter>('all');

  useErrorDialogEffect(loadError, 'Approval requests could not be loaded');
  useErrorDialogEffect(submitError, 'Approval decision could not be completed');
  useErrorDialogEffect(attachmentError, 'Attachment could not be opened');
  useEscapeDismiss(Boolean(selectedId), () => setSelectedId(null), 10);

  async function loadRequests() {
    try {
      setLoadError('');
      const leavePath = buildApiPath('/api/leave/request', {
        page: '0',
        size: '100',
        requestStatus: statusFilter !== 'all' ? statusFilter : undefined,
        isPaid:
          leavePaidFilter === 'paid' ? 'true' : leavePaidFilter === 'unpaid' ? 'false' : undefined,
      });
      const overtimePath = buildApiPath('/api/overtime/all', {
        page: '0',
        size: '100',
        requestStatus: statusFilter !== 'all' ? statusFilter : undefined,
        overtimeType: overtimeTypeFilter !== 'all' ? overtimeTypeFilter : undefined,
      });
      const [employeesRes, overtimeRes, leaveRes] = await Promise.allSettled([
        apiFetchJson<unknown>('/api/employees?page=0&size=200'),
        apiFetchJson<unknown>(overtimePath),
        apiFetchJson<unknown>(leavePath),
      ]);

      if (overtimeRes.status !== 'fulfilled' || leaveRes.status !== 'fulfilled') {
        throw (
          (overtimeRes.status === 'rejected' && overtimeRes.reason) ||
          (leaveRes.status === 'rejected' && leaveRes.reason) ||
          new Error('Failed to load approval requests.')
        );
      }

      const employeeNameById = new Map<number, string>();
      if (employeesRes.status === 'fulfilled') {
        for (const row of toArray<EmployeeDirectoryRow>(employeesRes.value)) {
          const employeeId =
            typeof row.employeeId === 'number' ? row.employeeId : typeof row.id === 'number' ? row.id : null;
          if (employeeId === null) continue;
          const label = employeeDirectoryLabel(row);
          if (label) employeeNameById.set(employeeId, label);
        }
      }

      const overtimeRows = toArray<OvertimeDto>(overtimeRes.value).map((item, idx) => {
        const attachment = extractAttachmentReference(item.reason);
        return {
          id: `overtime-${item.overtimeId ?? idx}`,
          employeeId: item.employeeId,
          employee: resolvedEmployeeLabel(employeeNameById, item.employeeId),
          message: `${item.overtimeType || 'Overtime'} request on ${formatDateOnly(item.workDate)}`,
          submittedAt: formatDateTime(item.requestAt),
          type: 'Overtime' as const,
          source: 'overtime' as const,
          status: item.requestStatus || 'PENDING',
          reason: attachment.cleanText,
          referenceLabel: 'Work Date',
          referenceValue: formatDateOnly(item.workDate),
          requestLabel: 'Overtime Request',
          requestKind: formatRequestType(item.overtimeType || 'Overtime'),
          durationLabel: formatClockWindow(item.startTime, item.endTime),
          requestDateTime: formatRequestDateTime('overtime', item.startTime, item.endTime, item.workDate),
          decisionSummary: item.approveReason || '',
          overtimeType: item.overtimeType,
          attachmentPathId: attachment.attachmentPathId ?? undefined,
          sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
        };
      });

      const leaveRows = toArray<LeaveDto>(leaveRes.value).map((item, idx) => {
        const attachment = extractAttachmentReference(item.reason);
        return {
          id: `leave-${item.requestId ?? idx}`,
          leaveRequestId: item.requestId,
          employeeId: item.empId,
          employee: resolvedEmployeeLabel(employeeNameById, item.empId, leaveEmployeeLabel(item)),
          message: `Leave request from ${formatDateOnly(item.startDateTime)} to ${formatDateOnly(item.endDateTime)}`,
          submittedAt: formatDateTime(item.requestAt ?? item.startDateTime),
          type: 'Leave' as const,
          source: 'leave' as const,
          status: item.requestStatus || 'PENDING',
          reason: attachment.cleanText,
          referenceLabel: 'Leave Period',
          referenceValue: `${formatDateOnly(item.startDateTime)} - ${formatDateOnly(item.endDateTime)}`,
          requestLabel: 'Leave Request',
          requestKind: `${formatRequestType(item.leaveType)} - ${item.paid === false ? 'Unpaid' : 'Paid'}`,
          durationLabel: formatLeaveDuration(item.startDateTime, item.endDateTime),
          requestDateTime: formatRequestDateTime('leave', item.startDateTime, item.endDateTime),
          decisionSummary: item.approverReason || '',
          isPaid: item.paid,
          leaveType: item.leaveType,
          attachmentPathId: attachment.attachmentPathId ?? undefined,
          sortStamp:
            item.requestAt ? Date.parse(item.requestAt) || 0 : item.startDateTime ? Date.parse(item.startDateTime) || 0 : 0,
        };
      });

      const merged = [...leaveRows, ...overtimeRows].sort(
        (a, b) =>
          requestStatusPriority(a.status) - requestStatusPriority(b.status) ||
          b.sortStamp - a.sortStamp ||
          a.id.localeCompare(b.id)
      );
      setRequests(merged);
    } catch (error) {
      setRequests([]);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  const refreshRequests = useAutoRefreshingPage(loadRequests, { intervalMs: 15000 });

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests, statusFilter, leavePaidFilter, overtimeTypeFilter]);

  const normalizedSearch = normalizeText(searchValue);

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => {
      if (typeFilter !== 'all' && request.source !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && toStatusCode(request.status) !== statusFilter) {
        return false;
      }

      if (leavePaidFilter !== 'all') {
        if (request.source !== 'leave') {
          return false;
        }
        const shouldBePaid = leavePaidFilter === 'paid';
        if ((request.isPaid ?? true) !== shouldBePaid) {
          return false;
        }
      }

      if (overtimeTypeFilter !== 'all') {
        if (request.source !== 'overtime') {
          return false;
        }
        if (String(request.overtimeType ?? '').toUpperCase() !== overtimeTypeFilter) {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        request.employee,
        request.message,
        request.reason,
        request.referenceLabel,
        request.referenceValue,
        request.type,
        statusLabel(request.status),
        request.requestLabel,
        request.requestKind,
        request.durationLabel,
        request.requestDateTime,
      ]
        .map(normalizeText)
        .join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [requests, typeFilter, statusFilter, leavePaidFilter, overtimeTypeFilter, normalizedSearch]);

  const cards = useMemo(() => {
    const approved = visibleRequests.filter((r) => toStatusCode(r.status) === 'APPROVED').length;
    const denied = visibleRequests.filter((r) => toStatusCode(r.status) === 'REJECTED').length;
    const pending = visibleRequests.filter((r) => toStatusCode(r.status) === 'PENDING').length;
    return [
      { label: 'Approved', value: approved, tone: 'approved' as const },
      { label: 'Denied', value: denied, tone: 'denied' as const },
      { label: 'Pending', value: pending, tone: 'pending' as const },
    ];
  }, [visibleRequests]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId, requests]
  );
  const activeFilterCount = [typeFilter, statusFilter, leavePaidFilter, overtimeTypeFilter].filter(
    (value) => value !== 'all'
  ).length;
  const hasFinalDecision = selected ? toStatusCode(selected.status) !== 'PENDING' : false;
  const leaveReadyForReview =
    selected?.source !== 'leave' || (typeof selected.leaveType === 'string' && selected.leaveType.length > 0);
  const canReviewSelected =
    selected ? toStatusCode(selected.status) === 'PENDING' && leaveReadyForReview : false;

  useEffect(() => {
    setDecisionReason('');
    setSubmitError('');
    setPendingDecision(null);
    setConfirmDecisionOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (selected) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selected]);

  function handleTypeFilterChange(nextType: RequestTypeFilter) {
    setTypeFilter(nextType);
    if (nextType === 'leave') {
      setOvertimeTypeFilter('all');
    } else if (nextType === 'overtime') {
      setLeavePaidFilter('all');
    }
  }

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
    setLeavePaidFilter('all');
    setOvertimeTypeFilter('all');
  }

  async function submitDecision() {
    if (!selected) return;
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 5) {
      setSubmitError('Please enter at least 5 characters explaining the decision.');
      return;
    }

    setSubmitError('');
    setIsSaving(true);
    try {
      if (selected.source === 'leave') {
        const leaveId = Number(selected.id.replace('leave-', ''));
        await apiFetchJson(`/api/leave/update/${leaveId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            leaveType: selected.leaveType,
            requestStatus: pendingDecision,
            approverReason: trimmedReason,
          }),
        });
      } else {
        const overtimeId = Number(selected.id.replace('overtime-', ''));
        await apiFetchJson('/api/overtime/update', {
          method: 'PATCH',
          body: JSON.stringify({
            overtimeId,
            updateStatus: pendingDecision,
            approveReason: trimmedReason,
          }),
        });
      }

      setSelectedId(null);
      await loadRequests();
    } catch (error) {
      setSubmitError(getFriendlyErrorMessage(error, 'approval-decision'));
    } finally {
      setIsSaving(false);
    }
  }

  function requestDecisionConfirmation() {
    if (!selected) return;
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 5) {
      setSubmitError('Please enter at least 5 characters explaining the decision.');
      return;
    }
    setSubmitError('');
    setConfirmDecisionOpen(true);
  }

  async function handleOpenAttachment(pathId: number) {
    setAttachmentError('');
    setOpeningAttachmentId(pathId);
    try {
      await openDocumentAttachment(pathId);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Failed to open the attachment.');
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <PageHeader
          title={selected ? 'Review Employee Request' : 'Requests from Employees'}
          description={
            selected
              ? 'Review the selected employee request before recording an approval or denial.'
              : 'Review leave and overtime requests here. Payroll disputes stay in Manage Payslips.'
          }
        />

        <div className="hrAppr__toolbar">
          <label className="hrApprSearch" aria-label="Search approvals">
            <FiSearch />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search employee, request, reason, or status"
            />
            {searchValue && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
                <FiXCircle />
              </button>
            )}
          </label>

          <div className="hrApprFilter">
            <button
              type="button"
              className={`hrApprFilter__toggle ${filterOpen ? 'is-open' : ''} ${
                activeFilterCount > 0 ? 'is-active' : ''
              }`}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <FiFilter />
              <span>Filter</span>
              {activeFilterCount > 0 && <span className="hrApprFilter__count">{activeFilterCount}</span>}
            </button>

            {filterOpen && (
              <div className="hrApprFilter__panel">
                <label className="hrApprFilter__field">
                  <span>Request Type</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => handleTypeFilterChange(e.target.value as RequestTypeFilter)}
                  >
                    <option value="all">All Requests</option>
                    <option value="leave">Leave</option>
                    <option value="overtime">Overtime</option>
                  </select>
                </label>

                <label className="hrApprFilter__field">
                  <span>Status</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                    <option value="all">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Denied</option>
                  </select>
                </label>

                <label className="hrApprFilter__field">
                  <span>Leave Pay</span>
                  <select
                    value={leavePaidFilter}
                    onChange={(e) => setLeavePaidFilter(e.target.value as LeavePaidFilter)}
                    disabled={typeFilter === 'overtime'}
                  >
                    <option value="all">All Leave</option>
                    <option value="paid">Paid Only</option>
                    <option value="unpaid">Unpaid Only</option>
                  </select>
                </label>

                <label className="hrApprFilter__field">
                  <span>OT Type</span>
                  <select
                    value={overtimeTypeFilter}
                    onChange={(e) => setOvertimeTypeFilter(e.target.value as OvertimeTypeFilter)}
                    disabled={typeFilter === 'leave'}
                  >
                    <option value="all">All OT Types</option>
                    <option value="BASIC">Basic</option>
                    <option value="OVERTIME">Overtime</option>
                    <option value="DOUBLE_OVERTIME">Double Overtime</option>
                    <option value="TRIPLE_OVERTIME">Triple Overtime</option>
                    <option value="HOLIDAY">Holiday</option>
                    <option value="ALLOWANCE">Allowance</option>
                    <option value="NIGHTDIFF">Night Differential</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </label>

                <div className="hrApprFilter__actions">
                  <button type="button" onClick={clearFilters}>
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ApprovalStatusSummary items={cards} />

      <section className="hrApprTable hrApprRequestTable">
        {visibleRequests.length > 0 ? (
          <>
            <div className="hrApprRequestTable__head" role="row">
              <span>Name</span>
              <span>Request</span>
              <span>Specific Type</span>
              <span>Duration</span>
              <span>Date and Time</span>
              <span className="hrApprRequestTable__headCell--status">Status</span>
            </div>

            <div className="hrApprRequestTable__body">
              {visibleRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className={`hrApprRequestTable__row hrApprRequestTable__row--${toStatusCode(request.status).toLowerCase()}`}
                  onClick={() => setSelectedId(request.id)}
                >
                  <span className="hrApprRequestTable__cell hrApprRequestTable__cell--name">{request.employee}</span>
                  <span className="hrApprRequestTable__cell">{request.requestLabel}</span>
                  <span className="hrApprRequestTable__cell">{request.requestKind}</span>
                  <span className="hrApprRequestTable__cell">{request.durationLabel}</span>
                  <span className="hrApprRequestTable__cell">{request.requestDateTime}</span>
                  <span className="hrApprRequestTable__cell hrApprRequestTable__cell--status">
                    <span className={`hrApprRow__status hrApprRow__status--${toStatusCode(request.status).toLowerCase()}`}>
                      {statusLabel(request.status)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="hrApprRequestTable__empty">
            <span>No matching requests.</span>
            <span>Try clearing the search or adjusting the filters.</span>
          </div>
        )}
      </section>

      {selected && (
        <div className="hrApprModalBackdrop" role="dialog" aria-modal="true">
          <div className="hrApprModal">
            <div className="dashModal__top">
              <div>
                <h2 className="hrApprModal__title">
                  {selected.employee} - {selected.type}
                </h2>
                <p className="hrApprModal__subtitle">Review the request details, choose an approval outcome, and confirm the decision after the reason is complete.</p>
              </div>
              <ModalCloseButton className="hrApprModal__close" onClick={() => setSelectedId(null)} />
            </div>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Reference:</span>
                <input value={`${selected.referenceLabel}: ${selected.referenceValue}`} readOnly />
              </label>
              <label>
                <span>Current Status:</span>
                <div
                  className={`hrApprForm__statusBadge hrApprForm__statusBadge--${toStatusCode(selected.status).toLowerCase()}`}
                >
                  {statusLabel(selected.status)}
                </div>
              </label>
            </div>

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Requested At:</span>
                <input value={selected.submittedAt} readOnly />
              </label>
              <label>
                <span>Type:</span>
                <input value={selected.type} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Request Message:</span>
                <input value={selected.message} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Reason:</span>
                <textarea value={selected.reason || 'No reason provided.'} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <div className="hrApprAttachment">
                <div className="hrApprAttachment__copy">
                  <span>Attachment:</span>
                  <p>
                    {typeof selected.attachmentPathId === 'number'
                      ? 'A supporting file was uploaded with this request.'
                      : 'No attachment was uploaded with this request.'}
                  </p>
                </div>
                {typeof selected.attachmentPathId === 'number' && (
                  <button
                    type="button"
                    className="hrApprAttachment__button"
                    onClick={() => void handleOpenAttachment(selected.attachmentPathId!)}
                    disabled={openingAttachmentId === selected.attachmentPathId}
                  >
                    {openingAttachmentId === selected.attachmentPathId ? 'Opening...' : 'View Attachment'}
                  </button>
                )}
              </div>
            </div>

            {selected.decisionSummary && (
              <div className="hrApprForm__row">
                <label>
                  <span>Latest Decision Note:</span>
                  <textarea value={selected.decisionSummary} readOnly />
                </label>
              </div>
            )}

            {selected.source === 'leave' && !leaveReadyForReview && (
              <p className="hrApprForm__hint">This leave request is missing the details needed to submit an HR decision.</p>
            )}
            {hasFinalDecision && (
              <p className="hrApprForm__hint">This request already has a final decision recorded.</p>
            )}

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row">
              <label className="decisionPicker">
                <span>Administrative Approval:</span>
                <div className="decisionPicker__actions">
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDecision === 'APPROVED' ? 'is-selected' : ''}`}
                    disabled={isSaving || !canReviewSelected}
                    onClick={() => setPendingDecision('APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDecision === 'REJECTED' ? 'is-selected' : ''}`}
                    disabled={isSaving || !canReviewSelected}
                    onClick={() => setPendingDecision('REJECTED')}
                  >
                    Deny
                  </button>
                </div>
                {canReviewSelected && (
                  <p className="decisionPicker__note">
                    Choose the outcome here first. The request will only be submitted when you use the confirm button below.
                  </p>
                )}
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Reason for Approval / Denial:</span>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Type the reason for approving or denying this request"
                  readOnly={!canReviewSelected}
                />
              </label>
            </div>

            <div className="hrApprModal__footer">
              {canReviewSelected ? (
                <>
                  <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="button" onClick={requestDecisionConfirmation} disabled={isSaving || !pendingDecision}>
                    {isSaving
                      ? 'Saving...'
                      : pendingDecision === 'APPROVED'
                        ? 'Confirm Approval'
                        : pendingDecision === 'REJECTED'
                          ? 'Confirm Denial'
                          : 'Confirm Decision'}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDecisionOpen}
        title={pendingDecision === 'REJECTED' ? 'Confirm Denial' : 'Confirm Approval'}
        message={
          selected
            ? `Apply this ${pendingDecision === 'REJECTED' ? 'denial' : 'approval'} to ${selected.employee}'s ${selected.type.toLowerCase()} request?`
            : 'Confirm this approval decision?'
        }
        confirmLabel={pendingDecision === 'REJECTED' ? 'Confirm Denial' : 'Confirm Approval'}
        cancelLabel="Go Back"
        isBusy={isSaving}
        onConfirm={() => {
          setConfirmDecisionOpen(false);
          void submitDecision();
        }}
        onCancel={() => setConfirmDecisionOpen(false)}
      />
    </div>
  );
}
