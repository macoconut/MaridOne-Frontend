import { useEffect, useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import './manage-emp.css';

type ModalType = 'add' | 'edit' | 'delete' | null;

const employeeRows: Array<{
  id: string;
  name: string;
  status: string;
  email: string;
  phone: string;
  position: string;
}> = [];

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
          {employeeRows.length > 0 ? (
            employeeRows.map((row) => (
              <div key={row.id} className="hrEmpRow">
                <div>{row.id}</div>
                <div>{row.name}</div>
                <div>{row.status}</div>
                <div>{row.email}</div>
                <div>{row.phone}</div>
                <div>{row.position}</div>
              </div>
            ))
          ) : (
            <div className="hrEmpRow">
              <div>No employee records yet.</div>
              <div />
              <div />
              <div />
              <div />
              <div />
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
                    <input />
                  </div>
                )}

                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>First Name:</label>
                    <input />
                  </div>
                  <div className="hrEmpField hrEmpField--icon">
                    <label>Birth Date:</label>
                    <input />
                    <FiCalendar />
                  </div>

                  <div className="hrEmpField">
                    <label>Middle Name:</label>
                    <input />
                  </div>
                  <div className="hrEmpField hrEmpField--icon">
                    <label>Employment Date:</label>
                    <input />
                    <FiCalendar />
                  </div>

                  <div className="hrEmpField">
                    <label>Last Name:</label>
                    <input />
                  </div>
                  <div className="hrEmpField">
                    <label>Employment Status:</label>
                    <input />
                  </div>
                </div>

                <div className="hrEmpField hrEmpField--full">
                  <label>Address:</label>
                  <input />
                </div>

                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>Email:</label>
                    <input />
                  </div>
                  <div className="hrEmpField">
                    <label>HRIS Password:</label>
                    <input />
                  </div>

                  <div className="hrEmpField">
                    <label>Number:</label>
                    <input />
                  </div>
                  <div className="hrEmpField" />
                </div>

                <div className="hrEmpField">
                  <label>Position:</label>
                  <input />
                </div>
              </div>
            ) : (
              <div className="hrEmpDelete">
                <div className="hrEmpForm__grid">
                  <div className="hrEmpField">
                    <label>Employee ID:</label>
                    <input />
                  </div>
                  <div className="hrEmpField">
                    <label>First Name:</label>
                    <input />
                  </div>
                  <div className="hrEmpField" />
                  <div className="hrEmpField">
                    <label>Middle Name:</label>
                    <input />
                  </div>
                  <div className="hrEmpField" />
                  <div className="hrEmpField">
                    <label>Last Name:</label>
                    <input />
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
