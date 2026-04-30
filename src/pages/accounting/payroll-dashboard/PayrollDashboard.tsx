import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import LargePopup from '../../../components/dialog/LargePopup';
import PageHeader from '../../../components/layout/PageHeader';
import SensitiveAccessIndicator from '../../../components/security/SensitiveAccessIndicator';
import SensitiveAccessModal from '../../../components/security/SensitiveAccessModal';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { useSensitiveAccessPrompt } from '../../../hooks/useSensitiveAccessPrompt';
import { apiFetchJson, toArray } from '../../../lib/api';
import { formatDate } from '../../../lib/formatters';
import type { PayTypeSummaryRow, PayrollItemRow, PayrollRunRow } from '../../../lib/types/payroll';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './PayrollDashboard.css';

type HistoryPoint = {
  payId: number;
  label: string;
  grossTotal: number;
  totalPayrollCost: number;
};

type BreakdownPoint = {
  label: string;
  total: number;
  share: number;
  tone: 't1' | 't2' | 't3' | 't4' | 't5' | 't6';
};

type DashboardBreakdownRow = {
  label: string;
  value: number;
  note?: string;
};

type DashboardBreakdownState = {
  title: string;
  subtitle: string;
  totalLabel: string;
  totalValue: number;
  rows: DashboardBreakdownRow[];
};

type AccountingPayrollDashboardProps = {
  showSensitiveAccessIndicator?: boolean;
};

const LOCKED_PAGE_MESSAGE =
  'Verify your access first by clicking the lock button beside the page title to view this data.';

const BREAKDOWN_COLORS: Record<BreakdownPoint['tone'], string> = {
  t1: '#b83573',
  t2: '#f06f9b',
  t3: '#ef9aa8',
  t4: '#f3b6c3',
  t5: '#c98ab7',
  t6: '#9f5f97',
};

function toAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number) {
  return `P${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShareLabel(share: number) {
  const percentage = share * 100;
  if (percentage >= 10) return `${Math.round(percentage)}%`;
  if (percentage >= 1) return `${percentage.toFixed(1).replace(/\.0$/, '')}%`;
  return `${percentage.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
}

function describeRun(run: PayrollRunRow | null) {
  if (!run) return 'No payroll run selected';
  if (run.periodStart || run.periodEnd) {
    return `${formatDate(run.periodStart, '-')} to ${formatDate(run.periodEnd, '-')}`;
  }
  if (run.periodDescription?.trim()) return run.periodDescription.trim();
  return 'Payroll period unavailable';
}

function toSortStamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareRunsDescending(a: PayrollRunRow, b: PayrollRunRow) {
  const endDiff = toSortStamp(b.periodEnd) - toSortStamp(a.periodEnd);
  if (endDiff !== 0) return endDiff;

  const startDiff = toSortStamp(b.periodStart) - toSortStamp(a.periodStart);
  if (startDiff !== 0) return startDiff;

  return (b.payId ?? 0) - (a.payId ?? 0);
}

function getSummaryKind(row: PayTypeSummaryRow) {
  return row.summaryKind ?? row.adjustment ?? row.adjustmentKind;
}

function formatPayTypeLabel(row: PayTypeSummaryRow) {
  const value = row.payType;
  const key = String(value ?? '').trim().toUpperCase();
  const summaryKind = getSummaryKind(row);
  switch (key) {
    case 'BASIC':
      return 'Basic Pay';
    case 'BONUS':
      return 'Bonus';
    case 'SSS':
      return summaryKind === 'EMPLOYER_CONTRIBUTION' ? 'Employer SSS Contribution' : 'SSS Contribution';
    case 'PHILHEALTH':
      return summaryKind === 'EMPLOYER_CONTRIBUTION'
        ? 'Employer PhilHealth Contribution'
        : 'PhilHealth Contribution';
    case 'PAGIBIG':
      return summaryKind === 'EMPLOYER_CONTRIBUTION' ? 'Employer Pag-IBIG Contribution' : 'Pag-IBIG Contribution';
    case 'SSS_LOAN':
      return 'SSS Loan';
    case 'PAGIBIG_LOAN':
      return 'Pag-IBIG Loan';
    case 'MANUAL_ADJUSTMENT':
      return 'Manual Adjustment';
    case 'ABSENT_DEDUCTION':
      return 'Absent Deduction';
    case 'LATE_PENALTY':
      return 'Late Penalty';
    case 'CASH_ADVANCE':
      return 'Cash Advance';
    case 'BRACKET_LEVEL_ONE':
    case 'BRACKET_LEVEL_TWO':
    case 'BRACKET_LEVEL_THREE':
    case 'BRACKET_LEVEL_FOUR':
    case 'BRACKET_LEVEL_FIVE':
    case 'BRACKET_LEVEL_SIX':
      return 'Withholding Tax';
    default:
      return key
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Unknown pay type';
  }
}

function getDefaultRun(runs: PayrollRunRow[]) {
  return (
    runs.find((run) => run.payrollStatus === 'POSTED' && (run.itemCount ?? 0) > 0) ??
    runs.find((run) => (run.itemCount ?? 0) > 0) ??
    runs[0] ??
    null
  );
}

function buildDonutBackground(points: BreakdownPoint[]) {
  if (points.length === 0) return '';

  let cursor = 0;
  const segments = points.map((point) => {
    const start = cursor;
    cursor += point.share * 100;
    return `${BREAKDOWN_COLORS[point.tone]} ${start}% ${cursor}%`;
  });

  if (cursor < 100) {
    segments.push(`#eadff3 ${cursor}% 100%`);
  }

  return [
    `conic-gradient(${segments.join(', ')})`,
  ].join(', ');
}

export default function AccountingPayrollDashboard({
  showSensitiveAccessIndicator = false,
}: AccountingPayrollDashboardProps) {
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [selectedPayId, setSelectedPayId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<PayrollItemRow[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<PayTypeSummaryRow[]>([]);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const historyViewportRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [canScrollHistoryLeft, setCanScrollHistoryLeft] = useState(false);
  const [canScrollHistoryRight, setCanScrollHistoryRight] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<DashboardBreakdownState | null>(null);
  const silentRefreshRef = useRef(false);
  const sensitiveAccess = useSensitiveAccessPrompt({
    entryNotice: 'Enter your password to verify before viewing the payroll dashboard.',
  });
  const handleSensitiveAccessError = sensitiveAccess.handleProtectedError;
  useErrorDialogEffect(loadError, 'Payroll dashboard could not be loaded');
  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled: sensitiveAccess.isVerified && !sensitiveAccess.open,
  });

  useEffect(() => {
    if (!sensitiveAccess.isVerified) {
      setRuns([]);
      setSelectedPayId(null);
      setSelectedItems([]);
      setSelectedSummary([]);
      setHistoryPoints([]);
      setLoadError('');
      setIsLoading(false);
      silentRefreshRef.current = false;
      return;
    }

    let cancelled = false;

    async function loadRuns() {
      const isSilentRefresh = silentRefreshRef.current;
      if (!isSilentRefresh) {
        setIsLoading(true);
        setLoadError('');
      }

      try {
        const response = await apiFetchJson<unknown>('/api/payroll/run');
        if (cancelled) return;

        const nextRuns = [...toArray<PayrollRunRow>(response)].sort(compareRunsDescending);
        setRuns(nextRuns);
        setLoadError('');
        setSelectedPayId((currentPayId) => {
          if (currentPayId != null && nextRuns.some((run) => run.payId === currentPayId)) {
            return currentPayId;
          }

          const defaultRun = getDefaultRun(nextRuns);
          return typeof defaultRun?.payId === 'number' ? defaultRun.payId : null;
        });
      } catch (error) {
        if (cancelled) return;
        if (
          handleSensitiveAccessError(
            error,
            loadRuns,
            'Verify access before opening the payroll dashboard.'
          )
        ) {
          return;
        }
        if (!isSilentRefresh) {
          setRuns([]);
          setSelectedPayId(null);
          setSelectedItems([]);
          setSelectedSummary([]);
          setHistoryPoints([]);
          setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
          setIsLoading(false);
        } else {
          silentRefreshRef.current = false;
        }
      }
    }

    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, handleSensitiveAccessError, sensitiveAccess.isVerified]);

  useEffect(() => {
    if (!sensitiveAccess.isVerified || runs.length === 0 || selectedPayId == null) {
      setSelectedItems([]);
      setSelectedSummary([]);
      setHistoryPoints([]);
      setLoadError('');
      setIsLoading(false);
      silentRefreshRef.current = false;
      return;
    }

    let cancelled = false;

    async function loadDashboardData() {
      const isSilentRefresh = silentRefreshRef.current;
      if (!isSilentRefresh) {
        setIsLoading(true);
        setLoadError('');
      }

      try {
        const selectedItemsPromise = apiFetchJson<unknown>(
          `/api/payroll/run/${selectedPayId}/items?page=0&size=1000`
        );
        const selectedSummaryPromise = apiFetchJson<unknown>(`/api/payroll/run/summary/${selectedPayId}`);

        const recentRuns = runs
          .filter((run): run is PayrollRunRow & { payId: number } => typeof run.payId === 'number')
          .slice(0, 6)
          .reverse();

        const historyPromises = recentRuns.map(async (run) => {
          const response = await apiFetchJson<unknown>(`/api/payroll/run/${run.payId}/items?page=0&size=1000`);
          const rows = toArray<PayrollItemRow>(response);
          const grossTotal = rows.reduce((sum, row) => sum + toAmount(row.grossPay), 0);
          const employerContributionTotal = rows.reduce(
            (sum, row) => sum + toAmount(row.employerContributionTotal),
            0
          );
          return {
            payId: run.payId,
            label: describeRun(run),
            grossTotal,
            totalPayrollCost: grossTotal + employerContributionTotal,
          } as HistoryPoint;
        });

        const [itemsResponse, summaryResponse, nextHistoryPoints] = await Promise.all([
          selectedItemsPromise,
          selectedSummaryPromise,
          Promise.all(historyPromises),
        ]);

        if (cancelled) return;

        setSelectedItems(toArray<PayrollItemRow>(itemsResponse));
        setSelectedSummary(toArray<PayTypeSummaryRow>(summaryResponse));
        setHistoryPoints(nextHistoryPoints);
        setLoadError('');
      } catch (error) {
        if (cancelled) return;
        if (
          handleSensitiveAccessError(
            error,
            loadDashboardData,
            'Verify access before opening payroll dashboard details.'
          )
        ) {
          return;
        }
        if (!isSilentRefresh) {
          setSelectedItems([]);
          setSelectedSummary([]);
          setHistoryPoints([]);
          setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
        }
      } finally {
        if (!cancelled) {
          if (!isSilentRefresh) setIsLoading(false);
          silentRefreshRef.current = false;
        }
      }
    }

    void loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [runs, selectedPayId, handleSensitiveAccessError, sensitiveAccess.isVerified]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.payId === selectedPayId) ?? null,
    [runs, selectedPayId]
  );

  const finalNetPayout = useMemo(
    () => selectedItems.reduce((sum, row) => sum + toAmount(row.netPay), 0),
    [selectedItems]
  );

  const totalGrossWages = useMemo(
    () => selectedItems.reduce((sum, row) => sum + toAmount(row.grossPay), 0),
    [selectedItems]
  );

  const employerStatutoryCost = useMemo(
    () => selectedItems.reduce((sum, row) => sum + toAmount(row.employerContributionTotal), 0),
    [selectedItems]
  );

  const totalPayrollCost = useMemo(
    () => totalGrossWages + employerStatutoryCost,
    [employerStatutoryCost, totalGrossWages]
  );

  const breakdownPoints = useMemo<BreakdownPoint[]>(() => {
    const groupedRows = [...selectedSummary].reduce<Map<string, number>>((groups, row) => {
      if (getSummaryKind(row) === 'DEDUCTION') {
        return groups;
      }

      const label = formatPayTypeLabel(row);
      const total = toAmount(row.total);
      if (total <= 0) return groups;

      groups.set(label, (groups.get(label) ?? 0) + total);
      return groups;
    }, new Map());

    const rankedRows = [...groupedRows.entries()]
      .map(([label, total]) => ({ label, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 6);

    const total = rankedRows.reduce((sum, row) => sum + row.total, 0);
    if (total <= 0) return [];

    return rankedRows.map((row, index) => ({
      ...row,
      share: row.total / total,
      tone: (['t1', 't2', 't3', 't4', 't5', 't6'] as const)[index] ?? 't6',
    }));
  }, [selectedSummary]);

  const netPayoutRows = useMemo<DashboardBreakdownRow[]>(
    () =>
      selectedItems
        .map((row) => ({
          label: row.employeeName?.trim() || `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || `Employee #${row.empId ?? row.employeeId ?? '-'}`,
          value: toAmount(row.netPay),
          note: `Gross ${formatCurrency(toAmount(row.grossPay))}`,
        }))
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value),
    [selectedItems]
  );

  const grossWageRows = useMemo<DashboardBreakdownRow[]>(
    () =>
      selectedItems
        .map((row) => ({
          label: row.employeeName?.trim() || `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || `Employee #${row.empId ?? row.employeeId ?? '-'}`,
          value: toAmount(row.grossPay),
          note: `Net ${formatCurrency(toAmount(row.netPay))}`,
        }))
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value),
    [selectedItems]
  );

  const employerCostRows = useMemo<DashboardBreakdownRow[]>(
    () =>
      selectedSummary
        .filter((row) => getSummaryKind(row) === 'EMPLOYER_CONTRIBUTION')
        .map((row) => ({
          label: formatPayTypeLabel(row),
          value: toAmount(row.total),
        }))
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value),
    [selectedSummary]
  );

  const totalPayrollCostRows = useMemo<DashboardBreakdownRow[]>(
    () =>
      selectedItems
        .map((row) => ({
          label: row.employeeName?.trim() || `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || `Employee #${row.empId ?? row.employeeId ?? '-'}`,
          value: toAmount(row.grossPay) + toAmount(row.employerContributionTotal),
          note: `Gross ${formatCurrency(toAmount(row.grossPay))} + Employer cost ${formatCurrency(toAmount(row.employerContributionTotal))}`,
        }))
        .filter((row) => row.value > 0)
        .sort((left, right) => right.value - left.value),
    [selectedItems]
  );

  const historyScale = useMemo(
    () => Math.max(...historyPoints.flatMap((point) => [point.grossTotal, point.totalPayrollCost]), 0),
    [historyPoints]
  );

  const donutBackground = useMemo(() => buildDonutBackground(breakdownPoints), [breakdownPoints]);

  const syncHistoryScrollButtons = useCallback(() => {
    const viewport = historyViewportRef.current;
    if (!viewport) {
      setCanScrollHistoryLeft(false);
      setCanScrollHistoryRight(false);
      return;
    }

    const maxScrollLeft = Math.max(viewport.scrollWidth - viewport.clientWidth, 0);
    setCanScrollHistoryLeft(viewport.scrollLeft > 4);
    setCanScrollHistoryRight(maxScrollLeft - viewport.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const viewport = historyViewportRef.current;
    if (!viewport) {
      setCanScrollHistoryLeft(false);
      setCanScrollHistoryRight(false);
      return;
    }

    const syncButtons = () => syncHistoryScrollButtons();
    const frame = window.requestAnimationFrame(syncButtons);
    viewport.addEventListener('scroll', syncButtons, { passive: true });
    window.addEventListener('resize', syncButtons);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', syncButtons);
      window.removeEventListener('resize', syncButtons);
    };
  }, [historyPoints, syncHistoryScrollButtons]);

  const scrollHistory = useCallback((direction: 'left' | 'right') => {
    const viewport = historyViewportRef.current;
    if (!viewport) return;

    const distance = Math.max(viewport.clientWidth * 0.8, 260);
    viewport.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  }, []);

  const openBreakdown = useCallback(
    (kind: 'net' | 'gross' | 'employer' | 'total') => {
      if (!selectedRun) return;

      if (kind === 'net') {
        setSelectedBreakdown({
          title: 'Final Net Payout Breakdown',
          subtitle: `${describeRun(selectedRun)} by employee net pay.`,
          totalLabel: 'Final Net Payout',
          totalValue: finalNetPayout,
          rows: netPayoutRows,
        });
        return;
      }

      if (kind === 'gross') {
        setSelectedBreakdown({
          title: 'Total Gross Wages Breakdown',
          subtitle: `${describeRun(selectedRun)} by employee gross pay.`,
          totalLabel: 'Total Gross Wages',
          totalValue: totalGrossWages,
          rows: grossWageRows,
        });
        return;
      }

      if (kind === 'employer') {
        setSelectedBreakdown({
          title: 'Employer Statutory Cost Breakdown',
          subtitle: `${describeRun(selectedRun)} by employer contribution type.`,
          totalLabel: 'Employer Statutory Cost',
          totalValue: employerStatutoryCost,
          rows: employerCostRows,
        });
        return;
      }

      setSelectedBreakdown({
        title: 'Total Payroll Cost Breakdown',
        subtitle: `${describeRun(selectedRun)} by employee payroll cost.`,
        totalLabel: 'Total Payroll Cost',
        totalValue: totalPayrollCost,
        rows: totalPayrollCostRows,
      });
    },
    [
      employerCostRows,
      employerStatutoryCost,
      finalNetPayout,
      grossWageRows,
      netPayoutRows,
      selectedRun,
      totalGrossWages,
      totalPayrollCost,
      totalPayrollCostRows,
    ]
  );

  return (
    <section className="aDashPay">
      <div className="aDashPay__top">
        <PageHeader
          title="Overall Payroll Costs"
          description="Compare payroll cost trends, pay-type breakdowns, and the current run at a glance."
          titleMeta={showSensitiveAccessIndicator || !sensitiveAccess.isVerified ? (
            <SensitiveAccessIndicator
              onActivate={() =>
                sensitiveAccess.requestVerification(
                  async () => Promise.resolve(),
                  'Enter your password to unlock payroll dashboard access.'
                )
              }
            />
          ) : null}
        />

        <div className="aDashPay__controls">
          <div className="aDashPaySelectField">
            <label htmlFor="aDashPayRunSelect">Payroll run from:</label>
            <div className="aDashPaySelect">
              <select
                id="aDashPayRunSelect"
                value={selectedPayId ?? ''}
                onChange={(event) => setSelectedPayId(event.target.value ? Number(event.target.value) : null)}
                aria-label="Payroll run"
                disabled={runs.length === 0}
              >
                {runs.length > 0 ? (
                  runs.map((run) => (
                    <option key={run.payId ?? `run-${run.periodEnd}`} value={run.payId}>
                      {describeRun(run)}
                    </option>
                  ))
                ) : (
                  <option value="">No payroll runs yet</option>
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      <section className="aDashPaySummaryGrid">
        <button type="button" className="aDashPaySummaryCard aDashPaySummaryCard--button" onClick={() => openBreakdown('net')} disabled={!selectedRun}>
          <h3>Final Net Payout</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(finalNetPayout)}</div>
          <p>{selectedRun ? `${describeRun(selectedRun)} payout` : 'No payroll run selected yet'}</p>
        </button>

        <button type="button" className="aDashPaySummaryCard aDashPaySummaryCard--button" onClick={() => openBreakdown('gross')} disabled={!selectedRun}>
          <h3>Total Gross Wages</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(totalGrossWages)}</div>
          <p>{selectedItems.length} employee record{selectedItems.length === 1 ? '' : 's'} included in this run.</p>
        </button>

        <button type="button" className="aDashPaySummaryCard aDashPaySummaryCard--button" onClick={() => openBreakdown('employer')} disabled={!selectedRun}>
          <h3>Employer Statutory Cost</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(employerStatutoryCost)}</div>
          <p>Employer SSS, PhilHealth, and Pag-IBIG costs captured in this run.</p>
        </button>

        <button type="button" className="aDashPaySummaryCard aDashPaySummaryCard--button" onClick={() => openBreakdown('total')} disabled={!selectedRun}>
          <h3>Total Payroll Cost</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(totalPayrollCost)}</div>
          <p>Gross wages plus employer statutory contributions for the selected run.</p>
        </button>
      </section>

      <section className="aDashPayChartsGrid">
        <article className="aDashPayPanel aDashPayPanel--history">
          <header className="aDashPayPanel__head aDashPayPanel__head--history">
            <span>Latest Payroll Runs</span>
            <div className="aDashPayHistoryNav" aria-label="Payroll history navigation">
              <button
                type="button"
                className="aDashPayHistoryNav__button"
                onClick={() => scrollHistory('left')}
                aria-label="Scroll to earlier payroll runs"
                disabled={!canScrollHistoryLeft}
              >
                <FiChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                className="aDashPayHistoryNav__button"
                onClick={() => scrollHistory('right')}
                aria-label="Scroll to later payroll runs"
                disabled={!canScrollHistoryRight}
              >
                <FiChevronRight aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="aDashPayHistoryViewport" ref={historyViewportRef}>
            <div className="aDashPayHistory">
              {historyPoints.length > 0 ? (
                historyPoints.map((item) => (
                  <button
                    type="button"
                    key={item.payId}
                    className={`aDashPayHistoryCard aDashPayHistoryCard--button ${item.payId === selectedPayId ? 'is-selected' : ''}`}
                    onClick={() => setSelectedPayId(item.payId)}
                  >
                    <div className="aDashPayHistoryCard__period">
                      <strong>{item.label}</strong>
                    </div>

                    <div className="aDashPayHistoryCard__bars" aria-label={`Gross wages and total payroll cost for ${item.label}`}>
                      <div className="aDashPayHistoryMetric">
                        <strong className="aDashPayHistoryMetric__value">{formatCurrency(item.grossTotal)}</strong>
                        <div className="aDashPayHistoryMetric__plot">
                          <div
                            className="aDashPayHistoryMetric__bar aDashPayHistoryMetric__bar--gross"
                            style={{
                              height:
                                historyScale > 0
                                  ? `${Math.max((item.grossTotal / historyScale) * 100, item.grossTotal > 0 ? 12 : 0)}%`
                                  : '0%',
                            }}
                            title={`Gross pay: ${formatCurrency(item.grossTotal)}`}
                          />
                        </div>
                        <span className="aDashPayHistoryMetric__label">Gross Wages</span>
                      </div>

                      <div className="aDashPayHistoryMetric">
                        <strong className="aDashPayHistoryMetric__value">{formatCurrency(item.totalPayrollCost)}</strong>
                        <div className="aDashPayHistoryMetric__plot">
                          <div
                            className="aDashPayHistoryMetric__bar aDashPayHistoryMetric__bar--cost"
                            style={{
                              height:
                                historyScale > 0
                                  ? `${Math.max((item.totalPayrollCost / historyScale) * 100, item.totalPayrollCost > 0 ? 12 : 0)}%`
                                  : '0%',
                            }}
                            title={`Total payroll cost: ${formatCurrency(item.totalPayrollCost)}`}
                          />
                        </div>
                        <span className="aDashPayHistoryMetric__label">Total Payroll Cost</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="aDashPayHistory__empty">
                  {isLoading
                    ? 'Loading payroll history...'
                    : !sensitiveAccess.isVerified
                      ? LOCKED_PAGE_MESSAGE
                      : 'No payroll totals are available yet.'}
                </div>
              )}
            </div>
          </div>
        </article>

        <article className="aDashPayPanel">
          <header className="aDashPayPanel__head">Selected Run Cost Breakdown by Pay Type</header>
          <div className="aDashPayDonutBlock">
            <div
              className={`aDashPayDonut${breakdownPoints.length === 0 ? ' aDashPayDonut--empty' : ''}`}
              aria-label={
                breakdownPoints.length > 0
                  ? 'Pay type cost breakdown chart'
                  : 'No pay type breakdown data available'
              }
              role="img"
              style={donutBackground ? { background: donutBackground } : undefined}
            />
            <div className="aDashPayLegend">
              {breakdownPoints.length > 0 ? (
                breakdownPoints.map((item) => (
                  <div key={item.label} className="aDashPayLegend__item">
                    <i className={item.tone} />
                    <div className="aDashPayLegend__content">
                      <div className="aDashPayLegend__head">
                        <span className="aDashPayLegend__label">{item.label}</span>
                        <span className="aDashPayLegend__share">{formatShareLabel(item.share)}</span>
                      </div>
                      <span className="aDashPayLegend__value">{formatCurrency(item.total)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="aDashPayLegend__empty">
                  {isLoading
                    ? 'Loading pay type totals...'
                    : !sensitiveAccess.isVerified
                      ? LOCKED_PAGE_MESSAGE
                      : 'No pay type totals are available for this run yet.'}
                </div>
              )}
            </div>
          </div>
        </article>
      </section>

      <SensitiveAccessModal
        open={sensitiveAccess.open}
        onClose={sensitiveAccess.close}
        onVerified={sensitiveAccess.handleVerified}
        notice={sensitiveAccess.notice}
      />

      {selectedBreakdown ? (
        <LargePopup
          open
          ariaLabel="Payroll dashboard breakdown"
          title={selectedBreakdown.title}
          subtitle={selectedBreakdown.subtitle}
          size="lg"
          onClose={() => setSelectedBreakdown(null)}
          dismissOnBackdrop
          className="aDashPayPopup"
          footer={
            <button type="button" className="btn" onClick={() => setSelectedBreakdown(null)}>
              Close
            </button>
          }
        >
          <div className="aDashPayBreakdown">
            <div className="aDashPayBreakdown__totalCard">
              <span>{selectedBreakdown.totalLabel}</span>
              <strong>{formatCurrency(selectedBreakdown.totalValue)}</strong>
            </div>

            {selectedBreakdown.rows.length > 0 ? (
              <div className="aDashPayBreakdown__list" role="list">
                {selectedBreakdown.rows.map((row) => (
                  <article key={`${selectedBreakdown.title}-${row.label}`} className="aDashPayBreakdown__row" role="listitem">
                    <div className="aDashPayBreakdown__rowCopy">
                      <strong>{row.label}</strong>
                      {row.note ? <span>{row.note}</span> : null}
                    </div>
                    <div className="aDashPayBreakdown__rowValue">{formatCurrency(row.value)}</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="aDashPayBreakdown__empty">No breakdown data is available for this selection yet.</div>
            )}
          </div>
        </LargePopup>
      ) : null}
    </section>
  );
}
