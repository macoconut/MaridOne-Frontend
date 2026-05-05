import { ApiError, apiFetchJson, toArray } from '../../../lib/api';
import { extractAttachmentReference } from '../../../lib/document/documentAttachments';
import {
  employeeLabel,
  employeeLabelFromParts,
  formatDate,
  formatDateTime,
  toMoneyString,
  toOptionalMoneyString,
  toOptionalText,
} from '../../../lib/utils/formatters';
import { getManilaNow } from '../../../lib/manilaTime';
import { formatPayrollRunTypeLabel } from '../../../lib/payrollRunLabels';
import type { EmployeeOption } from '../../../lib/types/employee';
import type {
  PayrollDisputeRow as DisputeDto,
  PayrollItemRow as PayrollItemSummaryDto,
  PayrollRunRow as PayrollRunDto,
} from '../../../lib/types/payroll';
import type {
  CorrectionIntent,
  CorrectionLine,
  CorrectionSourceItem,
  DisputeRow,
  DisputeStatusCode,
  DisputeTypeFilter,
  ManualLineFormState,
  PayrollItemSummaryRow,
  RunFormState,
} from './types';

const PAYROLL_RUN_STORAGE_KEY = 'maridone.hr.latestPayrollRun';
const WAITING_DISPUTE_STORAGE_KEY = 'maridone.hr.waitingDisputes';

export const EMPLOYEE_OPTIONS_TIMEOUT_MS = 10000;

export function normalizeText(value?: string) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function mapDisputeType(subject?: string): Exclude<DisputeTypeFilter, 'all'> {
  const normalized = normalizeText(subject);
  if (normalized.includes('overtime')) return 'Overtime';
  if (normalized.includes('late') || normalized.includes('attendance')) return 'Attendance Issue';
  if (normalized.includes('absent')) return 'Absent Deduction';
  if (normalized.includes('general')) return 'General';
  return 'Other';
}

export function toAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatCurrency(value: unknown) {
  return `P${toAmount(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function mapCorrectionLine(
  row: Record<string, unknown>,
  idx: number,
  lineType: CorrectionLine['lineType']
): CorrectionLine | null {
  const lineId = Number(row.earningsId ?? row.deductionsId);
  if (!Number.isFinite(lineId) || lineId <= 0) return null;

  return {
    key: `${lineType}-${String(row.earningsId ?? row.deductionsId ?? idx + 1)}`,
    lineId,
    lineType,
    label:
      lineType === 'EARNING'
        ? String(row.description ?? `Earning ${idx + 1}`)
        : String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`),
    amount: toMoneyString(row.amount),
    originalAmount: toOptionalMoneyString(row.originalAmount),
    adjustedBy: toOptionalText(row.adjustedBy),
    adjustedAt: toOptionalText(row.adjustedAt),
  };
}

export function mapCorrectionLines(response: unknown, lineType: CorrectionLine['lineType']) {
  return toArray<Record<string, unknown>>(response)
    .map((row, idx) => mapCorrectionLine(row, idx, lineType))
    .filter((line): line is CorrectionLine => line !== null);
}

export function summarizePayrollItemLines(
  earnings: CorrectionLine[],
  deductions: CorrectionLine[],
  fallback?: PayrollItemSummaryRow | null
) {
  const hasDetailedLines = earnings.length > 0 || deductions.length > 0;
  const grossPay =
    earnings.length > 0 ? earnings.reduce((sum, line) => sum + toAmount(line.amount), 0) : toAmount(fallback?.grossPay);
  const totalDeductions =
    deductions.length > 0
      ? deductions.reduce((sum, line) => sum + toAmount(line.amount), 0)
      : toAmount(fallback?.deductions);
  const netPay = hasDetailedLines ? grossPay - totalDeductions : toAmount(fallback?.netPay);

  return {
    grossPay,
    deductions: totalDeductions,
    netPay,
  };
}

