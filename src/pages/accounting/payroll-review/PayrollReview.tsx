import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiSearch, FiXCircle } from 'react-icons/fi';
import PageHeader from '../../../components/layout/PageHeader';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { useRegisterPageRefresh } from '../../../lib/pageRefresh';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './PayrollReview.css';

type ReportView = 'employee' | 'payType';

type PayrollRunRow = {
  payId?: number;
  periodStart?: string;
  periodEnd?: string;
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

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
  if (typeof row.empId === 'number') return `Employee ID ${row.empId}`;
  return 'Unnamed employee';
}

function formatRunLabel(run: PayrollRunRow) {
  if (run.periodStart || run.periodEnd) {
    return `${formatDate(run.periodStart)} to ${formatDate(run.periodEnd)}`;
  }
  return run.periodDescription || 'Payroll period unavailable';
}

function toSortStamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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

function compareRunsDescending(a: PayrollRunRow, b: PayrollRunRow) {
  const endDiff = toSortStamp(b.periodEnd) - toSortStamp(a.periodEnd);
  if (endDiff !== 0) return endDiff;

  const startDiff = toSortStamp(b.periodStart) - toSortStamp(a.periodStart);
  if (startDiff !== 0) return startDiff;

  return (b.payId ?? 0) - (a.payId ?? 0);
}

