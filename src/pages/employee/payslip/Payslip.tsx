import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getUserEmail } from '../../../lib/session';
import './Payslip.css';

export default function Payslip() {
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [payslipPeriods, setPayslipPeriods] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [earnings, setEarnings] = useState<Array<{ label: string; amount: string }>>([]);
  const [deductions, setDeductions] = useState<Array<{ label: string; amount: string }>>([]);

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

        const items = await apiFetchJson<unknown>(`/api/payroll/item/${resolvedEmpId}`);
        const rows = toArray<Record<string, unknown>>(items);
        setPayslipPeriods(rows.map((row, idx) => String(row.period ?? `Payslip ${idx + 1}`)));
        const first = rows[0];
        setSelectedItemId(typeof first?.id === 'number' ? first.id : typeof first?.itemId === 'number' ? (first.itemId as number) : null);
      } catch {
        setEmployeeId(null);
        setPayslipPeriods([]);
        setSelectedItemId(null);
      }
    })();
  }, []);

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
            label: String(row.description ?? row.type ?? `Earning ${idx + 1}`),
            amount: String(row.amount ?? '0.00'),
          }))
        );
        setDeductions(
          toArray<Record<string, unknown>>(deductionsResponse).map((row, idx) => ({
            label: String(row.deductionType ?? row.description ?? `Deduction ${idx + 1}`),
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

  function handleDownload() {
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

  return (
    <div className="pay">
      <div className="pay__head">
        <h1 className="pay__title">Payslips</h1>
        <div className="pay__selectWrap">
          <select className="pay__select" disabled={payslipPeriods.length === 0}>
            {payslipPeriods.length > 0 ? (
              payslipPeriods.map((period) => <option key={period}>{period}</option>)
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

        <div className="payInfo">
          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Name</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Tax Number</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Designation</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Department</span>
              <span className="payInfo__line" />
            </div>
          </div>

          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Pay Period</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Start Date</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>End Date</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Worked Days</span>
              <span className="payInfo__line" />
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
                <div className="payTable__row" key={item.label}>
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
                <div className="payTable__row" key={item.label}>
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
        <button className="payBtn" type="button" onClick={handleDownload}>Download Payslip</button>
        <button className="payBtn" type="button" onClick={() => window.print()}>Print Payslip</button>
        <button className="payBtn" type="button" onClick={() => navigate('/employee/approvals')}>File Dispute</button>
      </div>
    </div>
  );
}
