import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './manage-emp.css';

type ModalType = 'add' | 'edit-pick' | 'edit' | 'delete' | null;

type EmployeeRow = {
  id: string;
  name: string;
  status: string;
  email: string;
  phone: string;
  position: string;
};

type FormState = {
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  employmentStatus: string;
  email: string;
  password: string;
  phoneNumber: string;
  position: string;
  permanentAddress: string;
  temporaryAddress: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  reason: string;
};

type AttendanceLog = {
  employeeId?: number;
};

const emptyForm: FormState = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  employmentStatus: 'REGULAR',
  email: '',
  password: '',
  phoneNumber: '',
  position: 'EMPLOYEE',
  permanentAddress: '',
  temporaryAddress: '',
  city: '',
  state: '',
  country: '',
  zipCode: '',
  reason: '',
};

export default function HrManageEmp() {
  const [modal, setModal] = useState<ModalType>(null);
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([]);
  const [loadMessage, setLoadMessage] = useState<string>('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedEmployee = useMemo(
    () => employeeRows.find((row) => row.id === form.employeeId) ?? null,
    [employeeRows, form.employeeId]
  );

  async function loadEmployees() {
    try {
      const response = await apiFetchJson<unknown>('/api/employees?page=0&size=100');
      const mapped = toArray<Record<string, unknown>>(response).map((item, idx) => ({
        id: String(item.employeeId ?? item.id ?? idx + 1),
        name:
          [item.firstName, item.middleName, item.lastName]
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
            .join(' ') || `Employee #${item.employeeId ?? item.id ?? idx + 1}`,
        status: String(item.employmentStatus ?? '-'),
        email: String(item.email ?? '-'),
        phone: String(item.phoneNumber ?? '-'),
        position: String(item.position ?? '-'),
      }));
      setEmployeeRows(mapped);
      setLoadMessage(mapped.length === 0 ? 'No employees found.' : '');
    } catch (error) {
      try {
        const logsResponse = await apiFetchJson<unknown>('/api/logs/attendance?page=0&size=500');
        const ids = new Set<number>();
        for (const log of toArray<AttendanceLog>(logsResponse)) {
          if (typeof log.employeeId === 'number') ids.add(log.employeeId);
        }
        const fallbackRows = [...ids]
          .sort((a, b) => a - b)
          .map((id) => ({
            id: String(id),
            name: `Employee #${id}`,
            status: 'Unknown',
            email: '-',
            phone: '-',
            position: '-',
          }));
        setEmployeeRows(fallbackRows);
        setLoadMessage(
          fallbackRows.length > 0
            ? 'Loaded employee IDs from attendance logs only. Full profile list endpoint is restricted for HR role.'
            : 'No employee data available for HR role yet.'
        );
      } catch {
        setEmployeeRows([]);
        const message = getFriendlyErrorMessage(error, 'employee-load');
        setLoadMessage(`Cannot load employees for HR role yet: ${message}`);
      }
    }
  }

  useEffect(() => {
    if (modal) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [modal]);

  useEffect(() => {
    void loadEmployees();
  }, []);

  function openModal(type: ModalType) {
    setModal(type);
    setSubmitError('');
    setSubmitSuccess('');
    setForm(emptyForm);
  }

  function closeModal() {
    setModal(null);
    setSubmitError('');
    setSubmitSuccess('');
    setForm(emptyForm);
  }

  function populateFormFromRow(row: EmployeeRow) {
    setForm((prev) => ({
      ...prev,
      employeeId: row.id,
      firstName: row.name.split(' ')[0] ?? '',
      middleName: '',
      lastName: row.name.split(' ').slice(1).join(' ') ?? '',
      email: row.email === '-' ? '' : row.email,
      phoneNumber: row.phone === '-' ? '' : row.phone,
      position: row.position === '-' ? 'EMPLOYEE' : row.position,
      employmentStatus: row.status === '-' ? 'REGULAR' : row.status,
    }));
  }

  function beginEdit(row: EmployeeRow) {
    populateFormFromRow(row);
    setSubmitError('');
    setSubmitSuccess('');
    setModal('edit');
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!modal) return;
    setSubmitError('');
    setSubmitSuccess('');
    setIsSaving(true);
    try {
      if (modal === 'add') {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
          throw new Error('First name, last name, and email are required.');
        }
        await apiFetchJson('/api/employees/create', {
          method: 'POST',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || undefined,
            lastName: form.lastName.trim(),
            birthDate: form.birthDate || undefined,
            employmentStatus: form.employmentStatus,
            email: form.email.trim(),
            phoneNumber: form.phoneNumber.trim() || undefined,
            position: form.position,
            address: {
              permanentAddress: form.permanentAddress.trim() || undefined,
              temporaryAddress: form.temporaryAddress.trim() || undefined,
              city: form.city.trim() || undefined,
              state: form.state.trim() || undefined,
              country: form.country.trim() || undefined,
              zipCode: form.zipCode.trim() || undefined,
            },
          }),
        });
        setSubmitSuccess('Employee created successfully.');
      } else if (modal === 'edit') {
        const id = Number(form.employeeId);
        if (!Number.isFinite(id)) throw new Error('Employee ID is required for edit.');
        await apiFetchJson(`/api/employees/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim() || undefined,
            middleName: form.middleName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            birthDate: form.birthDate || undefined,
            email: form.email.trim() || undefined,
            phoneNumber: form.phoneNumber.trim() || undefined,
            position: form.position || undefined,
            address: {
              permanentAddress: form.permanentAddress.trim() || undefined,
              temporaryAddress: form.temporaryAddress.trim() || undefined,
              city: form.city.trim() || undefined,
              state: form.state.trim() || undefined,
              country: form.country.trim() || undefined,
              zipCode: form.zipCode.trim() || undefined,
            },
          }),
        });
        setSubmitSuccess('Employee updated successfully.');
      } else if (modal === 'delete') {
        const id = Number(form.employeeId);
        if (!Number.isFinite(id)) throw new Error('Employee ID is required for status update.');
        await apiFetchJson(`/api/employees/status/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            employmentStatus: 'TERMINATED',
          }),
        });
        setSubmitSuccess('Employee terminated successfully.');
      }
      await loadEmployees();
    } catch (error) {
      setSubmitError(
        getFriendlyErrorMessage(error, modal === 'delete' ? 'employee-terminate' : 'employee-save')
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="hrEmp">
      <h1 className="hrEmp__title">Employee Management</h1>

      <section className="hrEmpTable">
        <div className="hrEmpTable__head">
          <div>Employee ID</div>
          <div>Name</div>
          <div>Status</div>
          <div>Email</div>
          <div>Phone Number</div>
          <div>Position</div>
        </div>

        <div className="hrEmpTable__body">
          {employeeRows.length > 0 ? (
            employeeRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="hrEmpRow"
                onClick={() => {
                  populateFormFromRow(row);
                }}
              >
                <div>{row.id}</div>
                <div>{row.name}</div>
                <div>{row.status}</div>
                <div>{row.email}</div>
                <div>{row.phone}</div>
                <div>{row.position}</div>
              </button>
            ))
          ) : (
            <div className="hrEmpRow">
              <div>-</div>
              <div>{loadMessage || 'Waiting for backend data.'}</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </div>
          )}
        </div>
      </section>
      {loadMessage && <p className="hrEmpForm__error">{loadMessage}</p>}

      <div className="hrEmpActions">
        <button type="button" onClick={() => openModal('add')}>
          Add Employee
        </button>
        <button type="button" onClick={() => openModal('edit-pick')}>
          Edit Employee
        </button>
        <button type="button" onClick={() => openModal('delete')}>
          Terminate Employee
        </button>
      </div>

      {modal === 'edit-pick' && (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true">
          <div className="hrEmpModal hrEmpModal--picker">
            <h2>SELECT EMPLOYEE TO EDIT</h2>
            <div className="hrEmpModal__rule" />

            <div className="hrEmpPicker">
              {employeeRows.length > 0 ? (
                employeeRows.map((row) => (
                  <button
                    key={`edit-pick-${row.id}`}
                    type="button"
                    className="hrEmpPicker__row"
                    onClick={() => beginEdit(row)}
                  >
                    <div className="hrEmpPicker__primary">
                      <strong>{row.name}</strong>
                      <span>Employee #{row.id}</span>
                    </div>
                    <div className="hrEmpPicker__secondary">
                      <span>{row.position}</span>
                      <span>{row.status}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="hrEmpPicker__empty">{loadMessage || 'No employee records available yet.'}</div>
              )}
            </div>

            <div className="hrEmpModal__actions">
              <button type="button" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && modal !== 'edit-pick' && (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true">
          <div className={`hrEmpModal ${modal === 'delete' ? 'is-delete' : ''}`}>
            <h2>{modal === 'add' ? 'ADD EMPLOYEE' : modal === 'edit' ? 'EDIT EMPLOYEE' : 'TERMINATE EMPLOYEE'}</h2>
            <div className="hrEmpModal__rule" />

            <div className="hrEmpForm">
              <div className="hrEmpForm__section">
                <div className="hrEmpForm__sectionTitle">Employment Details</div>
                <div className="hrEmpForm__grid hrEmpForm__grid--meta">
                {modal !== 'add' && (
                  <div className="hrEmpField">
                    <label>Employee ID:</label>
                    <input
                      placeholder="e.g. 67676767"
                      value={form.employeeId}
                      onChange={(e) => setField('employeeId', e.target.value)}
                    />
                  </div>
                )}
                <div className="hrEmpField">
                  <label>Status:</label>
                  <select
                    value={form.employmentStatus}
                    onChange={(e) => setField('employmentStatus', e.target.value)}
                  >
                    <option value="REGULAR">REGULAR</option>
                    <option value="NEW_HIRE">NEW_HIRE</option>
                    <option value="PART_TIME">PART_TIME</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
                </div>
              </div>

              {modal !== 'delete' ? (
                <>
                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Personal Information</div>
                    <div className="hrEmpForm__grid">
                    <div className="hrEmpField">
                      <label>First Name:</label>
                      <input value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Middle Name:</label>
                      <input value={form.middleName} onChange={(e) => setField('middleName', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Last Name:</label>
                      <input value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Birth Date:</label>
                      <input type="date" value={form.birthDate} onChange={(e) => setField('birthDate', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Email:</label>
                      <input value={form.email} onChange={(e) => setField('email', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Phone Number:</label>
                      <input value={form.phoneNumber} onChange={(e) => setField('phoneNumber', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Position:</label>
                      <select value={form.position} onChange={(e) => setField('position', e.target.value)}>
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="HR">HR</option>
                        <option value="MANAGEMENT">MANAGEMENT</option>
                        <option value="ACCOUNTING">ACCOUNTING</option>
                        <option value="UNKNOWN">UNKNOWN</option>
                      </select>
                    </div>
                    <div className="hrEmpField">
                      <label>HRIS Password (for account creation flow):</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Address Information</div>
                    <div className="hrEmpForm__grid">
                    <div className="hrEmpField">
                      <label>Permanent Address:</label>
                      <input value={form.permanentAddress} onChange={(e) => setField('permanentAddress', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Temporary Address:</label>
                      <input value={form.temporaryAddress} onChange={(e) => setField('temporaryAddress', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>City:</label>
                      <input value={form.city} onChange={(e) => setField('city', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>State:</label>
                      <input value={form.state} onChange={(e) => setField('state', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Country:</label>
                      <input value={form.country} onChange={(e) => setField('country', e.target.value)} />
                    </div>
                    <div className="hrEmpField">
                      <label>Zip Code:</label>
                      <input value={form.zipCode} onChange={(e) => setField('zipCode', e.target.value)} />
                    </div>
                  </div>
                  </div>
                </>
              ) : (
                <div className="hrEmpDelete">
                  <div className="hrEmpField">
                    <label>Selected Employee:</label>
                    <input value={selectedEmployee ? `${selectedEmployee.id} - ${selectedEmployee.name}` : form.employeeId} readOnly />
                  </div>
                  <div className="hrEmpField hrEmpField--full">
                    <label>Reason for Termination:</label>
                    <textarea value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {submitError && <p className="hrEmpForm__error">{submitError}</p>}
            {submitSuccess && <p className="hrEmpForm__success">{submitSuccess}</p>}

            <div className="hrEmpModal__actions">
              <button type="button" onClick={closeModal} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => void submit()} disabled={isSaving}>
                {modal === 'add' ? 'Add Employee' : modal === 'edit' ? 'Edit Employee' : 'Terminate Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
