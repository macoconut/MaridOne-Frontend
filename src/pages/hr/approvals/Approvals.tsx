import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import '../../manager/pending-approvals/PendingApprovals.css';

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
  paid?: boolean;
  suggestedPaid?: boolean;
  paidOverrideReason?: string;
  managerApprover?: string;
  managerApproveReason?: string;
  managerApprovedAt?: string;
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
  suggestedPaid?: boolean;
  paidOverrideReason?: string;
  managerApprover?: string;
  managerApproverReason?: string;
  managerApprovedAt?: string;
};

type LeaveBalanceRow = {
  leaveType?: string;
  balanceHours?: number | string;
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
  decisionSummary?: string;
  paid?: boolean;
  suggestedPaid?: boolean;
  paidOverrideReason?: string;
  overtimeType?: string;
  leaveType?: string;
  managerApprover?: string;
  managerDecisionSummary?: string;
  managerReviewedAt?: string;
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

function formatPeriodOnly(source: SourceType, start?: string, end?: string, workDate?: string) {
  const resolvedStart = source === 'overtime' ? start || workDate : start;
  const resolvedEnd = source === 'overtime' ? end || start || workDate : end;
  const startDateLabel = formatDateOnly(resolvedStart);
  const endDateLabel = formatDateOnly(resolvedEnd);
  if (startDateLabel === '-' && endDateLabel === '-') return '-';
  if (startDateLabel === endDateLabel) return startDateLabel;
  return `${startDateLabel} to ${endDateLabel}`;
}

function formatTimeRangeOnly(start?: string, end?: string) {
  const startTimeLabel = formatTimeOnly(start);
  const endTimeLabel = formatTimeOnly(end);
  if (startTimeLabel === '-' && endTimeLabel === '-') return '-';
  return `${startTimeLabel} to ${endTimeLabel}`;
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
  const [pendingPaidDecision, setPendingPaidDecision] = useState<boolean | null>(null);
  const [paidOverrideReason, setPaidOverrideReason] = useState('');
  const [leaveBalanceLabel, setLeaveBalanceLabel] = useState('Not available');
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
  const [leavePaidFilter, setLeavePaidFilter] = useState<LeavePaidFilter>('all');
  const [overtimeTypeFilter, setOvertimeTypeFilter] = useState<OvertimeTypeFilter>('all');

  useErrorDialogEffect(loadError, 'Approval requests could not be loaded');
  useErrorDialogEffect(submitError, 'Approval decision could not be completed');
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

  const isDirty = useMemo(() => {
    if (!selected || !canReviewSelected) return false;
    if (pendingDecision !== null) return true;
    if (decisionReason.trim() !== '') return true;
    if (pendingPaidDecision !== (selected.paid ?? selected.suggestedPaid ?? true)) return true;
    if (paidOverrideReason.trim() !== (selected.paidOverrideReason ?? '')) return true;
    return false;
  }, [selected, canReviewSelected, pendingDecision, decisionReason, pendingPaidDecision, paidOverrideReason]);

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
      const leavePath = buildApiPath('/api/leave/request', {
        page: '0',
        size: '100',
      });
      const overtimePath = buildApiPath('/api/overtime/all', {
        page: '0',
        size: '100',
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
        const payLabel = item.paid === false ? 'Unpaid' : 'Paid';
        return {
          id: `overtime-${item.overtimeId ?? idx}`,
          employeeId: item.employeeId,
          employee: resolvedEmployeeLabel(employeeNameById, item.employeeId),
          message: `${item.overtimeType || 'Overtime'} request on ${formatDateOnly(item.workDate)}`,
          submittedAt: formatDateTime(item.requestAt),
          type: 'Overtime' as const,
          source: 'overtime' as const,
          status: item.requestStatus || 'PENDING_MANAGER',
          reason: attachment.cleanText,
          referenceLabel: 'Work Date',
          referenceValue: formatDateOnly(item.workDate),
          requestLabel: 'Overtime Request',
          requestKind: `${formatRequestType(item.overtimeType || 'Overtime')} - ${payLabel}`,
          requestDate: formatPeriodOnly('overtime', item.startTime, item.endTime, item.workDate),
          requestTime: formatTimeRangeOnly(item.startTime, item.endTime),
          decisionSummary: item.approveReason || '',
          overtimeType: item.overtimeType,
          paid: item.paid,
          suggestedPaid: item.suggestedPaid,
          paidOverrideReason: item.paidOverrideReason,
          managerApprover: item.managerApprover,
          managerDecisionSummary: item.managerApproveReason || '',
          managerReviewedAt: formatDateTime(item.managerApprovedAt),
          attachmentPathId: attachment.attachmentPathId ?? undefined,
          sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
        };
      });

      const leaveRows = toArray<LeaveDto>(leaveRes.value).map((item, idx) => {
        const attachment = extractAttachmentReference(item.reason);
        const leaveTypeLabel = formatRequestType(item.leaveType);
        const payLabel = item.paid === false ? 'Unpaid' : 'Paid';
        return {
          id: `leave-${item.requestId ?? idx}`,
          leaveRequestId: item.requestId,
          employeeId: item.empId,
          employee: resolvedEmployeeLabel(employeeNameById, item.empId, leaveEmployeeLabel(item)),
          message: `${leaveTypeLabel} - ${payLabel} (${formatDateOnly(item.startDateTime)} to ${formatDateOnly(item.endDateTime)})`,
          submittedAt: formatDateTime(item.requestAt ?? item.startDateTime),
          type: 'Leave' as const,
          source: 'leave' as const,
          status: item.requestStatus || 'PENDING_MANAGER',
          reason: attachment.cleanText,
          referenceLabel: 'Leave Period',
          referenceValue: `${formatDateOnly(item.startDateTime)} - ${formatDateOnly(item.endDateTime)}`,
          requestLabel: 'Leave Request',
          requestKind: `${leaveTypeLabel} - ${payLabel}`,
          requestDate: formatPeriodOnly('leave', item.startDateTime, item.endDateTime),
          requestTime: formatTimeRangeOnly(item.startDateTime, item.endDateTime),
          decisionSummary: item.approverReason || '',
          paid: item.paid,
          suggestedPaid: item.suggestedPaid,
          paidOverrideReason: item.paidOverrideReason,
          managerApprover: item.managerApprover,
          managerDecisionSummary: item.managerApproverReason || '',
          managerReviewedAt: formatDateTime(item.managerApprovedAt),
          leaveType: item.leaveType,
          attachmentPathId: attachment.attachmentPathId ?? undefined,
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
    setPendingDecision(null);
    setConfirmDecisionOpen(false);
  }, [selectedId]);

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
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 5) {
      setSubmitError('Please enter at least 5 characters explaining the decision.');
      return;
    }

    if (pendingDecision === 'APPROVED' && (selected.source === 'leave' || selected.source === 'overtime')) {
      if (pendingPaidDecision == null) {
        setSubmitError('Choose whether this approved request should be treated as paid or unpaid.');
        return;
      }
      if (pendingPaidDecision !== selectedSuggestedPaid && paidOverrideReason.trim().length < 5) {
        setSubmitError('Please explain why HR is overriding the paid or unpaid treatment.');
        return;
      }
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
            paid: pendingDecision === 'APPROVED' ? pendingPaidDecision : undefined,
            paidOverrideReason:
              pendingDecision === 'APPROVED' && pendingPaidDecision !== selectedSuggestedPaid
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
            updateStatus: pendingDecision,
            approveReason: trimmedReason,
            paid: pendingDecision === 'APPROVED' ? pendingPaidDecision : undefined,
            paidOverrideReason:
              pendingDecision === 'APPROVED' && pendingPaidDecision !== selectedSuggestedPaid
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
      setIsSaving(false);
    }
  }

  function requestDecisionConfirmation() {
    if (!selected) return;
    setDecisionSubmitAttempted(true);
    if (!pendingDecision) {
      setSubmitError('Choose approve or deny before confirming the decision.');
      return;
    }
    const trimmedReason = decisionReason.trim();
    if (trimmedReason.length < 5) {
      setSubmitError('Please enter at least 5 characters explaining the decision.');
      return;
    }
    if (pendingDecision === 'APPROVED' && (selected.source === 'leave' || selected.source === 'overtime')) {
      if (pendingPaidDecision == null) {
        setSubmitError('Choose whether this approved request should be treated as paid or unpaid.');
        return;
      }
      if (pendingPaidDecision !== selectedSuggestedPaid && paidOverrideReason.trim().length < 5) {
        setSubmitError('Please explain why HR is overriding the paid or unpaid treatment.');
        return;
      }
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
              ? 'Review the manager recommendation, confirm the paid or unpaid treatment, and record the final HR decision.'
              : 'Review leave and overtime requests here. Payroll disputes stay in Manage Payslips.'
          }
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
                    <option value="REJECTED">Denied</option>
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

      {selected && createPortal(
        <div className="hrApprModalBackdrop" role="dialog" aria-modal="true">
          <div className="hrApprModal">
            <div className="dashModal__top">
              <div>
                <h2 className="hrApprModal__title">
                  {selected.employee} - {selected.type}
                </h2>
                <p className="hrApprModal__subtitle">Review the manager recommendation, confirm the paid or unpaid treatment when needed, and record the final HR decision here.</p>
              </div>
              <ModalCloseButton className="hrApprModal__close" onClick={requestCloseModal} />
            </div>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Type:</span>
                <input value={selected.type} readOnly />
              </label>
              <label>
                <span>Current Status:</span>
                <input value={statusLabel(selected.status)} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Requested At:</span>
                <input value={selected.submittedAt} readOnly />
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
                  <span>Final Decision Note:</span>
                  <textarea value={selected.decisionSummary} readOnly />
                </label>
              </div>
            )}

            {(selected.managerApprover || selected.managerDecisionSummary) && (
              <>
                <div className="hrApprForm__row hrApprForm__row--2">
                  <label>
                    <span>Manager Reviewer:</span>
                    <input value={selected.managerApprover || '-'} readOnly />
                  </label>
                  <label>
                    <span>Manager Reviewed At:</span>
                    <input value={selected.managerReviewedAt || '-'} readOnly />
                  </label>
                </div>

                <div className="hrApprForm__row">
                  <label>
                    <span>Manager Review Note:</span>
                    <textarea value={selected.managerDecisionSummary || 'No manager note provided.'} readOnly />
                  </label>
                </div>
              </>
            )}

            {hasFinalDecision && (
              <div className="hrApprModal__rule" />
            )}

            {(selected.source === 'leave' || selected.source === 'overtime') && (
              <>
                <div className="hrApprForm__row hrApprForm__row--2">
                  <label>
                    <span>System Suggestion:</span>
                    <input value={selectedSuggestedPaid ? 'Paid' : 'Unpaid'} readOnly />
                  </label>
                  {selected.source === 'leave' ? (
                    <label>
                      <span>Available Leave Balance:</span>
                      <input value={leaveBalanceLabel} readOnly />
                    </label>
                  ) : (
                    <label>
                      <span>Current OT Treatment:</span>
                      <input value={selected.paid === false ? 'Unpaid' : 'Paid'} readOnly />
                    </label>
                  )}
                </div>

                <div className="hrApprForm__row">
                  <label className="decisionPicker">
                    <span>{selected.source === 'leave' ? 'Leave Pay Treatment:' : 'Overtime Pay Treatment:'}</span>
                    <div className="decisionPicker__actions">
                      <button
                        type="button"
                        className={`decisionPicker__button ${pendingPaidDecision === true ? 'is-selected' : ''}`}
                        disabled={isSaving || !canReviewSelected}
                        onClick={() => setPendingPaidDecision(true)}
                      >
                        Paid
                      </button>
                      <button
                        type="button"
                        className={`decisionPicker__button ${pendingPaidDecision === false ? 'is-selected' : ''}`}
                        disabled={isSaving || !canReviewSelected}
                        onClick={() => setPendingPaidDecision(false)}
                      >
                        Unpaid
                      </button>
                    </div>
                    {canReviewSelected && (
                      <p className="decisionPicker__note">
                        Keep the system suggestion when possible. If HR changes it, add an override reason below for the audit trail.
                      </p>
                    )}
                  </label>
                </div>

                {canReviewSelected && pendingPaidDecision !== selectedSuggestedPaid && (
                  <div className="hrApprForm__row">
                    <label>
                      <span>Paid / Unpaid Override Reason:</span>
                      <textarea
                        value={paidOverrideReason}
                        onChange={(e) => setPaidOverrideReason(e.target.value)}
                        placeholder="Explain why HR is overriding the paid or unpaid treatment"
                        aria-invalid={decisionSubmitAttempted && paidOverrideReason.trim().length < 5 ? 'true' : undefined}
                      />
                    </label>
                  </div>
                )}
              </>
            )}

            <div className="hrApprForm__row">
              <label className="decisionPicker">
                <span>HR Final Decision:</span>
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
                    HR is the final approver. Choose the outcome here first, then confirm it below.
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
                  aria-invalid={decisionSubmitAttempted && decisionReason.trim().length < 5 ? 'true' : undefined}
                  readOnly={!canReviewSelected}
                />
              </label>
            </div>

            <div className="hrApprModal__footer">
              {canReviewSelected ? (
                <>
                  <button type="button" onClick={requestCloseModal} disabled={isSaving}>
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
                <button type="button" onClick={requestCloseModal} disabled={isSaving}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
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
        title={pendingDecision === 'REJECTED' ? 'Confirm Denial' : 'Confirm Approval'}
        message={
          selected
            ? pendingDecision === 'REJECTED'
              ? `Deny ${selected.employee}'s ${selected.type.toLowerCase()} request now?`
              : `Finalize ${selected.employee}'s ${selected.type.toLowerCase()} request as ${pendingPaidDecision === false ? 'unpaid' : 'paid'} and approve it?`
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
