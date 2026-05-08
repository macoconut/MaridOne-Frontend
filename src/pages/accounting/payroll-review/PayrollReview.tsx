import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCalendar, FiDownload, FiEye, FiFilter, FiMoreVertical, FiSearch, FiXCircle } from 'react-icons/fi';
import LargePopup from '../../../components/dialog/LargePopup';

type AggregatedEmployeeRow = EmployeeReportRow & {
  itemIds: number[];
};
import EmployeeSortMenu from '@/components/layout/EmployeeSortMenu';
import SortMenu, { type SortOption } from '@/components/layout/SortMenu';
import PageHeader from '@/components/layout/PageHeader';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '@/lib/api/api';
import { compareEmployees, type EmployeeSortKey } from '@/lib/utils/employeeSort';
import { getFriendlyErrorMessage } from '@/lib/utils/uiErrors';
import { getManilaNow } from '@/lib/utils/manilaTime';
import {
  formatDate,
  formatDateTime,
  toMoneyString,
  toOptionalMoneyString,
  toOptionalText,
} from '@/lib/utils/formatters';
import type {
  EmployeeDirectoryEntry,
  EmployeeReportRow,
  PayTypeSummaryRow,
  PayrollBreakdownLine,
  PayrollItemRow,
  PayrollRunRow,
} from '@/lib/types/payroll';
import './PayrollReview.css';

type ReportView = 'employee' | 'payType';

type EmployeeReportExportRow = {
  employeeId: string;
  employeeName: string;
  grossPay: string;
  earningsTotal: string;
  deductionsTotal: string;
  employerContributionTotal: string;
  netPay: string;
  earnings: PayrollBreakdownLine[];
  deductions: PayrollBreakdownLine[];
  employerContributions: PayrollBreakdownLine[];
};

type PayTypeSortKey = 'name' | 'amount';

const DEFAULT_EARNING_BREAKDOWN_LABELS = [
  'Basic Pay',
  'Bonus',
  'Approved Overtime',
  'Regular Holiday Premium',
  'Special Holiday Premium',
  'Rest Day Premium',
  'Night Differential',
  'OT Night Differential',
  'Premium Pay',
  'Manual Adjustment',
];

const DEFAULT_DEDUCTION_BREAKDOWN_LABELS = [
  'SSS Contribution',
  'PhilHealth Contribution',
  'Pag-IBIG Contribution',
  'Withholding Tax',
  'Late Penalty',
  'Absent Deduction',
  'SSS Loan',
  'Pag-IBIG Loan',
  'Cash Advance',
  'Manual Adjustment',
  'Equipment Loss Penalty',
  'HMO Upgrade',
];

const DEFAULT_EMPLOYER_CONTRIBUTION_BREAKDOWN_LABELS = [
  'Employer SSS Contribution',
  'Employer PhilHealth Contribution',
  'Employer Pag-IBIG Contribution',
];

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