export function getStandardPaymentDate(startIso: string, endIso: string): string | null {
  if (!startIso || !endIso) return null;
  const [startYear, startMonth, startDay] = startIso.split('-').map(Number);
  const [endYear, endMonth, endDay] = endIso.split('-').map(Number);

  if (startDay === 11 && endDay === 25 && startYear === endYear && startMonth === endMonth) {
    const daysInMonth = new Date(startYear, startMonth, 0).getDate();
    const payDay = Math.min(30, daysInMonth);
    return `${startYear}-${String(startMonth).padStart(2, '0')}-${String(payDay).padStart(2, '0')}`;
  }

  const isNextMonth =
    (startMonth === 12 && endMonth === 1 && endYear === startYear + 1) ||
    (endMonth === startMonth + 1 && endYear === startYear);

  if (startDay === 26 && endDay === 10 && isNextMonth) {
    return `${endYear}-${String(endMonth).padStart(2, '0')}-15`;
  }

  return null;
}

export function applyStandardPaymentDate(runForm: RunFormState): RunFormState {
  const standardPaymentDate = getStandardPaymentDate(runForm.periodStart, runForm.periodEnd);
  if (!standardPaymentDate) return runForm;

  return {
    ...runForm,
    paymentDate: standardPaymentDate,
  };
}

export function createDefaultRunForm(): RunFormState {
  const manila = getManilaNow();
  const todayIso = manila.dateKey;
  const start = `${manila.year}-${String(manila.month).padStart(2, '0')}-01`;

  return applyStandardPaymentDate({
    periodStart: start,
    periodEnd: todayIso,
    paymentDate: todayIso,
    runType: 'REGULAR',
  });
}

export function createDefaultManualLineForm(): ManualLineFormState {
  return {
    empId: '',
    lineType: 'EARNING',
    amount: '',
  };
}

