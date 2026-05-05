import { useLoading } from '@/context/useLoading';
import { useEffect, useMemo, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import ApprovalStatusSummary from '@/components/approvals/ApprovalStatusSummary';
import ConfirmDialog from '@/components/dialog/ConfirmDialog';
import LargePopup from '@/components/dialog/LargePopup';
import PageHeader from '@/components/layout/PageHeader';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '@/lib/api/api';
import { extractAttachmentReference, openDocumentAttachment } from '@/lib/document/documentAttachments';
import { formatDateTime } from '@/lib/utils/formatters';
import {
  buildRequestSummaryMessage,
  formatLeaveDurationLabel,
  formatRequestPeriodLabel,
  formatRequestTimeRangeLabel,
  formatRequestTypeLabel,
} from '@/lib/requestPresentation';
import type { LeaveApprovalRow as LeaveDto, OvertimeApprovalRow as OvertimeDto } from '@/lib/types/approval';
import { getFriendlyErrorMessage } from '@/lib/uiErrors';
import '@/self-service/approvals/Approval.css';
import './PendingApprovals.css';
import '../../hr/approvals/Approvals.css';

type EmployeeRow = {
  id: number;
  name: string;
};

type RequestType = 'Leave' | 'Overtime';
type SourceType = 'leave' | 'overtime';
type RequestTypeFilter = 'all' | SourceType;
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

type ManagerRequest = {
  id: string;
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
  requestDate: string;
  requestTime: string;
  durationLabel: string;
  decisionSummary?: string;
  managerDecisionSummary?: string;
  managerReviewer?: string;
  managerReviewedAt?: string;
  sortStamp: number;
  leaveType?: string;
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  overtimeId?: number;
  attachmentPathId?: number;
};

function employeeLabel(employeeById: Map<number, EmployeeRow>, employeeId?: number) {
  if (typeof employeeId !== 'number') return 'Employee unavailable';
  return employeeById.get(employeeId)?.name || 'Employee unavailable';
}

function normalizeText(value?: string) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toStatusCode(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'DENIED') return 'REJECTED';
  if (normalized === 'PENDING_MANAGER' || normalized === 'PENDING_HR' || normalized === 'PENDING') return 'PENDING';
  return normalized;
}

function statusLabel(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'PENDING_MANAGER') return 'Pending Manager Review';
  if (normalized === 'PENDING_HR') return 'Awaiting HR';
  if (normalized === 'PENDING') return 'Pending Manager Review';
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Denied';
  if (normalized === 'CANCELLED') return 'Cancelled';
  return status;
}

function approvalStatusTone(status: string) {
  const normalized = toStatusCode(status);
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'REJECTED') return 'denied';
  if (normalized === 'CANCELLED') return 'cancelled';
  return 'pending';
}

function splitRequestKind(value?: string) {
  const [primary = '', payLabel = ''] = String(value ?? '').split(' - ');
  return {
    primary: primary || value || 'Request',
    payLabel,
  };
}

