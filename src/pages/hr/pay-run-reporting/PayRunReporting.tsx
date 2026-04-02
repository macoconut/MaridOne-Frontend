import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './PayRunReporting.css';

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

type AdjustmentKind = 'EARNING' | 'DEDUCTION';

type PayTypeSummaryRow = {
  payType?: string;
  adjustment?: AdjustmentKind;
  adjustmentKind?: AdjustmentKind;
  total?: number | string;
};

function formatCurrency(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
  }
  return '0.00';
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

function formatEmployeeName(row: PayrollItemRow) {
  const fullName = [row.firstName, row.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');

  if (fullName) return fullName;
  if (typeof row.empId === 'number') return `Employee ID ${row.empId}`;
  return 'Unnamed employee';
}

function formatSummaryLabel(value?: string) {
  const key = String(value ?? '').trim();
  if (!key) return 'Unknown line item';
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

function getEmptyRunMessage(run: PayrollRunRow | null, view: ReportView) {
  if (!run) {
    return view === 'employee'
      ? 'No employee totals matched this payroll run.'
      : 'No pay type totals matched this payroll run.';
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

export default function HrPayRunReporting() {
  const [view, setView] = useState<ReportView>('employee');
  const [filterValue, setFilterValue] = useState('');
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [selectedPayId, setSelectedPayId] = useState<number | null>(null);
  const [employeeRows, setEmployeeRows] = useState<PayrollItemRow[]>([]);
  const [payTypeRows, setPayTypeRows] = useState<PayTypeSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const filterLabel = useMemo(() => (view === 'employee' ? 'Employee:' : 'Category:'), [view]);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setIsLoading(true);
      setLoadError('');

      try {
        const runResponse = await apiFetchJson<unknown>('/api/payroll/run');
        if (cancelled) return;

        const nextRuns = toArray<PayrollRunRow>(runResponse);
        setRuns(nextRuns);

        const selectedExists = nextRuns.some((run) => run.payId === selectedPayId);
        const defaultRun = nextRuns.find((run) => (run.itemCount ?? 0) > 0) ?? nextRuns[0] ?? null;
        const nextPayId =
          selectedExists && selectedPayId != null
            ? selectedPayId
            : typeof defaultRun?.payId === 'number'
              ? defaultRun.payId
              : null;

        setSelectedPayId(nextPayId);
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
  }, [refreshTick, selectedPayId]);

  useEffect(() => {
    if (selectedPayId == null) {
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
          apiFetchJson<unknown>(`/api/payroll/run/${selectedPayId}/items?page=0&size=200`),
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
  }, [refreshTick, selectedPayId]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.payId === selectedPayId) ?? null,
    [runs, selectedPayId]
  );

  const normalizedFilter = filterValue.trim().toLowerCase();

  const visibleEmployeeRows = useMemo(() => {
    if (!normalizedFilter || normalizedFilter === 'all') return employeeRows;

    return employeeRows.filter((row) => {
      const name = formatEmployeeName(row).toLowerCase();
      const employeeId = typeof row.empId === 'number' ? String(row.empId) : '';
      return name.includes(normalizedFilter) || employeeId.includes(normalizedFilter);
    });
  }, [employeeRows, normalizedFilter]);

  const visiblePayTypeRows = useMemo(() => {
    if (!normalizedFilter || normalizedFilter === 'all') return payTypeRows;

    return payTypeRows.filter((row) => {
      const payType = String(row.payType ?? '').toLowerCase();
      const kind = String(getSummaryAdjustmentKind(row) ?? '').toLowerCase();
      return payType.includes(normalizedFilter) || kind.includes(normalizedFilter);
    });
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

  return (
    <div className="hrRun">
      <div className="hrRun__top">
        <h1>Pay Run Reporting</h1>
        <select value={view} onChange={(e) => setView(e.target.value as ReportView)} aria-label="Report view">
          <option value="employee">By Employee</option>
          <option value="payType">By Earnings / Deductions</option>
        </select>
      </div>

      <div className="hrRunFilters">
        <div className="hrRunFilters__field hrRunFilters__field--search">
          <label>{filterLabel}</label>
          <div className="hrRunFilters__searchWrap">
            <FiSearch />
            <input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder={view === 'employee' ? 'Search by employee name or ID' : 'Search by earnings or deductions type'}
            />
            <button type="button" aria-label="Clear filter" onClick={() => setFilterValue('')}>
              <FiXCircle />
            </button>
          </div>
        </div>

        <div className="hrRunFilters__field">
          <label>From:</label>
          <select
            aria-label="From date"
            value={selectedPayId ?? ''}
            onChange={(e) => setSelectedPayId(e.target.value ? Number(e.target.value) : null)}
            disabled={runs.length === 0}
          >
            {runs.length > 0 ? (
              runs.map((run) => (
                <option key={`from-${run.payId}`} value={run.payId}>
                  {formatDate(run.periodStart)}
                </option>
              ))
            ) : (
              <option value="">No payroll runs yet</option>
            )}
          </select>
        </div>

        <div className="hrRunFilters__field">
          <label>To:</label>
          <select
            aria-label="To date"
            value={selectedPayId ?? ''}
            onChange={(e) => setSelectedPayId(e.target.value ? Number(e.target.value) : null)}
            disabled={runs.length === 0}
          >
            {runs.length > 0 ? (
              runs.map((run) => (
                <option key={`to-${run.payId}`} value={run.payId}>
                  {formatDate(run.periodEnd)}
                </option>
              ))
            ) : (
              <option value="">No payroll runs yet</option>
            )}
          </select>
        </div>

        <button
          className="hrRunFilters__refresh"
          type="button"
          aria-label="Refresh"
          onClick={() => setRefreshTick((tick) => tick + 1)}
        >
          <FiRefreshCw />
        </button>
      </div>

      {selectedRun && (
        <p className="hrRun__status">
          {selectedRun.periodDescription || `${formatDate(selectedRun.periodStart)} to ${formatDate(selectedRun.periodEnd)}`} •{' '}
          {selectedRun.payrollStatus || 'Unknown status'} • {selectedRun.itemCount ?? 0} item
          {(selectedRun.itemCount ?? 0) === 1 ? '' : 's'}
        </p>
      )}
      {loadError && <p className="hrRun__status hrRun__status--error">{loadError}</p>}

      {view === 'employee' ? (
        <section className="hrRunTable" aria-label="Pay run by employee">
          <div className="hrRunTable__head">
            <span>Employee Name</span>
            <span>Total</span>
          </div>

          <div className="hrRunTable__body">
            {!isLoading && visibleEmployeeRows.length > 0 ? (
              visibleEmployeeRows.map((row, index) => (
                <article key={`${row.itemId ?? row.empId ?? index}`} className="hrRunEmployee">
                  <div className="hrRunEmployee__name">{formatEmployeeName(row)}</div>
                  <div className="hrRunEmployee__sub">
                    NET PAY • GROSS {formatCurrency(row.grossPay)}
                    {typeof row.itemId === 'number' ? ` • ITEM #${row.itemId}` : ''}
                  </div>
                  <div className="hrRunEmployee__value">{formatCurrency(row.netPay)}</div>
                </article>
              ))
            ) : (
              <article className="hrRunEmpty">
                {isLoading ? 'Loading pay run details...' : getEmptyRunMessage(selectedRun, 'employee')}
              </article>
            )}
          </div>
        </section>
      ) : (
        <section className="hrRunTable" aria-label="Pay run earnings and deductions">
          <div className="hrRunTable__head">
            <span>Earnings and Deductions</span>
            <span>Total</span>
          </div>

          <div className="hrRunTable__body hrRunTable__body--split">
            {!isLoading && (visibleEarningRows.length > 0 || visibleDeductionRows.length > 0) ? (
              <>
                <section className="hrRunGroup" aria-label="Earnings summary">
                  <div className="hrRunGroup__head">
                    <span>EARNINGS</span>
                    <span>{formatCurrency(earningsTotal)}</span>
                  </div>
                  {visibleEarningRows.length > 0 ? (
                    visibleEarningRows.map((row, index) => (
                      <article key={`earning-${row.payType ?? index}`} className="hrRunTypeRow">
                        <div>{formatSummaryLabel(row.payType)}</div>
                        <div>{formatCurrency(row.total)}</div>
                      </article>
                    ))
                  ) : (
                    <article className="hrRunEmpty hrRunEmpty--group">No earnings matched this payroll run.</article>
                  )}
                </section>

                <section className="hrRunGroup" aria-label="Deductions summary">
                  <div className="hrRunGroup__head">
                    <span>DEDUCTIONS</span>
                    <span>{formatCurrency(deductionsTotal)}</span>
                  </div>
                  {visibleDeductionRows.length > 0 ? (
                    visibleDeductionRows.map((row, index) => (
                      <article key={`deduction-${row.payType ?? index}`} className="hrRunTypeRow">
                        <div>{formatSummaryLabel(row.payType)}</div>
                        <div>{formatCurrency(row.total)}</div>
                      </article>
                    ))
                  ) : (
                    <article className="hrRunEmpty hrRunEmpty--group">No deductions matched this payroll run.</article>
                  )}
                </section>
              </>
            ) : (
              <article className="hrRunEmpty">
                {isLoading ? 'Loading pay type totals...' : getEmptyRunMessage(selectedRun, 'payType')}
              </article>
            )}
          </div>
        </section>
      )}

      <div className="hrRunActions">
        <button type="button" onClick={() => window.print()}>
          Download Report
        </button>
        <button type="button" onClick={() => window.print()}>
          Print Report
        </button>
      </div>
    </div>
  );
}
