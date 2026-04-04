import { useEffect, useMemo, useState } from 'react';
import { FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import ApprovalStatusSummary from '../../../components/approvals/ApprovalStatusSummary';
import PageHeader from '../../../components/layout/PageHeader';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './PendingApprovals.css';
import '../../hr/approvals/Approvals.css';

type EmployeeRow = {
  id: number;
  name: string;
};

type LeaveDto = {
  requestId?: number;
  empId?: number;
  startDateTime?: string;
  endDateTime?: string;
  requestAt?: string;
  requestStatus?: string;
  reason?: string;
  isPaid?: boolean;
  leaveType?: string;
  approverReason?: string;
};

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

type RequestType = 'Leave' | 'Overtime';
type SourceType = 'leave' | 'overtime';
type RequestTypeFilter = 'all' | SourceType;
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

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
  durationLabel: string;
  requestDateTime: string;
  decisionSummary?: string;
  sortStamp: number;
  leaveType?: string;
  requestId?: number;
  startDateTime?: string;
  endDateTime?: string;
  overtimeId?: number;
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

function formatPeriod(start?: string, end?: string) {
  const startLabel = formatDateOnly(start);
  const endLabel = formatDateOnly(end);
  return startLabel === endLabel ? startLabel : `${startLabel} to ${endLabel}`;
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
  return normalized;
}

function statusLabel(status: string) {
  const normalized = toStatusCode(status);
  if (normalized === 'PENDING') return 'Pending';
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Denied';
  return status;
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
  const [requests, setRequests] = useState<ManagerRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useErrorDialogEffect(loadError, 'Team requests could not be loaded');

  async function loadRequests() {
    try {
      setLoadError('');
      const [employeesRes, leaveRes, overtimeRes] = await Promise.all([
        apiFetchJson<unknown>('/api/employees/team'),
        apiFetchJson<unknown>('/api/leave/request/team?page=0&size=50'),
        apiFetchJson<unknown>('/api/overtime/team?page=0&size=50'),
      ]);

      const employeeById = rosterMap(employeesRes);

      const leaveRows = toArray<LeaveDto>(leaveRes).map((item, idx) => ({
        id: `leave-${item.requestId ?? idx}`,
        requestId: item.requestId,
        employee: employeeLabel(employeeById, item.empId),
        message: `${item.leaveType?.replaceAll('_', ' ') || 'Leave'} - ${
          item.isPaid === false ? 'Unpaid' : 'Paid'
        }`,
        submittedAt: formatDateTime(item.requestAt ?? item.startDateTime),
        type: 'Leave' as const,
        source: 'leave' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Leave Period',
        referenceValue: formatPeriod(item.startDateTime, item.endDateTime),
        requestLabel: 'Leave Request',
        requestKind: `${formatRequestType(item.leaveType)} - ${item.isPaid === false ? 'Unpaid' : 'Paid'}`,
        durationLabel: formatLeaveDuration(item.startDateTime, item.endDateTime),
        requestDateTime: formatRequestDateTime('leave', item.startDateTime, item.endDateTime),
        decisionSummary: item.approverReason || '',
        sortStamp:
          item.requestAt ? Date.parse(item.requestAt) || 0 : item.startDateTime ? Date.parse(item.startDateTime) || 0 : 0,
        leaveType: item.leaveType,
        startDateTime: item.startDateTime,
        endDateTime: item.endDateTime,
      }));

      const overtimeRows = toArray<OvertimeDto>(overtimeRes).map((item, idx) => ({
        id: `overtime-${item.overtimeId ?? idx}`,
        overtimeId: item.overtimeId,
        employee: employeeLabel(employeeById, item.employeeId),
        message: `${item.overtimeType || 'Overtime'} request on ${formatDateOnly(item.workDate)}`,
        submittedAt: formatDateTime(item.requestAt),
        type: 'Overtime' as const,
        source: 'overtime' as const,
        status: item.requestStatus || 'PENDING',
        reason: item.reason || '',
        referenceLabel: 'Work Window',
        referenceValue: `${formatDateTime(item.startTime)} to ${formatDateTime(item.endTime)}`,
        requestLabel: 'Overtime Request',
        requestKind: formatRequestType(item.overtimeType || 'Overtime'),
        durationLabel: formatClockWindow(item.startTime, item.endTime),
        requestDateTime: formatRequestDateTime('overtime', item.startTime, item.endTime, item.workDate),
        decisionSummary: item.approveReason || '',
        sortStamp: item.requestAt ? Date.parse(item.requestAt) || 0 : 0,
      }));

      const merged = [...leaveRows, ...overtimeRows].sort(
        (a, b) => b.sortStamp - a.sortStamp || a.id.localeCompare(b.id)
      );
      setRequests(merged);
    } catch (error) {
      setRequests([]);
      setLoadError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

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
        request.durationLabel,
        request.requestDateTime,
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
  const activeFilterCount = [typeFilter, statusFilter].filter((value) => value !== 'all').length;

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
  }

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <PageHeader
          title={selected ? 'Review Team Request' : 'Requests from Team Members'}
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
                    onChange={(e) => setTypeFilter(e.target.value as RequestTypeFilter)}
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
        <ApprovalStatusSummary items={cards} />
      </div>

      <section className="hrApprTable mgrPendTable">
        {loadError && <p className="hrApprForm__error">{loadError}</p>}
        {visibleRequests.length > 0 ? (
          <>
            <div className="mgrPendTable__head" role="row">
              <span>Name</span>
              <span>Request</span>
              <span>Specific Type</span>
              <span>Duration</span>
              <span>Date and Time</span>
              <span className="mgrPendTable__headCell--status">Status</span>
            </div>

            <div className="mgrPendTable__body">
              {visibleRequests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className={`mgrPendTable__row mgrPendTable__row--${toStatusCode(request.status).toLowerCase()}`}
                  onClick={() => setSelectedId(request.id)}
                >
                  <span className="mgrPendTable__cell mgrPendTable__cell--name">{request.employee}</span>
                  <span className="mgrPendTable__cell">{request.requestLabel}</span>
                  <span className="mgrPendTable__cell">{request.requestKind}</span>
                  <span className="mgrPendTable__cell">{request.durationLabel}</span>
                  <span className="mgrPendTable__cell">{request.requestDateTime}</span>
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
          <div className="mgrPendTable__empty">
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
                <p className="hrApprModal__subtitle">
                  Review the team request details and current status.
                </p>
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
                  className={`hrApprForm__statusBadge hrApprForm__statusBadge--${toStatusCode(
                    selected.status
                  ).toLowerCase()}`}
                >
                  {statusLabel(selected.status)}
                </div>
              </label>
            </div>

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Recorded At:</span>
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

            {selected.decisionSummary && (
              <div className="hrApprForm__row">
                <label>
                  <span>Latest Decision Note:</span>
                  <textarea value={selected.decisionSummary} readOnly />
                </label>
              </div>
            )}

            <p className="hrApprForm__hint">
              Managers can review team requests here, but final approval actions stay on the HR side.
            </p>

            <div className="hrApprModal__footer">
              <button type="button" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
