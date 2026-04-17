import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiEye, FiFilter, FiSearch, FiXCircle } from 'react-icons/fi';
import LargePopup from '../../../components/dialog/LargePopup';

type AggregatedEmployeeRow = EmployeeReportRow & {
  itemIds: number[];
};
import EmployeeSortMenu from '../../../components/layout/EmployeeSortMenu';
import SortMenu, { type SortOption } from '../../../components/layout/SortMenu';
import PageHeader from '../../../components/layout/PageHeader';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { compareEmployees, type EmployeeSortKey } from '../../../lib/employeeSort';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import { getManilaNow } from '../../../lib/manilaTime';
import './PayrollReview.css';

type ReportView = 'employee' | 'payType';

type PayrollRunRow = {
  payId?: number;
  periodStart?: string;
  periodEnd?: string;
  paymentDate?: string;
  periodDescription?: string;
  payrollStatus?: string;
  runType?: string;
  itemCount?: number;
};

type PayrollItemRow = {
  empId?: number;
  firstName?: string;
  lastName?: string;
  itemId?: number;
  grossPay?: number | string;
  netPay?: number | string;
};

type EmployeeDirectoryEntry = {
  id: number;
  role: string;
  department: string;
};

type EmployeeReportRow = PayrollItemRow & {
  role: string;
  department: string;
};

type PayrollBreakdownLine = {
  key: string;
  lineId: number;
  lineType: 'EARNING' | 'DEDUCTION';
  label: string;
  amount: string;
  originalAmount?: string;
  adjustedBy?: string;
  adjustedAt?: string;
};

type AdjustmentKind = 'EARNING' | 'DEDUCTION';

type PayTypeSummaryRow = {
  payType?: string;
  adjustment?: AdjustmentKind;
  adjustmentKind?: AdjustmentKind;
  total?: number | string;
};

type PayTypeSortKey = 'name' | 'amount';

const PAY_TYPE_SORT_OPTIONS: Array<SortOption<PayTypeSortKey>> = [
  {
    value: 'name',
    label: 'Alphabetical',
    hint: 'Show categories in alphabetical order.',
  },
  {
    value: 'amount',
    label: 'Amount',
    hint: 'Show categories with highest totals first.',
  },
];