function rosterMap(payload: unknown) {
  const rows = toArray<Record<string, unknown>>(payload).map((row, idx) => ({
    id: Number(row.employeeId ?? row.id ?? idx + 1),
    name:
      [row.firstName, row.middleName, row.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ') || 'Employee unavailable',
  }));

  return new Map(
    rows
      .filter((row) => Number.isFinite(row.id))
      .map((row) => [row.id, row] satisfies [number, EmployeeRow])
  );
}

export default function ManagerPendingApprovals() {
  const { showLoading, hideLoading } = useLoading();

  const [requests, setRequests] = useState<ManagerRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionSubmitAttempted, setDecisionSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmDecisionOpen, setConfirmDecisionOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [openingAttachmentId, setOpeningAttachmentId] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useErrorDialogEffect(loadError, 'Team requests could not be loaded');
  useErrorDialogEffect(submitError, 'Team request decision could not be completed');
  useErrorDialogEffect(attachmentError, 'Attachment could not be opened');

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId, requests]
  );
  const activeFilterCount = [typeFilter, statusFilter].filter((value) => value !== 'all').length;
  const normalizedSelectedStatus = String(selected?.status ?? '').toUpperCase();
  const hasFinalDecision = selected
    ? ['APPROVED', 'REJECTED', 'CANCELLED'].includes(normalizedSelectedStatus)
    : false;
  const canReviewSelected = selected
    ? normalizedSelectedStatus === 'PENDING_MANAGER' || normalizedSelectedStatus === 'PENDING'
    : false;
  const selectedStatusTone = selected ? approvalStatusTone(selected.status) : 'pending';
  const selectedRequestKind = splitRequestKind(selected?.requestKind);

  const isDirty = useMemo(() => {
    if (!selected || !canReviewSelected) return false;
    if (pendingDecision !== null) return true;
    if (decisionReason.trim() !== '') return true;
    return false;
  }, [selected, canReviewSelected, pendingDecision, decisionReason]);

  function requestCloseModal() {
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      setSelectedId(null);
    }
  }

  function discardAndCloseModal() {
    setConfirmDiscardOpen(false);
    setSelectedId(null);
  }

  useEscapeDismiss(Boolean(selectedId), requestCloseModal, 10);

  async function loadRequests() {
    try {
      setLoadError('');
      const [employeesRes, leaveRes, overtimeRes] = await Promise.all([
        apiFetchJson<unknown>('/api/employees/team'),
        apiFetchJson<unknown>('/api/leave/request/team?page=0&size=200&sort=requestId,desc'),
        apiFetchJson<unknown>('/api/overtime/team?page=0&size=200&sort=requestAt,desc'),
      ]);

      const employeeById = rosterMap(employeesRes);

      const leaveRows = toArray<LeaveDto>(leaveRes).map((item, idx) => {
        const attachment = extractAttachmentReference(item.reason);
        const leaveTypeLabel = formatRequestTypeLabel(item.leaveType);
        const payLabel = item.paid === false ? 'Unpaid' : 'Paid';
        return {
          id: `leave-${item.requestId ?? idx}`,
          requestId: item.requestId,
          employee: employeeLabel(employeeById, item.empId),
          message: buildRequestSummaryMessage('leave', leaveTypeLabel, item.paid),
          submittedAt: formatDateTime(item.requestAt ?? item.startDateTime, '-'),
          type: 'Leave' as const,
          source: 'leave' as const,
          status: item.requestStatus || 'PENDING_MANAGER',
          reason: attachment.cleanText,
          referenceLabel: 'Leave Period',
          referenceValue: formatRequestPeriodLabel('leave', item.startDateTime, item.endDateTime),
          requestLabel: 'Leave Request',
          requestKind: `${leaveTypeLabel} - ${payLabel}`,
          requestDate: formatRequestPeriodLabel('leave', item.startDateTime, item.endDateTime),
          requestTime: formatRequestTimeRangeLabel(item.startDateTime, item.endDateTime),
          durationLabel: formatLeaveDurationLabel(item.startDateTime, item.endDateTime),
          decisionSummary: item.approverReason || '',
          managerDecisionSummary: item.managerApproverReason || '',
          managerReviewer: item.managerApprover || '',
          managerReviewedAt: formatDateTime(item.managerApprovedAt, '-'),
          sortStamp:
            item.requestAt ? Date.parse(item.requestAt) || 0 : item.startDateTime ? Date.parse(item.startDateTime) || 0 : 0,
          leaveType: item.leaveType,
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
          attachmentPathId: attachment.attachmentPathId ?? undefined,
        };
      });

      const overtimeRows = toArray<OvertimeDto>(overtimeRes).map((item, idx) => {
        const attachment = extractAttachmentReference(item.reason);
        const payLabel = item.paid === false ? 'Unpaid' : 'Paid';
        const overtimeTypeLabel = formatRequestTypeLabel(item.overtimeType || 'Overtime');
        return {
          id: `overtime-${item.overtimeId ?? idx}`,
          overtimeId: item.overtimeId,
          employee: employeeLabel(employeeById, item.employeeId),
          message: buildRequestSummaryMessage('overtime', overtimeTypeLabel, item.paid),
          submittedAt: formatDateTime(item.requestAt, '-'),
          type: 'Overtime' as const,
          source: 'overtime' as const,
          status: item.requestStatus || 'PENDING_MANAGER',
          reason: attachment.cleanText,
          referenceLabel: 'Work Window',
          referenceValue: `${formatDateTime(item.startTime, '-')} to ${formatDateTime(item.endTime, '-')}`,
          requestLabel: 'Overtime Request',
          requestKind: `${overtimeTypeLabel} - ${payLabel}`,
          requestDate: formatRequestPeriodLabel('overtime', item.startTime, item.endTime, item.workDate),
          requestTime: formatRequestTimeRangeLabel(item.startTime, item.endTime),
          durationLabel: formatRequestTimeRangeLabel(item.startTime, item.endTime),
          decisionSummary: item.approveReason || '',
          managerDecisionSummary: item.managerApproveReason || '',
          managerReviewer: item.managerApprover || '',
          managerReviewedAt: formatDateTime(item.managerApprovedAt, '-'),
          sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
          attachmentPathId: attachment.attachmentPathId ?? undefined,
        };
      });

      const merged = [...leaveRows, ...overtimeRows].sort(
        (a, b) => b.sortStamp - a.sortStamp || a.id.localeCompare(b.id)
      );
      setRequests(merged);
    } catch (error) {
      setRequests([]);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  const refreshRequests = useAutoRefreshingPage(loadRequests, { intervalMs: 10000 });

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

  useEffect(() => {
    if (selectedId) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selectedId]);

  const normalizedSearch = normalizeText(searchValue);

  const visibleRequests = useMemo(() => {
    return requests.filter((request) => {
      if (typeFilter !== 'all' && request.source !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && toStatusCode(request.status) !== statusFilter) {
        return false;
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
        request.requestLabel,
        request.requestKind,
        request.requestDate,
        request.requestTime,
        request.decisionSummary,
        statusLabel(request.status),
      ]
        .map(normalizeText)
        .join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [requests, typeFilter, statusFilter, normalizedSearch]);

  const cards = useMemo(() => {
    const approved = visibleRequests.filter((request) => toStatusCode(request.status) === 'APPROVED').length;
    const denied = visibleRequests.filter((request) => toStatusCode(request.status) === 'REJECTED').length;
    const pending = visibleRequests.filter((request) => toStatusCode(request.status) === 'PENDING').length;
    const cancelled = visibleRequests.filter((request) => toStatusCode(request.status) === 'CANCELLED').length;
    return [
      { label: 'Approved', value: approved, tone: 'approved' as const },
      { label: 'Denied', value: denied, tone: 'denied' as const },
      { label: 'Pending', value: pending, tone: 'pending' as const },
      { label: 'Cancelled', value: cancelled, tone: 'cancelled' as const },
    ];
  }, [visibleRequests]);

  useEffect(() => {
    setDecisionReason('');
    setDecisionSubmitAttempted(false);
    setSubmitError('');
    setPendingDecision(null);
    setConfirmDecisionOpen(false);
  }, [selectedId]);

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
  }

  async function submitDecision() {
    if (!selected) return;
    setDecisionSubmitAttempted(true);
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 20) {
      setSubmitError('Please enter at least 20 characters explaining the decision.');
      return;
    }

    setSubmitError('');
    showLoading();
    setIsSaving(true);
    try {
      if (selected.source === 'leave') {
        const leaveId = selected.requestId ?? Number(selected.id.replace('leave-', ''));
        await apiFetchJson(`/api/leave/update/${leaveId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            leaveType: selected.leaveType,
            requestStatus: pendingDecision,
            approverReason: trimmedReason,
          }),
        });
      } else {
        const overtimeId = selected.overtimeId ?? Number(selected.id.replace('overtime-', ''));
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
      hideLoading();
      setIsSaving(false);
    }
  }

  function requestDecisionConfirmation() {
    setDecisionSubmitAttempted(true);
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }

    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 20) {
      setSubmitError('Please enter at least 20 characters explaining the decision.');
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
          title={selected ? 'Review Team Request' : 'Requests from Team Members'}
        />

        <div className="hrAppr__toolbar">
          <label className="uSearch" aria-label="Search approvals">
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

          <div className="uFilter">
            <button
              type="button"
              className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${
                activeFilterCount > 0 ? 'is-active' : ''
              }`}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <FiFilter />
              <span>Filter</span>
            </button>

            {filterOpen && (
              <div className="uFilter__panel">
                <label className="uFilter__field">
                  <span>Request Type</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as RequestTypeFilter)}
                  >
                    <option value="all">All Requests</option>
                    <option value="leave">Leave</option>
                    <option value="overtime">Overtime</option>
                  </select>
                </label>

                <label className="uFilter__field">
                  <span>Status</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Denied</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>

                <div className="uFilter__actions">
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

      <section className="hrApprTable mgrPendTable">
        {visibleRequests.length > 0 ? (
          <>
            <div className="mgrPendTable__head" role="row">
              <span>Name</span>
              <span>Request</span>
              <span>Specific Type</span>
              <span>Date</span>
              <span>Time</span>
              <span className="mgrPendTable__headCell--status">Status</span>
            </div>

            <div className="mgrPendTable__body">
              {visibleRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className="mgrPendTable__row"
                  onClick={() => setSelectedId(request.id)}
                >
                  <span className="mgrPendTable__cell mgrPendTable__cell--name">{request.employee}</span>
                  <span className="mgrPendTable__cell">{request.requestLabel}</span>
                  <span className="mgrPendTable__cell">{request.requestKind}</span>
                  <span className="mgrPendTable__cell">{request.requestDate}</span>
                  <span className="mgrPendTable__cell">{request.requestTime}</span>
                  <span className="mgrPendTable__cell mgrPendTable__cell--status">
                    <span className={`hrApprRow__status hrApprRow__status--${toStatusCode(request.status).toLowerCase()}`}>
                      {statusLabel(request.status)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="uEmptyState">
            No matching requests found. Try clearing the search or adjusting the filters.
          </div>
        )}
      </section>

      <LargePopup
        open={Boolean(selected)}
        ariaLabel="Pending approval review"
        title={selected ? `${selected.employee} - ${selected.type}` : 'Pending approval review'}
        subtitle={
          canReviewSelected
            ? 'Review the team request details, then either forward the request to HR or deny it here.'
            : 'Review the submitted details, supporting documents, and recorded decision history for this team request.'
        }
        size="lg"
        onClose={requestCloseModal}
        closeDisabled={isSaving}
        footer={
          canReviewSelected ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={requestCloseModal} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={requestDecisionConfirmation} disabled={isSaving || !pendingDecision}>
                {isSaving
                  ? 'Saving...'
                  : pendingDecision === 'APPROVED'
                    ? 'Confirm Forward to HR'
                    : pendingDecision === 'REJECTED'
                      ? 'Confirm Denial'
                      : 'Confirm Decision'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={requestCloseModal} disabled={isSaving}>
              Close
            </button>
          )
        }
      >
        {selected ? (
          <div className="apprModal__content">
            <div className="apprModal__tilesWrapper">
              <div className="apprModal__tilesRow">
                <div className="apprModal__tile apprModal__tile--status">
                  <span>Current Status</span>
                  <div className={`apprModal__badge apprModal__badge--${selectedStatusTone}`}>
                    {statusLabel(selected.status)}
                  </div>
                </div>
                <div className="apprModal__tile apprModal__tile--type">
                  <span>Request Type</span>
                  <div className="apprModal__typeValue">
                    <strong>{selectedRequestKind.primary}</strong>
                    {selectedRequestKind.payLabel && (
                      <span
                        className={`apprModal__payBadge apprModal__payBadge--${
                          selectedRequestKind.payLabel.toLowerCase() === 'unpaid' ? 'unpaid' : 'paid'
                        }`}
                      >
                        {selectedRequestKind.payLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="apprModal__tilesRow">
                <div className="apprModal__tile">
                  <span>Submitted At</span>
                  <strong>{selected.submittedAt}</strong>
                </div>
                <div className="apprModal__tile">
                  <span>{selected.referenceLabel}</span>
                  <strong>{selected.referenceValue}</strong>
                </div>
                <div className="apprModal__tile">
                  <span>Time Window</span>
                  <strong>{selected.requestTime}</strong>
                </div>
                <div className="apprModal__tile">
                  <span>Duration</span>
                  <strong>{selected.durationLabel}</strong>
                </div>
              </div>
            </div>

            <div className="apprModal__messages">
              <div className="apprModal__message">
                <span>Request Reason</span>
                <p>{selected.reason || 'No reason provided.'}</p>
              </div>

              <div className="apprModal__message apprModal__message--attachment">
                <div className="apprModal__documentRow">
                  <div className="apprModal__documentCopy">
                    <span>Supporting Document</span>
                    <p>
                      {typeof selected.attachmentPathId === 'number'
                        ? 'A supporting file was uploaded with this request.'
                        : 'No supporting file was uploaded with this request.'}
                    </p>
                  </div>
                  {typeof selected.attachmentPathId === 'number' && (
                    <button
                      type="button"
                      className="apprModal__documentButton"
                      onClick={() => void handleOpenAttachment(selected.attachmentPathId!)}
                      disabled={openingAttachmentId === selected.attachmentPathId}
                    >
                      {openingAttachmentId === selected.attachmentPathId ? 'Opening...' : 'View Attachment'}
                    </button>
                  )}
                </div>
              </div>

              {selected.managerDecisionSummary && (
                <div className="apprModal__message apprModal__message--manager">
                  <span>Manager Remarks</span>
                  <p>
                    {selected.managerDecisionSummary}
                    {(selected.managerReviewer || selected.managerReviewedAt) && (
                      <span className="apprModal__subNote">
                        {selected.managerReviewer ? <>Reviewed by <strong>{selected.managerReviewer}</strong></> : 'Reviewed'}
                        {selected.managerReviewedAt ? <> on <strong>{selected.managerReviewedAt}</strong></> : null}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {!canReviewSelected && normalizedSelectedStatus === 'PENDING_HR' && (
                <div className="apprModal__message apprModal__message--manager">
                  <span>Workflow Update</span>
                  <p>This request is already with HR for final review. No further manager action is needed right now.</p>
                </div>
              )}

              {selected.decisionSummary && hasFinalDecision && (
                <div className="apprModal__message apprModal__message--hr">
                  <span>{normalizedSelectedStatus === 'CANCELLED' ? 'Cancellation Note' : 'Final Decision Note'}</span>
                  <p>{selected.decisionSummary}</p>
                </div>
              )}
            </div>

            {canReviewSelected && (
              <div className="apprModal__reviewPanels">
                <div className="apprModal__panel">
                  <p className="apprModal__panelTitle">Manager Review</p>

                  <div className="decisionPicker">
                    <div className="decisionPicker__actions">
                      <button
                        type="button"
                        className={`decisionPicker__button ${pendingDecision === 'APPROVED' ? 'is-selected' : ''}`}
                        disabled={isSaving}
                        onClick={() => setPendingDecision('APPROVED')}
                      >
                        Forward to HR
                      </button>
                      <button
                        type="button"
                        className={`decisionPicker__button ${pendingDecision === 'REJECTED' ? 'is-selected' : ''}`}
                        disabled={isSaving}
                        onClick={() => setPendingDecision('REJECTED')}
                      >
                        Deny
                      </button>
                    </div>
                  </div>

                  <label>
                    <textarea
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      placeholder="Type the reason for approving or denying this request"
                      aria-invalid={decisionSubmitAttempted && decisionReason.trim().length < 5 ? 'true' : undefined}
                    />
                  </label>

                  {submitError ? <p className="hrApprForm__error">{submitError}</p> : null}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </LargePopup>
      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        message="You have unsaved review progress. If you close this request now, your edits will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={discardAndCloseModal}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
      <ConfirmDialog
        open={confirmDecisionOpen}
        title={pendingDecision === 'REJECTED' ? 'Confirm Denial' : 'Confirm Forward to HR'}
        message={
          selected
            ? pendingDecision === 'REJECTED'
              ? `Deny ${selected.employee}'s ${selected.type.toLowerCase()} request now?`
              : `Forward ${selected.employee}'s ${selected.type.toLowerCase()} request to HR for the final decision?`
            : 'Confirm this team approval decision?'
        }
        confirmLabel={pendingDecision === 'REJECTED' ? 'Confirm Denial' : 'Forward to HR'}
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
