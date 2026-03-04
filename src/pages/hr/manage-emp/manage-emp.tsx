import { useEffect, useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import { apiRequest, asArray } from '../../../lib/api';
import './manage-emp.css';

type ModalType = 'add' | 'edit' | 'delete' | null;

type EmployeeRecord = {
  employeeId?: number | string;
  id?: number | string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  employmentStatus?: string;
  email?: string;
  contactNumber?: string;
  position?: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  status: string;
  email: string;
  phone: string;
  position: string;
};

function getFullName(employee: EmployeeRecord): string {
  const names = [employee.firstName, employee.middleName, employee.lastName]
    .map((name) => (name ?? '').trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(' ') : 'Unnamed employee';
}

function toRow(employee: EmployeeRecord): EmployeeRow {
  const idValue = employee.employeeId ?? employee.id;
  return {
    id: String(idValue ?? ''),
    name: getFullName(employee),
    status: employee.employmentStatus ?? '-',
    email: employee.email ?? '-',
    phone: employee.contactNumber ?? '-',
    position: employee.position ?? '-',
  };
}

export default function HrManageEmp() {
  const [modal, setModal] = useState<ModalType>(null);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resultMessage, setResultMessage] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [position, setPosition] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    if (modal) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [modal]);

  useEffect(() => {
    void loadEmployees();
  }, []);

  async function loadEmployees() {
    setIsLoading(true);
    try {
      const payload = await apiRequest<unknown>('/api/employees?page=0&size=100');
      const mapped = asArray<EmployeeRecord>(payload).map(toRow);
      setRows(mapped);
      if (!resultMessage) setResultMessage('');
    } catch (error) {
      setRows([]);
      setResultMessage(`Failed to load employees: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  function resetFormState() {
    setEmployeeId('');
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setEmploymentStatus('');
    setEmail('');
    setContactNumber('');
    setPosition('');
    setDeleteReason('');
  }

  function closeModal() {
    setModal(null);
    resetFormState();
  }

  async function handleSubmit() {
    try {
      if (modal === 'add') {
        await apiRequest('/api/employees/create', {
          method: 'POST',
          body: {
            firstName: firstName.trim(),
            middleName: middleName.trim() || undefined,
            lastName: lastName.trim(),
            email: email.trim(),
            contactNumber: contactNumber.trim(),
            position: position.trim(),
            employmentStatus: employmentStatus.trim() || 'REGULAR',
          },
        });
        setResultMessage('Employee created successfully.');
      } else if (modal === 'edit') {
        if (!employeeId.trim()) {
          setResultMessage('Employee ID is required for edit.');
          return;
        }
        await apiRequest(`/api/employees/${employeeId.trim()}`, {
          method: 'PATCH',
          body: {
            firstName: firstName.trim() || undefined,
            middleName: middleName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            email: email.trim() || undefined,
            contactNumber: contactNumber.trim() || undefined,
            position: position.trim() || undefined,
            employmentStatus: employmentStatus.trim() || undefined,
          },
        });
        setResultMessage(`Employee #${employeeId.trim()} updated successfully.`);
      } else if (modal === 'delete') {
        if (!employeeId.trim()) {
          setResultMessage('Employee ID is required for delete.');
          return;
        }
        await apiRequest(`/api/employees/status/${employeeId.trim()}`, {
          method: 'PATCH',
          body: {
            accountStatus: 'INACTIVE',
            remarks: deleteReason.trim() || undefined,
          },
        });
        setResultMessage(`Employee #${employeeId.trim()} marked as INACTIVE.`);
      }

      closeModal();
      await loadEmployees();
    } catch (error) {
      setResultMessage(`Request failed: ${String(error)}`);
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
          {rows.map((row) => (
            <div key={row.id} className="hrEmpRow">
              <div>{row.id}</div>
              <div>{row.name}</div>
              <div>{row.status}</div>
              <div>{row.email}</div>
              <div>{row.phone}</div>
              <div>{row.position}</div>
            </div>
          ))}
          {!isLoading && rows.length === 0 && (
            <div className="hrEmpRow">
              <div>No employee records from backend.</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </div>
          )}
        </div>
      </section>

      <div className="hrEmpActions">
        <button type="button" onClick={() => setModal('add')}>
          Add Employee
        </button>
        <button type="button" onClick={() => setModal('edit')}>
          Edit Employee
        </button>
        <button type="button" onClick={() => setModal('delete')}>
          Delete Employee
        </button>
      </div>
      {(isLoading || resultMessage) && (
        <p className="hrEmp__title" style={{ fontSize: 14, marginTop: 12 }}>
          {isLoading ? 'Loading employees...' : resultMessage}
        </p>
      )}

      {modal && (
        <div className="hrEmpModalBackdrop" role="dialog" aria-modal="true">
          <div className={`hrEmpModal ${modal === 'delete' ? 'is-delete' : ''}`}>
            <h2>{modal === 'add' ? 'ADD EMPLOYEE' : modal === 'edit' ? 'EDIT EMPLOYEE' : 'DELETE EMPLOYEE'}</h2>
            <div className="hrEmpModal__rule" />

            {modal !== 'delete' ? (
              <div className="hrEmpForm">
                {modal === 'edit' && (
                  <div className="hrEmpField">
                    <label>Employee ID:</label>
                    <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. 67676767" />
                  </div>
                )}

                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>First Name:</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Juan" />
                  </div>
                  <div className="hrEmpField hrEmpField--icon">
                    <label>Birth Date:</label>
                    <input placeholder="e.g. January 31, 1999" />
                    <FiCalendar />
                  </div>

                  <div className="hrEmpField">
                    <label>Middle Name:</label>
                    <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="e.g. Two" />
                  </div>
                  <div className="hrEmpField hrEmpField--icon">
                    <label>Employment Date:</label>
                    <input placeholder="e.g. August 7, 2022" />
                    <FiCalendar />
                  </div>

                  <div className="hrEmpField">
                    <label>Last Name:</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Tamad" />
                  </div>
                  <div className="hrEmpField">
                    <label>Employment Status:</label>
                    <input value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)} placeholder="e.g. REGULAR" />
                  </div>
                </div>

                <div className="hrEmpField hrEmpField--full">
                  <label>Address:</label>
                  <input placeholder="e.g. Sampaloc, Manila, Metro Manila, Philippines" />
                </div>

                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>Email:</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. sample@sample.com" />
                  </div>
                  <div className="hrEmpField">
                    <label>HRIS Password:</label>
                    <input placeholder="e.g. password123" />
                  </div>

                  <div className="hrEmpField">
                    <label>Number:</label>
                    <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="e.g. 09676767676" />
                  </div>
                  <div className="hrEmpField" />
                </div>

                <div className="hrEmpField">
                  <label>Position:</label>
                  <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Head of Research" />
                </div>
              </div>
            ) : (
              <div className="hrEmpDelete">
                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>Employee ID:</label>
                    <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. 67676767" />
                  </div>
                  <div className="hrEmpField">
                    <label>First Name:</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="hrEmpField" />
                  <div className="hrEmpField">
                    <label>Middle Name:</label>
                    <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Optional" />
                  </div>
                  <div className="hrEmpField" />
                  <div className="hrEmpField">
                    <label>Last Name:</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Optional" />
                  </div>
                </div>

                <div className="hrEmpField hrEmpField--full">
                  <label>Reason for Deleting:</label>
                  <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
                </div>
              </div>
            )}

            <div className="hrEmpModal__actions">
              <button type="button" onClick={closeModal}>
                Cancel
              </button>
              <button type="button" onClick={() => void handleSubmit()}>
                {modal === 'add' ? 'Add Employee' : modal === 'edit' ? 'Edit Employee' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
