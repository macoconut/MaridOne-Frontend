import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson, toArray } from '../../../lib/api';
import './Payslips.css';

type DisputeDto = {
  id?: number;
  subject?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
  statusReason?: string;
  itemId?: number;
};

type DisputeStatus = 'Open' | 'Clear';

type DisputeRow = {
  id: number;
  employee: string;
  department: string;
  payrollPeriod: string;
  status: DisputeStatus;
  subject: string;
  reason: string;
};

function mapStatus(value: string | undefined): DisputeStatus {
  return value && value.toUpperCase() === 'PENDING' ? 'Open' : 'Clear';
}

export default function HrPayslips() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [runMessage, setRunMessage] = useState('');

  async function loadDisputes() {
    try {
      const response = await apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=100');
      const mapped = toArray<DisputeDto>(response).map((item, idx) => ({
        id: item.id ?? idx + 1,
        employee: `Item #${item.itemId ?? '-'}`,
        department: 'From backend',
        payrollPeriod: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString()
          : 'No date',
        status: mapStatus(item.status),
        subject: item.subject || 'Payroll dispute',
        reason: item.reason || '',
      }));
      setDisputes(mapped);
    } catch {
      setDisputes([]);
    }
  }

  useEffect(() => {
    void loadDisputes();
  }, []);

  const currentPayPeriod = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }, []);

  async function updateDispute(status: 'APPROVED' | 'REJECTED') {
    if (!selectedDispute) return;
    setIsSaving(true);
    setActionError('');
    try {
      await apiFetchJson(`/api/payroll/item/dispute/update/${selectedDispute.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          statusReason: remarks.trim() || `${status} by HR in payslip review`,
        }),
      });
      setSelectedDispute(null);
      setRemarks('');
      await loadDisputes();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update dispute status.');
    } finally {
      setIsSaving(false);
    }
  }

  async function runPayForCurrentPeriod() {
    setRunMessage('');
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    try {
      await apiFetchJson('/api/payroll/run/create', {
        method: 'POST',
        body: JSON.stringify({
          periodStart: toISO(periodStart),
          periodEnd: toISO(periodEnd),
          periodDescription: `HR pay run ${toISO(periodStart)} to ${toISO(periodEnd)}`,
          payrollStatus: 'IN_PROGRESS',
          runType: 'REGULAR',
        }),
      });
      setRunMessage('Payroll run created successfully.');
    } catch (error) {
      setRunMessage(error instanceof Error ? error.message : 'Failed to create payroll run.');
    }
  }

  return (
    <div className="hrPay">
      <h1 className="hrPay__title">Manage Payslips</h1>

      <section className="hrPayPeriod">
        <div>
          <h2>Current Pay Period: {currentPayPeriod}</h2>
          <p>
            Period from: <span>Waiting for payroll run endpoint data</span>
          </p>
        </div>
        <button type="button" onClick={() => void runPayForCurrentPeriod()}>Run Pay for this Period</button>
      </section>
      {runMessage && <p className="hrPay__message">{runMessage}</p>}

      <section className="hrPayPanel">
        <header className="hrPayPanel__head">Payroll Dispute from Employees</header>

        <div className="hrPayTable">
          <div className="hrPayTable__head">
            <span>Employee Name</span>
            <span>Department</span>
            <span>Payroll Period</span>
            <span>Status</span>
          </div>
          <div className="hrPayTable__body">
            {disputes.length > 0 ? (
              disputes.map((row) => (
                <button key={row.id} className="hrPayRow" type="button" onClick={() => setSelectedDispute(row)}>
                  <span>{row.employee}</span>
                  <span>{row.department}</span>
                  <span>{row.payrollPeriod}</span>
                  <span className={row.status === 'Open' ? 'is-open' : ''}>{row.status}</span>
                </button>
              ))
            ) : (
              <div className="hrPayRow">
                <span>No disputes yet</span>
                <span>-</span>
                <span>-</span>
                <span>Clear</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedDispute && (
        <div className="hrPayModalBackdrop" role="dialog" aria-modal="true">
          <article className="hrPayModal">
            <h3>{selectedDispute.employee} - Payslip Dispute</h3>
            <div className="hrPayModal__rule" />

            <div className="hrPayModal__grid">
              <label>
                <span>Department:</span>
                <input value={selectedDispute.department} readOnly />
              </label>
              <label>
                <span>Status:</span>
                <input value={selectedDispute.status} readOnly />
              </label>
              <label>
                <span>Payroll Period:</span>
                <input value={selectedDispute.payrollPeriod} readOnly />
              </label>
              <label>
                <span>Dispute Type:</span>
                <input value={selectedDispute.subject} readOnly />
              </label>
            </div>

            <label className="hrPayModal__area">
              <span>Reason for Dispute:</span>
              <textarea value={selectedDispute.reason || 'No reason provided.'} readOnly />
            </label>

            <div className="hrPayModal__line">
              <span>Supporting Documents:</span>
              <button type="button">No file endpoint yet</button>
            </div>

            <div className="hrPayModal__line">
              <span>Administrative Approval:</span>
              <div className="hrPayModal__inlineBtns">
                <button type="button" disabled={isSaving} onClick={() => void updateDispute('APPROVED')}>
                  Approve
                </button>
                <button type="button" className="is-muted" disabled={isSaving} onClick={() => void updateDispute('REJECTED')}>
                  Deny
                </button>
              </div>
            </div>

            <label className="hrPayModal__area">
              <span>Remarks:</span>
              <textarea
                placeholder="Enter review notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </label>
            {actionError && <p className="hrPay__message">{actionError}</p>}

            <div className="hrPayModal__actions">
              <button type="button" className="is-muted" onClick={() => setSelectedDispute(null)} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => setSelectedDispute(null)} disabled={isSaving}>
                Close
              </button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