function formatSummaryLabel(value?: string, summaryKind?: PayrollBreakdownLine['lineType']) {
  const key = String(value ?? '').trim();
  if (!key) return 'Unknown line item';
  const normalized = key.replace(/[\s_-]+/g, '').toUpperCase();
  if (summaryKind === 'EMPLOYER_CONTRIBUTION') {
    if (normalized === 'PAGIBIG' || normalized === 'EMPLOYERPAGIBIGCONTRIBUTION') {
      return 'Employer Pag-IBIG Contribution';
    }
    if (normalized === 'PHILHEALTH' || normalized === 'EMPLOYERPHILHEALTHCONTRIBUTION') {
      return 'Employer PhilHealth Contribution';
    }
    if (normalized === 'SSS' || normalized === 'EMPLOYERSSSCONTRIBUTION') {
      return 'Employer SSS Contribution';
    }
  }
  if (summaryKind === 'DEDUCTION') {
    if (normalized === 'WITHHOLDINGTAX' || normalized.startsWith('BRACKETLEVEL')) return 'Withholding Tax';
  }
  if (normalized === 'PAGIBIG' || normalized === 'PAGIBIGCONTRIBUTION') return 'PagIbig';
  if (normalized === 'PHILHEALTH' || normalized === 'PHILHEALTHCONTRIBUTION') return 'PhilHealth';
  if (normalized === 'SSS' || normalized === 'SSSCONTRIBUTION') return 'SSS';
  if (normalized === 'BONUS') return 'Bonus';
  if (summaryKind === 'EARNING' && normalized === 'NIGHTDIFF') return 'Night Differential';
  return key
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPayTypeDisplayLabel(row: PayTypeSummaryRow) {
  const summaryKind = getSummaryKind(row) as PayrollBreakdownLine['lineType'] | undefined;
  const normalized = String(row.payType ?? '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toUpperCase();
  const canonical = formatSummaryLabel(row.payType, summaryKind);

  if (summaryKind === 'EMPLOYER_CONTRIBUTION') {
    if (normalized === 'PAGIBIG' || canonical === 'Employer Pag-IBIG Contribution') return 'Employer PagIbig';
    if (normalized === 'PHILHEALTH' || canonical === 'Employer PhilHealth Contribution') return 'Employer PhilHealth';
    if (normalized === 'SSS' || canonical === 'Employer SSS Contribution') return 'Employer SSS';
  }

  return canonical;
}

function getSummaryKind(row: PayTypeSummaryRow) {
  return row.summaryKind ?? row.adjustment ?? row.adjustmentKind;
}

function mergePayTypeSummaryRows(rows: PayTypeSummaryRow[]) {
  const merged = new Map<string, PayTypeSummaryRow>();

  for (const row of rows) {
    const summaryKind = getSummaryKind(row) as PayrollBreakdownLine['lineType'] | undefined;
    const mergedPayType = formatSummaryLabel(row.payType, summaryKind);
    const key = `${summaryKind ?? 'UNKNOWN'}::${mergedPayType}`;
    const existing = merged.get(key);

    if (existing) {
      existing.total = toAmount(existing.total) + toAmount(row.total);
      continue;
    }

    merged.set(key, {
      ...row,
      payType: mergedPayType,
      summaryKind: row.summaryKind ?? summaryKind,
    });
  }

  return Array.from(merged.values());
}

function normalizeBreakdownLabel(label: string, lineType: PayrollBreakdownLine['lineType']) {
  const trimmed = label.trim();
  if (!trimmed) {
    if (lineType === 'EARNING') return 'Other Earnings';
    if (lineType === 'DEDUCTION') return 'Other Deductions';
    return 'Other Employer Contributions';
  }

  const normalized = trimmed.replace(/[\s_-]+/g, ' ').trim().toLowerCase();

  if (lineType === 'EMPLOYER_CONTRIBUTION') {
    if (normalized === 'employer sss contribution' || normalized === 'sss contribution' || normalized === 'sss') {
      return 'Employer SSS Contribution';
    }
    if (
      normalized === 'employer philhealth contribution' ||
      normalized === 'philhealth contribution' ||
      normalized === 'philhealth'
    ) {
      return 'Employer PhilHealth Contribution';
    }
    if (
      normalized === 'employer pag ibig contribution' ||
      normalized === 'pag ibig contribution' ||
      normalized === 'pag ibig' ||
      normalized === 'pagibig'
    ) {
      return 'Employer Pag-IBIG Contribution';
    }
  }

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
    if (normalized === 'nightdiff') return 'Night Differential';
    if (normalized === 'bonus') return 'Bonus';
  }

  return trimmed;
}

function toCsvValue(value: unknown) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(rows: string[][]) {
  return rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n');
}

function sumBreakdownAmounts(response: unknown) {
  return toArray<Record<string, unknown>>(response).reduce((sum, row) => sum + toAmount(row.amount), 0);
}

function orderBreakdownLabels(observedLabels: string[], defaultLabels: string[]) {
  const uniqueObserved = Array.from(new Set(observedLabels.filter(Boolean)));
  const remaining = uniqueObserved
    .filter((label) => !defaultLabels.includes(label))
    .sort((a, b) => a.localeCompare(b));
  return [...defaultLabels, ...remaining];
}

function buildBreakdownAmountMap(lines: PayrollBreakdownLine[], lineType: PayrollBreakdownLine['lineType']) {
  const amounts = new Map<string, number>();

  for (const line of lines) {
    const label = normalizeBreakdownLabel(line.label, lineType);
    amounts.set(label, (amounts.get(label) ?? 0) + toAmount(line.amount));
  }

  return amounts;
}

function buildEmployeeReportRows(reportLabel: string, payrollStatus: string, rows: EmployeeReportExportRow[]) {
  const earningsBreakdownLabels = orderBreakdownLabels(
    rows.flatMap((row) => row.earnings.map((line) => normalizeBreakdownLabel(line.label, 'EARNING'))),
    DEFAULT_EARNING_BREAKDOWN_LABELS
  );
  const deductionsBreakdownLabels = orderBreakdownLabels(
    rows.flatMap((row) => row.deductions.map((line) => normalizeBreakdownLabel(line.label, 'DEDUCTION'))),
    DEFAULT_DEDUCTION_BREAKDOWN_LABELS
  );
  const employerContributionBreakdownLabels = orderBreakdownLabels(
    rows.flatMap((row) =>
      row.employerContributions.map((line) => normalizeBreakdownLabel(line.label, 'EMPLOYER_CONTRIBUTION'))
    ),
    DEFAULT_EMPLOYER_CONTRIBUTION_BREAKDOWN_LABELS
  );

  return [
    ['Report', reportLabel],
    ['Status', payrollStatus],
    [''],
    ['Employee ID', 'Employee Name', 'Gross Pay', 'Earnings Total', 'Deductions Total', 'ER Contributions', 'Net Pay'],
    ...rows.map((row) => [
      row.employeeId,
      row.employeeName,
      row.grossPay,
      row.earningsTotal,
      row.deductionsTotal,
      row.employerContributionTotal,
      row.netPay,
    ]),
    [''],
    ['Earnings Breakdown'],
    ['Employee ID', 'Employee Name', ...earningsBreakdownLabels],
    ...rows.map((row) => {
      const earningsAmounts = buildBreakdownAmountMap(row.earnings, 'EARNING');
      return [
        row.employeeId,
        row.employeeName,
        ...earningsBreakdownLabels.map((label) => formatCurrency(earningsAmounts.get(label) ?? 0)),
      ];
    }),
    [''],
    ['Deductions Breakdown'],
    ['Employee ID', 'Employee Name', ...deductionsBreakdownLabels],
    ...rows.map((row) => {
      const deductionsAmounts = buildBreakdownAmountMap(row.deductions, 'DEDUCTION');
      return [
        row.employeeId,
        row.employeeName,
        ...deductionsBreakdownLabels.map((label) => formatCurrency(deductionsAmounts.get(label) ?? 0)),
      ];
    }),
    [''],
    ['Employer Contributions Breakdown'],
    ['Employee ID', 'Employee Name', ...employerContributionBreakdownLabels],
    ...rows.map((row) => {
      const contributionAmounts = buildBreakdownAmountMap(row.employerContributions, 'EMPLOYER_CONTRIBUTION');
      return [
        row.employeeId,
        row.employeeName,
        ...employerContributionBreakdownLabels.map((label) => formatCurrency(contributionAmounts.get(label) ?? 0)),
      ];
    }),
  ];
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<AggregatedEmployeeRow | null>(null);
  const [selectedBreakdownEarnings, setSelectedBreakdownEarnings] = useState<PayrollBreakdownLine[]>([]);
  const [selectedBreakdownDeductions, setSelectedBreakdownDeductions] = useState<PayrollBreakdownLine[]>([]);
  const [selectedBreakdownEmployerContributions, setSelectedBreakdownEmployerContributions] = useState<PayrollBreakdownLine[]>([]);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const silentRefreshRef = useRef(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  useErrorDialogEffect(loadError, 'Payroll review data could not be loaded');
  useErrorDialogEffect(actionError, 'Payslip review report could not be exported');

  const handlePageRefresh = useCallback(() => {
    silentRefreshRef.current = true;
    setRefreshTick((tick) => tick + 1);
  }, []);

  const filterLabel = useMemo(() => (view === 'employee' ? 'Employee:' : 'Category:'), [view]);

  useAutoRefreshingPage(handlePageRefresh, { intervalMs: 15000 });

  useEffect(() => {
    setSortMenuOpen(false);
  }, [view]);

  useEffect(() => {
    if (!actionMenuOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [actionMenuOpen]);

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
  const selectedBreakdownEmployerContributionTotal = useMemo(() => {
    if (!selectedBreakdownItem) return 0;
    if (selectedBreakdownEmployerContributions.length > 0) {
      return selectedBreakdownEmployerContributions.reduce((sum, line) => sum + toAmount(line.amount), 0);
    }
    return toAmount(selectedBreakdownItem.employerContributionTotal);
  }, [selectedBreakdownEmployerContributions, selectedBreakdownItem]);
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
        existing.employerContributionTotal =
          toAmount(existing.employerContributionTotal) + toAmount(row.employerContributionTotal);
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
    const mergedRows = mergePayTypeSummaryRows(payTypeRows);
    const filtered =
      !normalizedFilter || normalizedFilter === 'all'
        ? [...mergedRows]
        : mergedRows.filter((row) => {
            const payType = String(row.payType ?? '').toLowerCase();
            const kind = String(getSummaryKind(row) ?? '').toLowerCase();
            const friendlyPayType = formatSummaryLabel(
              row.payType,
              getSummaryKind(row) as PayrollBreakdownLine['lineType'] | undefined
            ).toLowerCase();
            const displayPayType = formatPayTypeDisplayLabel(row).toLowerCase();
            return (
              payType.includes(normalizedFilter) ||
              kind.includes(normalizedFilter) ||
              friendlyPayType.includes(normalizedFilter) ||
              displayPayType.includes(normalizedFilter)
            );
          });

    return filtered.sort((a, b) => {
      if (payTypeSort === 'amount') {
        return toAmount(b.total) - toAmount(a.total);
      }
      return formatPayTypeDisplayLabel(a).localeCompare(formatPayTypeDisplayLabel(b));
    });
  }, [normalizedFilter, payTypeRows, payTypeSort]);

  const visibleEarningRows = useMemo(
    () => visiblePayTypeRows.filter((row) => getSummaryKind(row) === 'EARNING'),
    [visiblePayTypeRows]
  );

  const visibleDeductionRows = useMemo(
    () => visiblePayTypeRows.filter((row) => getSummaryKind(row) === 'DEDUCTION'),
    [visiblePayTypeRows]
  );

  const visibleEmployerContributionRows = useMemo(
    () => visiblePayTypeRows.filter((row) => getSummaryKind(row) === 'EMPLOYER_CONTRIBUTION'),
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

  const employerContributionTotal = useMemo(
    () => visibleEmployerContributionRows.reduce((sum, row) => sum + toAmount(row.total), 0),
    [visibleEmployerContributionRows]
  );

  const reportLabel = useMemo(() => {
    if (!fromDate || !toDate) return 'Payslip Review Report';
    return `Report from ${formatDate(fromDate, '-')} to ${formatDate(toDate, '-')}`;
  }, [fromDate, toDate]);

  const reportFileStem = useMemo(() => {
    return reportLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'payslip-review-report';
  }, [reportLabel]);

  const payTypeReportRows = useMemo(() => {
    return [
      ['Report', reportLabel],
      ['Status', selectedRun?.payrollStatus || 'Unknown status'],
      [''],
      ['Category', 'Type', 'Total'],
      ...visibleEarningRows.map((row) => ['Earnings', formatPayTypeDisplayLabel(row), formatCurrency(row.total)]),
      ['Earnings Total', '', formatCurrency(earningsTotal)],
      ...visibleDeductionRows.map((row) => ['Deductions', formatPayTypeDisplayLabel(row), formatCurrency(row.total)]),
      ['Deductions Total', '', formatCurrency(deductionsTotal)],
      ...visibleEmployerContributionRows.map((row) => [
        'Employer Contributions',
        formatPayTypeDisplayLabel(row),
        formatCurrency(row.total),
      ]),
      ['Employer Contributions Total', '', formatCurrency(employerContributionTotal)],
    ];
  }, [
    deductionsTotal,
    earningsTotal,
    employerContributionTotal,
    reportLabel,
    selectedRun?.payrollStatus,
    visibleDeductionRows,
    visibleEarningRows,
    visibleEmployerContributionRows,
  ]);

  const payTypeReportCsv = useMemo(() => buildCsvContent(payTypeReportRows), [payTypeReportRows]);

  const hasDownloadableReport = useMemo(() => {
    if (view === 'employee') {
      return visibleEmployeeRows.length > 0;
    }

    return (
      visibleEarningRows.length > 0 ||
      visibleDeductionRows.length > 0 ||
      visibleEmployerContributionRows.length > 0
    );
  }, [view, visibleDeductionRows.length, visibleEarningRows.length, visibleEmployeeRows.length, visibleEmployerContributionRows.length]);

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
    setSelectedBreakdownEmployerContributions([]);
    setBreakdownError('');
    setIsLoadingBreakdown(false);
  }, []);

  useEscapeDismiss(Boolean(selectedBreakdownItem), closeBreakdownModal, 10);
  useEscapeDismiss(actionMenuOpen, () => setActionMenuOpen(false), 11);

  useEffect(() => {
    closeBreakdownModal();
  }, [closeBreakdownModal, view]);

  function mapBreakdownLines(response: unknown, lineType: PayrollBreakdownLine['lineType']) {
    return toArray<Record<string, unknown>>(response)
      .map((row, idx) => ({
        key: `${lineType}-${String(row.earningsId ?? row.deductionsId ?? row.employerContributionId ?? idx + 1)}`,
        lineId: Number(row.earningsId ?? row.deductionsId ?? row.employerContributionId),
        lineType,
        label: normalizeBreakdownLabel(
          String(
            row.description ??
              row.deductionType ??
              row.contributionType ??
              (lineType === 'EARNING'
                ? `Earning ${idx + 1}`
                : lineType === 'DEDUCTION'
                  ? `Deduction ${idx + 1}`
                  : `Employer Contribution ${idx + 1}`)
          ),
          lineType
        ),
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
    setSelectedBreakdownEmployerContributions([]);
    setBreakdownError('');
    setIsLoadingBreakdown(true);

    try {
      const allEarnings: PayrollBreakdownLine[] = [];
      const allDeductions: PayrollBreakdownLine[] = [];
      const allEmployerContributions: PayrollBreakdownLine[] = [];

      await Promise.all(
        row.itemIds.map(async (itemId) => {
          const [earningsResponse, deductionsResponse, employerContributionResponse] = await Promise.all([
            apiFetchJson<unknown>(`/api/payroll/item/earnings/${itemId}`),
            apiFetchJson<unknown>(`/api/payroll/item/deductions/${itemId}`),
            apiFetchJson<unknown>(`/api/payroll/item/employer-contributions/${itemId}`),
          ]);
          allEarnings.push(...mapBreakdownLines(earningsResponse, 'EARNING'));
          allDeductions.push(...mapBreakdownLines(deductionsResponse, 'DEDUCTION'));
          allEmployerContributions.push(...mapBreakdownLines(employerContributionResponse, 'EMPLOYER_CONTRIBUTION'));
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
      setSelectedBreakdownEmployerContributions(sumLines(allEmployerContributions));
    } catch (error) {
      setBreakdownError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingBreakdown(false);
    }
  }

  async function downloadCurrentReport() {
    if (!hasDownloadableReport) return;

    setActionError('');
    setIsDownloading(true);

    try {
      const csvContent =
        view === 'employee'
          ? buildCsvContent(
              buildEmployeeReportRows(
                reportLabel,
                selectedRun?.payrollStatus || 'Unknown status',
                await Promise.all(
                  visibleEmployeeRows.map(async (row) => {
                    const itemIds = row.itemIds.length > 0
                      ? row.itemIds
                      : typeof row.itemId === 'number'
                        ? [row.itemId]
                        : [];
                    const fallbackGross = toAmount(row.grossPay);
                    const fallbackNet = toAmount(row.netPay);
                    const fallbackDeductions = Math.max(fallbackGross - fallbackNet, 0);

                    if (itemIds.length === 0) {
                      return {
                        employeeId: String(row.empId ?? '-'),
                        employeeName: formatEmployeeName(row),
                        grossPay: formatCurrency(row.grossPay),
                        earningsTotal: formatCurrency(fallbackGross),
                        deductionsTotal: formatCurrency(fallbackDeductions),
                        employerContributionTotal: formatCurrency(row.employerContributionTotal),
                        netPay: formatCurrency(row.netPay),
                        earnings: [],
                        deductions: [],
                        employerContributions: [],
                      };
                    }

                    const combinedResults = await Promise.all(
                      itemIds.map(async (itemId) =>
                        Promise.allSettled([
                          apiFetchJson<unknown>(`/api/payroll/item/earnings/${itemId}`),
                          apiFetchJson<unknown>(`/api/payroll/item/deductions/${itemId}`),
                          apiFetchJson<unknown>(`/api/payroll/item/employer-contributions/${itemId}`),
                        ])
                      )
                    );

                    const rawEarningsResponses: unknown[] = [];
                    const rawDeductionResponses: unknown[] = [];
                    const rawEmployerContributionResponses: unknown[] = [];
                    const earningsLines: PayrollBreakdownLine[] = [];
                    const deductionLines: PayrollBreakdownLine[] = [];
                    const employerContributionLines: PayrollBreakdownLine[] = [];

                    for (const [earningsResult, deductionsResult, employerContributionResult] of combinedResults) {
                      if (earningsResult.status === 'fulfilled') {
                        rawEarningsResponses.push(earningsResult.value);
                        earningsLines.push(...mapBreakdownLines(earningsResult.value, 'EARNING'));
                      }
                      if (deductionsResult.status === 'fulfilled') {
                        rawDeductionResponses.push(deductionsResult.value);
                        deductionLines.push(...mapBreakdownLines(deductionsResult.value, 'DEDUCTION'));
                      }
                      if (employerContributionResult.status === 'fulfilled') {
                        rawEmployerContributionResponses.push(employerContributionResult.value);
                        employerContributionLines.push(
                          ...mapBreakdownLines(employerContributionResult.value, 'EMPLOYER_CONTRIBUTION')
                        );
                      }
                    }

                    const earningsTotalForRow =
                      rawEarningsResponses.length > 0
                        ? rawEarningsResponses.reduce<number>(
                            (sum, response) => sum + sumBreakdownAmounts(response),
                            0
                          )
                        : fallbackGross;
                    const deductionsTotalForRow =
                      rawDeductionResponses.length > 0
                        ? rawDeductionResponses.reduce<number>(
                            (sum, response) => sum + sumBreakdownAmounts(response),
                            0
                          )
                        : fallbackDeductions;
                    const employerContributionTotalForRow =
                      rawEmployerContributionResponses.length > 0
                        ? rawEmployerContributionResponses.reduce<number>(
                            (sum, response) => sum + sumBreakdownAmounts(response),
                            0
                          )
                        : toAmount(row.employerContributionTotal);

                    return {
                      employeeId: String(row.empId ?? '-'),
                      employeeName: formatEmployeeName(row),
                      grossPay: formatCurrency(row.grossPay),
                      earningsTotal: formatCurrency(earningsTotalForRow),
                      deductionsTotal: formatCurrency(deductionsTotalForRow),
                      employerContributionTotal: formatCurrency(employerContributionTotalForRow),
                      netPay: formatCurrency(row.netPay),
                      earnings: earningsLines,
                      deductions: deductionLines,
                      employerContributions: employerContributionLines,
                    };
                  })
                )
              )
            )
          : payTypeReportCsv;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportFileStem}-${view}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsDownloading(false);
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
          description="Analyze payroll totals by employee or pay type, including employer statutory costs, before printing or cross-checking posted values."
        />
        <div className="aReviewRun__topActions">
          <label className="aReviewRunSelect aReviewRunSelect--view" aria-label="Report view">
            <select value={view} onChange={(e) => setView(e.target.value as ReportView)}>
              <option value="employee">By Employee</option>
              <option value="payType">By Pay Type</option>
            </select>
          </label>

          <div className="aReviewRunMenu" ref={actionMenuRef}>
            <button
              type="button"
              className={`aReviewRunMenu__toggle ${actionMenuOpen ? 'is-open' : ''}`}
              onClick={() => setActionMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={actionMenuOpen}
              aria-label="Payslip review report actions"
            >
              <FiMoreVertical />
            </button>

            {actionMenuOpen ? (
              <div className="aReviewRunMenu__panel" role="menu" aria-label="Payslip review report actions">
                <button
                  type="button"
                  className="aReviewRunMenu__item"
                  role="menuitem"
                  onClick={() => {
                    setActionMenuOpen(false);
                    void downloadCurrentReport();
                  }}
                  disabled={isDownloading || !hasDownloadableReport}
                >
                  <FiDownload aria-hidden="true" />
                  <span>{isDownloading ? 'Preparing CSV...' : 'Download Report'}</span>
                </button>
              </div>
            ) : null}
          </div>
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
                placeholder={view === 'employee' ? 'Search by employee name or ID' : 'Search by pay type'}
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
              <EmployeeSortMenu
                value={employeeSort}
                onChange={setEmployeeSort}
                open={sortMenuOpen}
                onOpenChange={(open) => {
                  setSortMenuOpen(open);
                  if (open) {
                    setFilterOpen(false);
                  }
                }}
              />
            ) : (
              <SortMenu
                value={payTypeSort}
                onChange={setPayTypeSort}
                options={PAY_TYPE_SORT_OPTIONS}
                panelLabel="Sort categories"
                open={sortMenuOpen}
                onOpenChange={(open) => {
                  setSortMenuOpen(open);
                  if (open) {
                    setFilterOpen(false);
                  }
                }}
              />
            )}
            <div className="uFilter">
              <button
                type="button"
                className={`uFilter__toggle ${filterOpen ? 'is-open' : ''} ${
                  activeFilterCount > 0 ? 'is-active' : ''
                }`}
                onClick={() => {
                  setFilterOpen((open) => {
                    const nextOpen = !open;
                    if (nextOpen) {
                      setSortMenuOpen(false);
                    }
                    return nextOpen;
                  });
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
            <span>ER Contributions</span>
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
                  <div className="aReviewRunEmployee__employer">{formatCurrency(row.employerContributionTotal)}</div>
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
        <div className="aReviewRunSplitTables" aria-label="Pay run earnings, deductions, and employer contributions">
          {!isLoading && (visibleEarningRows.length > 0 || visibleDeductionRows.length > 0 || visibleEmployerContributionRows.length > 0) ? (
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
                        <div className="aReviewRunTypeRow__label">{formatPayTypeDisplayLabel(row)}</div>
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
                        <div className="aReviewRunTypeRow__label">{formatPayTypeDisplayLabel(row)}</div>
                        <div className="aReviewRunTypeRow__value">{formatCurrency(row.total)}</div>
                      </article>
                    ))
                  ) : (
                    <article className="uEmptyState">No deductions matched this payroll run.</article>
                  )}
                </div>
              </section>

              <section
                className="aReviewRunTable aReviewRunTable--summaryView"
                aria-label="Employer contributions summary table"
              >
                <div className="aReviewRunGroup__head">
                  <div className="aReviewRunGroup__titleBlock">
                    <span className="aReviewRunGroup__title">Employer Contributions</span>
                    <span className="aReviewRunGroup__caption">Total employer statutory cost</span>
                  </div>
                  <span className="aReviewRunGroup__total">{formatCurrency(employerContributionTotal)}</span>
                </div>
                <div className="aReviewRunTable__head aReviewRunTable__head--payType">
                  <span>Type</span>
                  <span>Total</span>
                </div>
                <div className="aReviewRunTable__body aReviewRunTable__body--summary">
                  {visibleEmployerContributionRows.length > 0 ? (
                    visibleEmployerContributionRows.map((row, index) => (
                      <article
                        key={`employer-contribution-${row.payType ?? index}`}
                        className="aReviewRunTypeRow aReviewRunTypeRow--table"
                      >
                        <div className="aReviewRunTypeRow__label">
                          {formatPayTypeDisplayLabel(row)}
                        </div>
                        <div className="aReviewRunTypeRow__value">{formatCurrency(row.total)}</div>
                      </article>
                    ))
                  ) : (
                    <article className="uEmptyState">No employer contributions matched this payroll run.</article>
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
          subtitle="Review the current earnings, deductions, employer contributions, and totals for this payroll item."
          size="lg"
          className="aReviewRunPopup aReviewRunPopup--breakdown"
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
              <span>ER Contributions</span>
              <strong>{formatCurrency(selectedBreakdownEmployerContributionTotal)}</strong>
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

                <section className="aReviewRunBreakdown__section">
                  <div className="aReviewRunBreakdown__head">
                    <h3>Employer Contributions</h3>
                    <span>{selectedBreakdownEmployerContributions.length} line(s)</span>
                  </div>
                  <div className="aReviewRunBreakdown__list">
                    {selectedBreakdownEmployerContributions.length > 0 ? (
                      selectedBreakdownEmployerContributions.map((line) => (
                        <div key={line.key} className="aReviewRunBreakdown__row">
                          <div>
                            <strong>{line.label}</strong>
                          </div>
                          <div className="aReviewRunBreakdown__amounts">
                            <strong>{formatCurrency(line.amount)}</strong>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="aReviewRunBreakdown__empty">
                        No employer contributions were returned for this payroll item.
                      </div>
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
