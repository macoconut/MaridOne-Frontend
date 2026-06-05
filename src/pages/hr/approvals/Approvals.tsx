import { useLoading } from '@/context/useLoading';
import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import ApprovalStatusSummary from '@/components/approvals/ApprovalStatusSummary';
import ConfirmDialog from '@/components/dialog/ConfirmDialog';
import WorkflowHelpButton from '@/components/help/WorkflowHelpButton';
import LargePopup from '@/components/dialog/LargePopup';
import PageHeader from '@/components/layout/PageHeader';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '@/lib/api/api';
import {openDocumentUsingEntityFilter} from '@/lib/api/endpoints/documents/document-fetch';
import {
  buildRequestSummaryMessage,
  formatLeaveDurationLabel,
  formatRequestPeriodLabel,
  formatRequestTimeRangeLabel,
  formatRequestTypeLabel,
} from '@/lib/utils/requestPresentation';
import type {
  ApprovalEmployeeDirectoryRow as EmployeeDirectoryRow,
  LeaveApprovalRow as LeaveDto,
  OvertimeApprovalRow as OvertimeDto,
} from '@/lib/types/approval';
import type { LeaveBalanceRow } from '@/lib/types/employee';
import { getFriendlyErrorMessage } from '@/lib/utils/uiErrors';
import { formatDateTime, formatEmployeeLabel } from '@/lib/utils/formatters';
import '@/pages/self-service/approvals/Approval.css';
import './Approvals.css';
import '@/pages/manager/pending-approvals/PendingApprovals.css';
import { DocumentEntities } from '@/enum/directories';

type RequestType = 'Overtime' | 'Leave';
type SourceType = 'overtime' | 'leave';
type RequestTypeFilter = 'all' | SourceType;
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
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
  requestDate: string;
  requestTime: string;
  durationLabel: string;
  decisionSummary?: string;
  paid?: boolean;
  suggestedPaid?: boolean;
  paidOverrideReason?: string;
  overtimeType?: string;
  leaveType?: string;
  managerApprover?: string;
  managerDecisionSummary?: string;
  managerReviewedAt?: string;
  attachmentConnectedEntity?: string;
  attachmentConnectedId?: number;
  sortStamp: number;
};



function resolvedEmployeeLabel(
  employeeNameById: Map<number, string>,
  employeeId?: number,
  preferredLabel?: string
) {
  const mappedLabel = typeof employeeId === 'number' ? employeeNameById.get(employeeId) : '';
  if (mappedLabel && mappedLabel.trim().length > 0) return mappedLabel.trim();
  return formatEmployeeLabel({ firstName: preferredLabel, employeeId });
}

function requestStatusPriority(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'PENDING_HR') return 0;
  if (normalized === 'PENDING_MANAGER') return 1;
  if (normalized === 'PENDING') return 2;
  if (normalized === 'APPROVED') return 3;
  if (normalized === 'REJECTED') return 4;
  if (normalized === 'CANCELLED') return 5;
  return 4;
}

function statusLabel(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'PENDING_HR') return 'Pending HR Review';
  if (normalized === 'PENDING_MANAGER') return 'Pending Manager Review';
  if (normalized === 'PENDING') return 'Pending Manager Review';
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Denied';
  if (normalized === 'CANCELLED') return 'Cancelled';
  return status;
}

function toStatusCode(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'DENIED') return 'REJECTED';
  if (normalized === 'PENDING_MANAGER' || normalized === 'PENDING_HR' || normalized === 'PENDING') return 'PENDING';
  return normalized;
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

function buildAttachmentKey(entity: string, id: number) {
  return `${entity}-${id}`;
}

const HR_APPROVAL_WORKFLOW_HELP = [
  'Managers review direct team requests first; Management reviews requests from employees without assigned managers.',
  'Endorsed leave and overtime requests arrive here for final HR paid or unpaid treatment.',
  'HR users can finalize their own endorsed requests here by choosing the paid or unpaid treatment.',
];






