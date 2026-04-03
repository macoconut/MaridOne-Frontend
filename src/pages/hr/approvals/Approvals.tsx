import { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './Approvals.css';

type DisputeDto = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  statusReason?: string;
  itemId?: number;
  employeeId?: number;
  employeeName?: string;
};

type OvertimeDto = {
  overtimeId?: number;
  employeeId?: number;
  requestStatus?: string;
  requestAt?: string;
  workDate?: string;
  overtimeType?: string;
  reason?: string;
  approveReason?: string;
};

type LeaveDto = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestStatus?: string;
  reason?: string;
  paid?: boolean;
};

type EmployeeDirectoryRow = {
  employeeId?: number;
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
};

type RequestType = 'Dispute' | 'Overtime' | 'Leave';
type SourceType = 'dispute' | 'overtime' | 'leave';
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
  disputeId?: number;
  leaveRequestId?: number;
  itemId?: number;
  employeeId?: number;
  employee: string;
  message: string;
  time: string;
  type: RequestType;
  source: SourceType;
  status: string;
  reason: string;
  referenceLabel: string;
  referenceValue: string;
  decisionSummary?: string;
  isPaid?: boolean;
  overtimeType?: string;
  sortStamp: number;
};

type CorrectionIntent = {
  disputeId: number;
  itemId: number;
  employee: string;
  message: string;
  disputeReason: string;
  decisionReason: string;
};

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
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
    month: 'short',
    day: 'numeric',
  });
}

function employeeLabel(employeeName?: string, employeeId?: number) {
  const trimmedName = typeof employeeName === 'string' ? employeeName.trim() : '';
  if (trimmedName) return trimmedName;
  return typeof employeeId === 'number' ? `Employee ID ${employeeId}` : 'Employee unavailable';
}

