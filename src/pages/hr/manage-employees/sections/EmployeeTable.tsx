import { FiEdit2, FiUserX } from 'react-icons/fi';
import { formatEmploymentStatusLabel, isTerminatedStatus } from '../manageEmployeesShared';
import type { EmployeeRow } from '../types';

type EmployeeTableProps = {
  emptyStateMessage: string;
  onOpenDelete: (row: EmployeeRow) => void;
  onOpenDetails: (employeeId: string) => void;
  onOpenEdit: (row: EmployeeRow) => void;
  rows: EmployeeRow[];
};

export default function EmployeeTable({
  emptyStateMessage,
  onOpenDelete,
  onOpenDetails,
  onOpenEdit,
  rows,
}: EmployeeTableProps) {
  return (
    <>
      <div className="hrEmpTable__head">
        <div>EMP ID</div>
        <div>NAME</div>
        <div>Username</div>
        <div className="hrEmpTable__headCell--status">Status</div>
        <div>Position</div>
        <div>Company Email</div>
        <div className="hrEmpTable__headCell--actions" />
      </div>

      <div className="hrEmpTable__body">
        {rows.length > 0 ? (
          rows.map((row) => {
            const isTerminated = isTerminatedStatus(row.status);

            return (
              <div
                key={row.id}
                className={`hrEmpRow ${isTerminated ? 'is-terminated' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetails(row.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenDetails(row.id);
                  }
                }}
              >
                <div>{row.id}</div>
                <div className="hrEmpRow__name">
                  <span className="hrEmpRow__nameText">{row.name}</span>
                </div>
                <div>{row.username}</div>
                <div className="hrEmpRow__statusCell">
                  {isTerminated ? 'RELEASED' : formatEmploymentStatusLabel(row.status)}
                </div>
                <div className="hrEmpRow__positionCell">{row.position}</div>
                <div className="hrEmpRow__emailCell">{row.email}</div>
                <div className="hrEmpRow__actions" onClick={(event) => event.stopPropagation()}>
                  {!isTerminated ? (
                    <>
                      <button
                        type="button"
                        className="hrEmpRow__action"
                        onClick={() => onOpenEdit(row)}
                        title="Edit employee"
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="hrEmpRow__action hrEmpRow__action--danger"
                        onClick={() => onOpenDelete(row)}
                        title="Record employee separation"
                      >
                        <FiUserX aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="uEmptyState">No employee records to show. {emptyStateMessage}</div>
        )}
      </div>
    </>
  );
}
