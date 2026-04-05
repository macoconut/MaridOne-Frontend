import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson, apiFetchRaw, toArray } from '../../../lib/api';
import { uploadDocument } from '../../../lib/documentUpload';
import { getUserEmail } from '../../../lib/session';
import ModalCloseButton from '../../../components/dialog/ModalCloseButton';
import FileUploadField from '../../../components/form/FileUploadField';
import ConfirmDialog from '../../../components/dialog/ConfirmDialog';
import PageHeader from '../../../components/layout/PageHeader';
import { useAutoRefreshingPage } from '../../../hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '../../../hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import './Payslip.css';

type EmployeeDetails = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  email?: string;
  address?: {
    permanentAddress?: string;
    temporaryAddress?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
};

type PayrollItemRow = {
  id?: number;
  itemId?: number;
  runDetails?: {
    periodStart?: string;
    periodEnd?: string;
  };
};

type DisputeRow = {
  itemId?: number;
  status?: string;
};

type DocumentRow = {
  pathId?: number;
  filePath?: string;
  fileName?: string;
  fileType?: string;
  username?: string;
};

type PayslipLine = {
  key: string;
  label: string;
  amount: string;
  originalAmount?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  isAdjusted: boolean;
};

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DISPUTE_UPLOAD_SUBDIR = 'dispute-request';

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

