import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './ManageEmployees.css';

type ModalType = 'add' | 'edit-pick' | 'edit' | 'delete' | null;
type SubmitModal = Exclude<ModalType, null | 'edit-pick'>;
type ConfirmAction = 'edit' | 'delete';

type EmployeeRow = {
  id: string;
  name: string;
  status: string;
  email: string;
  phone: string;
  position: string;
};

type EmployeeDetails = {
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  birthDate?: string;
  employmentStatus?: string;
  employmentDateStart?: string;
  email?: string;
  phoneNumber?: string;
  position?: string;
  address?: {
    permanentAddress?: string;
    temporaryAddress?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
};

type FormState = {
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  employmentStatus: string;
  employmentDateStart: string;
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

const emptyForm: FormState = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  employmentStatus: 'REGULAR',
  employmentDateStart: '',
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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
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

  function todayDateValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function sanitizePhoneNumber(value: string) {
    return value.replace(/\D/g, '').slice(0, 11);
  }

  function getPhoneValidationMessage(value: string) {
    const digits = sanitizePhoneNumber(value);
    if (!digits) return 'Enter an 11-digit mobile number, for example 09171234567.';
    if (digits.length !== 11) return 'Phone number must be exactly 11 digits.';
    return 'Enter an 11-digit mobile number, for example 09171234567.';
  }

  function validatePhoneNumber(value: string) {
    const digits = sanitizePhoneNumber(value);
    if (digits.length !== 11) {
      throw new Error('Phone number must be exactly 11 digits.');
    }
    return digits;
  }

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
      setEmployeeRows([]);
      const message = getFriendlyErrorMessage(error, 'employee-load');
      setLoadMessage(
        `Unable to load the employee roster right now. You can still enter an employee ID manually if needed. (${message})`
      );
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
    setForm(type === 'add' ? { ...emptyForm, employmentDateStart: todayDateValue() } : emptyForm);
  }

  function closeModal() {
    setModal(null);
    setConfirmAction(null);
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
    void loadEmployeeDetails(row.id);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadEmployeeDetails(employeeId: string) {
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const payload = await apiFetchJson<EmployeeDetails>(`/api/employees/${employeeId}`);
      setForm({
        employeeId: String(payload.id ?? employeeId),
        firstName: payload.firstName ?? '',
        middleName: payload.middleName ?? '',
        lastName: payload.lastName ?? '',
        birthDate: payload.birthDate ?? '',
        employmentStatus: payload.employmentStatus ?? 'REGULAR',
        employmentDateStart: payload.employmentDateStart ?? '',
        email: payload.email ?? '',
        password: '',
        phoneNumber: sanitizePhoneNumber(payload.phoneNumber ?? ''),
        position: payload.position ?? 'EMPLOYEE',
        permanentAddress: payload.address?.permanentAddress ?? '',
        temporaryAddress: payload.address?.temporaryAddress ?? '',
        city: payload.address?.city ?? '',
        state: payload.address?.state ?? '',
        country: payload.address?.country ?? '',
        zipCode: payload.address?.zipCode ?? '',
        reason: '',
      });
      setModal('edit');
    } catch (error) {
      setSubmitError(getFriendlyErrorMessage(error, 'employee-load'));
    }
  }

  async function executeSubmit(targetModal: SubmitModal) {
    setSubmitError('');
    setSubmitSuccess('');
    setIsSaving(true);
    try {
      if (targetModal === 'add') {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.email.trim() || !form.phoneNumber.trim()) {
          throw new Error('First name, last name, birth date, email, and phone number are required.');
        }
        const sanitizedPhoneNumber = validatePhoneNumber(form.phoneNumber);
        await apiFetchJson('/api/employees/create', {
          method: 'POST',
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || undefined,
            lastName: form.lastName.trim(),
            birthDate: form.birthDate || undefined,
            employmentStatus: form.employmentStatus,
            employmentDateStart: form.employmentDateStart || undefined,
            email: form.email.trim(),
            phoneNumber: sanitizedPhoneNumber,
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
      } else if (targetModal === 'edit') {
        const id = Number(form.employeeId);
        if (!Number.isFinite(id)) throw new Error('Employee ID is required for edit.');
        const sanitizedPhoneNumber = form.phoneNumber.trim()
          ? validatePhoneNumber(form.phoneNumber)
          : undefined;
        await apiFetchJson(`/api/employees/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: form.firstName.trim() || undefined,
            middleName: form.middleName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            birthDate: form.birthDate || undefined,
            employmentStatus: form.employmentStatus || undefined,
            employmentDateStart: form.employmentDateStart || undefined,
            email: form.email.trim() || undefined,
            phoneNumber: sanitizedPhoneNumber,
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
      } else if (targetModal === 'delete') {
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
        getFriendlyErrorMessage(error, targetModal === 'delete' ? 'employee-terminate' : 'employee-save')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submit() {
    if (!modal || modal === 'edit-pick') return;

    if (modal === 'add') {
      await executeSubmit('add');
      return;
    }

    setConfirmAction(modal);
  }

  async function confirmAndSubmit() {
    if (!confirmAction) return;
    const nextAction = confirmAction;
    setConfirmAction(null);
    await executeSubmit(nextAction);
  }

  const phoneHelperMessage = modal !== 'delete' ? getPhoneValidationMessage(form.phoneNumber) : '';
  const phoneHasError =
    modal !== 'delete' && form.phoneNumber.trim().length > 0 && sanitizePhoneNumber(form.phoneNumber).length !== 11;

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
                      <span>Employee ID: {row.id}</span>
                    </div>
                    <div className="hrEmpPicker__secondary">
                      <span>{row.position}</span>
                      <span>{row.status}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="hrEmpPicker__empty">
                  <div>{loadMessage || 'No employee records available yet.'}</div>
                  <button type="button" className="hrEmpPicker__row" onClick={() => setModal('edit')}>
                    Enter employee ID instead
                  </button>
                </div>
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
                      placeholder="Enter employee ID number"
                      value={form.employeeId}
                      onChange={(e) => setField('employeeId', e.target.value)}
                    />
                  </div>
                )}
                {modal !== 'delete' && (
                  <>
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
                    <div className="hrEmpField">
                      <label>Employment Start Date:</label>
                      <input
                        type="date"
                        value={form.employmentDateStart}
                        onChange={(e) => setField('employmentDateStart', e.target.value)}
                      />
                    </div>
                  </>
                )}
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
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="Enter 11-digit mobile number"
                        aria-invalid={phoneHasError}
                        value={form.phoneNumber}
                        onChange={(e) => setField('phoneNumber', sanitizePhoneNumber(e.target.value))}
                      />
                      <span className={`hrEmpField__hint ${phoneHasError ? 'is-error' : ''}`}>
                        {phoneHelperMessage}
                      </span>
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
                    <input
                      value={selectedEmployee ? `${selectedEmployee.id} - ${selectedEmployee.name}` : form.employeeId}
                      onChange={(e) => setField('employeeId', e.target.value)}
                      readOnly={!!selectedEmployee}
                      placeholder="Enter employee ID number"
                    />
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

            {confirmAction && (
              <div className="hrEmpConfirmLayer" role="dialog" aria-modal="true">
                <div className="hrEmpConfirmCard">
                  <h3>{confirmAction === 'edit' ? 'Confirm Employee Update' : 'Confirm Termination'}</h3>
                  <p>
                    {confirmAction === 'edit'
                      ? `Are you sure you want to save the changes for employee ID ${form.employeeId}?`
                      : `Are you sure you want to mark employee ID ${form.employeeId}${selectedEmployee ? ` (${selectedEmployee.name})` : ''} as terminated?`}
                  </p>
                  <div className="hrEmpConfirmCard__actions">
                    <button type="button" onClick={() => setConfirmAction(null)} disabled={isSaving}>
                      Go Back
                    </button>
                    <button type="button" onClick={() => void confirmAndSubmit()} disabled={isSaving}>
                      {confirmAction === 'edit' ? 'Confirm Edit' : 'Confirm Termination'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
