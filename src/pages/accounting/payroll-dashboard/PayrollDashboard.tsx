import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/layout/PageHeader';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { useRegisterPageRefresh } from '../../../lib/pageRefresh';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './PayrollDashboard.css';

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

type PayTypeSummaryRow = {
  payType?: string;
  total?: number | string;
};

type HistoryPoint = {
  label: string;
  total: number;
  tone: 'light' | 'dark';
};

type BreakdownPoint = {
  label: string;
  total: number;
  share: number;
  tone: 't1' | 't2' | 't3' | 't4';
};

const BREAKDOWN_COLORS: Record<BreakdownPoint['tone'], string> = {
  t1: '#b83573',
  t2: '#f06f9b',
  t3: '#ef9aa8',
  t4: '#f3b6c3',
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

function formatShortMonth(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short' });
}

function describeRun(run: PayrollRunRow | null) {
  if (!run) return 'No payroll run selected';
  if (run.periodDescription?.trim()) return run.periodDescription.trim();
  return `${formatDate(run.periodStart)} - ${formatDate(run.periodEnd)}`;
}

function formatPayTypeLabel(value?: string) {
  const key = String(value ?? '').trim().toUpperCase();
  switch (key) {
    case 'BASIC':
      return 'Basic Pay';
    case 'SSS':
      return 'SSS Contribution';
    case 'PHILHEALTH':
      return 'PhilHealth Contribution';
    case 'PAGIBIG':
      return 'Pag-IBIG Contribution';
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

function isContributionType(value?: string) {
  const key = String(value ?? '').trim().toUpperCase();
  return key === 'SSS' || key === 'PHILHEALTH' || key === 'PAGIBIG';
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

export default function AccountingPayrollDashboard() {
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [selectedPayId, setSelectedPayId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<PayrollItemRow[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<PayTypeSummaryRow[]>([]);
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  useErrorDialogEffect(loadError, 'Payroll dashboard could not be loaded');
  const handlePageRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useRegisterPageRefresh(handlePageRefresh);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await apiFetchJson<unknown>('/api/payroll/run');
        if (cancelled) return;

        const nextRuns = toArray<PayrollRunRow>(response);
        setRuns(nextRuns);
        setSelectedPayId((currentPayId) => {
          if (currentPayId != null && nextRuns.some((run) => run.payId === currentPayId)) {
            return currentPayId;
          }

          const defaultRun = getDefaultRun(nextRuns);
          return typeof defaultRun?.payId === 'number' ? defaultRun.payId : null;
        });
      } catch (error) {
        if (cancelled) return;
        setRuns([]);
        setSelectedPayId(null);
        setSelectedItems([]);
        setSelectedSummary([]);
        setHistoryPoints([]);
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
    if (runs.length === 0 || selectedPayId == null) {
      setSelectedItems([]);
      setSelectedSummary([]);
      setHistoryPoints([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDashboardData() {
      setIsLoading(true);
      setLoadError('');

      try {
        const selectedItemsPromise = apiFetchJson<unknown>(
          `/api/payroll/run/${selectedPayId}/items?page=0&size=1000`
        );
        const selectedSummaryPromise = apiFetchJson<unknown>(`/api/payroll/run/summary/${selectedPayId}`);

        const recentRuns = runs
          .filter((run): run is PayrollRunRow & { payId: number } => typeof run.payId === 'number')
          .slice(0, 6);

        const historyPromises = recentRuns.map(async (run, index) => {
          const response = await apiFetchJson<unknown>(`/api/payroll/run/${run.payId}/items?page=0&size=1000`);
          const rows = toArray<PayrollItemRow>(response);
          const grossTotal = rows.reduce((sum, row) => sum + toAmount(row.grossPay), 0);
          return {
            label: formatShortMonth(run.periodEnd ?? run.periodStart),
            total: grossTotal,
            tone: (index + 1) % 2 === 0 ? 'light' : 'dark',
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
      } catch (error) {
        if (cancelled) return;
        setSelectedItems([]);
        setSelectedSummary([]);
        setHistoryPoints([]);
        setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [runs, selectedPayId]);

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

  const contributionDeductions = useMemo(
    () =>
      selectedSummary.reduce(
        (sum, row) => (isContributionType(row.payType) ? sum + toAmount(row.total) : sum),
        0
      ),
    [selectedSummary]
  );

  const breakdownPoints = useMemo<BreakdownPoint[]>(() => {
    const rankedRows = [...selectedSummary]
      .map((row) => ({
        label: formatPayTypeLabel(row.payType),
        total: toAmount(row.total),
      }))
      .filter((row) => row.total > 0)
      .sort((left, right) => right.total - left.total)
      .slice(0, 4);

    const total = rankedRows.reduce((sum, row) => sum + row.total, 0);
    if (total <= 0) return [];

    return rankedRows.map((row, index) => ({
      ...row,
      share: row.total / total,
      tone: (['t1', 't2', 't3', 't4'] as const)[index] ?? 't4',
    }));
  }, [selectedSummary]);

  const historyScale = useMemo(
    () => Math.max(...historyPoints.map((point) => point.total), 0),
    [historyPoints]
  );

  const donutBackground = useMemo(() => buildDonutBackground(breakdownPoints), [breakdownPoints]);
  const donutLabels = useMemo(() => {
    let cursor = 0;

    return breakdownPoints.map((point) => {
      const sweep = point.share * 360;
      const midpoint = cursor + sweep / 2;
      cursor += sweep;

      const radians = ((midpoint - 90) * Math.PI) / 180;
      const radius = point.share < 0.12 ? 34 : 28;

      return {
        ...point,
        percentLabel: `${Math.round(point.share * 100)}%`,
        style: {
          left: `calc(50% + ${Math.cos(radians) * radius}%)`,
          top: `calc(50% + ${Math.sin(radians) * radius}%)`,
        },
      };
    });
  }, [breakdownPoints]);

  return (
    <section className="aDashPay">
      <div className="aDashPay__top">
        <PageHeader
          title="Overall Payroll Costs"
          description="Compare payroll cost trends, pay-type breakdowns, and the current run at a glance."
        />

        <div className="aDashPay__controls">
          <select
            className="aDashPay__dateSelect"
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

        <button className="aDashPay__exportBtn" type="button" onClick={() => window.print()}>
          Export Payroll
          <br />
          Analytics
        </button>
      </div>

      <p className={`aDashPay__status${loadError ? ' is-error' : ''}`}>
        {loadError
          ? loadError
          : selectedRun
            ? `${describeRun(selectedRun)} • ${selectedRun.payrollStatus ?? 'Unknown status'} • ${selectedRun.itemCount ?? 0} payroll item${
                (selectedRun.itemCount ?? 0) === 1 ? '' : 's'
              }`
            : 'Select a payroll run to review its totals.'}
      </p>

      <section className="aDashPaySummaryGrid">
        <article className="aDashPaySummaryCard">
          <h3>Final Net Payout</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(finalNetPayout)}</div>
          <p>{selectedRun ? `${formatDate(selectedRun.periodStart)} - ${formatDate(selectedRun.periodEnd)} payout` : 'No payroll run selected yet'}</p>
        </article>

        <article className="aDashPaySummaryCard">
          <h3>Contribution Deductions</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(contributionDeductions)}</div>
          <p>SSS, PhilHealth, and Pag-IBIG deductions captured in this run.</p>
        </article>

        <article className="aDashPaySummaryCard">
          <h3>Total Gross Wages</h3>
          <div className="aDashPaySummaryCard__value">{formatCurrency(totalGrossWages)}</div>
          <p>{selectedItems.length} employee record{selectedItems.length === 1 ? '' : 's'} included in this run.</p>
        </article>
      </section>

      <section className="aDashPayChartsGrid">
        <article className="aDashPayPanel">
          <header className="aDashPayPanel__head">Latest 6 Payroll Runs by Gross Wages</header>
          <div className="aDashPayHistory">
            {historyPoints.length > 0 ? (
              historyPoints.map((item) => (
                <div key={`${item.label}-${item.total}`} className="aDashPayHistory__barWrap">
                  <div
                    className={`aDashPayHistory__bar aDashPayHistory__bar--${item.tone}`}
                    style={{
                      height:
                        historyScale > 0
                          ? `${Math.max((item.total / historyScale) * 100, item.total > 0 ? 10 : 0)}%`
                          : '0%',
                    }}
                    title={`${item.label}: ${formatCurrency(item.total)}`}
                  />
                  <strong>{formatCurrency(item.total)}</strong>
                  <span>{item.label}</span>
                </div>
              ))
            ) : (
              <div className="aDashPayHistory__empty">
                {isLoading ? 'Loading payroll history...' : 'No payroll totals are available yet.'}
              </div>
            )}
          </div>
        </article>

        <article className="aDashPayPanel">
          <header className="aDashPayPanel__head">Selected Run Cost Breakdown by Pay Type</header>
          <div className="aDashPayDonutBlock">
            <div className="aDashPayLegend">
              {breakdownPoints.length > 0 ? (
                breakdownPoints.map((item) => (
                  <div key={item.label} className="aDashPayLegend__item">
                    <i className={item.tone} />
                    <span>
                      {item.label} • {formatCurrency(item.total)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="aDashPayLegend__empty">
                  {isLoading ? 'Loading pay type totals...' : 'No pay type totals are available for this run yet.'}
                </div>
              )}
            </div>
            <div
              className={`aDashPayDonut${breakdownPoints.length === 0 ? ' aDashPayDonut--empty' : ''}`}
              aria-label={
                breakdownPoints.length > 0
                  ? 'Pay type cost breakdown with percentage labels for each segment'
                  : 'No pay type breakdown data available'
              }
              role="img"
              style={donutBackground ? { background: donutBackground } : undefined}
            >
              {donutLabels.map((item) => (
                <div
                  key={`${item.label}-${item.percentLabel}`}
                  className={`aDashPayDonut__label aDashPayDonut__label--${item.tone}`}
                  style={item.style}
                >
                  {item.percentLabel}
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
