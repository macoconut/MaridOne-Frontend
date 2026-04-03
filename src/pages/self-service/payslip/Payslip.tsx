import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson, apiFetchRaw, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
import { FiUpload, FiX } from 'react-icons/fi';
import './Payslip.css';

type EmployeeDetails = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  position?: string;
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

type PayslipLine = {
  key: string;
  label: string;
  amount: string;
  originalAmount?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  isAdjusted: boolean;
};

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
    month: 'short',
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
    month: 'short',
    day: 'numeric',
  });
}

function formatPeriodLabel(start?: string, end?: string) {
  if (!start || !end) return '-';
  return `${formatDisplayDate(start)} to ${formatDisplayDate(end)}`;
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
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeSubject, setDisputeSubject] = useState('Overtime pay dispute');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [disputeError, setDisputeError] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

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
        const first = rows[0];
        setSelectedItemId(
          typeof first?.id === 'number'
            ? first.id
            : typeof first?.itemId === 'number'
              ? first.itemId
              : null
        );
        setSelectedRun(first?.runDetails ?? null);
        setSelectedPeriodIndex(0);
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
  }, []);

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
            label: String(row.deductionType ?? row.description ?? `Deduction ${idx + 1}`),
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

  const workedDays = useMemo(() => {
    const startRaw = selectedRun?.periodStart;
    const endRaw = selectedRun?.periodEnd;
    if (!startRaw || !endRaw) return '-';
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? String(diffDays) : '-';
  }, [selectedRun]);

  const displayPayPeriod = useMemo(
    () => formatPeriodLabel(selectedRun?.periodStart, selectedRun?.periodEnd),
    [selectedRun]
  );

  function handleDownload() {
    const formatLine = (line: PayslipLine) => {
      const parts = [`${line.label}: ${line.amount}`];
      if (line.isAdjusted) {
        parts.push(
          `[Adjusted${line.originalAmount ? ` | Original: ${line.originalAmount}` : ''}${
            line.adjustedBy ? ` | By: ${line.adjustedBy}` : ''
          }${line.adjustedAt ? ` | At: ${formatAdjustmentTimestamp(line.adjustedAt)}` : ''}]`
        );
      }
      return parts.join(' ');
    };

    const content = [
      `Employee ID: ${employeeId ?? '-'}`,
      `Selected Item ID: ${selectedItemId ?? '-'}`,
      `Pay Period: ${displayPayPeriod}`,
      hasAdjustedLines ? `Adjusted Lines: ${adjustedLines.length}` : 'Adjusted Lines: 0',
      '',
      'Earnings:',
      ...(earnings.length > 0 ? earnings.map(formatLine) : ['No earnings data available']),
      '',
      'Deductions:',
      ...(deductions.length > 0 ? deductions.map(formatLine) : ['No deductions data available']),
      '',
      `Total Earnings: ${totalEarnings.toFixed(2)}`,
      `Total Deductions: ${totalDeductions.toFixed(2)}`,
      `Net Pay: ${(totalEarnings - totalDeductions).toFixed(2)}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `payslip-summary-${selectedItemId ?? 'latest'}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openDisputeForm() {
    setDisputeSubject('Overtime pay dispute');
    setDisputeReason('');
    setDisputeFile(null);
    setDisputeError('');
    setDisputeOpen(true);
  }

  async function uploadDocument(file: File) {
    const uploadPaths = ['/api/document/upload', '/api/LOCAL/document/upload'];

    for (const path of uploadPaths) {
      const form = new FormData();
      form.append('file', file);

      const response = await apiFetchRaw(path, {
        method: 'POST',
        body: form,
      });

      if (response.ok) {
        const payload = (await response.json()) as Record<string, unknown>;
        const pathId = typeof payload.pathId === 'number' ? payload.pathId : null;
        if (pathId != null) return pathId;
        throw new Error('Document upload succeeded but no file reference was returned.');
      }

      if (response.status !== 404) {
        throw new Error(`Document upload failed (${response.status}).`);
      }
    }

    throw new Error('Document upload endpoint is not enabled in current backend profile.');
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

    setDisputeSubmitting(true);
    try {
      let attachmentRef: number | null = null;

      if (disputeFile) {
        attachmentRef = await uploadDocument(disputeFile);
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

  return (
    <div className="pay">
      <div className="pay__head">
        <h1 className="pay__title">Payslips</h1>
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
              <div className="payCard__companyMeta">Employee payroll statement</div>
              <div className="payCard__companyMeta">{displayPayPeriod}</div>
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
              <span>Employee Number</span>
              <span className="payInfo__line">{employeeId ? `EMP-${employeeId}` : '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Designation</span>
              <span className="payInfo__line">{employeeInfo?.position ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Email</span>
              <span className="payInfo__line">{employeeInfo?.email ?? '-'}</span>
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
              <span>Covered Days</span>
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
                    <span>{item.amount}</span>
                    {item.isAdjusted && item.originalAmount && (
                      <span className="payTable__original">Original: {item.originalAmount}</span>
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
            <div className="payTable__total">
              <span>Total Earnings</span>
              <span>{totalEarnings.toFixed(2)}</span>
            </div>
          </div>

          <div className="payTable">
            <div className="payTable__head">
              <div>Deductions</div>
              <div>Amount</div>
            </div>
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
                    <span>{item.amount}</span>
                    {item.isAdjusted && item.originalAmount && (
                      <span className="payTable__original">Original: {item.originalAmount}</span>
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
            <div className="payTable__total">
              <span>Total Deductions</span>
              <span>{totalDeductions.toFixed(2)}</span>
            </div>
            <div className="payTable__net">
              <span>Net Pay</span>
              <span>{(totalEarnings - totalDeductions).toFixed(2)}</span>
            </div>
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
        <button className="payBtn" type="button" onClick={handleDownload}>Download Summary</button>
        <button className="payBtn" type="button" onClick={() => window.print()}>Print Payslip</button>
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
              <button type="button" className="payModal__close" onClick={() => setDisputeOpen(false)} aria-label="Close">
                <FiX />
              </button>
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
              <label>Supporting Documents (if any):</label>
              <div className="payModal__uploadCard">
                <p className="payModal__uploadHint">
                  Add screenshots, payroll references, or other supporting files only when they directly explain the issue.
                </p>
                <div className="payModal__uploadRow">
                  <label className="payModal__uploadBtn">
                    <FiUpload />
                    <span>{disputeFile ? 'Replace Attachment' : 'Upload Attachment'}</span>
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => setDisputeFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <span className="payModal__uploadName">{disputeFile ? disputeFile.name : 'No file selected'}</span>
                </div>
              </div>
            </div>

            <div className="payModal__actions">
              <button type="button" className="payModal__cancel" onClick={() => setDisputeOpen(false)} disabled={disputeSubmitting}>
                Cancel
              </button>
              <button type="button" onClick={() => void submitDispute()} disabled={disputeSubmitting}>
                Submit
              </button>
            </div>
            {disputeError && <p className="payModal__error">{disputeError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