export default function HrApprovals() {
  const { showLoading, hideLoading } = useLoading();
  const [attachmentExistsMap, setAttachmentExistsMap] = useState<Record<string, boolean | 'checking'>>({});
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [pendingPaidDecision, setPendingPaidDecision] = useState<boolean | null>(null);
  const [paidOverrideReason, setPaidOverrideReason] = useState('');
  const [leaveBalanceLabel, setLeaveBalanceLabel] = useState('Not available');
  const [, setDecisionSubmitAttempted] = useState(false);
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
  const [leavePaidFilter, setLeavePaidFilter] = useState<LeavePaidFilter>('all');
  const [overtimeTypeFilter, setOvertimeTypeFilter] = useState<OvertimeTypeFilter>('all');

  useErrorDialogEffect(loadError, 'Leave requests could not be loaded');
  useErrorDialogEffect(submitError, 'Leave request decision could not be completed');
  useErrorDialogEffect(attachmentError, 'Attachment could not be opened');

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId, requests]
  );
  const activeFilterCount = [typeFilter, statusFilter, leavePaidFilter, overtimeTypeFilter].filter(
    (value) => value !== 'all'
  ).length;
  const normalizedSelectedStatus = String(selected?.status ?? '').toUpperCase();
  const hasFinalDecision = selected
    ? ['APPROVED', 'REJECTED', 'CANCELLED'].includes(normalizedSelectedStatus)
    : false;
  const canReviewSelected = selected ? normalizedSelectedStatus === 'PENDING_HR' : false;
  const selectedSuggestedPaid = Boolean(selected?.suggestedPaid ?? selected?.paid ?? true);
  const selectedStatusTone = selected ? approvalStatusTone(selected.status) : 'pending';
  const selectedRequestKind = splitRequestKind(selected?.requestKind);
  const defaultPendingDecision = canReviewSelected ? 'APPROVED' : null;

  const isDirty = useMemo(() => {
    if (!selected || !canReviewSelected) return false;
    if (pendingDecision !== defaultPendingDecision) return true;
    if (decisionReason.trim() !== '') return true;
    if (pendingPaidDecision !== (selected.paid ?? selected.suggestedPaid ?? true)) return true;
    if (paidOverrideReason.trim() !== (selected.paidOverrideReason ?? '')) return true;
    return false;
  }, [selected, canReviewSelected, defaultPendingDecision, pendingDecision, decisionReason, pendingPaidDecision, paidOverrideReason]);

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

  async function validateAttachment(
  connectedEntity: string,
  connectedId: number
) {
  const key = buildAttachmentKey(connectedEntity, connectedId);

  setAttachmentExistsMap((prev) => ({
    ...prev,
    [key]: 'checking',
  }));

  try {
    const exists = await apiFetchJson<boolean>(
      `/api/document/exists?connectedEntity=${connectedEntity}&connectedId=${connectedId}`
    );

    setAttachmentExistsMap((prev) => ({
      ...prev,
      [key]: exists,
    }));

    return exists;
  } catch {
    setAttachmentExistsMap((prev) => ({
      ...prev,
      [key]: false,
    }));

    return false;
  }
}




  async function loadRequests() {
    try {
      setLoadError('');
      const leavePath = buildApiPath('/api/leave/request', {
        page: '0',
        size: '200',
        sort: 'requestId,desc',
      });
      const overtimePath = buildApiPath('/api/overtime/all', {
        page: '0',
        size: '200',
        sort: 'requestAt,desc',
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
          const label = formatEmployeeLabel({ firstName: row.firstName, middleName: row.middleName, lastName: row.lastName, employeeId});
          if (label) employeeNameById.set(employeeId, label);
        }
      }

      const overtimeRows = toArray<OvertimeDto>(overtimeRes.value).map((item, idx) => {
        const payLabel = item.paid === false ? 'Unpaid' : 'Paid';
        const overtimeTypeLabel = formatRequestTypeLabel(item.overtimeType || 'Overtime');
        return {
          id: `overtime-${item.overtimeId ?? idx}`,
          employeeId: item.employeeId,
          employee: resolvedEmployeeLabel(employeeNameById, item.employeeId),
          message: buildRequestSummaryMessage('overtime', overtimeTypeLabel, item.paid),
          submittedAt: formatDateTime(item.requestAt, '-'),
          type: 'Overtime' as const,
          source: 'overtime' as const,
          status: item.requestStatus || 'PENDING_MANAGER',
          reason: item.reason || '',
          referenceLabel: 'Work Date',
          referenceValue: formatRequestPeriodLabel('overtime', item.startTime, item.endTime, item.workDate),
          requestLabel: 'Overtime Request',
          requestKind: `${overtimeTypeLabel} - ${payLabel}`,
          requestDate: formatRequestPeriodLabel('overtime', item.startTime, item.endTime, item.workDate),
          requestTime: formatRequestTimeRangeLabel(item.startTime, item.endTime),
          durationLabel: formatRequestTimeRangeLabel(item.startTime, item.endTime),
          decisionSummary: item.approveReason || '',
          overtimeType: item.overtimeType,
          paid: item.paid,
          suggestedPaid: item.suggestedPaid,
          paidOverrideReason: item.paidOverrideReason,
          managerApprover: item.managerApprover,
          managerDecisionSummary: item.managerApproveReason || '',
          managerReviewedAt: formatDateTime(item.managerApprovedAt, '-'),
          attachmentConnectedEntity: DocumentEntities.OVERTIME,
          attachmentConnectedId: item.overtimeId,
          sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
        };
      });

      const leaveRows = toArray<LeaveDto>(leaveRes.value)
        .map((item, idx) => {
          const leaveTypeLabel = formatRequestTypeLabel(item.leaveType);
          const payLabel = item.paid === false ? 'Unpaid' : 'Paid';
          return {
            id: `leave-${item.requestId ?? idx}`,
            leaveRequestId: item.requestId,
            employeeId: item.empId,
            employee: resolvedEmployeeLabel(employeeNameById, item.empId, formatEmployeeLabel({ firstName: item.firstName, middleName: item.middleName, lastName: item.lastName, employeeId: item.employeeId })),
            message: buildRequestSummaryMessage('leave', leaveTypeLabel, item.paid),
            submittedAt: formatDateTime(item.requestAt ?? item.startDateTime, '-'),
            type: 'Leave' as const,
            source: 'leave' as const,
            status: item.requestStatus || 'PENDING_MANAGER',
            reason: item.reason || '',
            referenceLabel: 'Leave Period',
            referenceValue: formatRequestPeriodLabel('leave', item.startDateTime, item.endDateTime),
            requestLabel: 'Leave Request',
            requestKind: `${leaveTypeLabel} - ${payLabel}`,
            requestDate: formatRequestPeriodLabel('leave', item.startDateTime, item.endDateTime),
            requestTime: formatRequestTimeRangeLabel(item.startDateTime, item.endDateTime),
            durationLabel: formatLeaveDurationLabel(item.startDateTime, item.endDateTime),
            decisionSummary: item.approverReason || '',
            paid: item.paid,
            suggestedPaid: item.suggestedPaid,
            paidOverrideReason: item.paidOverrideReason,
            managerApprover: item.managerApprover,
            managerDecisionSummary: item.managerApproverReason || '',
            managerReviewedAt: formatDateTime(item.managerApprovedAt, '-'),
            leaveType: item.leaveType,
            attachmentConnectedEntity: DocumentEntities.LEAVE_REQUEST,
            attachmentConnectedId: item.requestId,
            sortStamp:
              item.requestAt ? Date.parse(item.requestAt) || 0 : item.startDateTime ? Date.parse(item.startDateTime) || 0 : 0,
          };
        });

      const merged = [...leaveRows, ...overtimeRows]
        .filter((request) => String(request.status ?? '').toUpperCase() !== 'PENDING_MANAGER')
        .sort(
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






  const refreshRequests = useAutoRefreshingPage(loadRequests, { intervalMs: 10000 });

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

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
        if ((request.paid ?? true) !== shouldBePaid) {
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
        request.requestDate,
        request.requestTime,
      ]
        .map(normalizeText)
        .join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [requests, typeFilter, statusFilter, leavePaidFilter, overtimeTypeFilter, normalizedSearch]);

  const cards = useMemo(() => {
    const approved = requests.filter((r) => toStatusCode(r.status) === 'APPROVED').length;
    const denied = requests.filter((r) => toStatusCode(r.status) === 'REJECTED').length;
    const pending = requests.filter((r) => toStatusCode(r.status) === 'PENDING').length;
    const cancelled = requests.filter((r) => toStatusCode(r.status) === 'CANCELLED').length;
    return [
      { label: 'Approved', value: approved, tone: 'approved' as const },
      { label: 'Denied', value: denied, tone: 'denied' as const },
      { label: 'Pending', value: pending, tone: 'pending' as const },
      { label: 'Cancelled', value: cancelled, tone: 'cancelled' as const },
    ];
  }, [requests]);

  useEffect(() => {
    setDecisionReason('');
    setPendingPaidDecision(selected?.paid ?? selected?.suggestedPaid ?? true);
    setPaidOverrideReason(selected?.paidOverrideReason ?? '');
    setLeaveBalanceLabel('Not available');
    setDecisionSubmitAttempted(false);
    setSubmitError('');
    setPendingDecision(selected && String(selected.status).toUpperCase() === 'PENDING_HR' ? 'APPROVED' : null);
    setConfirmDecisionOpen(false);
  }, [selected]);

  useEffect(() => {
    if (!selected || selected.source !== 'leave' || typeof selected.employeeId !== 'number' || !selected.leaveType) {
      setLeaveBalanceLabel('Not applicable');
      return;
    }

    let cancelled = false;
    setLeaveBalanceLabel('Loading...');

    void (async () => {
      try {
        const balances = await apiFetchJson<unknown>(`/api/leave/balance/${selected.employeeId}`);
        const matchingBalance = toArray<LeaveBalanceRow>(balances).find(
          (row) => String(row.leaveType ?? '').toUpperCase() === String(selected.leaveType ?? '').toUpperCase()
        );
        const rawBalance = matchingBalance?.balanceHours;
        const balanceNumber =
          typeof rawBalance === 'number'
            ? rawBalance
            : typeof rawBalance === 'string'
              ? Number(rawBalance)
              : Number.NaN;

        if (!cancelled) {
          setLeaveBalanceLabel(Number.isFinite(balanceNumber) ? `${balanceNumber.toFixed(2)} hrs` : 'No balance record');
        }
      } catch {
        if (!cancelled) {
          setLeaveBalanceLabel('Balance unavailable');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected]);

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
    setDecisionSubmitAttempted(true);
    const decision = pendingDecision ?? (String(selected.status).toUpperCase() === 'PENDING_HR' ? 'APPROVED' : null);
    if (decision !== 'APPROVED') {
      setSubmitError('This request can only be finalized as approved.');
      return;
    }
    const trimmedReason = decisionReason.trim();

    if (selected.source === 'leave' || selected.source === 'overtime') {
      if (pendingPaidDecision == null) {
        setSubmitError('Choose whether this approved request should be treated as paid or unpaid.');
        return;
      }
    }

    setSubmitError('');
    showLoading();
    setIsSaving(true);
    try {
      if (selected.source === 'leave') {
        const leaveId = Number(selected.id.replace('leave-', ''));
        await apiFetchJson(`/api/leave/update/${leaveId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            leaveType: selected.leaveType,
            requestStatus: decision,
            approverReason: trimmedReason,
            paid: pendingPaidDecision,
            paidOverrideReason:
              pendingPaidDecision !== selectedSuggestedPaid
                ? paidOverrideReason.trim()
                : undefined,
          }),
        });
      } else {
        const overtimeId = Number(selected.id.replace('overtime-', ''));
        await apiFetchJson('/api/overtime/update', {
          method: 'PATCH',
          body: JSON.stringify({
            overtimeId,
            updateStatus: decision,
            approveReason: trimmedReason,
            paid: pendingPaidDecision,
            paidOverrideReason:
              pendingPaidDecision !== selectedSuggestedPaid
                ? paidOverrideReason.trim()
                : undefined,
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
    if (!selected) return;
    setDecisionSubmitAttempted(true);
    const decision = pendingDecision ?? (String(selected.status).toUpperCase() === 'PENDING_HR' ? 'APPROVED' : null);
    if (decision !== 'APPROVED') {
      setSubmitError('This request can only be finalized as approved.');
      return;
    }
    if (selected.source === 'leave' || selected.source === 'overtime') {
      if (pendingPaidDecision == null) {
        setSubmitError('Choose whether this approved request should be treated as paid or unpaid.');
        return;
      }
    }
    setSubmitError('');
    setConfirmDecisionOpen(true);
  }

async function handleOpenAttachment(connectedEntity: string, connectedId: number) {
  setAttachmentError('');
  const key = buildAttachmentKey(connectedEntity, connectedId);
  const cached = attachmentExistsMap[key];

  if (cached === false) {
    setAttachmentError('No supporting document was uploaded.');
    return;
  }

  if (cached === 'checking') return;

  const exists = cached === true ? true : await validateAttachment(connectedEntity, connectedId);

  if (!exists) {
    setAttachmentError('No supporting document was uploaded.');
    return;
  }

  setOpeningAttachmentId(connectedId);
  try {
    await openDocumentUsingEntityFilter(connectedEntity, connectedId);
  } catch (error) {
    setAttachmentError(error instanceof Error ? error.message : 'Failed to open attachment.');
  } finally {
    setOpeningAttachmentId(null);
  }
}

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <PageHeader
          title='Manage Requests'
          description='Review manager recommendations, confirm paid or unpaid treatment, and record the final HR decision for leave and overtime requests.'
          titleMeta={
            <WorkflowHelpButton
              title="Approval Routing"
              items={HR_APPROVAL_WORKFLOW_HELP}
              ariaLabel="Show approval routing logic"
            />
          }
        />

        <div className="hrAppr__toolbar">
          <label className="uSearch" aria-label="Search leave requests">
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
                    onChange={(e) => handleTypeFilterChange(e.target.value as RequestTypeFilter)}
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
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </label>

                <label className="uFilter__field">
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

                <label className="uFilter__field">
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
            {requests.length > 0
              ? 'No requests matched this view. Try clearing the search or relaxing the filters to bring the full request list back.'
              : 'No employee requests yet. Approved, pending, and denied leave or overtime requests will appear here once employees start filing them.'}
          </div>
        )}
      </section>

      <LargePopup
        open={Boolean(selected)}
        ariaLabel="Leave request details"
        title={selected ? `${selected.employee} - ${selected.type}` : 'Leave request details'}
        subtitle={
          canReviewSelected
            ? 'Review the manager recommendation, confirm the paid or unpaid treatment when needed, and record the finalization note here.'
            : 'Review the submitted details, supporting documents, manager recommendation, and recorded final decision.'
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
                {isSaving ? 'Saving...' : 'Finalize'}
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
                {(() => {
                  const key = buildAttachmentKey(
                    selected.attachmentConnectedEntity!,
                    selected.attachmentConnectedId!
                  );
                  const existsState = attachmentExistsMap[key];
                  return (
                    <div className="apprModal__documentRow">
                      <div className="apprModal__documentCopy">
                        <span>Supporting Document</span>
                        <p>
                          {existsState === true
                            ? 'A supporting file was uploaded with this request.'
                            : existsState === false
                            ? 'No supporting document was found for this request.'
                            : 'Click to check for a supporting document.'}
                        </p>
                      </div>
                      {existsState !== false && (
                        <button
                          type="button"
                          className="apprModal__documentButton"
                          onClick={() => void handleOpenAttachment(
                            selected.attachmentConnectedEntity!,
                            selected.attachmentConnectedId!
                          )}
                          disabled={existsState === 'checking' || openingAttachmentId === selected.attachmentConnectedId}
                        >
                          {existsState === 'checking' || openingAttachmentId === selected.attachmentConnectedId
                            ? 'Loading...'
                            : 'View Attachment'}
                        </button>
                      )}
                    </div>
                  );
                })()}
            </div>

              {(selected.managerApprover || selected.managerDecisionSummary) && (
                <div className="apprModal__message apprModal__message--manager">
                  <span>Manager Remarks</span>
                  <p>
                    {selected.managerDecisionSummary || 'No manager note provided.'}
                    {(selected.managerApprover || selected.managerReviewedAt) && (
                      <span className="apprModal__subNote">
                        {selected.managerApprover ? <>Reviewed by <strong>{selected.managerApprover}</strong></> : 'Reviewed'}
                        {selected.managerReviewedAt ? <> on <strong>{selected.managerReviewedAt}</strong></> : null}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {selected.paidOverrideReason && hasFinalDecision && (
                <div className="apprModal__message apprModal__message--hr">
                  <span>Pay Treatment Override</span>
                  <p>{selected.paidOverrideReason}</p>
                </div>
              )}

              {selected.decisionSummary && (
                <div className="apprModal__message apprModal__message--hr">
                  <span>{normalizedSelectedStatus === 'CANCELLED' ? 'Cancellation Note' : 'Final Decision Note'}</span>
                  <p>{selected.decisionSummary}</p>
                </div>
              )}
            </div>

            {canReviewSelected && (
              <div className="apprModal__reviewPanels">
                {(selected.source === 'leave' || selected.source === 'overtime') && (
                  <div className="apprModal__panel">
                    <p className="apprModal__panelTitle">
                      {selected.source === 'leave' ? 'Leave Pay Treatment' : 'Overtime Pay Treatment'}
                    </p>

                    <div className="apprModal__tilesRow">
                      <div className="apprModal__tile">
                        <span>System Suggestion</span>
                        <strong>{selectedSuggestedPaid ? 'Paid' : 'Unpaid'}</strong>
                      </div>
                      {selected.source === 'leave' ? (
                        <div className="apprModal__tile">
                          <span>Available Leave Balance</span>
                          <strong>{leaveBalanceLabel}</strong>
                        </div>
                      ) : (
                        <div className="apprModal__tile">
                          <span>Current OT Treatment</span>
                          <strong>{selected.paid === false ? 'Unpaid' : 'Paid'}</strong>
                        </div>
                      )}
                    </div>

                    <div className="decisionPicker">
                      <div className="decisionPicker__actions">
                        <button
                          type="button"
                          className={`decisionPicker__button ${pendingPaidDecision === true ? 'is-selected' : ''}`}
                          disabled={isSaving}
                          onClick={() => setPendingPaidDecision(true)}
                        >
                          Paid
                        </button>
                        <button
                          type="button"
                          className={`decisionPicker__button ${pendingPaidDecision === false ? 'is-selected' : ''}`}
                          disabled={isSaving}
                          onClick={() => setPendingPaidDecision(false)}
                        >
                          Unpaid
                        </button>
                      </div>
                    </div>

                    {pendingPaidDecision !== selectedSuggestedPaid && (
                      <label>
                        <textarea
                          value={paidOverrideReason}
                          onChange={(e) => setPaidOverrideReason(e.target.value)}
                          placeholder="Optional note for changing the paid or unpaid treatment"
                        />
                      </label>
                    )}
                  </div>
                )}

                <div className="apprModal__panel">
                  <p className="apprModal__panelTitle">HR Finalization Note</p>

                  <label>
                    <textarea
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      placeholder="Optional note for finalizing this request"
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
        message="You have unsaved changes in this approval review. If you close it now, your progress will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={discardAndCloseModal}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
      <ConfirmDialog
        open={confirmDecisionOpen}
        title="Confirm Finalization"
        message="This will finalize the request as approved with the selected pay treatment."
        confirmLabel="Finalize"
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