function formatSummaryLabel(value?: string) {
  const key = String(value ?? '').trim();
  if (!key) return 'Unknown line item';
  const normalized = key.replace(/[\s_]+/g, '').toUpperCase();
  if (normalized === 'PAGIBIG') return 'PagIbig';
  if (normalized === 'PHILHEALTH') return 'PhilHealth';
  if (normalized === 'SSS') return 'SSS';
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

function getEmptyRunMessage(run: PayrollRunRow | null, view: ReportView, availableRunCount: number) {
  if (!run) {
    if (view === 'employee') {
      return availableRunCount > 0
        ? 'No employee totals matched this payroll run.'
        : 'No posted payroll runs are available yet.';
    }

    return availableRunCount > 0 ? 'No pay type totals matched this payroll run.' : 'No payroll runs are available yet.';
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
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [selectedPayId, setSelectedPayId] = useState<number | null>(null);
  const [employeeRows, setEmployeeRows] = useState<PayrollItemRow[]>([]);
  const [payTypeRows, setPayTypeRows] = useState<PayTypeSummaryRow[]>([]);
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<PayrollItemRow | null>(null);
  const [selectedBreakdownEarnings, setSelectedBreakdownEarnings] = useState<PayrollBreakdownLine[]>([]);
  const [selectedBreakdownDeductions, setSelectedBreakdownDeductions] = useState<PayrollBreakdownLine[]>([]);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  useErrorDialogEffect(loadError, 'Payroll review data could not be loaded');
  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  const filterLabel = useMemo(() => (view === 'employee' ? 'Employee:' : 'Category:'), [view]);
  const selectableRuns = useMemo(
    () => (view === 'employee' ? runs.filter((run) => run.payrollStatus === 'POSTED') : runs),
    [runs, view]
  );

  useRegisterPageRefresh(handlePageRefresh);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setIsLoading(true);
      setLoadError('');

      try {
        const runResponse = await apiFetchJson<unknown>('/api/payroll/run');
        if (cancelled) return;

        const nextRuns = [...toArray<PayrollRunRow>(runResponse)].sort(compareRunsDescending);
        setRuns(nextRuns);
      } catch (error) {
        if (cancelled) return;
        setRuns([]);
        setSelectedPayId(null);
        setEmployeeRows([]);
        setPayTypeRows([]);
        setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
        setIsLoading(false);
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    const selectedExists = selectableRuns.some((run) => run.payId === selectedPayId);
    const defaultRun = selectableRuns.find((run) => (run.itemCount ?? 0) > 0) ?? selectableRuns[0] ?? null;
    const nextPayId =
      selectedExists && selectedPayId != null ? selectedPayId : typeof defaultRun?.payId === 'number' ? defaultRun.payId : null;

    if (nextPayId !== selectedPayId) {
      setSelectedPayId(nextPayId);
    }
  }, [selectableRuns, selectedPayId]);

  useEffect(() => {
    if (selectedPayId == null || !selectableRuns.some((run) => run.payId === selectedPayId)) {
      setEmployeeRows([]);
      setPayTypeRows([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRunDetails() {
      setIsLoading(true);
      setLoadError('');

      try {
        const [itemsResponse, summaryResponse] = await Promise.all([
          apiFetchJson<unknown>(`/api/payroll/run/${selectedPayId}/items?page=0&size=1000`),
          apiFetchJson<unknown>(`/api/payroll/run/summary/${selectedPayId}`),
        ]);

        if (cancelled) return;

        setEmployeeRows(toArray<PayrollItemRow>(itemsResponse));
        setPayTypeRows(toArray<PayTypeSummaryRow>(summaryResponse));
      } catch (error) {
        if (cancelled) return;
        setEmployeeRows([]);
        setPayTypeRows([]);
        setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadRunDetails();

    return () => {
      cancelled = true;
    };
  }, [refreshTick, selectableRuns, selectedPayId]);

  const selectedRun = useMemo(
    () => selectableRuns.find((run) => run.payId === selectedPayId) ?? null,
    [selectableRuns, selectedPayId]
  );

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

  const visibleEmployeeRows = useMemo(() => {
    const filtered =
      !normalizedFilter || normalizedFilter === 'all'
        ? [...employeeRows]
        : employeeRows.filter((row) => {
            const name = formatEmployeeName(row).toLowerCase();
            const empId = String(row.empId ?? '').toLowerCase();
            return name.includes(normalizedFilter) || empId.includes(normalizedFilter);
          });

    return filtered.sort((a, b) => {
      const aId = typeof a.empId === 'number' ? a.empId : Number.MAX_SAFE_INTEGER;
      const bId = typeof b.empId === 'number' ? b.empId : Number.MAX_SAFE_INTEGER;
      if (aId !== bId) return aId - bId;
      return formatEmployeeName(a).localeCompare(formatEmployeeName(b));
    });
  }, [employeeRows, normalizedFilter]);

  const visiblePayTypeRows = useMemo(() => {
    const filtered =
      !normalizedFilter || normalizedFilter === 'all'
        ? [...payTypeRows]
        : payTypeRows.filter((row) => {
            const payType = String(row.payType ?? '').toLowerCase();
            const kind = String(getSummaryAdjustmentKind(row) ?? '').toLowerCase();
            return payType.includes(normalizedFilter) || kind.includes(normalizedFilter);
          });

    return filtered.sort((a, b) => formatSummaryLabel(a.payType).localeCompare(formatSummaryLabel(b.payType)));
  }, [normalizedFilter, payTypeRows]);

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
  }, [closeBreakdownModal, selectedPayId, view]);

  function mapBreakdownLines(response: unknown, lineType: PayrollBreakdownLine['lineType']) {
    return toArray<Record<string, unknown>>(response)
      .map((row, idx) => ({
        key: `${lineType}-${String(row.earningsId ?? row.deductionsId ?? idx + 1)}`,
        lineId: Number(row.earningsId ?? row.deductionsId),
        lineType,
        label:
          lineType === 'EARNING'
            ? String(row.description ?? `Earning ${idx + 1}`)
            : String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`),
        amount: toMoneyString(row.amount),
        originalAmount: toOptionalMoneyString(row.originalAmount),
        adjustedBy: toOptionalText(row.adjustedBy),
        adjustedAt: toOptionalText(row.adjustedAt),
      }))
      .filter((line) => Number.isFinite(line.lineId) && line.lineId > 0);
  }

  async function openBreakdownModal(row: PayrollItemRow) {
    if (typeof row.itemId !== 'number') return;

    setSelectedBreakdownItem(row);
    setSelectedBreakdownEarnings([]);
    setSelectedBreakdownDeductions([]);
    setBreakdownError('');
    setIsLoadingBreakdown(true);

    try {
      const [earningsResponse, deductionsResponse] = await Promise.all([
        apiFetchJson<unknown>(`/api/payroll/item/earnings/${row.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/deductions/${row.itemId}`),
      ]);

      setSelectedBreakdownEarnings(mapBreakdownLines(earningsResponse, 'EARNING'));
      setSelectedBreakdownDeductions(mapBreakdownLines(deductionsResponse, 'DEDUCTION'));
    } catch (error) {
      setBreakdownError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingBreakdown(false);
    }
  }

  return (
    <div className="aReviewPay">
      <div className="aReviewRun__top">
        <PageHeader
          title="Payslip Review"
          description="Analyze payroll totals by employee or pay type before printing or cross-checking posted values."
        />
        <label className="aReviewRunSelect aReviewRunSelect--view" aria-label="Report view">
          <select value={view} onChange={(e) => setView(e.target.value as ReportView)}>
            <option value="employee">By Employee</option>
            <option value="payType">By Earnings / Deductions</option>
          </select>
        </label>
      </div>

      <div className="aReviewRunFilters">
        <div className="aReviewRunFilters__field aReviewRunFilters__field--search">
          <label>{filterLabel}</label>
          <label className="aReviewRunSearch" aria-label={view === 'employee' ? 'Search employees' : 'Search pay types'}>
            <FiSearch />
            <input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder={view === 'employee' ? 'Search by employee name' : 'Search by earnings or deductions type'}
            />
            {filterValue && (
              <button type="button" aria-label="Clear filter" onClick={() => setFilterValue('')}>
                <FiXCircle />
              </button>
            )}
          </label>
        </div>

        <div className="aReviewRunFilters__field">
          <label>Payroll Period:</label>
          <label className="aReviewRunSelect" aria-label="Payroll period">
            <select
              value={selectedPayId ?? ''}
              onChange={(e) => setSelectedPayId(e.target.value ? Number(e.target.value) : null)}
              disabled={selectableRuns.length === 0}
            >
              {selectableRuns.length > 0 ? (
                selectableRuns.map((run) => (
                  <option key={run.payId} value={run.payId}>
                    {formatRunLabel(run)}
                  </option>
                ))
              ) : (
                <option value="">{view === 'employee' ? 'No posted payroll runs yet' : 'No payroll runs yet'}</option>
              )}
            </select>
          </label>
        </div>
      </div>

      {view === 'employee' ? (
        <section className="aReviewRunTable" aria-label="Payslips by employee">
          <div className="aReviewRunTable__head aReviewRunTable__head--employee">
            <span>Employee ID</span>
            <span>Employee Name</span>
            <span>Gross Pay</span>
            <span>Net Pay</span>
            <span className="aReviewRunTable__headCell--action">Details</span>
          </div>

          <div className="aReviewRunTable__body">
            {!isLoading && visibleEmployeeRows.length > 0 ? (
              visibleEmployeeRows.map((row, index) => (
                <button
                  key={`${row.itemId ?? row.empId ?? index}`}
                  type="button"
                  className="aReviewRunEmployee aReviewRunEmployee--interactive"
                  onClick={() => void openBreakdownModal(row)}
                  disabled={typeof row.itemId !== 'number'}
                >
                  <div className="aReviewRunEmployee__id">{row.empId ?? '-'}</div>
                  <div className="aReviewRunEmployee__name">{formatEmployeeName(row)}</div>
                  <div className="aReviewRunEmployee__gross">{formatCurrency(row.grossPay)}</div>
                  <div className="aReviewRunEmployee__value">{formatCurrency(row.netPay)}</div>
                  <div className="aReviewRunEmployee__action">
                    <span className="aReviewRunPreviewPill">
                      {typeof row.itemId === 'number' ? 'View Breakdown' : 'Unavailable'}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <article className="aReviewRunEmpty">
                {isLoading ? 'Loading pay run details...' : getEmptyRunMessage(selectedRun, 'employee', selectableRuns.length)}
              </article>
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
                    <article className="aReviewRunEmpty aReviewRunEmpty--group">No earnings matched this payroll run.</article>
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
                    <article className="aReviewRunEmpty aReviewRunEmpty--group">No deductions matched this payroll run.</article>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section className="aReviewRunTable aReviewRunTable--summaryView" aria-label="Pay type summary table">
              <div className="aReviewRunTable__body aReviewRunTable__body--summary">
                <article className="aReviewRunEmpty">
                  {isLoading ? 'Loading pay type totals...' : getEmptyRunMessage(selectedRun, 'payType', selectableRuns.length)}
                </article>
              </div>
            </section>
          )}
        </div>
      )}

      {selectedBreakdownItem && (
        <div className="aReviewRunModalBackdrop" role="dialog" aria-modal="true" aria-label="Payroll item breakdown">
          <article className="aReviewRunModal">
            <div className="aReviewRunModal__top">
              <div className="aReviewRunModal__heading">
                <h2 className="aReviewRunModal__title">{formatEmployeeName(selectedBreakdownItem)} - Payslip Breakdown</h2>
                <p className="aReviewRunModal__subtitle">
                  Review the earnings, deductions, and totals for this payroll item before printing or cross-checking values.
                </p>
              </div>
              <button
                type="button"
                className="aReviewRunModal__close"
                aria-label="Close payroll item breakdown"
                onClick={closeBreakdownModal}
              >
                <FiXCircle />
              </button>
            </div>
            <div className="aReviewRunModal__rule" />

            <div className="aReviewRunModal__grid">
              <label>
                <span>Payroll Item</span>
                <input value={`#${selectedBreakdownItem.itemId ?? '-'}`} readOnly />
              </label>
              <label>
                <span>Run Status</span>
                <input value={selectedRun?.payrollStatus ?? 'Unknown'} readOnly />
              </label>
              <label>
                <span>Pay Period</span>
                <input value={selectedRun ? formatRunLabel(selectedRun) : 'Payroll period unavailable'} readOnly />
              </label>
              <label>
                <span>Run Type</span>
                <input value={selectedRun?.runType ?? 'Unknown'} readOnly />
              </label>
            </div>

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
          </article>
        </div>
      )}
    </div>
  );
}
