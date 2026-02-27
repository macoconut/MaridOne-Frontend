import { useEffect, useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import './manage-emp.css';

type ModalType = 'add' | 'edit' | 'delete' | null;

const employeeRows = Array.from({ length: 5 }).map((_, idx) => ({
  id: `67676767${idx}`,
  name: 'Employee#67',
  status: 'Non-Exempt',
  email: 'emp6767@gmail.com',
  phone: '09676767676',
  position: 'Head of Research',
}));

export default function HrManageEmp() {
  const [modal, setModal] = useState<ModalType>(null);

  useEffect(() => {
    if (modal) document.body.classList.add('modal-open');
    else document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [modal]);

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
          {employeeRows.map((row) => (
            <div key={row.id} className="hrEmpRow">
              <div>{row.id}</div>
              <div>{row.name}</div>
              <div>{row.status}</div>
              <div>{row.email}</div>
              <div>{row.phone}</div>
              <div>{row.position}</div>
            </div>
          ))}
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
                    <input placeholder="e.g. 67676767" />
                  </div>
                )}

                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>First Name:</label>
                    <input placeholder="e.g. Juan" />
                  </div>
                  <div className="hrEmpField hrEmpField--icon">
                    <label>Birth Date:</label>
                    <input placeholder="e.g. January 31, 1999" />
                    <FiCalendar />
                  </div>

                  <div className="hrEmpField">
                    <label>Middle Name:</label>
                    <input placeholder="e.g. Two" />
                  </div>
                  <div className="hrEmpField hrEmpField--icon">
                    <label>Employment Date:</label>
                    <input placeholder="e.g. August 7, 2022" />
                    <FiCalendar />
                  </div>

                  <div className="hrEmpField">
                    <label>Last Name:</label>
                    <input placeholder="e.g. Tamad" />
                  </div>
                  <div className="hrEmpField">
                    <label>Employment Status:</label>
                    <input placeholder="e.g. Exempt" />
                  </div>
                </div>

                <div className="hrEmpField hrEmpField--full">
                  <label>Address:</label>
                  <input placeholder="e.g. Sampaloc, Manila, Metro Manila, Philippines" />
                </div>

                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>Email:</label>
                    <input placeholder="e.g. sample@sample.com" />
                  </div>
                  <div className="hrEmpField">
                    <label>HRIS Password:</label>
                    <input placeholder="e.g. password123" />
                  </div>

                  <div className="hrEmpField">
                    <label>Number:</label>
                    <input placeholder="e.g. 09676767676" />
                  </div>
                  <div className="hrEmpField" />
                </div>

                <div className="hrEmpField">
                  <label>Position:</label>
                  <input placeholder="e.g. Head of Research" />
                </div>
              </div>
            ) : (
              <div className="hrEmpDelete">
                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>Employee ID:</label>
                    <input placeholder="e.g. 67676767" />
                  </div>
                  <div className="hrEmpField">
                    <label>First Name:</label>
                    <input placeholder="e.g. Juan" />
                  </div>
                  <div className="hrEmpField" />
                  <div className="hrEmpField">
                    <label>Middle Name:</label>
                    <input placeholder="e.g. Two" />
                  </div>
                  <div className="hrEmpField" />
                  <div className="hrEmpField">
                    <label>Last Name:</label>
                    <input placeholder="e.g. Tamad" />
                  </div>
                </div>

                <div className="hrEmpField hrEmpField--full">
                  <label>Reason for Deleting:</label>
                  <textarea />
                </div>
              </div>
            )}

            <div className="hrEmpModal__actions">
              <button type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button">{modal === 'add' ? 'Add Employee' : modal === 'edit' ? 'Edit Employee' : 'Delete Employee'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