function getCurrentMonthRange() {
  const manila = getManilaNow();
  const firstDayIso = `${manila.year}-${String(manila.month).padStart(2, '0')}-01`;
  const lastDayDate = new Date(manila.year, manila.month, 0);
  const lastDayIso = `${manila.year}-${String(manila.month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

  return {
    from: firstDayIso,
    to: lastDayIso,
  };
}

function formatDateHuman(isoDate: string) {
  if (!isoDate) return 'Select Date';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(value: unknown) {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  if (typeof value === 'number' && Number.isFinite(value)) return `P${value.toLocaleString(undefined, options)}`;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `P${parsed.toLocaleString(undefined, options)}` : value;
  }
  return `P${(0).toLocaleString(undefined, options)}`;
}

function toAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';
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

function formatEmployeeName(row: PayrollItemRow) {
  const fullName = [row.firstName, row.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');

  if (fullName) return fullName;
  if (typeof row.empId === 'number') return `EMP ID ${row.empId}`;
  return 'Unnamed employee';
}

function buildEmployeeDirectory(response: unknown) {
  return toArray<Record<string, unknown>>(response)
    .map((item, index) => {
      const id = Number(item.employeeId ?? item.id ?? index + 1);
      if (!Number.isFinite(id) || id <= 0) return null;

      return {
        id,
        role: typeof item.position === 'string' ? item.position.trim() : '',
        department: typeof item.department === 'string' ? item.department.trim() : '',
      } satisfies EmployeeDirectoryEntry;
    })
    .filter((entry): entry is EmployeeDirectoryEntry => entry !== null);
}

function toMoneyString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return '0.00';
}

function toOptionalMoneyString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return undefined;
}

function toOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function formatSummaryLabel(value?: string) {
  const key = String(value ?? '').trim();
  if (!key) return 'Unknown line item';
  const normalized = key.replace(/[\s_]+/g, '').toUpperCase();
  if (normalized === 'PAGIBIG') return 'Pag-IBIG Contribution';
  if (normalized === 'PHILHEALTH') return 'PhilHealth Contribution';
  if (normalized === 'SSS') return 'SSS Contribution';
  if (normalized === 'BONUS') return 'Bonus';
  return key
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getSummaryAdjustmentKind(row: PayTypeSummaryRow) {
  return row.adjustment ?? row.adjustmentKind;
}

function normalizeBreakdownLabel(label: string, lineType: PayrollBreakdownLine['lineType']) {
  const trimmed = label.trim();
  if (!trimmed) return lineType === 'EARNING' ? 'Other Earnings' : 'Other Deductions';

  const normalized = trimmed.replace(/[\s_-]+/g, ' ').trim().toLowerCase();

  if (lineType === 'DEDUCTION') {
    if (normalized === 'sss contribution' || normalized === 'sss') return 'SSS Contribution';
    if (normalized === 'philhealth contribution' || normalized === 'philhealth') return 'PhilHealth Contribution';
    if (normalized === 'pag ibig contribution' || normalized === 'pag ibig' || normalized === 'pagibig') return 'Pag-IBIG Contribution';
    if (normalized === 'pag ibig loan' || normalized === 'pagibig loan') return 'Pag-IBIG Loan';
    if (normalized.startsWith('withholding tax') || normalized.startsWith('bracket level')) return 'Withholding Tax';
  }

  if (lineType === 'EARNING') {
    if (normalized === 'basic salary') return 'Basic Pay';
    if (normalized === 'overtime' || normalized === 'approved overtime') return 'Approved Overtime';
    if (normalized === 'bonus') return 'Bonus';
  }

  return trimmed;
}

function getEmptyRunMessage(run: PayrollRunRow | null, view: ReportView, availableRunCount: number) {
  if (!run) {
    if (view === 'employee') {
      return availableRunCount > 0
        ? 'No employee totals matched this payroll run.'
        : 'No posted payroll runs are available yet.';
    }

    return availableRunCount > 0 ? 'No pay type totals matched this payroll run.' : 'No payroll runs are available yet.';
  }

  if (run.payId === -1) {
    return 'No posted payroll data was found within the selected date range. Try adjusting your filters or check if payroll runs have been posted for this period.';
  }

  if ((run.itemCount ?? 0) > 0) {
    return view === 'employee'
      ? 'No employee totals matched this payroll run.'
      : 'No pay type totals matched this payroll run.';
  }

  if (run.runType === 'ADJUSTMENT') {
    return view === 'employee'
      ? 'This adjustment run is still empty. Add correction items to see employee totals here.'
      : 'This adjustment run is still empty. Add correction items to see pay type totals here.';
  }

  return view === 'employee'
    ? 'This payroll run has no generated payroll items yet.'
    : 'This payroll run has no generated pay type totals yet.';
}

export default function AccountingPayrollReview() {
  const [view, setView] = useState<ReportView>('employee');
  const [filterValue, setFilterValue] = useState('');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('id');
  const [payTypeSort, setPayTypeSort] = useState<'name' | 'amount'>('name');
  const initialDateRange = useMemo(() => getCurrentMonthRange(), []);
  const [fromDate, setFromDate] = useState(initialDateRange.from);
  const [toDate, setToDate] = useState(initialDateRange.to);
  const [employeeRows, setEmployeeRows] = useState<PayrollItemRow[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeDirectoryEntry[]>([]);
  const [payTypeRows, setPayTypeRows] = useState<PayTypeSummaryRow[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<AggregatedEmployeeRow | null>(null);
  const [selectedBreakdownEarnings, setSelectedBreakdownEarnings] = useState<PayrollBreakdownLine[]>([]);
  const [selectedBreakdownDeductions, setSelectedBreakdownDeductions] = useState<PayrollBreakdownLine[]>([]);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const silentRefreshRef = useRef(false);
  useErrorDialogEffect(loadError, 'Payroll review data could not be loaded');

  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  const filterLabel = useMemo(() => (view === 'employee' ? 'Employee:' : 'Category:'), [view]);

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    if (selectedBreakdownItem) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [selectedBreakdownItem]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployeeDirectory() {
      try {
        const response = await apiFetchJson<unknown>('/api/employees?page=0&size=500');
        if (cancelled) return;
        setEmployeeDirectory(buildEmployeeDirectory(response));
      } catch {
        if (!cancelled) {
          setEmployeeDirectory([]);
        }
      }
    }

    void loadEmployeeDirectory();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setEmployeeRows([]);
      setPayTypeRows([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadReportDetails() {
      const isSilentRefresh = silentRefreshRef.current;
      if (!isSilentRefresh) {
        setIsLoading(true);
        setLoadError('');
      }

      try {
        const [itemsResponse, summaryResponse] = await Promise.all([
          apiFetchJson<unknown>(`/api/payroll/report/items?from=${fromDate}&to=${toDate}&page=0&size=500`),
          apiFetchJson<unknown>(`/api/payroll/report/summary?from=${fromDate}&to=${toDate}`),
        ]);

        if (cancelled) return;

        setEmployeeRows(toArray<PayrollItemRow>(itemsResponse));
        setPayTypeRows(toArray<PayTypeSummaryRow>(summaryResponse));
        setLoadError('');
      } catch (error) {
        if (cancelled) return;
        if (!isSilentRefresh) {
          setEmployeeRows([]);
          setPayTypeRows([]);
          setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
        }
      } finally {
        if (!cancelled) {
          if (!isSilentRefresh) setIsLoading(false);
          silentRefreshRef.current = false;
        }
      }
    }

    void loadReportDetails();

    return () => {
      cancelled = true;
    };
  }, [fromDate, toDate, refreshTick]);

  const selectedRun = useMemo(() => {
    if (!fromDate || !toDate) return null;
    return {
      payId: -1,
      periodStart: fromDate,
      periodEnd: toDate,
      periodDescription: `Report range: ${fromDate} to ${toDate}`,
      payrollStatus: 'POSTED',
      runType: 'REGULAR',
      itemCount: employeeRows.length,
    } as PayrollRunRow;
  }, [fromDate, toDate, employeeRows.length]);

  const selectedBreakdownGross = selectedBreakdownItem ? toAmount(selectedBreakdownItem.grossPay) : 0;
  const selectedBreakdownNet = selectedBreakdownItem ? toAmount(selectedBreakdownItem.netPay) : 0;
  const selectedBreakdownDeductionsTotal = useMemo(() => {
    if (!selectedBreakdownItem) return 0;
    if (selectedBreakdownDeductions.length > 0) {
      return selectedBreakdownDeductions.reduce((sum, line) => sum + toAmount(line.amount), 0);
    }
    return Math.max(selectedBreakdownGross - selectedBreakdownNet, 0);
  }, [selectedBreakdownDeductions, selectedBreakdownGross, selectedBreakdownItem, selectedBreakdownNet]);

  const normalizedFilter = filterValue.trim().toLowerCase();
  const employeeDirectoryById = useMemo(
    () => new Map(employeeDirectory.map((entry) => [entry.id, entry])),
    [employeeDirectory]
  );
  const employeeReportRows = useMemo<EmployeeReportRow[]>(() => {
    return employeeRows.map((row) => {
      const entry = typeof row.empId === 'number' ? employeeDirectoryById.get(row.empId) : undefined;
      return {
        ...row,
        role: entry?.role ?? '',
        department: entry?.department ?? '',
      };
    });
  }, [employeeDirectoryById, employeeRows]);

  const roleOptions = useMemo(
    () => Array.from(new Set(employeeReportRows.map((row) => row.role).filter(Boolean))).sort(),
    [employeeReportRows]
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set(employeeReportRows.map((row) => row.department).filter(Boolean))).sort(),
    [employeeReportRows]
  );

  const visibleEmployeeRows = useMemo(() => {
    const filtered = employeeReportRows.filter((row) => {
      const name = formatEmployeeName(row).toLowerCase();
      const empId = String(row.empId ?? '').toLowerCase();
      const matchesSearch = !normalizedFilter || normalizedFilter === 'all' || name.includes(normalizedFilter) || empId.includes(normalizedFilter);
      const matchesRole = roleFilter === 'all' || row.role === roleFilter;
      const matchesDept = departmentFilter === 'all' || row.department === departmentFilter;
      return matchesSearch && matchesRole && matchesDept;
    });

    const aggregatedMap = new Map<number, AggregatedEmployeeRow>();
    for (const row of filtered) {
      const empId = row.empId;
      if (typeof empId !== 'number') continue;

      const existing = aggregatedMap.get(empId);
      if (existing) {
        existing.grossPay = toAmount(existing.grossPay) + toAmount(row.grossPay);
        existing.netPay = toAmount(existing.netPay) + toAmount(row.netPay);
        if (typeof row.itemId === 'number' && !existing.itemIds.includes(row.itemId)) {
          existing.itemIds.push(row.itemId);
        }
      } else {
        aggregatedMap.set(empId, {
          ...row,
          itemIds: typeof row.itemId === 'number' ? [row.itemId] : [],
        });
      }
    }

    return Array.from(aggregatedMap.values()).sort((left, right) =>
      compareEmployees(
        employeeSort,
        { id: left.empId, name: formatEmployeeName(left) },
        { id: right.empId, name: formatEmployeeName(right) }
      )
    );
  }, [departmentFilter, employeeReportRows, roleFilter, employeeSort, normalizedFilter]);

  const visiblePayTypeRows = useMemo(() => {
    const filtered =
      !normalizedFilter || normalizedFilter === 'all'
        ? [...payTypeRows]
        : payTypeRows.filter((row) => {
            const payType = String(row.payType ?? '').toLowerCase();
            const kind = String(getSummaryAdjustmentKind(row) ?? '').toLowerCase();
            const friendlyPayType = formatSummaryLabel(row.payType).toLowerCase();
            return payType.includes(normalizedFilter) || kind.includes(normalizedFilter) || friendlyPayType.includes(normalizedFilter);
          });

    return filtered.sort((a, b) => {
      if (payTypeSort === 'amount') {
        return toAmount(b.total) - toAmount(a.total);
      }
      return formatSummaryLabel(a.payType).localeCompare(formatSummaryLabel(b.payType));
    });
  }, [normalizedFilter, payTypeRows, payTypeSort]);

  const visibleEarningRows = useMemo(
    () => visiblePayTypeRows.filter((row) => getSummaryAdjustmentKind(row) === 'EARNING'),
    [visiblePayTypeRows]
  );

  const visibleDeductionRows = useMemo(
    () => visiblePayTypeRows.filter((row) => getSummaryAdjustmentKind(row) === 'DEDUCTION'),
    [visiblePayTypeRows]
  );

  const earningsTotal = useMemo(
    () => visibleEarningRows.reduce((sum, row) => sum + toAmount(row.total), 0),
    [visibleEarningRows]
  );

  const deductionsTotal = useMemo(
    () => visibleDeductionRows.reduce((sum, row) => sum + toAmount(row.total), 0),
    [visibleDeductionRows]
  );

  const activeFilterCount = [roleFilter, departmentFilter].filter(
    (value) => value !== 'all'
  ).length;

  const employeeEmptyMessage =
    employeeRows.length > 0 && visibleEmployeeRows.length === 0 && (normalizedFilter || activeFilterCount > 0)
      ? 'No employee totals matched the current search or filters.'
      : getEmptyRunMessage(selectedRun, 'employee', 0);

  const closeBreakdownModal = useCallback(() => {
    setSelectedBreakdownItem(null);
    setSelectedBreakdownEarnings([]);
    setSelectedBreakdownDeductions([]);
    setBreakdownError('');
    setIsLoadingBreakdown(false);
  }, []);

  useEscapeDismiss(Boolean(selectedBreakdownItem), closeBreakdownModal, 10);

  useEffect(() => {
    closeBreakdownModal();
  }, [closeBreakdownModal, view]);

  function mapBreakdownLines(response: unknown, lineType: PayrollBreakdownLine['lineType']) {
    return toArray<Record<string, unknown>>(response)
      .map((row, idx) => ({
        key: `${lineType}-${String(row.earningsId ?? row.deductionsId ?? idx + 1)}`,
        lineId: Number(row.earningsId ?? row.deductionsId),
        lineType,
        label: normalizeBreakdownLabel(String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`), lineType),
        amount: toMoneyString(row.amount),
        originalAmount: toOptionalMoneyString(row.originalAmount),
        adjustedBy: toOptionalText(row.adjustedBy),
        adjustedAt: toOptionalText(row.adjustedAt),
      }))
      .filter((line) => Number.isFinite(line.lineId) && line.lineId > 0);
  }

  async function openBreakdownModal(row: AggregatedEmployeeRow) {
    if (row.itemIds.length === 0) return;

    setSelectedBreakdownItem(row);
    setSelectedBreakdownEarnings([]);
    setSelectedBreakdownDeductions([]);
    setBreakdownError('');
    setIsLoadingBreakdown(true);

    try {
      const allEarnings: PayrollBreakdownLine[] = [];
      const allDeductions: PayrollBreakdownLine[] = [];

      await Promise.all(
        row.itemIds.map(async (itemId) => {
          const [earningsResponse, deductionsResponse] = await Promise.all([
            apiFetchJson<unknown>(`/api/payroll/item/earnings/${itemId}`),
            apiFetchJson<unknown>(`/api/payroll/item/deductions/${itemId}`),
          ]);
          allEarnings.push(...mapBreakdownLines(earningsResponse, 'EARNING'));
          allDeductions.push(...mapBreakdownLines(deductionsResponse, 'DEDUCTION'));
        })
      );

      const sumLines = (lines: PayrollBreakdownLine[]) => {
        const map = new Map<string, PayrollBreakdownLine>();
        for (const line of lines) {
          const existing = map.get(line.label);
          if (existing) {
            existing.amount = toMoneyString(toAmount(existing.amount) + toAmount(line.amount));
          } else {
            map.set(line.label, { ...line });
          }
        }
        return Array.from(map.values());
      };

      setSelectedBreakdownEarnings(sumLines(allEarnings));
      setSelectedBreakdownDeductions(sumLines(allDeductions));
    } catch (error) {
      setBreakdownError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingBreakdown(false);
    }
  }

  function clearFilters() {
    setRoleFilter('all');
    setDepartmentFilter('all');
  }

  return (
    <div className="aReviewPay">
      <div className="aReviewRun__top">
        <PageHeader
          title="Payslip Review"
          description="Analyze payroll totals by employee or pay type before printing or cross-checking posted values."
        />
        <div className="aReviewRun__topActions">
          <label className="aReviewRunSelect aReviewRunSelect--view" aria-label="Report view">
            <select value={view} onChange={(e) => setView(e.target.value as ReportView)}>
              <option value="employee">By Employee</option>
              <option value="payType">By Earnings / Deductions</option>
            </select>
          </label>
        </div>
      </div>

      <div className="aReviewRunFilters">
        <div className="aReviewRunFilters__field aReviewRunFilters__field--search">
          <label>{filterLabel}</label>
          <div className="aReviewRunFilters__searchGroup">
            <label className="uSearch" aria-label={view === 'employee' ? 'Search employees' : 'Search pay types'}>
              <FiSearch />
              <input
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder={view === 'employee' ? 'Search by employee name or ID' : 'Search by earnings or deductions type'}
              />
              {filterValue && (
                <button type="button" aria-label="Clear search" onClick={() => setFilterValue('')}>
                  <FiXCircle />
                </button>
              )}
            </label>
          </div>
        </div>

        <div className="aReviewRunFilters__field aReviewRunFilters__field--dates">
          <label>Date Range:</label>
          <div className="aReviewRunFilters__dateGroup">
            <div className="aReviewRunDateInput">
              <FiCalendar />
              <span className="aReviewRunDateInput__value">{formatDateHuman(fromDate)}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="From date"
              />
            </div>
            <span className="aReviewRunFilters__dateSeparator">to</span>
            <div className="aReviewRunDateInput">
              <FiCalendar />
              <span className="aReviewRunDateInput__value">{formatDateHuman(toDate)}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="To date"
              />
            </div>
          </div>
        </div>

        <div className="aReviewRunFilters__field aReviewRunFilters__field--sort">
          <label>Sort By:</label>
          <div className="aReviewRunFilters__actions">
            {view === 'employee' ? (
              <EmployeeSortMenu value={employeeSort} onChange={setEmployeeSort} />
            ) : (
              <SortMenu
                value={payTypeSort}
                onChange={setPayTypeSort}
                options={PAY_TYPE_SORT_OPTIONS}
                panelLabel="Sort categories"
              />
            )}
            <div className="uFilter">
              <button
                type="button"
                className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${
                  activeFilterCount > 0 ? 'is-active' : ''
                }`}
                onClick={() => {
                  setFilterOpen((open) => !open);
                }}
              >
                <FiFilter />
                <span>Filter</span>
              </button>

              {filterOpen ? (
                <div className="uFilter__panel">
                  <label className="uFilter__field">
                    <span>Role</span>
                    <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                      <option value="all">All Roles</option>
                      {roleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="uFilter__field">
                    <span>Department</span>
                    <select
                      value={departmentFilter}
                      onChange={(event) => setDepartmentFilter(event.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {departmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="uFilter__actions">
                    <button type="button" onClick={clearFilters}>
                      Reset Filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {view === 'employee' ? (
        <section className="aReviewRunTable" aria-label="Payslips by employee">
          <div className="aReviewRunTable__head aReviewRunTable__head--employee">
            <span>EMP ID</span>
            <span>NAME</span>
            <span>Gross Pay</span>
            <span>Net Pay</span>
            <span className="aReviewRunTable__headCell--action"></span>
          </div>

          <div className="aReviewRunTable__body">
            {!isLoading && visibleEmployeeRows.length > 0 ? (
              visibleEmployeeRows.map((row, index) => (
                <button
                  key={`${row.empId ?? index}`}
                  type="button"
                  className="aReviewRunEmployee aReviewRunEmployee--interactive"
                  onClick={() => void openBreakdownModal(row)}
                  disabled={row.itemIds.length === 0}
                >
                  <div className="aReviewRunEmployee__id">{row.empId ?? '-'}</div>
                  <div className="aReviewRunEmployee__name">{formatEmployeeName(row)}</div>
                  <div className="aReviewRunEmployee__gross">{formatCurrency(row.grossPay)}</div>
                  <div className="aReviewRunEmployee__value">{formatCurrency(row.netPay)}</div>
                  <div className="aReviewRunEmployee__action">
                    <FiEye className="aReviewRunEmployee__eye" />
                  </div>
                </button>
              ))
            ) : (
              <article className="uEmptyState">{isLoading ? 'Loading pay run details...' : employeeEmptyMessage}</article>
            )}
          </div>
        </section>
      ) : (
        <div className="aReviewRunSplitTables" aria-label="Pay run earnings and deductions">
          {!isLoading && (visibleEarningRows.length > 0 || visibleDeductionRows.length > 0) ? (
            <>
              <section className="aReviewRunTable aReviewRunTable--summaryView" aria-label="Earnings summary table">
                <div className="aReviewRunGroup__head">
                  <div className="aReviewRunGroup__titleBlock">
                    <span className="aReviewRunGroup__title">Earnings</span>
                    <span className="aReviewRunGroup__caption">Total earnings</span>
                  </div>
                  <span className="aReviewRunGroup__total">{formatCurrency(earningsTotal)}</span>
                </div>
                <div className="aReviewRunTable__head aReviewRunTable__head--payType">
                  <span>Type</span>
                  <span>Total</span>
                </div>
                <div className="aReviewRunTable__body aReviewRunTable__body--summary">
                  {visibleEarningRows.length > 0 ? (
                    visibleEarningRows.map((row, index) => (
                      <article key={`earning-${row.payType ?? index}`} className="aReviewRunTypeRow aReviewRunTypeRow--table">
                        <div className="aReviewRunTypeRow__label">{formatSummaryLabel(row.payType)}</div>
                        <div className="aReviewRunTypeRow__value">{formatCurrency(row.total)}</div>
                      </article>
                    ))
                  ) : (
                    <article className="uEmptyState">No earnings matched this payroll run.</article>
                  )}
                </div>
              </section>

              <section className="aReviewRunTable aReviewRunTable--summaryView" aria-label="Deductions summary table">
                <div className="aReviewRunGroup__head">
                  <div className="aReviewRunGroup__titleBlock">
                    <span className="aReviewRunGroup__title">Deductions</span>
                    <span className="aReviewRunGroup__caption">Total deductions</span>
                  </div>
                  <span className="aReviewRunGroup__total">{formatCurrency(deductionsTotal)}</span>
                </div>
                <div className="aReviewRunTable__head aReviewRunTable__head--payType">
                  <span>Type</span>
                  <span>Total</span>
                </div>
                <div className="aReviewRunTable__body aReviewRunTable__body--summary">
                  {visibleDeductionRows.length > 0 ? (
                    visibleDeductionRows.map((row, index) => (
                      <article key={`deduction-${row.payType ?? index}`} className="aReviewRunTypeRow aReviewRunTypeRow--table">
                        <div className="aReviewRunTypeRow__label">{formatSummaryLabel(row.payType)}</div>
                        <div className="aReviewRunTypeRow__value">{formatCurrency(row.total)}</div>
                      </article>
                    ))
                  ) : (
                    <article className="uEmptyState">No deductions matched this payroll run.</article>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="aReviewRunTable aReviewRunTable--summaryView" aria-label="Pay type summary table">
              <div className="aReviewRunTable__body aReviewRunTable__body--summary">
                <article className="uEmptyState">
                  {isLoading ? 'Loading pay type totals...' : getEmptyRunMessage(selectedRun, 'payType', 0)}
                </article>
              </div>
            </section>
          )}
        </div>
      )}

      {selectedBreakdownItem && (
        <LargePopup
          open
          ariaLabel="Payroll item breakdown"
          title={`${formatEmployeeName(selectedBreakdownItem)} - Payslip Breakdown`}
          subtitle="Review the current earnings, deductions, and totals before posting this in-progress payroll item."
          size="lg"
          onClose={closeBreakdownModal}
          footer={(
            <button type="button" className="btn btn--ghost" onClick={closeBreakdownModal}>
              Close
            </button>
          )}
        >
          <div className="aReviewRunBreakdownTotals">
            <div className="aReviewRunBreakdownTotals__card">
              <span>Gross Pay</span>
              <strong>{formatCurrency(selectedBreakdownGross)}</strong>
            </div>
            <div className="aReviewRunBreakdownTotals__card">
              <span>Total Deductions</span>
              <strong>{formatCurrency(selectedBreakdownDeductionsTotal)}</strong>
            </div>
            <div className="aReviewRunBreakdownTotals__card">
              <span>Net Pay</span>
              <strong>{formatCurrency(selectedBreakdownNet)}</strong>
            </div>
          </div>

          {isLoadingBreakdown ? (
            <p className="aReviewRunModal__intro">
              Loading the payroll lines for this employee so the full payslip breakdown can be reviewed.
            </p>
          ) : (
            <>
              {breakdownError && <p className="aReviewRunModal__message">{breakdownError}</p>}

              <div className="aReviewRunBreakdown">
                <section className="aReviewRunBreakdown__section">
                  <div className="aReviewRunBreakdown__head">
                    <h3>Earnings</h3>
                    <span>{selectedBreakdownEarnings.length} line(s)</span>
                  </div>
                  <div className="aReviewRunBreakdown__list">
                    {selectedBreakdownEarnings.length > 0 ? (
                      selectedBreakdownEarnings.map((line) => (
                        <div key={line.key} className="aReviewRunBreakdown__row">
                          <div>
                            <strong>{line.label}</strong>
                            {(line.adjustedBy || line.adjustedAt) && (
                              <span>
                                {line.adjustedBy ? `Adjusted by ${line.adjustedBy}` : 'Adjusted'}{' '}
                                {line.adjustedAt ? `on ${formatDateTime(line.adjustedAt)}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="aReviewRunBreakdown__amounts">
                            {line.originalAmount && <small>Original: {formatCurrency(line.originalAmount)}</small>}
                            <strong>{formatCurrency(line.amount)}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="aReviewRunBreakdown__empty">No earnings were returned for this payroll item.</div>
                    )}
                  </div>
                </section>

                <section className="aReviewRunBreakdown__section">
                  <div className="aReviewRunBreakdown__head">
                    <h3>Deductions</h3>
                    <span>{selectedBreakdownDeductions.length} line(s)</span>
                  </div>
                  <div className="aReviewRunBreakdown__list">
                    {selectedBreakdownDeductions.length > 0 ? (
                      selectedBreakdownDeductions.map((line) => (
                        <div key={line.key} className="aReviewRunBreakdown__row">
                          <div>
                            <strong>{line.label}</strong>
                            {(line.adjustedBy || line.adjustedAt) && (
                              <span>
                                {line.adjustedBy ? `Adjusted by ${line.adjustedBy}` : 'Adjusted'}{' '}
                                {line.adjustedAt ? `on ${formatDateTime(line.adjustedAt)}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="aReviewRunBreakdown__amounts">
                            {line.originalAmount && <small>Original: {formatCurrency(line.originalAmount)}</small>}
                            <strong>{formatCurrency(line.amount)}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="aReviewRunBreakdown__empty">No deductions were returned for this payroll item.</div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </LargePopup>
      )}
    </div>
  );
}