function formatAdjustmentTimestamp(value?: string) {
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

function formatDisplayDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatPeriodLabel(start?: string, end?: string) {
  if (!start || !end) return '-';
  return `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
}

function formatFileDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function sanitizeFileNamePart(value?: string) {
  if (!value) return '';
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatCurrency(value: number | string | undefined) {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, ''))
        : Number.NaN;

  if (Number.isFinite(parsedValue)) {
    return `P ${moneyFormatter.format(parsedValue)}`;
  }

  return `P ${moneyFormatter.format(0)}`;
}

function normalizePayslipLabel(label: string) {
  const normalized = label.trim();
  const upper = normalized.toUpperCase();

  if (upper === 'PAGIBIG') return 'Pag-IBIG';
  if (upper === 'PHILHEALTH') return 'PhilHealth';
  if (/^BRACKET_LEVEL_/i.test(normalized)) return 'Withholding Tax';

  return normalized;
}

function matchesPayslipPeriod(document: DocumentRow, periodEnd?: string) {
  const target = typeof periodEnd === 'string' ? periodEnd.trim().toLowerCase() : '';
  if (!target) return true;

  const searchableText = [document.filePath, document.fileName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .replace(/\\/g, '/')
    .toLowerCase();

  return searchableText.includes(target);
}

function toManilaDateKey(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

export default function Payslip() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [payrollItems, setPayrollItems] = useState<PayrollItemRow[]>([]);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const [payslipPeriods, setPayslipPeriods] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<{ periodStart?: string; periodEnd?: string } | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeDetails | null>(null);
  const [earnings, setEarnings] = useState<PayslipLine[]>([]);
  const [deductions, setDeductions] = useState<PayslipLine[]>([]);
  const [workedDays, setWorkedDays] = useState('-');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeSubject, setDisputeSubject] = useState('Overtime pay dispute');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [disputeError, setDisputeError] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [confirmDisputeSubmit, setConfirmDisputeSubmit] = useState(false);
  const [printingPayslip, setPrintingPayslip] = useState(false);
  const [payslipActionError, setPayslipActionError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useErrorDialogEffect(disputeError, 'Payslip dispute could not be submitted');
  useErrorDialogEffect(payslipActionError, 'Payslip action failed');
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useEscapeDismiss(disputeOpen, () => setDisputeOpen(false), 10);
  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled: !disputeOpen && !confirmDisputeSubmit && !disputeSubmitting && !printingPayslip,
  });

  useEffect(() => {
    if (disputeOpen || confirmDisputeSubmit) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [confirmDisputeSubmit, disputeOpen]);

  useEffect(() => {
    void (async () => {
      try {
        const username = getUserEmail();
        if (!username) throw new Error('Missing username');
        const userDetails = await apiFetchJson<Record<string, unknown>>(`/api/user/details/${encodeURIComponent(username)}`);
        const selfEmployee =
          userDetails.employee && typeof userDetails.employee === 'object'
            ? (userDetails.employee as Record<string, unknown>)
            : null;
        const resolvedEmpId =
          typeof userDetails.employeeId === 'number'
            ? userDetails.employeeId
            : typeof selfEmployee?.employeeId === 'number'
              ? selfEmployee.employeeId
              : typeof selfEmployee?.id === 'number'
                ? selfEmployee.id
                : null;
        if (!resolvedEmpId) throw new Error('Missing employee ID');
        setEmployeeId(resolvedEmpId);
        const employeeDetails = await apiFetchJson<EmployeeDetails>(`/api/employees/${resolvedEmpId}`);
        setEmployeeInfo(employeeDetails);

        const items = await apiFetchJson<unknown>(`/api/payroll/item/${resolvedEmpId}`);
        const rows = toArray<PayrollItemRow>(items);
        setPayrollItems(rows);
        setPayslipPeriods(
          rows.map((row, idx) => {
            const start = row.runDetails?.periodStart;
            const end = row.runDetails?.periodEnd;
            return start && end ? formatPeriodLabel(start, end) : `Payslip ${idx + 1}`;
          })
        );
        setSelectedPeriodIndex((currentIndex) => {
          const nextIndex =
            currentIndex >= 0 && currentIndex < rows.length ? currentIndex : 0;
          const selected = rows[nextIndex];

          setSelectedItemId(
            typeof selected?.id === 'number'
              ? selected.id
              : typeof selected?.itemId === 'number'
                ? selected.itemId
                : null
          );
          setSelectedRun(selected?.runDetails ?? null);

          return nextIndex;
        });
      } catch {
        setEmployeeId(null);
        setEmployeeInfo(null);
        setPayrollItems([]);
        setSelectedPeriodIndex(0);
        setPayslipPeriods([]);
        setSelectedItemId(null);
        setSelectedRun(null);
      }
    })();
  }, [refreshTick]);

  function handlePeriodChange(index: number) {
    setSelectedPeriodIndex(index);
    const selected = payrollItems[index];
    setSelectedItemId(
      typeof selected?.id === 'number'
        ? selected.id
        : typeof selected?.itemId === 'number'
          ? selected.itemId
          : null
    );
    setSelectedRun(selected?.runDetails ?? null);
  }

  useEffect(() => {
    if (!selectedItemId) {
      setEarnings([]);
      setDeductions([]);
      return;
    }

    void (async () => {
      try {
        const [earningsResponse, deductionsResponse] = await Promise.all([
          apiFetchJson<unknown>(`/api/payroll/item/earnings/${selectedItemId}`),
          apiFetchJson<unknown>(`/api/payroll/item/deductions/${selectedItemId}`),
        ]);

        setEarnings(
          toArray<Record<string, unknown>>(earningsResponse).map((row, idx) => ({
            key: String(row.earningsId ?? `earning-${idx + 1}`),
            label: String(row.description ?? row.type ?? `Earning ${idx + 1}`),
            amount: toMoneyString(row.amount),
            originalAmount: toOptionalMoneyString(row.originalAmount),
            adjustedBy: toOptionalText(row.adjustedBy),
            adjustedAt: toOptionalText(row.adjustedAt),
            isAdjusted: row.originalAmount != null || row.adjustedAt != null || row.adjustedBy != null,
          }))
        );
        setDeductions(
          toArray<Record<string, unknown>>(deductionsResponse).map((row, idx) => ({
            key: String(row.deductionsId ?? `deduction-${idx + 1}`),
            label: normalizePayslipLabel(String(row.deductionType ?? row.description ?? `Deduction ${idx + 1}`)),
            amount: toMoneyString(row.amount),
            originalAmount: toOptionalMoneyString(row.originalAmount),
            adjustedBy: toOptionalText(row.adjustedBy),
            adjustedAt: toOptionalText(row.adjustedAt),
            isAdjusted: row.originalAmount != null || row.adjustedAt != null || row.adjustedBy != null,
          }))
        );
      } catch {
        setEarnings([]);
        setDeductions([]);
      }
    })();
  }, [selectedItemId]);

  const totalEarnings = useMemo(
    () => earnings.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [earnings]
  );
  const totalDeductions = useMemo(
    () => deductions.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [deductions]
  );
  const netPay = useMemo(() => totalEarnings - totalDeductions, [totalDeductions, totalEarnings]);
  const adjustedLines = useMemo(
    () => [...earnings, ...deductions].filter((row) => row.isAdjusted),
    [deductions, earnings]
  );
  const hasAdjustedLines = adjustedLines.length > 0;

  const employeeName = useMemo(() => {
    const parts = [employeeInfo?.firstName, employeeInfo?.middleName, employeeInfo?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    return parts || '-';
  }, [employeeInfo]);

  const displayPayPeriod = useMemo(
    () => formatPeriodLabel(selectedRun?.periodStart, selectedRun?.periodEnd),
    [selectedRun]
  );
  const taxNumber = '-';
  const department = employeeInfo?.department?.trim() || '-';

  useEffect(() => {
    let cancelled = false;

    async function loadWorkedDays() {
      const startRaw = selectedRun?.periodStart;
      const endRaw = selectedRun?.periodEnd;
      if (!employeeId || !startRaw || !endRaw) {
        if (!cancelled) setWorkedDays('-');
        return;
      }

      const periodStart = new Date(`${startRaw}T00:00:00`);
      const periodEnd = new Date(`${endRaw}T23:59:59.999`);

      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        if (!cancelled) setWorkedDays('-');
        return;
      }

      try {
        const logs = await apiFetchJson<unknown>(
          `/api/logs/attendance/self/${employeeId}?direction=IN&timestampAfter=${encodeURIComponent(periodStart.toISOString())}&timestampBefore=${encodeURIComponent(periodEnd.toISOString())}&page=0&size=500`
        );

        const uniqueWorkedDays = new Set(
          toArray<Record<string, unknown>>(logs)
            .map((row) => (typeof row.timestamp === 'string' ? toManilaDateKey(row.timestamp) : null))
            .filter((value): value is string => Boolean(value))
        );

        if (!cancelled) {
          setWorkedDays(String(uniqueWorkedDays.size));
        }
      } catch {
        if (!cancelled) {
          setWorkedDays('-');
        }
      }
    }

    void loadWorkedDays();

    return () => {
      cancelled = true;
    };
  }, [employeeId, selectedRun]);

  function buildPayslipPdfName(document?: DocumentRow) {
    const lastName = sanitizeFileNamePart(employeeInfo?.lastName);
    const firstName = sanitizeFileNamePart(employeeInfo?.firstName);
    const employeeSegment = [lastName, firstName].filter(Boolean).join('_');
    const periodStart = formatFileDate(selectedRun?.periodStart);
    const periodEnd = formatFileDate(selectedRun?.periodEnd);
    const periodSegment =
      periodStart && periodEnd ? `${periodStart}_to_${periodEnd}` : sanitizeFileNamePart(displayPayPeriod);
    const documentName = sanitizeFileNamePart(document?.fileName?.replace(/\.pdf$/i, ''));
    const baseName =
      [employeeSegment, periodSegment].filter(Boolean).join('_') ||
      documentName ||
      `payslip_${selectedItemId ?? 'latest'}`;

    return `${baseName}.pdf`;
  }

  async function loadSelectedPayslipPdf() {
    const username = getUserEmail();
    if (!username) {
      throw new Error('Missing username.');
    }

    const documents = await apiFetchJson<DocumentRow[]>(
      `/api/user/documents/${encodeURIComponent(username)}?subDir=payslip`
    );
    const selectedDocument =
      documents.find((document) => matchesPayslipPeriod(document, selectedRun?.periodEnd)) ?? documents[0];

    if (!selectedDocument || typeof selectedDocument.pathId !== 'number') {
      throw new Error('No saved payslip PDF was found for this pay period yet.');
    }

    const documentViewPaths = [
      `/api/LOCAL/document/${selectedDocument.pathId}/view`,
      `/api/document/${selectedDocument.pathId}/view`,
    ];

    let documentBlob: Blob | null = null;

    for (const path of documentViewPaths) {
      const response = await apiFetchRaw(path, { method: 'GET' });

      if (response.ok) {
        documentBlob = await response.blob();
        break;
      }

      if (response.status !== 404) {
        throw new Error(`Failed to open the saved payslip (${response.status}).`);
      }
    }

    if (!documentBlob) {
      throw new Error('The saved payslip document could not be opened.');
    }

    const fileName = buildPayslipPdfName(selectedDocument);
    const pdfFile = new File(
      [documentBlob],
      fileName,
      { type: documentBlob.type || selectedDocument.fileType || 'application/pdf' }
    );

    return { file: pdfFile, fileName };
  }

  async function handleDownload() {
    setPayslipActionError('');
    setPrintingPayslip(true);

    try {
      const { file, fileName } = await loadSelectedPayslipPdf();
      const downloadUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
    } catch (error) {
      setPayslipActionError(error instanceof Error ? error.message : 'Failed to download the saved payslip.');
    } finally {
      setPrintingPayslip(false);
    }
  }

  async function handlePrintPayslip() {
    setPayslipActionError('');
    setPrintingPayslip(true);

    try {
      const { file } = await loadSelectedPayslipPdf();
      const documentUrl = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = documentUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
    } catch (error) {
      setPayslipActionError(error instanceof Error ? error.message : 'Failed to open the saved payslip.');
    } finally {
      setPrintingPayslip(false);
    }
  }

  function openDisputeForm() {
    setDisputeSubject('Overtime pay dispute');
    setDisputeReason('');
    setDisputeFile(null);
    setDisputeError('');
    setDisputeOpen(true);
  }

  async function submitDispute() {
    setDisputeError('');
    if (!selectedItemId) {
      setDisputeError('No payroll item selected.');
      return;
    }
    if (disputeReason.trim().length < 5) {
      setDisputeError('Reason must be at least 5 characters.');
      return;
    }

    setConfirmDisputeSubmit(false);
    setDisputeSubmitting(true);
    try {
      let attachmentRef: number | null = null;

      if (disputeFile) {
        attachmentRef = await uploadDocument(disputeFile, DISPUTE_UPLOAD_SUBDIR);
      }

      if (employeeId) {
        const existingDisputes = await apiFetchJson<unknown>(
          `/api/payroll/item/dispute/self?empId=${employeeId}&status=PENDING&page=0&size=100`
        );
        const hasPendingForItem = toArray<DisputeRow>(existingDisputes).some(
          (row) => row.itemId === selectedItemId && String(row.status ?? '').toUpperCase() === 'PENDING'
        );
        if (hasPendingForItem) {
          setDisputeError('This payslip already has a pending dispute request.');
          return;
        }
      }

      await apiFetchJson(`/api/payroll/item/dispute/create/${selectedItemId}`, {
        method: 'POST',
        body: JSON.stringify({
          subject: disputeSubject,
          reason: [
            disputeReason.trim(),
            attachmentRef ? `(Attachment ID: ${attachmentRef})` : '',
          ]
            .filter(Boolean)
            .join(' '),
        }),
      });
      setDisputeOpen(false);
    } catch (error) {
      setDisputeError(error instanceof Error ? error.message : 'Failed to file dispute.');
    } finally {
      setDisputeSubmitting(false);
    }
  }

  function requestDisputeConfirmation() {
    setDisputeError('');
    if (!selectedItemId) {
      setDisputeError('No payroll item selected.');
      return;
    }
    if (disputeReason.trim().length < 5) {
      setDisputeError('Reason must be at least 5 characters.');
      return;
    }
    setConfirmDisputeSubmit(true);
  }

  return (
    <div className="pay">
      <div className="pay__head">
        <PageHeader
          title="Payslips"
          description="Review each pay period, download your summary, and file payroll disputes when needed."
        />
        <div className="pay__selectWrap">
          <select
            className="pay__select"
            value={selectedPeriodIndex}
            onChange={(e) => handlePeriodChange(Number(e.target.value))}
            disabled={payslipPeriods.length === 0}
          >
            {payslipPeriods.length > 0 ? (
              payslipPeriods.map((period, idx) => (
                <option key={period} value={idx}>
                  {period}
                </option>
              ))
            ) : (
              <option>No payslip periods available</option>
            )}
          </select>
        </div>
      </div>

      <section className="payCard">
        <div className="payCard__header">
            <div className="payCard__company">
              <div className="payCard__companyName">Marid Industries Corporation</div>
              <div className="payCard__companyMeta">Address</div>
              <div className="payCard__companyMeta">marid@marid.com</div>
            </div>
          <div className="payCard__title">PAYSLIP</div>
        </div>

        <div className="payCard__rule" />

        {hasAdjustedLines && (
          <section className="payAdjustmentNotice" aria-live="polite">
            <strong>This payslip contains adjusted payroll lines.</strong>
            <span>
              {adjustedLines.length} {adjustedLines.length === 1 ? 'entry was' : 'entries were'} updated after the
              original computation.
            </span>
          </section>
        )}

        <div className="payInfo">
          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Name</span>
              <span className="payInfo__line">{employeeName}</span>
            </div>
            <div className="payInfo__row">
              <span>Tax Number</span>
              <span className="payInfo__line">{taxNumber}</span>
            </div>
            <div className="payInfo__row">
              <span>Designation</span>
              <span className="payInfo__line">{employeeInfo?.position ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Department</span>
              <span className="payInfo__line">{department}</span>
            </div>
          </div>

          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Pay Period</span>
              <span className="payInfo__line">{displayPayPeriod}</span>
            </div>
            <div className="payInfo__row">
              <span>Start Date</span>
              <span className="payInfo__line">{formatDisplayDate(selectedRun?.periodStart)}</span>
            </div>
            <div className="payInfo__row">
              <span>End Date</span>
              <span className="payInfo__line">{formatDisplayDate(selectedRun?.periodEnd)}</span>
            </div>
            <div className="payInfo__row">
              <span>Worked Days</span>
              <span className="payInfo__line">{workedDays}</span>
            </div>
          </div>
        </div>

        <div className="payTables">
          <div className="payTable">
            <div className="payTable__head">
              <div>Earnings</div>
              <div>Amount</div>
            </div>
            <div className="payTable__body">
              {earnings.length > 0 ? (
                earnings.map((item) => (
                  <div className={`payTable__row${item.isAdjusted ? ' payTable__row--adjusted' : ''}`} key={item.key}>
                    <div className="payTable__cell">
                      <div className="payTable__lineTitle">
                        <span>{item.label}</span>
                        {item.isAdjusted && <span className="payTable__badge">Adjusted</span>}
                      </div>
                      {item.isAdjusted && (
                        <div className="payTable__meta">
                          {item.adjustedBy && <span>By {item.adjustedBy}</span>}
                          {item.adjustedAt && <span>{formatAdjustmentTimestamp(item.adjustedAt)}</span>}
                        </div>
                      )}
                    </div>
                    <div className="payTable__amount">
                      <span>{formatCurrency(item.amount)}</span>
                      {item.isAdjusted && item.originalAmount && (
                        <span className="payTable__original">Original: {formatCurrency(item.originalAmount)}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="payTable__row">
                  <span>No earnings data available</span>
                  <span>-</span>
                </div>
              )}
            </div>
            <div className="payTable__total">
              <span>Total Earnings</span>
              <span>{formatCurrency(totalEarnings)}</span>
            </div>
          </div>

          <div className="payTable">
            <div className="payTable__head">
              <div>Deductions</div>
              <div>Amount</div>
            </div>
            <div className="payTable__body">
              {deductions.length > 0 ? (
                deductions.map((item) => (
                  <div className={`payTable__row${item.isAdjusted ? ' payTable__row--adjusted' : ''}`} key={item.key}>
                    <div className="payTable__cell">
                      <div className="payTable__lineTitle">
                        <span>{item.label}</span>
                        {item.isAdjusted && <span className="payTable__badge">Adjusted</span>}
                      </div>
                      {item.isAdjusted && (
                        <div className="payTable__meta">
                          {item.adjustedBy && <span>By {item.adjustedBy}</span>}
                          {item.adjustedAt && <span>{formatAdjustmentTimestamp(item.adjustedAt)}</span>}
                        </div>
                      )}
                    </div>
                    <div className="payTable__amount">
                      <span>{formatCurrency(item.amount)}</span>
                      {item.isAdjusted && item.originalAmount && (
                        <span className="payTable__original">Original: {formatCurrency(item.originalAmount)}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="payTable__row">
                  <span>No deductions data available</span>
                  <span>-</span>
                </div>
              )}
            </div>
            <div className="payTable__total">
              <span>Total Deductions</span>
              <span>{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>

        <div className="payNetRow">
          <div className="payNet">
            <span>Net Pay</span>
            <span>{formatCurrency(netPay)}</span>
          </div>
        </div>

        <div className="payCard__rule payCard__rule--thin" />

        <div className="paySign">
          <div className="paySign__line">
            <span>Employee Signature over Printed Name</span>
          </div>
          <div className="paySign__line">
            <span>Employer Signature over Printed Name</span>
          </div>
        </div>
      </section>

      <div className="payActions">
        <button className="payBtn" type="button" onClick={() => void handleDownload()} disabled={printingPayslip}>
          {printingPayslip ? 'Preparing Payslip...' : 'Download Payslip'}
        </button>
        <button className="payBtn" type="button" onClick={() => void handlePrintPayslip()} disabled={printingPayslip}>
          {printingPayslip ? 'Opening Payslip...' : 'Print Payslip'}
        </button>
        <button className="payBtn" type="button" onClick={openDisputeForm}>File Dispute</button>
      </div>

      {disputeOpen && (
        <div className="payModalBackdrop" role="dialog" aria-modal="true" aria-label="Payslip dispute form">
          <div className="payModal">
            <div className="payModal__top">
              <div>
                <div className="payModal__title">PAYSLIP DISPUTE FORM</div>
                <p className="payModal__subtitle">Describe the payroll discrepancy clearly and attach supporting proof only when it helps validate the dispute.</p>
              </div>
              <ModalCloseButton className="payModal__close" onClick={() => setDisputeOpen(false)} />
            </div>

            <div className="payModal__rule" />

            <div className="payModal__row">
              <label>Dispute Type:</label>
              <select value={disputeSubject} onChange={(e) => setDisputeSubject(e.target.value)}>
                <option>Overtime pay dispute</option>
                <option>Late penalty dispute</option>
                <option>Absent deduction dispute</option>
                <option>General payroll dispute</option>
              </select>
            </div>

            <div className="payModal__row payModal__row--col">
              <label>Reason for Dispute:</label>
              <textarea
                placeholder="Describe your dispute..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
            </div>

            <div className="payModal__row">
              <FileUploadField
                label="Supporting Documents (Optional)"
                hint="Add screenshots, payroll references, or other supporting files only when they directly explain the issue. Maximum file size: 10 MB."
                file={disputeFile}
                onChange={setDisputeFile}
                uploadLabel="Upload Attachment"
                replaceLabel="Replace Attachment"
                emptyLabel="Optional attachment"
              />
            </div>

            <div className="payModal__actions">
              <button type="button" className="payModal__cancel" onClick={() => setDisputeOpen(false)} disabled={disputeSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={requestDisputeConfirmation} disabled={disputeSubmitting}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDisputeSubmit}
        title="Confirm Payslip Dispute"
        message={`Submit this dispute for the payroll period ${displayPayPeriod}?`}
        confirmLabel="Submit Dispute"
        cancelLabel="Go Back"
        isBusy={disputeSubmitting}
        onConfirm={() => void submitDispute()}
        onCancel={() => setConfirmDisputeSubmit(false)}
      />
    </div>
  );
}