export function buildEmployeeOptions(response: unknown) {
  return toArray<Record<string, unknown>>(response)
    .map((item, index) => {
      const id = Number(item.employeeId ?? item.id ?? index + 1);
      if (!Number.isFinite(id) || id <= 0) return null;

      const explicitName = typeof item.name === 'string' ? item.name.trim() : '';
      const fallbackName = [item.firstName, item.middleName, item.lastName]
        .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(' ')
        .trim();

      return {
        id,
        name: explicitName || fallbackName || `Employee #${id}`,
        status: String(item.status ?? item.employmentStatus ?? ''),
        position: String(item.position ?? ''),
        department: typeof item.department === 'string' ? item.department.trim() : '',
      } satisfies EmployeeOption;
    })
    .filter((option): option is EmployeeOption => option !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function describeRun(periodStart: string, periodEnd: string) {
  return `Payroll run ${periodStart} to ${periodEnd}`;
}

export function describeAdjustmentRun(periodStart: string, periodEnd: string) {
  return `Payroll adjustment ${periodStart} to ${periodEnd}`;
}

export function formatRunType(value?: string) {
  return formatPayrollRunTypeLabel(value);
}

export function normalizeRunType(value?: string): RunFormState['runType'] {
  return value === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'REGULAR';
}

export function getTodayIsoDate() {
  return getManilaNow().dateKey;
}

export function isFutureIsoDate(value: string, todayIsoDate: string) {
  return Boolean(value) && value > todayIsoDate;
}

export function readStoredRun() {
  try {
    const raw = window.localStorage.getItem(PAYROLL_RUN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PayrollRunDto;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistRunSelection(run: PayrollRunDto | null) {
  try {
    if (run) {
      window.localStorage.setItem(PAYROLL_RUN_STORAGE_KEY, JSON.stringify(run));
    } else {
      window.localStorage.removeItem(PAYROLL_RUN_STORAGE_KEY);
    }
  } catch {
    // ignore storage write failures
  }
}

export function clearStoredRun() {
  try {
    window.localStorage.removeItem(PAYROLL_RUN_STORAGE_KEY);
  } catch {
    // ignore storage write failures
  }
}

export function toSortStamp(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function compareRunsDescending(a: PayrollRunDto, b: PayrollRunDto) {
  const endDiff = toSortStamp(b.periodEnd) - toSortStamp(a.periodEnd);
  if (endDiff !== 0) return endDiff;

  const startDiff = toSortStamp(b.periodStart) - toSortStamp(a.periodStart);
  if (startDiff !== 0) return startDiff;

  return (b.payId ?? 0) - (a.payId ?? 0);
}

export function pickCurrentRun(runs: PayrollRunDto[], preferredPayId?: number | null) {
  const preferredRun =
    preferredPayId != null ? runs.find((run) => run.payId === preferredPayId) ?? null : null;
  const latestInProgressRun = runs.find((run) => run.payrollStatus === 'IN_PROGRESS') ?? null;
  const latestRunWithItems = runs.find((run) => (run.itemCount ?? 0) > 0) ?? null;

  return (
    (preferredRun && preferredRun.payrollStatus !== 'POSTED' ? preferredRun : null) ??
    latestInProgressRun ??
    preferredRun ??
    latestRunWithItems ??
    runs[0] ??
    null
  );
}

function toDisputeStatusCode(value?: string): DisputeStatusCode {
  const normalized = String(value ?? 'PENDING').trim().toUpperCase();
  if (normalized === 'WAITING_ADJUSTMENT') return 'WAITING_ADJUSTMENT';
  if (normalized === 'APPROVED') return 'APPROVED';
  if (normalized === 'REJECTED') return 'REJECTED';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

function formatDisputeStatusLabel(status: DisputeStatusCode) {
  if (status === 'WAITING_ADJUSTMENT') return 'Waiting for Adjustment';
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Denied';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
}

function toDisputeStatusTone(status: DisputeStatusCode): DisputeRow['statusTone'] {
  if (status === 'WAITING_ADJUSTMENT') return 'waiting-adjustment';
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'CANCELLED') return 'cancelled';
  return 'pending';
}

export function toDisputeRow(item: DisputeDto, idx: number): DisputeRow {
  const attachment = extractAttachmentReference(item.reason);
  const statusCode = toDisputeStatusCode(item.status);
  return {
    id: item.id ?? idx + 1,
    itemId: item.itemId,
    employeeId: item.employeeId,
    employeeName: item.employeeName,
    employee: employeeLabel(item.employeeName, item.employeeId),
    payrollPeriod: item.createdAt ? formatDate(item.createdAt) : 'No date',
    submittedAt: formatDateTime(item.createdAt),
    sortStamp: toSortStamp(item.createdAt),
    statusCode,
    statusLabel: formatDisputeStatusLabel(statusCode),
    statusTone: toDisputeStatusTone(statusCode),
    subject: item.subject || 'Payroll dispute',
    reason: attachment.cleanText,
    decisionSummary: item.statusReason || '',
    attachmentPathId: attachment.attachmentPathId ?? undefined,
  };
}

export function mapDisputeRows(response: unknown) {
  return toArray<DisputeDto>(response).map((item, idx) => toDisputeRow(item, idx));
}

export function createWaitingDisputeRow(row: DisputeRow, decisionSummary: string): DisputeRow {
  return {
    ...row,
    sortStamp: row.sortStamp || Date.now(),
    statusCode: 'WAITING_ADJUSTMENT',
    statusLabel: formatDisputeStatusLabel('WAITING_ADJUSTMENT'),
    statusTone: toDisputeStatusTone('WAITING_ADJUSTMENT'),
    decisionSummary,
    attachmentPathId: row.attachmentPathId,
  };
}

export function readWaitingDisputes() {
  try {
    const raw = window.localStorage.getItem(WAITING_DISPUTE_STORAGE_KEY);
    if (!raw) return [] as DisputeRow[];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry, idx) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Partial<DisputeRow>;
        const id = typeof row.id === 'number' ? row.id : idx + 1;
        return createWaitingDisputeRow(
          {
            id,
            itemId: typeof row.itemId === 'number' ? row.itemId : undefined,
            employeeId: typeof row.employeeId === 'number' ? row.employeeId : undefined,
            employeeName: typeof row.employeeName === 'string' ? row.employeeName : undefined,
            employee: typeof row.employee === 'string' && row.employee.trim().length > 0 ? row.employee : 'Employee unavailable',
            payrollPeriod: typeof row.payrollPeriod === 'string' && row.payrollPeriod.trim().length > 0 ? row.payrollPeriod : 'No date',
            submittedAt: typeof row.submittedAt === 'string' && row.submittedAt.trim().length > 0 ? row.submittedAt : 'Not available',
            sortStamp: typeof row.sortStamp === 'number' && Number.isFinite(row.sortStamp) ? row.sortStamp : 0,
            statusCode: 'WAITING_ADJUSTMENT',
            statusLabel: formatDisputeStatusLabel('WAITING_ADJUSTMENT'),
            statusTone: toDisputeStatusTone('WAITING_ADJUSTMENT'),
            subject: typeof row.subject === 'string' && row.subject.trim().length > 0 ? row.subject : 'Payroll dispute',
            reason: typeof row.reason === 'string' ? row.reason : '',
            decisionSummary: typeof row.decisionSummary === 'string' ? row.decisionSummary : '',
            attachmentPathId: typeof row.attachmentPathId === 'number' ? row.attachmentPathId : undefined,
          },
          typeof row.decisionSummary === 'string' ? row.decisionSummary : ''
        );
      })
      .filter((row): row is DisputeRow => row !== null);
  } catch {
    return [];
  }
}

function writeWaitingDisputes(rows: DisputeRow[]) {
  try {
    if (rows.length > 0) {
      window.localStorage.setItem(WAITING_DISPUTE_STORAGE_KEY, JSON.stringify(rows));
    } else {
      window.localStorage.removeItem(WAITING_DISPUTE_STORAGE_KEY);
    }
  } catch {
    // ignore storage write failures
  }
}

export function upsertWaitingDispute(row: DisputeRow) {
  const existing = readWaitingDisputes();
  const next = [...existing.filter((entry) => entry.id !== row.id), createWaitingDisputeRow(row, row.decisionSummary || '')]
    .sort((left, right) => right.sortStamp - left.sortStamp || left.employee.localeCompare(right.employee));
  writeWaitingDisputes(next);
}

export function removeWaitingDispute(disputeId: number) {
  const next = readWaitingDisputes().filter((entry) => entry.id !== disputeId);
  writeWaitingDisputes(next);
}

export async function reconcileWaitingDisputes() {
  const cached = readWaitingDisputes();
  if (cached.length === 0) return cached;

  const validIds = new Set<number>();

  try {
    const uniqueIds = [...new Set(cached.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0))];

    await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          await apiFetchJson<unknown>(`/api/payroll/item/dispute/details/${id}`);
          validIds.add(id);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            return;
          }
          throw error;
        }
      })
    );
  } catch {
    return cached;
  }

  const next = cached.filter((row) => validIds.has(row.id));
  if (next.length !== cached.length) {
    writeWaitingDisputes(next);
  }

  return next;
}

export function buildCorrectionIntent(row: DisputeRow): CorrectionIntent | null {
  if (typeof row.itemId !== 'number') return null;
  return {
    disputeId: row.id,
    itemId: row.itemId,
    employee: row.employee,
    message: row.subject,
    disputeReason: row.reason,
    decisionReason: row.decisionSummary || '',
  };
}

export function mapPayrollItemSummaryRows(response: unknown) {
  return toArray<PayrollItemSummaryDto>(response)
    .map((row, idx) => {
      const grossPay = toAmount(row.grossPay);
      const netPay = toAmount(row.netPay);
      return {
        itemId: row.itemId ?? idx + 1,
        empId: row.empId,
        employee: employeeLabelFromParts(row.firstName, row.lastName, row.empId),
        grossPay,
        deductions: Math.max(grossPay - netPay, 0),
        netPay,
      } satisfies PayrollItemSummaryRow;
    })
    .sort((left, right) => left.employee.localeCompare(right.employee) || left.itemId - right.itemId);
}

export function hasCorrectionSourcePeriod(source: CorrectionSourceItem | null) {
  return Boolean(source?.runDetails?.periodStart && source.runDetails?.periodEnd);
}
