import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSearch, FiXCircle } from 'react-icons/fi';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './PayrollReview.css';

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

function toAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function describeRun(run: PayrollRunRow | null) {
  if (!run) return 'No payroll run selected';
  if (run.periodDescription?.trim()) return run.periodDescription.trim();
  return `${formatDate(run.periodStart)} - ${formatDate(run.periodEnd)}`;
}

function getDefaultRun(runs: PayrollRunRow[]) {
  return (
    runs.find((run) => run.payrollStatus === 'POSTED' && (run.itemCount ?? 0) > 0) ??
    runs.find((run) => (run.itemCount ?? 0) > 0) ??
    runs[0] ??
    null
  );
}

export default function AccountingPayrollReview() {
  const [filterValue, setFilterValue] = useState('');
  const [runs, setRuns] = useState<PayrollRunRow[]>([]);
  const [selectedPayId, setSelectedPayId] = useState<number | null>(null);
  const [rows, setRows] = useState<PayrollItemRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<PayrollItemRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

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
        setRows([]);
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
    if (selectedPayId == null) {
      setRows([]);
      setSelectedRow(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRows() {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await apiFetchJson<unknown>(`/api/payroll/run/${selectedPayId}/items?page=0&size=1000`);
        if (cancelled) return;
        setRows(toArray<PayrollItemRow>(response));
      } catch (error) {
        if (cancelled) return;
        setRows([]);
        setSelectedRow(null);
        setLoadError(getFriendlyErrorMessage(error, 'payroll-run'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [selectedPayId]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.payId === selectedPayId) ?? null,
    [runs, selectedPayId]
  );

  const normalizedFilter = filterValue.trim().toLowerCase();

  const visibleRows = useMemo(() => {
    if (!normalizedFilter || normalizedFilter === 'all') return rows;

    return rows.filter((row) => {
      const name = formatEmployeeName(row).toLowerCase();
      const employeeId = typeof row.empId === 'number' ? String(row.empId) : '';
      const itemId = typeof row.itemId === 'number' ? String(row.itemId) : '';
      return (
        name.includes(normalizedFilter) ||
        employeeId.includes(normalizedFilter) ||
        itemId.includes(normalizedFilter)
      );
    });
  }, [normalizedFilter, rows]);

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (summary, row) => {
          const gross = toAmount(row.grossPay);
          const net = toAmount(row.netPay);
          const deductions = Math.max(gross - net, 0);

          return {
            gross: summary.gross + gross,
            deductions: summary.deductions + deductions,
            net: summary.net + net,
          };
        },
        { gross: 0, deductions: 0, net: 0 }
      ),
    [visibleRows]
  );

  const selectedRowDeductions = selectedRow
    ? Math.max(toAmount(selectedRow.grossPay) - toAmount(selectedRow.netPay), 0)
    : 0;

  return (
    <section className="aReviewPay">
      <h1>Review Employees&apos; Payslips</h1>

      <div className="aReviewPay__filters">
        <div className="aReviewPay__field">
          <label>Employee:</label>
          <div className="aReviewPay__search">
            <FiSearch />
            <input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="Search by employee name, employee ID, or item ID"
            />
            <button type="button" aria-label="Clear" onClick={() => setFilterValue('')}>
              <FiXCircle />
            </button>
          </div>
        </div>

        <div className="aReviewPay__field">
          <label>Payout Period:</label>
          <select
            aria-label="Payout period"
            value={selectedPayId ?? ''}
            onChange={(event) => setSelectedPayId(event.target.value ? Number(event.target.value) : null)}
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

        <button
          type="button"
          className="aReviewPay__refresh"
          aria-label="Refresh"
          onClick={() => setRefreshTick((tick) => tick + 1)}
        >
          <FiRefreshCw />
        </button>
      </div>

      <p className={`aReviewPay__status${loadError ? ' is-error' : ''}`}>
        {loadError
          ? loadError
          : selectedRun
            ? `${describeRun(selectedRun)} • ${selectedRun.payrollStatus ?? 'Unknown status'} • ${selectedRun.itemCount ?? 0} payroll item${
                (selectedRun.itemCount ?? 0) === 1 ? '' : 's'
              }`
            : 'Select a payroll run to review its payslips.'}
      </p>

      <section className="aReviewPayTable">
        <div className="aReviewPayTable__head">
          <span>Employee Name</span>
          <span>Gross Pay</span>
          <span>Total Deductions</span>
          <span>Net Pay</span>
          <span>Payroll Item</span>
          <span>Action</span>
        </div>

        <div className="aReviewPayTable__body">
          {!isLoading && visibleRows.length > 0 ? (
            <>
              {visibleRows.map((row) => {
                const gross = toAmount(row.grossPay);
                const net = toAmount(row.netPay);
                const deductions = Math.max(gross - net, 0);

                return (
                  <article key={row.itemId ?? row.empId ?? formatEmployeeName(row)} className="aReviewPayRow">
                    <span className="is-name">{formatEmployeeName(row)}</span>
                    <span>{formatCurrency(gross)}</span>
                    <span>{formatCurrency(deductions)}</span>
                    <span className="is-net">{formatCurrency(net)}</span>
                    <span>{typeof row.itemId === 'number' ? `#${row.itemId}` : '-'}</span>
                    <button type="button" onClick={() => setSelectedRow(row)}>
                      View Summary
                    </button>
                  </article>
                );
              })}

              <article className="aReviewPayRow aReviewPayRow--total">
                <span className="is-name">TOTAL</span>
                <span>{formatCurrency(totals.gross)}</span>
                <span>{formatCurrency(totals.deductions)}</span>
                <span className="is-net">{formatCurrency(totals.net)}</span>
                <span />
                <span />
              </article>
            </>
          ) : (
            <article className="aReviewPayRow aReviewPayRow--empty">
              <span className="is-name">
                {isLoading ? 'Loading payroll items...' : 'No payroll items matched this selection.'}
              </span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
              <span />
            </article>
          )}
        </div>
      </section>

      {selectedRow && (
        <div className="aReviewPayModalBackdrop" role="dialog" aria-modal="true" aria-label="Payroll item summary">
          <div className="aReviewPayModal">
            <button
              type="button"
              className="aReviewPayModal__close"
              aria-label="Close summary"
              onClick={() => setSelectedRow(null)}
            >
              <FiXCircle />
            </button>

            <h2>{formatEmployeeName(selectedRow)}</h2>
            <p className="aReviewPayModal__subtitle">Review the payroll totals for this item before printing or cross-checking the posted numbers.</p>
            <p>{describeRun(selectedRun)}</p>

            <div className="aReviewPayModal__grid">
              <label>
                <span>Employee ID</span>
                <input value={selectedRow.empId ?? '-'} readOnly />
              </label>
              <label>
                <span>Payroll Item</span>
                <input value={selectedRow.itemId != null ? `#${selectedRow.itemId}` : '-'} readOnly />
              </label>
              <label>
                <span>Gross Pay</span>
                <input value={formatCurrency(toAmount(selectedRow.grossPay))} readOnly />
              </label>
              <label>
                <span>Total Deductions</span>
                <input value={formatCurrency(selectedRowDeductions)} readOnly />
              </label>
              <label>
                <span>Net Pay</span>
                <input value={formatCurrency(toAmount(selectedRow.netPay))} readOnly />
              </label>
              <label>
                <span>Run Status</span>
                <input value={selectedRun?.payrollStatus ?? 'Unknown'} readOnly />
              </label>
            </div>

            <div className="aReviewPayModal__actions">
              <button type="button" onClick={() => setSelectedRow(null)}>
                Close
              </button>
              <button type="button" onClick={() => window.print()}>
                Print Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