function employeeDirectoryLabel(row?: EmployeeDirectoryRow) {
  if (!row) return '';
  const fullName = [row.firstName, row.middleName, row.lastName]
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
  const navigate = useNavigate();
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [leavePaidFilter, setLeavePaidFilter] = useState<LeavePaidFilter>('all');
  const [overtimeTypeFilter, setOvertimeTypeFilter] = useState<OvertimeTypeFilter>('all');

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
      const [employeesRes, disputesRes, overtimeRes, leaveRes] = await Promise.allSettled([
        apiFetchJson<unknown>('/api/employees?page=0&size=200'),
        apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=50'),
        apiFetchJson<unknown>(overtimePath),
        apiFetchJson<unknown>(leavePath),
      ]);

      if (
        disputesRes.status !== 'fulfilled' ||
        overtimeRes.status !== 'fulfilled' ||
        leaveRes.status !== 'fulfilled'
      ) {
        throw (
          (disputesRes.status === 'rejected' && disputesRes.reason) ||
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

      const disputeRows = toArray<DisputeDto>(disputesRes.value).map((item, idx) => ({
        id: `dispute-${item.id ?? idx}`,
        disputeId: item.id,
        itemId: item.itemId,
        employeeId: item.employeeId,
        employee: resolvedEmployeeLabel(employeeNameById, item.employeeId, item.employeeName),
        message: item.subject?.trim() || `Payroll dispute for payslip item #${item.itemId ?? '-'}`,
        time: formatDateTime(item.createdAt),
        type: 'Dispute' as const,
        source: 'dispute' as const,
        status: item.status || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Payslip Item',
        referenceValue: typeof item.itemId === 'number' ? `#${item.itemId}` : 'Unavailable',
        decisionSummary: item.statusReason || '',
        sortStamp: item.createdAt ? Date.parse(item.createdAt) || 0 : 0,
      }));

      const overtimeRows = toArray<OvertimeDto>(overtimeRes.value).map((item, idx) => ({
        id: `overtime-${item.overtimeId ?? idx}`,
        employeeId: item.employeeId,
        employee: resolvedEmployeeLabel(employeeNameById, item.employeeId),
        message: `${item.overtimeType || 'Overtime'} request on ${formatDateOnly(item.workDate)}`,
        time: formatDateTime(item.requestAt),
        type: 'Overtime' as const,
        source: 'overtime' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Work Date',
        referenceValue: formatDateOnly(item.workDate),
        decisionSummary: item.approveReason || '',
        overtimeType: item.overtimeType,
        sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
      }));

      const leaveRows = toArray<LeaveDto>(leaveRes.value).map((item, idx) => ({
        id: `leave-${item.requestId ?? idx}`,
        leaveRequestId: item.requestId,
        employeeId: item.empId,
        employee: resolvedEmployeeLabel(employeeNameById, item.empId),
        message: `Leave request from ${formatDateOnly(item.startDateTime)} to ${formatDateOnly(item.endDateTime)}`,
        time: formatDateTime(item.startDateTime),
        type: 'Leave' as const,
        source: 'leave' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Leave Period',
        referenceValue: `${formatDateOnly(item.startDateTime)} - ${formatDateOnly(item.endDateTime)}`,
        decisionSummary: item.paid === false ? 'Unpaid leave request' : 'Paid leave request',
        isPaid: item.paid,
        sortStamp: item.startDateTime ? Date.parse(item.startDateTime) || 0 : 0,
      }));

      const merged = [...leaveRows, ...disputeRows, ...overtimeRows].sort(
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

  useEffect(() => {
    void loadRequests();
  }, [statusFilter, leavePaidFilter, overtimeTypeFilter]);

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
        request.time,
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
      { label: 'Approved', value: approved, tone: 'approved' },
      { label: 'Denied', value: denied, tone: 'denied' },
      { label: 'Pending', value: pending, tone: 'pending' },
    ];
  }, [visibleRequests]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId, requests]
  );
  const activeFilterCount = [typeFilter, statusFilter, leavePaidFilter, overtimeTypeFilter].filter(
    (value) => value !== 'all'
  ).length;
  const canReviewSelected =
    selected ? toStatusCode(selected.status) === 'PENDING' && selected.source !== 'leave' : false;

  useEffect(() => {
    setDecisionReason('');
    setSubmitError('');
    setPendingDecision(null);
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
    } else if (nextType === 'dispute') {
      setLeavePaidFilter('all');
      setOvertimeTypeFilter('all');
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
      let correctionIntent: CorrectionIntent | null = null;

      if (selected.source === 'leave') {
        throw new Error('Leave requests can be displayed here, but this backend response does not include the leave type needed to submit an HR decision.');
      }

      if (selected.source === 'dispute') {
        const id = selected.id.replace('dispute-', '');
        await apiFetchJson(`/api/payroll/item/dispute/update/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: pendingDecision,
            statusReason: trimmedReason,
          }),
        });

        if (
          pendingDecision === 'APPROVED' &&
          typeof selected.disputeId === 'number' &&
          typeof selected.itemId === 'number'
        ) {
          correctionIntent = {
            disputeId: selected.disputeId,
            itemId: selected.itemId,
            employee: selected.employee,
            message: selected.message,
            disputeReason: selected.reason,
            decisionReason: trimmedReason,
          };
        }
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

      if (correctionIntent) {
        navigate('/hr/payslips', {
          state: {
            correctionIntent,
          },
        });
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message.includes('leave type needed')
          ? error.message
          : getFriendlyErrorMessage(error, 'approval-decision')
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <div className="hrAppr__titleRow">
          <h1 className="hrAppr__title">{selected ? 'Review Employee Request' : 'Requests from Employees'}</h1>
          <div className="hrAppr__summary">
            Showing {visibleRequests.length} of {requests.length} request
            {requests.length === 1 ? '' : 's'}
          </div>
        </div>

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
                    <option value="dispute">Dispute</option>
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
                    disabled={typeFilter === 'overtime' || typeFilter === 'dispute'}
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
                    disabled={typeFilter === 'leave' || typeFilter === 'dispute'}
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

      <div className="hrAppr__cards">
        {cards.map((card) => (
          <article key={card.label} className="hrApprCard">
            <div className={`hrApprCard__ring hrApprCard__ring--${card.tone}`} />
            <div className="hrApprCard__body">
              <div className="hrApprCard__label">{card.label}</div>
              <div className="hrApprCard__value">{card.value}</div>
            </div>
          </article>
        ))}
      </div>

      <section className="hrApprTable">
        {loadError && <p className="hrApprForm__error">{loadError}</p>}
        {visibleRequests.length > 0 ? (
          visibleRequests.map((request) => (
            <button
              key={request.id}
              type="button"
              className={`hrApprRow hrApprRow--${toStatusCode(request.status).toLowerCase()}`}
              onClick={() => setSelectedId(request.id)}
            >
              <span className="hrApprRow__employee">{request.employee}</span>
              <span className="hrApprRow__message">{request.message}</span>
              <span className="hrApprRow__meta">
                <span className={`hrApprRow__status hrApprRow__status--${toStatusCode(request.status).toLowerCase()}`}>
                  {statusLabel(request.status)}
                </span>
                <span className="hrApprRow__time">{request.time}</span>
              </span>
            </button>
          ))
        ) : (
          <div className="hrApprRow">
            <span className="hrApprRow__employee">No matching requests.</span>
            <span className="hrApprRow__message">Try clearing the search or adjusting the filters.</span>
            <span className="hrApprRow__meta">
              <span className="hrApprRow__time">-</span>
            </span>
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
              <button
                type="button"
                className="hrApprModal__close"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
              >
                <FiXCircle />
              </button>
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
                <input value={selected.time} readOnly />
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

            {selected.decisionSummary && (
              <div className="hrApprForm__row">
                <label>
                  <span>Latest Decision Note:</span>
                  <textarea value={selected.decisionSummary} readOnly />
                </label>
              </div>
            )}

            {selected.source === 'dispute' && (
              <p className="hrApprForm__hint">
                Approving a payroll dispute opens the correction workspace so HR can stage the actual adjustment.
              </p>
            )}
            {selected.source === 'leave' && (
              <p className="hrApprForm__hint">
                This leave request can be reviewed here, but the current backend response does not include the leave type needed to submit an approval or denial from this page.
              </p>
            )}
            {!canReviewSelected && (
              <p className="hrApprForm__hint">This request already has a final decision recorded.</p>
            )}

            {submitError && <p className="hrApprForm__error">{submitError}</p>}

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
              <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                Cancel
              </button>
              {canReviewSelected ? (
                <button type="button" onClick={() => void submitDecision()} disabled={isSaving || !pendingDecision}>
                  {isSaving
                    ? 'Saving...'
                    : pendingDecision === 'APPROVED'
                      ? 'Confirm Approval'
                      : pendingDecision === 'REJECTED'
                        ? 'Confirm Denial'
                        : 'Confirm Decision'}
                </button>
              ) : (
                <button type="button" onClick={() => setSelectedId(null)} disabled={isSaving}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
