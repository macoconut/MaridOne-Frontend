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

export default function Payslip() {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [payrollItems, setPayrollItems] = useState<PayrollItemRow[]>([]);
  const [loadNotice, setLoadNotice] = useState('');
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0);
  const [payslipPeriods, setPayslipPeriods] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedRun, setSelectedRun] = useState<{ periodStart?: string; periodEnd?: string } | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeDetails | null>(null);
  const [earnings, setEarnings] = useState<Array<{ key: string; label: string; amount: string }>>([]);
  const [deductions, setDeductions] = useState<Array<{ key: string; label: string; amount: string }>>([]);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeSubject, setDisputeSubject] = useState('Overtime pay dispute');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFile, setDisputeFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
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
        setLoadNotice(
          rows.length === 0
            ? 'Posted payslips will appear here once HR posts a payroll run.'
            : ''
        );
        setPayrollItems(rows);
        setPayslipPeriods(
          rows.map((row, idx) => {
            const start = row.runDetails?.periodStart;
            const end = row.runDetails?.periodEnd;
            return start && end ? `${start} to ${end}` : `Payslip ${idx + 1}`;
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
        setLoadNotice('We could not load your payslip records right now.');
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
            key: String(row.earningsId ?? `earn-${idx}-${row.description ?? row.type ?? 'unknown'}-${row.amount ?? '0.00'}`),
            label: String(row.description ?? row.type ?? `Earning ${idx + 1}`),
            amount: String(row.amount ?? '0.00'),
          }))
        );
        setDeductions(
          toArray<Record<string, unknown>>(deductionsResponse).map((row, idx) => ({
            key: String(row.deductionsId ?? `deduct-${idx}-${row.deductionType ?? row.description ?? 'unknown'}-${row.amount ?? '0.00'}`),
            label: String(row.description ?? row.deductionType ?? `Deduction ${idx + 1}`),
            amount: String(row.amount ?? '0.00'),
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

  const employeeName = useMemo(() => {
    const parts = [employeeInfo?.firstName, employeeInfo?.middleName, employeeInfo?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
    return parts || '-';
  }, [employeeInfo]);

  const employeeAddress = useMemo(() => {
    const addr = employeeInfo?.address;
    if (!addr) return '-';
    const parts = [
      addr.permanentAddress,
      addr.temporaryAddress,
      addr.city,
      addr.state,
      addr.country,
      addr.zipCode,
    ]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());
    return parts.length > 0 ? parts.join(', ') : '-';
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

  const hasPayslip = selectedItemId !== null;

  function handleDownload() {
    if (!selectedItemId) return;
    const content = [
      `Employee ID: ${employeeId ?? '-'}`,
      `Selected Item ID: ${selectedItemId ?? '-'}`,
      `Total Earnings: ${totalEarnings.toFixed(2)}`,
      `Total Deductions: ${totalDeductions.toFixed(2)}`,
      `Net Pay: ${(totalEarnings - totalDeductions).toFixed(2)}`,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `payslip-${selectedItemId ?? 'latest'}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openDisputeForm() {
    if (!selectedItemId) return;
    setDisputeSubject('Overtime pay dispute');
    setDisputeReason('');
    setDisputeFile(null);
    setSignatureFile(null);
    setDisputeError('');
    setDisputeOpen(true);
  }

  async function uploadDocument(file: File) {
    const form = new FormData();
    form.append('file', file);
    const response = await apiFetchRaw('/api/document/upload', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? 'Document upload endpoint is not enabled in current backend profile.'
          : `Document upload failed (${response.status}).`
      );
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const pathId = typeof payload.pathId === 'number' ? payload.pathId : null;
    return pathId;
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
      let signatureRef: number | null = null;

      if (disputeFile) {
        attachmentRef = await uploadDocument(disputeFile);
      }
      if (signatureFile) {
        signatureRef = await uploadDocument(signatureFile);
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
            signatureRef ? `(Signature ID: ${signatureRef})` : '',
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
      {loadNotice && <p className="pay__notice">{loadNotice}</p>}

      <section className="payCard">
        <div className="payCard__header">
            <div className="payCard__company">
              <div className="payCard__companyName">Marid Industries Corporation</div>
              <div className="payCard__companyMeta">{employeeAddress}</div>
              <div className="payCard__companyMeta">{employeeInfo?.email ?? 'marid@marid.com'}</div>
            </div>
          <div className="payCard__title">PAYSLIP</div>
        </div>

        <div className="payCard__rule" />

        <div className="payInfo">
          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Name</span>
              <span className="payInfo__line">{employeeName}</span>
            </div>
            <div className="payInfo__row">
              <span>Tax Number</span>
              <span className="payInfo__line">{employeeId ? `EMP-${employeeId}` : '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Designation</span>
              <span className="payInfo__line">{employeeInfo?.position ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Department</span>
              <span className="payInfo__line">{employeeInfo?.position ?? '-'}</span>
            </div>
          </div>

          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Pay Period</span>
              <span className="payInfo__line">
                {selectedRun?.periodStart && selectedRun?.periodEnd
                  ? `${selectedRun.periodStart} to ${selectedRun.periodEnd}`
                  : '-'}
              </span>
            </div>
            <div className="payInfo__row">
              <span>Start Date</span>
              <span className="payInfo__line">{selectedRun?.periodStart ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>End Date</span>
              <span className="payInfo__line">{selectedRun?.periodEnd ?? '-'}</span>
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
            {earnings.length > 0 ? (
              earnings.map((item) => (
                <div className="payTable__row" key={item.key}>
                  <span>{item.label}</span>
                  <span>{item.amount}</span>
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
                <div className="payTable__row" key={item.key}>
                  <span>{item.label}</span>
                  <span>{item.amount}</span>
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
        <button className="payBtn" type="button" onClick={handleDownload} disabled={!hasPayslip}>Download Payslip</button>
        <button className="payBtn" type="button" onClick={() => window.print()} disabled={!hasPayslip}>Print Payslip</button>
        <button className="payBtn" type="button" onClick={openDisputeForm} disabled={!hasPayslip}>File Dispute</button>
      </div>

      {disputeOpen && (
        <div className="payModalBackdrop" role="dialog" aria-modal="true" aria-label="Payslip dispute form">
          <div className="payModal">
            <div className="payModal__top">
              <div className="payModal__title">PAYSLIP DISPUTE FORM</div>
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
              <label className="payModal__upload">
                <FiUpload />
                <span>{disputeFile ? disputeFile.name : 'Upload Here'}</span>
                <input type="file" style={{ display: 'none' }} onChange={(e) => setDisputeFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="payModal__row">
              <label>Employee's Signature:</label>
              <label className="payModal__upload">
                <FiUpload />
                <span>{signatureFile ? signatureFile.name : 'Upload Here'}</span>
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
                />
              </label>
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
