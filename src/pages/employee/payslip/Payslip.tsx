import { useEffect, useMemo, useState } from 'react';
import { apiRequest, asArray } from '../../../lib/api';
import './Payslip.css';

type UserDetails = {
  employeeId?: number | string;
  id?: number | string;
};

type PayrollItem = {
  itemId?: number | string;
  id?: number | string;
  payPeriod?: string;
  fromDate?: string;
  toDate?: string;
  workedDays?: number;
  employeeName?: string;
  position?: string;
  department?: string;
  taxNumber?: string;
  baseSalary?: number;
};

type AmountItem = {
  label?: string;
  name?: string;
  amount?: number | string;
  value?: number | string;
};

function getStorageValue(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(value);
}

function toAmountNumber(item: AmountItem): number {
  const raw = item.amount ?? item.value ?? 0;
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString();
}

export default function Payslip() {
  const [payrollItems, setPayrollItems] = useState<PayrollItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [earnings, setEarnings] = useState<AmountItem[]>([]);
  const [deductions, setDeductions] = useState<AmountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPayslipItems() {
      setIsLoading(true);
      setMessage('');

      const usernameOrEmail = (getStorageValue('maridone.userEmail') ?? '').trim();
      if (!usernameOrEmail) {
        if (isMounted) {
          setMessage('No active session found. Please log in again.');
          setIsLoading(false);
        }
        return;
      }

      let employeeId: string | number | undefined;
      try {
        const user = await apiRequest<UserDetails>(`/api/user/details/${encodeURIComponent(usernameOrEmail)}`);
        employeeId = user.employeeId ?? user.id;
      } catch {
        employeeId = undefined;
      }

      if (!employeeId) {
        if (isMounted) {
          setMessage('Unable to resolve employee profile.');
          setIsLoading(false);
        }
        return;
      }

      try {
        const payload = await apiRequest<unknown>(`/api/payroll/item/${employeeId}`);
        const list = asArray<PayrollItem>(payload);
        if (!isMounted) return;
        setPayrollItems(list);
        const firstId = list[0]?.itemId ?? list[0]?.id;
        setSelectedItemId(firstId ? String(firstId) : '');
      } catch (error) {
        if (!isMounted) return;
        setPayrollItems([]);
        setSelectedItemId('');
        setMessage(`Failed to load payslip items: ${String(error)}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadPayslipItems();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadBreakdown() {
      if (!selectedItemId) {
        setEarnings([]);
        setDeductions([]);
        return;
      }
      try {
        const [earningsPayload, deductionsPayload] = await Promise.all([
          apiRequest<unknown>(`/api/payroll/item/earnings/${selectedItemId}`),
          apiRequest<unknown>(`/api/payroll/item/deductions/${selectedItemId}`),
        ]);
        if (!isMounted) return;
        setEarnings(asArray<AmountItem>(earningsPayload));
        setDeductions(asArray<AmountItem>(deductionsPayload));
      } catch (error) {
        if (!isMounted) return;
        setEarnings([]);
        setDeductions([]);
        setMessage(`Failed to load earnings/deductions: ${String(error)}`);
      }
    }

    void loadBreakdown();

    return () => {
      isMounted = false;
    };
  }, [selectedItemId]);

  const selectedItem = useMemo(
    () => payrollItems.find((item) => String(item.itemId ?? item.id ?? '') === selectedItemId) ?? null,
    [payrollItems, selectedItemId]
  );

  const totalEarnings = earnings.reduce((sum, item) => sum + toAmountNumber(item), 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + toAmountNumber(item), 0);
  const netPay = totalEarnings - totalDeductions;

  const payslipPeriods = payrollItems.map((item) => {
    const id = String(item.itemId ?? item.id ?? '');
    const fromDate = formatDate(item.fromDate);
    const toDate = formatDate(item.toDate);
    const label = item.payPeriod?.trim() || `${fromDate} - ${toDate}`;
    return { id, label };
  });

  return (
    <div className="pay">
      <div className="pay__head">
        <h1 className="pay__title">Payslips</h1>
        <div className="pay__selectWrap">
          <select
            className="pay__select"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={payslipPeriods.length === 0}
          >
            {payslipPeriods.length > 0 ? (
              payslipPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))
            ) : (
              <option value="">No payslip periods available</option>
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
              <span className="payInfo__line">{selectedItem?.employeeName ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Tax Number</span>
              <span className="payInfo__line">{selectedItem?.taxNumber ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Designation</span>
              <span className="payInfo__line">{selectedItem?.position ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Department</span>
              <span className="payInfo__line">{selectedItem?.department ?? '-'}</span>
            </div>
          </div>

          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Pay Period</span>
              <span className="payInfo__line">{selectedItem?.payPeriod ?? '-'}</span>
            </div>
            <div className="payInfo__row">
              <span>Start Date</span>
              <span className="payInfo__line">{formatDate(selectedItem?.fromDate)}</span>
            </div>
            <div className="payInfo__row">
              <span>End Date</span>
              <span className="payInfo__line">{formatDate(selectedItem?.toDate)}</span>
            </div>
            <div className="payInfo__row">
              <span>Worked Days</span>
              <span className="payInfo__line">{selectedItem?.workedDays ?? '-'}</span>
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
              earnings.map((item, idx) => (
                <div className="payTable__row" key={`${item.label ?? item.name ?? 'earning'}-${idx}`}>
                  <span>{item.label ?? item.name ?? 'Earning'}</span>
                  <span>{toCurrency(toAmountNumber(item))}</span>
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
              <span>{toCurrency(totalEarnings)}</span>
            </div>
          </div>

          <div className="payTable">
            <div className="payTable__head">
              <div>Deductions</div>
              <div>Amount</div>
            </div>
            {deductions.length > 0 ? (
              deductions.map((item, idx) => (
                <div className="payTable__row" key={`${item.label ?? item.name ?? 'deduction'}-${idx}`}>
                  <span>{item.label ?? item.name ?? 'Deduction'}</span>
                  <span>{toCurrency(toAmountNumber(item))}</span>
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
              <span>{toCurrency(totalDeductions)}</span>
            </div>
            <div className="payTable__net">
              <span>Net Pay</span>
              <span>{toCurrency(netPay)}</span>
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
        <button className="payBtn" type="button">Download Payslip</button>
        <button className="payBtn" type="button">Print Payslip</button>
        <button className="payBtn" type="button">File Dispute</button>
      </div>

      {(isLoading || message) && <p style={{ marginTop: 12 }}>{isLoading ? 'Loading payslip...' : message}</p>}
    </div>
  );
}
