import { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiFilter, FiPlus, FiSearch, FiUserX, FiXCircle } from 'react-icons/fi';
import { useUiDialog } from '../../../components/dialog/UiDialogProvider';
import PageHeader from '../../../components/layout/PageHeader';
import { useErrorDialogEffect } from '../../../hooks/useErrorDialogEffect';
import { apiFetchJson, toArray } from '../../../lib/api';
import { getFriendlyErrorMessage } from '../../../lib/uiErrors';
import './ManageEmployees.css';

type ModalType = 'add' | 'edit' | 'delete' | null;
type ConfirmAction = 'edit' | 'delete';

type EmployeeRow = {
  id: string;
  name: string;
  username: string;
  status: string;
  email: string;
  phone: string;
  position: string;
  searchIndex: string;
};

type EmployeeDetails = {
  id?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  birthDate?: string;
  employmentStatus?: string;
  exemptionStatus?: string;
  employmentDateStart?: string;
  employmentDateEnd?: string;
  yearlySalary?: number | string;
  email?: string;
  phoneNumber?: string;
  position?: string;
  userAccountName?: string;
  managerId?: number;
  address?: {
    permanentAddress?: string;
    temporaryAddress?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
};

type EmployeeMutationResponse = {
  id?: number;
  employeeId?: number;
};

type FormState = {
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  birthDate: string;
  employmentStatus: string;
  exemptionStatus: string;
  employmentDateStart: string;
  employmentDateEnd: string;
  email: string;
  phoneNumber: string;
  position: string;
  yearlySalary: string;
  managerId: string;
  username: string;
  password: string;
  permanentAddress: string;
  temporaryAddress: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  reason: string;
};

const employmentStatusOptions = ['REGULAR', 'NEW_HIRE', 'PART_TIME', 'SUSPENDED', 'TERMINATED'] as const;
const exemptionStatusOptions = ['EXEMPT', 'NON_EXEMPT'] as const;
const positionOptions = ['EMPLOYEE', 'MANAGER', 'HR', 'MANAGEMENT', 'ACCOUNTING', 'UNKNOWN'] as const;

const emptyForm: FormState = {
  employeeId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  birthDate: '',
  employmentStatus: 'REGULAR',
  exemptionStatus: 'NON_EXEMPT',
  employmentDateStart: '',
  employmentDateEnd: '',
  email: '',
  phoneNumber: '',
  position: 'EMPLOYEE',
  yearlySalary: '',
  managerId: '',
  username: '',
  password: '',
  permanentAddress: '',
  temporaryAddress: '',
  city: '',
  state: '',
  country: '',
  zipCode: '',
  reason: '',
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function buildEmployeeSearchIndex(row: Omit<EmployeeRow, 'searchIndex'>) {
  return normalizeText([row.id, row.name, row.username, row.status, row.email, row.phone, row.position].join(' '));
}

function getDefaultExemptionStatus(position: string) {
  return position === 'EMPLOYEE' || position === 'UNKNOWN' ? 'NON_EXEMPT' : 'EXEMPT';
}

function formatDateValue(value?: string | null) {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatCurrencyValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(numeric);
}

function displayValue(value?: string | number | null) {
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text.length > 0 ? text : '-';
}

function mergeRowWithDetails(row: EmployeeRow, details: EmployeeDetails): EmployeeRow {
  const rowBase = {
    id: row.id,
    name: row.name,
    username: details.userAccountName?.trim() ? details.userAccountName : row.username,
    status: details.employmentStatus?.trim() ? details.employmentStatus : row.status,
    email: details.email?.trim() ? details.email : row.email,
    phone: details.phoneNumber?.trim() ? details.phoneNumber : row.phone,
    position: details.position?.trim() ? details.position : row.position,
  };

  return {
    ...rowBase,
    searchIndex: buildEmployeeSearchIndex(rowBase),
  };
}

export default function HrManageEmp() {
  const { showSuccess } = useUiDialog();
  const [modal, setModal] = useState<ModalType>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([]);
  const [employeeDetailsById, setEmployeeDetailsById] = useState<Record<string, EmployeeDetails>>({});
  const [detailLoadingIds, setDetailLoadingIds] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailsDialogEmployeeId, setDetailsDialogEmployeeId] = useState<string | null>(null);
  const [loadMessage, setLoadMessage] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');

  const selectedEmployee = useMemo(
    () => employeeRows.find((row) => row.id === form.employeeId) ?? null,
    [employeeRows, form.employeeId]
  );

  const detailsDialogEmployee = useMemo(
    () => employeeRows.find((row) => row.id === detailsDialogEmployeeId) ?? null,
    [detailsDialogEmployeeId, employeeRows]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.status).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );

  const filterPositionOptions = useMemo(
    () => Array.from(new Set(employeeRows.map((row) => row.position).filter((value) => value && value !== '-'))).sort(),
    [employeeRows]
  );

  const visibleEmployeeRows = useMemo(() => {
    const normalizedSearch = normalizeText(searchValue);

    return employeeRows.filter((row) => {
      if (normalizedSearch && !row.searchIndex.includes(normalizedSearch)) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (positionFilter !== 'all' && row.position !== positionFilter) return false;
      return true;
    });
  }, [employeeRows, positionFilter, searchValue, statusFilter]);

  const activeFilterCount = [statusFilter, positionFilter].filter((value) => value !== 'all').length;
  const phoneHelperMessage = modal !== 'delete' ? getPhoneValidationMessage(form.phoneNumber) : '';
  const phoneHasError =
    modal !== 'delete' && form.phoneNumber.trim().length > 0 && sanitizePhoneNumber(form.phoneNumber).length !== 11;
  const rosterLoadError = loadMessage.startsWith('Unable to load the employee roster') ? loadMessage : '';

  useErrorDialogEffect(rosterLoadError, 'Employee roster could not be loaded');
  useErrorDialogEffect(submitError, 'Employee action could not be completed');

  useEffect(() => {
    if (modal || detailsDialogEmployeeId) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [detailsDialogEmployeeId, modal]);

  useEffect(() => {
    void loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const response = await apiFetchJson<unknown>('/api/employees?page=0&size=100');
      const mapped = toArray<Record<string, unknown>>(response).map((item, index) => {
        const rowBase = {
          id: String(item.employeeId ?? item.id ?? index + 1),
          name:
            [item.firstName, item.middleName, item.lastName]
              .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
              .join(' ') || `Employee #${item.employeeId ?? item.id ?? index + 1}`,
          username: String(item.userAccountName ?? item.username ?? '-'),
          status: String(item.employmentStatus ?? '-'),
          email: String(item.email ?? '-'),
          phone: String(item.phoneNumber ?? '-'),
          position: String(item.position ?? '-'),
        };

        return {
          ...rowBase,
          searchIndex: buildEmployeeSearchIndex(rowBase),
        };
      });

      setEmployeeRows(mapped);
      setEmployeeDetailsById({});
      setDetailLoadingIds({});
      setDetailErrors({});
      setDetailsDialogEmployeeId((current) => (current && mapped.some((row) => row.id === current) ? current : null));
      setLoadMessage(mapped.length === 0 ? 'No employees found.' : '');

      const missingUsernames = mapped.filter((row) => row.username === '-');
      if (missingUsernames.length > 0) {
        void Promise.allSettled(missingUsernames.map((row) => fetchEmployeeDetails(row.id)));
      }
    } catch (error) {
      setEmployeeRows([]);
      setEmployeeDetailsById({});
      setDetailLoadingIds({});
      setDetailErrors({});
      setDetailsDialogEmployeeId(null);
      setLoadMessage(
        `Unable to load the employee roster right now. (${getFriendlyErrorMessage(error, 'employee-load')})`
      );
    }
  }

  function todayDateValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function sanitizePhoneNumber(value: string) {
    return value.replace(/\D/g, '').slice(0, 11);
  }

  function sanitizeNumericId(value: string) {
    return value.replace(/\D/g, '');
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

  function parseYearlySalary(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('Yearly salary must be 0 or greater.');
    }
    return parsed;
  }

  function parseManagerId(value: string, employeeId: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error('Manager ID must be a valid employee number.');
    }
    if (employeeId && Number(employeeId) === parsed) {
      throw new Error('Employee cannot be their own manager.');
    }
    return parsed;
  }

  function resetMessages() {
    setSubmitError('');
    setSubmitSuccess('');
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openAddModal() {
    resetMessages();
    setConfirmAction(null);
    setModal('add');
    setForm({
      ...emptyForm,
      employmentDateStart: todayDateValue(),
      exemptionStatus: getDefaultExemptionStatus(emptyForm.position),
    });
  }

  function closeModal() {
    setModal(null);
    setConfirmAction(null);
    resetMessages();
    setForm(emptyForm);
  }

  function clearFilters() {
    setStatusFilter('all');
    setPositionFilter('all');
  }

  async function fetchEmployeeDetails(employeeId: string) {
    if (employeeDetailsById[employeeId]) {
      return employeeDetailsById[employeeId];
    }

    setDetailLoadingIds((current) => ({ ...current, [employeeId]: true }));
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[employeeId];
      return next;
    });

    try {
      const payload = await apiFetchJson<EmployeeDetails>(`/api/employees/${employeeId}`);
      setEmployeeDetailsById((current) => ({ ...current, [employeeId]: payload }));
      setEmployeeRows((current) =>
        current.map((row) => (row.id === employeeId ? mergeRowWithDetails(row, payload) : row))
      );
      return payload;
    } catch (error) {
      const message = getFriendlyErrorMessage(error, 'employee-load');
      setDetailErrors((current) => ({ ...current, [employeeId]: message }));
      throw error;
    } finally {
      setDetailLoadingIds((current) => ({ ...current, [employeeId]: false }));
    }
  }

  function openDetailsDialog(rowId: string) {
    setDetailsDialogEmployeeId(rowId);
    if (!employeeDetailsById[rowId] && !detailLoadingIds[rowId]) {
      void fetchEmployeeDetails(rowId);
    }
  }

  function closeDetailsDialog() {
    setDetailsDialogEmployeeId(null);
  }

  async function openEditModal(row: EmployeeRow) {
    resetMessages();
    setConfirmAction(null);

    try {
      const payload = await apiFetchJson<EmployeeDetails>(`/api/employees/${row.id}`);
      setForm({
        employeeId: String(payload.id ?? row.id),
        firstName: payload.firstName ?? '',
        middleName: payload.middleName ?? '',
        lastName: payload.lastName ?? '',
        birthDate: payload.birthDate ?? '',
        employmentStatus: payload.employmentStatus ?? 'REGULAR',
        exemptionStatus: payload.exemptionStatus ?? getDefaultExemptionStatus(payload.position ?? 'EMPLOYEE'),
        employmentDateStart: payload.employmentDateStart ?? '',
        employmentDateEnd: payload.employmentDateEnd ?? '',
        email: payload.email ?? '',
        phoneNumber: sanitizePhoneNumber(payload.phoneNumber ?? ''),
        position: payload.position ?? 'EMPLOYEE',
        yearlySalary:
          payload.yearlySalary !== undefined && payload.yearlySalary !== null ? String(payload.yearlySalary) : '',
        managerId: payload.managerId !== undefined && payload.managerId !== null ? String(payload.managerId) : '',
        username: payload.userAccountName ?? (row.username === '-' ? '' : row.username),
        password: '',
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

  function openDeleteModal(row: EmployeeRow) {
    resetMessages();
    setConfirmAction(null);
    setForm({
      ...emptyForm,
      employeeId: row.id,
      username: row.username === '-' ? '' : row.username,
    });
    setModal('delete');
  }

  function buildEmployeePayload(isCreate: boolean) {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate || !form.email.trim()) {
      throw new Error('First name, last name, birth date, and email are required.');
    }

    return {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      birthDate: form.birthDate || undefined,
      employmentStatus: form.employmentStatus || undefined,
      exemptionStatus: form.exemptionStatus || undefined,
      employmentDateStart: form.employmentDateStart || undefined,
      employmentDateEnd: form.employmentDateEnd || undefined,
      email: form.email.trim(),
      phoneNumber: isCreate || form.phoneNumber.trim() ? validatePhoneNumber(form.phoneNumber) : undefined,
      position: form.position || undefined,
      yearlySalary: parseYearlySalary(form.yearlySalary),
      managerId: parseManagerId(form.managerId, form.employeeId),
      address: {
        permanentAddress: form.permanentAddress.trim() || undefined,
        temporaryAddress: form.temporaryAddress.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        country: form.country.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
      },
    };
  }

  async function saveUserAccount(employeeId: number, mode: 'add' | 'edit') {
    const username = form.username.trim();
    const password = form.password.trim();
    const hasExistingAccount = Boolean(selectedEmployee?.username && selectedEmployee.username !== '-');

    if (!username) {
      throw new Error('Username is required for the employee account.');
    }
    if (mode === 'add' && !password) {
      throw new Error('Password is required for the employee account.');
    }
    if (mode === 'edit' && !hasExistingAccount && !password) {
      throw new Error('Password is required when creating a new login account for this employee.');
    }

    if (mode === 'add' || !hasExistingAccount) {
      await apiFetchJson('/api/user/create', {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          username,
          password,
        }),
      });
      return;
    }

    await apiFetchJson(`/api/user/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        employeeId,
        username,
        password: password || undefined,
      }),
    });
  }

  async function executeSubmit(targetModal: ModalType) {
    if (!targetModal) return;

    resetMessages();
    setIsSaving(true);

    try {
      if (targetModal === 'add') {
        if (!form.phoneNumber.trim()) {
          throw new Error('Phone number is required.');
        }

        const createdEmployee = await apiFetchJson<EmployeeMutationResponse>('/api/employees/create', {
          method: 'POST',
          body: JSON.stringify(buildEmployeePayload(true)),
        });

        const employeeId = Number(createdEmployee.id ?? createdEmployee.employeeId);
        if (!Number.isFinite(employeeId)) {
          throw new Error('Employee was created, but the new employee ID was not returned.');
        }

        let accountError = '';
        try {
          await saveUserAccount(employeeId, 'add');
        } catch (error) {
          accountError = getFriendlyErrorMessage(error, 'employee-save');
        }

        await loadEmployees();

        if (accountError) {
          setSubmitSuccess('Employee record created successfully.');
          setSubmitError(`Employee record was created, but the linked user account could not be saved. (${accountError})`);
        } else {
          closeModal();
          showSuccess('Employee created successfully.', 'Employee Created');
        }
        return;
      }

      if (targetModal === 'edit') {
        const employeeId = Number(form.employeeId);
        if (!Number.isFinite(employeeId)) {
          throw new Error('Employee ID is required for edit.');
        }

        await apiFetchJson(`/api/employees/${employeeId}`, {
          method: 'PATCH',
          body: JSON.stringify(buildEmployeePayload(false)),
        });

        let accountError = '';
        try {
          await saveUserAccount(employeeId, 'edit');
        } catch (error) {
          accountError = getFriendlyErrorMessage(error, 'employee-save');
        }

        await loadEmployees();

        if (accountError) {
          setSubmitSuccess('Employee details updated successfully.');
          setSubmitError(`Employee details were updated, but the linked user account could not be saved. (${accountError})`);
        } else {
          closeModal();
          showSuccess('Employee updated successfully.', 'Employee Updated');
        }
        return;
      }

      if (targetModal === 'delete') {
        const employeeId = Number(form.employeeId);
        if (!Number.isFinite(employeeId)) {
          throw new Error('Employee ID is required for termination.');
        }

        await apiFetchJson(`/api/employees/status/${employeeId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            employmentStatus: 'TERMINATED',
          }),
        });

        await loadEmployees();
        closeModal();
        showSuccess('Employee terminated successfully.', 'Employee Terminated');
      }
    } catch (error) {
      setSubmitError(
        getFriendlyErrorMessage(error, targetModal === 'delete' ? 'employee-terminate' : 'employee-save')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function submit() {
    if (!modal) return;

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

  function renderExpandedDetails(row: EmployeeRow) {
    const details = employeeDetailsById[row.id];
    const isLoading = Boolean(detailLoadingIds[row.id]);
    const detailError = detailErrors[row.id];
    const username = details?.userAccountName ?? (row.username === '-' ? '' : row.username);

    if (isLoading && !details) {
      return <div className="hrEmpDetails__feedback">Loading employee details...</div>;
    }

    if (detailError && !details) {
      return <div className="hrEmpDetails__feedback is-error">{detailError}</div>;
    }

    if (!details) {
      return <div className="hrEmpDetails__feedback">No employee details available yet.</div>;
    }

    return (
      <>
        <div className="hrEmpDetails__hero">
          <div className="hrEmpDetails__heroText">
            <span className="hrEmpDetails__eyebrow">Employee Profile</span>
            <strong>{row.name}</strong>
            <span>Employee ID {row.id}</span>
          </div>
          <div className="hrEmpDetails__badges">
            <span>{displayValue(details.position ?? row.position)}</span>
            <span>{displayValue(details.employmentStatus ?? row.status)}</span>
            <span>{displayValue(details.exemptionStatus)}</span>
          </div>
        </div>

        <div className="hrEmpDetails__grid">
          <section className="hrEmpDetails__card">
            <h3>Account and Contact</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Username</span>
                <strong>{displayValue(username)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Email</span>
                <strong>{displayValue(details.email)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Phone Number</span>
                <strong>{displayValue(details.phoneNumber)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Birth Date</span>
                <strong>{formatDateValue(details.birthDate)}</strong>
              </div>
            </div>
          </section>

          <section className="hrEmpDetails__card">
            <h3>Employment</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Status</span>
                <strong>{displayValue(details.employmentStatus)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Position</span>
                <strong>{displayValue(details.position)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Exemption Status</span>
                <strong>{displayValue(details.exemptionStatus)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Employment Start</span>
                <strong>{formatDateValue(details.employmentDateStart)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Employment End</span>
                <strong>{formatDateValue(details.employmentDateEnd)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Yearly Salary</span>
                <strong>{formatCurrencyValue(details.yearlySalary)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Manager ID</span>
                <strong>{displayValue(details.managerId)}</strong>
              </div>
            </div>
          </section>

          <section className="hrEmpDetails__card hrEmpDetails__card--full">
            <h3>Address</h3>
            <div className="hrEmpDetails__items">
              <div className="hrEmpDetails__item">
                <span>Permanent Address</span>
                <strong>{displayValue(details.address?.permanentAddress)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Temporary Address</span>
                <strong>{displayValue(details.address?.temporaryAddress)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>City</span>
                <strong>{displayValue(details.address?.city)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>State</span>
                <strong>{displayValue(details.address?.state)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Country</span>
                <strong>{displayValue(details.address?.country)}</strong>
              </div>
              <div className="hrEmpDetails__item">
                <span>Zip Code</span>
                <strong>{displayValue(details.address?.zipCode)}</strong>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  const emptyStateMessage =
    employeeRows.length === 0
      ? loadMessage || 'Waiting for backend data.'
      : 'No employees match your search or current filters.';

  return (
    <div className="hrEmp">
      <div className="hrEmp__head">
        <PageHeader
          title="Employee Management"
          description="Maintain employee records, accounts, and employment details from one directory."
        />
        <button type="button" className="hrEmpTable__addBtn" onClick={openAddModal}>
          <FiPlus aria-hidden="true" />
          <span>Add Employee</span>
        </button>
      </div>

      <section className="hrEmpTable">
        <div className="hrEmpToolbar">
          <label className="hrEmpSearch" aria-label="Search employees">
            <FiSearch />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search employee, username, email, phone, status, or position"
            />
            {searchValue ? (
              <button type="button" aria-label="Clear employee search" onClick={() => setSearchValue('')}>
                <FiXCircle />
              </button>
            ) : null}
          </label>

          <div className="hrEmpFilter">
            <button
              type="button"
              className={`hrEmpFilter__toggle ${filterOpen ? 'is-open' : ''} ${activeFilterCount > 0 ? 'is-active' : ''}`}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <FiFilter />
              <span>Filter</span>
              {activeFilterCount > 0 ? <span className="hrEmpFilter__count">{activeFilterCount}</span> : null}
            </button>

            {filterOpen ? (
              <div className="hrEmpFilter__panel">
                <label className="hrEmpFilter__field">
                  <span>Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All Statuses</option>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="hrEmpFilter__field">
                  <span>Position</span>
                  <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
                    <option value="all">All Positions</option>
                    {filterPositionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="hrEmpFilter__actions">
                  <button type="button" onClick={clearFilters}>
                    Reset Filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="hrEmpTable__head">
          <div>EmpID</div>
          <div>Name</div>
          <div>Username</div>
          <div>Status</div>
          <div>Position</div>
          <div>Actions</div>
        </div>

        <div className="hrEmpTable__body">
          {visibleEmployeeRows.length > 0 ? (
            visibleEmployeeRows.map((row) => (
              <div
                key={row.id}
                className="hrEmpRow"
                role="button"
                tabIndex={0}
                onClick={() => openDetailsDialog(row.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openDetailsDialog(row.id);
                  }
                }}
              >
                <div>{row.id}</div>
                <div className="hrEmpRow__name">
                  <span className="hrEmpRow__nameText">{row.name}</span>
                </div>
                <div>{row.username}</div>
                <div>{row.status}</div>
                <div>{row.position}</div>
                <div className="hrEmpRow__actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="hrEmpRow__action" onClick={() => void openEditModal(row)}>
                    <FiEdit2 aria-hidden="true" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="hrEmpRow__action hrEmpRow__action--danger"
                    onClick={() => openDeleteModal(row)}
                  >
                    <FiUserX aria-hidden="true" />
                    <span>Terminate</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="hrEmpTable__empty">
              <strong>No employee records to show.</strong>
              <span>{emptyStateMessage}</span>
            </div>
          )}
        </div>
      </section>

      {detailsDialogEmployee ? (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true" onClick={closeDetailsDialog}>
          <div className="hrEmpModal hrEmpModal--details" onClick={(event) => event.stopPropagation()}>
            <div className="hrEmpDetailsDialog__header">
              <div>
                <h2>EMPLOYEE DETAILS</h2>
                <p className="hrEmpModal__subtitle">
                  Review the full employee profile, account information, and employment details in one view.
                </p>
              </div>
              <button type="button" className="hrEmpDetailsDialog__close" onClick={closeDetailsDialog} aria-label="Close employee details">
                <FiXCircle />
              </button>
            </div>
            <div className="hrEmpModal__rule" />
            <div className="hrEmpDetails hrEmpDetails--dialog" role="region" aria-label={`${detailsDialogEmployee.name} details`}>
              {renderExpandedDetails(detailsDialogEmployee)}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true">
          <div className={`hrEmpModal ${modal === 'delete' ? 'is-delete' : ''}`}>
            <h2>{modal === 'add' ? 'ADD EMPLOYEE' : modal === 'edit' ? 'EDIT EMPLOYEE' : 'TERMINATE EMPLOYEE'}</h2>
            <p className="hrEmpModal__subtitle">
              {modal === 'add'
                ? 'Create the employee record and its login account together so HR does not need to manage them separately.'
                : modal === 'edit'
                  ? 'Review the employee profile, employment details, and account access before saving the update.'
                  : 'Confirm the selected employee and document the reason before updating the employment status.'}
            </p>
            <div className="hrEmpModal__rule" />

            <div className="hrEmpForm">
              {modal === 'delete' ? (
                <div className="hrEmpForm__section hrEmpForm__section--danger">
                  <div className="hrEmpForm__sectionTitle">Termination Details</div>
                  <div className="hrEmpDelete">
                    <div className="hrEmpDelete__summary">
                      <span className="hrEmpDelete__summaryLabel">Employee on record</span>
                      <strong>{selectedEmployee ? selectedEmployee.name : 'No employee selected yet'}</strong>
                      <span>
                        {selectedEmployee
                          ? `Employee ID ${selectedEmployee.id} | ${selectedEmployee.username === '-' ? 'No username yet' : selectedEmployee.username} | ${selectedEmployee.position} | ${selectedEmployee.status}`
                          : 'Select a valid employee record before terminating the employee.'}
                      </span>
                    </div>

                    <div className="hrEmpForm__grid hrEmpForm__grid--delete">
                      <div className="hrEmpField">
                        <label>Employee ID</label>
                        <input value={form.employeeId} readOnly placeholder="Employee ID" />
                      </div>

                      <div className="hrEmpField hrEmpField--full">
                        <label>Reason for Termination</label>
                        <textarea
                          value={form.reason}
                          onChange={(event) => setField('reason', event.target.value)}
                          placeholder="Add internal HR notes for the termination record"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Employment Details</div>
                    <div className="hrEmpForm__grid">
                      {modal === 'edit' ? (
                        <div className="hrEmpField">
                          <label>Employee ID</label>
                          <input value={form.employeeId} readOnly />
                        </div>
                      ) : null}

                      <div className="hrEmpField">
                        <label>Status</label>
                        <select
                          value={form.employmentStatus}
                          onChange={(event) => setField('employmentStatus', event.target.value)}
                        >
                          {employmentStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Position</label>
                        <select value={form.position} onChange={(event) => setField('position', event.target.value)}>
                          {positionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Exemption Status</label>
                        <select
                          value={form.exemptionStatus}
                          onChange={(event) => setField('exemptionStatus', event.target.value)}
                        >
                          {exemptionStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="hrEmpField">
                        <label>Employment Start Date</label>
                        <input
                          type="date"
                          value={form.employmentDateStart}
                          onChange={(event) => setField('employmentDateStart', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Employment End Date</label>
                        <input
                          type="date"
                          value={form.employmentDateEnd}
                          onChange={(event) => setField('employmentDateEnd', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Yearly Salary</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.yearlySalary}
                          onChange={(event) => setField('yearlySalary', event.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Manager ID</label>
                        <input
                          inputMode="numeric"
                          value={form.managerId}
                          onChange={(event) => setField('managerId', sanitizeNumericId(event.target.value))}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Personal Information</div>
                    <div className="hrEmpForm__grid">
                      <div className="hrEmpField">
                        <label>First Name</label>
                        <input value={form.firstName} onChange={(event) => setField('firstName', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Middle Name</label>
                        <input value={form.middleName} onChange={(event) => setField('middleName', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Last Name</label>
                        <input value={form.lastName} onChange={(event) => setField('lastName', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Birth Date</label>
                        <input type="date" value={form.birthDate} onChange={(event) => setField('birthDate', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Email</label>
                        <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={11}
                          placeholder="Enter 11-digit mobile number"
                          aria-invalid={phoneHasError}
                          value={form.phoneNumber}
                          onChange={(event) => setField('phoneNumber', sanitizePhoneNumber(event.target.value))}
                        />
                        {phoneHasError && <span className="hrEmpField__hint is-error">{phoneHelperMessage}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Account Access</div>
                    <div className="hrEmpForm__grid hrEmpForm__grid--account">
                      <div className="hrEmpField">
                        <label>Username</label>
                        <input
                          autoComplete="off"
                          value={form.username}
                          onChange={(event) => setField('username', event.target.value)}
                          placeholder="Required"
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>{modal === 'add' ? 'Password' : 'Password Reset'}</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={form.password}
                          onChange={(event) => setField('password', event.target.value)}
                          placeholder={modal === 'add' ? 'Required' : 'Leave blank to keep current password'}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hrEmpForm__section">
                    <div className="hrEmpForm__sectionTitle">Address Information</div>
                    <div className="hrEmpForm__grid">
                      <div className="hrEmpField">
                        <label>Permanent Address</label>
                        <input
                          value={form.permanentAddress}
                          onChange={(event) => setField('permanentAddress', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>Temporary Address</label>
                        <input
                          value={form.temporaryAddress}
                          onChange={(event) => setField('temporaryAddress', event.target.value)}
                        />
                      </div>

                      <div className="hrEmpField">
                        <label>City</label>
                        <input value={form.city} onChange={(event) => setField('city', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>State</label>
                        <input value={form.state} onChange={(event) => setField('state', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Country</label>
                        <input value={form.country} onChange={(event) => setField('country', event.target.value)} />
                      </div>

                      <div className="hrEmpField">
                        <label>Zip Code</label>
                        <input value={form.zipCode} onChange={(event) => setField('zipCode', event.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {submitError ? <p className="hrEmpForm__error">{submitError}</p> : null}
            {submitSuccess ? <p className="hrEmpForm__success">{submitSuccess}</p> : null}

            <div className="hrEmpModal__actions">
              <button type="button" onClick={closeModal} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" onClick={() => void submit()} disabled={isSaving}>
                {modal === 'add' ? 'Add Employee' : modal === 'edit' ? 'Save Changes' : 'Terminate Employee'}
              </button>
            </div>

            {confirmAction ? (
              <div className="hrEmpConfirmLayer" role="dialog" aria-modal="true">
                <div className="hrEmpConfirmCard">
                  <h3>{confirmAction === 'edit' ? 'Confirm Employee Update' : 'Confirm Termination'}</h3>
                  <p>
                    {confirmAction === 'edit'
                      ? `Are you sure you want to save the changes for ${
                          [form.firstName, form.middleName, form.lastName]
                            .map((value) => value.trim())
                            .filter(Boolean)
                            .join(' ') || `employee ID ${form.employeeId}`
                        }?`
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
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
