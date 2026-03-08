import { useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import './PendingApprovals.css';

type RequestType = 'Leave' | 'OT';

type PendingRequest = {
  id: string;
  employee: string;
  message: string;
  time: string;
  type: RequestType;
};

const requests: PendingRequest[] = [
  { id: '1', employee: 'Employee#67', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
  { id: '2', employee: 'Employee Name', message: 'Holiday OT Request - May 1, 2024', time: '11:07 AM', type: 'OT' },
  { id: '3', employee: 'Employee Name', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
  { id: '4', employee: 'Employee Name', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
  { id: '5', employee: 'Employee Name', message: 'Holiday OT Request - May 1, 2024', time: '11:07 AM', type: 'OT' },
  { id: '6', employee: 'Employee Name', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
  { id: '7', employee: 'Employee Name', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
  { id: '8', employee: 'Employee Name', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
  { id: '9', employee: 'Employee Name', message: 'Sick Leave Request - April 7, 2024', time: '11:07 AM', type: 'Leave' },
];

export default function ManagerPendingApprovals() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId]
  );

  return (
    <div className="mgrPend">
      <div className="mgrPend__top">
        <h1>Requests from Team Members</h1>
        <div className="mgrPend__tools">
          <FiSearch />
          <FiFilter />
        </div>
      </div>

      <div className="mgrPendCards">
        <article className="mgrPendCard">
          <div className="mgrPendCard__ring" />
          <div>
            <div className="mgrPendCard__label">Approved</div>
            <div className="mgrPendCard__value">67</div>
          </div>
        </article>
        <article className="mgrPendCard">
          <div className="mgrPendCard__ring" />
          <div>
            <div className="mgrPendCard__label">Denied</div>
            <div className="mgrPendCard__value">67</div>
          </div>
        </article>
        <article className="mgrPendCard">
          <div className="mgrPendCard__ring" />
          <div>
            <div className="mgrPendCard__label">Pending</div>
            <div className="mgrPendCard__value">67</div>
          </div>
        </article>
      </div>

      <section className="mgrPendTable">
        {requests.map((request) => (
          <button
            key={request.id}
            type="button"
            className="mgrPendRow"
            onClick={() => setSelectedId(request.id)}
          >
            <span className="mgrPendRow__employee">{request.employee}</span>
            <span className="mgrPendRow__message">{request.message}</span>
            <span className="mgrPendRow__time">{request.time}</span>
          </button>
        ))}
      </section>

      {selected && (
        <div className="mgrPendModalBackdrop" role="dialog" aria-modal="true">
          <article className="mgrPendModal">
            <button
              type="button"
              className="mgrPendModal__close"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
            >
              <FiXCircle />
            </button>

            <h2>
              Employee#67 - {selected.type === 'Leave' ? 'Leave Application Form' : 'OT Application Form'}
            </h2>
            <div className="mgrPendModal__rule" />

            <div className="mgrPendForm__row mgrPendForm__row--2">
              <label>
                <span>Department:</span>
                <input value="Research and Development" readOnly />
              </label>
              <label>
                <span>Position:</span>
                <input value="Head of Research" readOnly />
              </label>
            </div>

            <div className="mgrPendForm__row mgrPendForm__row--2">
              <label>
                <span>Type of {selected.type === 'Leave' ? 'Leave Requested:' : 'OT Requested:'}</span>
                <input value={selected.type === 'Leave' ? 'Sick Leave' : 'Holiday'} readOnly />
              </label>
              <label>
                <span>{selected.type === 'Leave' ? 'Leave Duration:' : 'Date of OT:'}</span>
                <input
                  value={selected.type === 'Leave' ? 'April 7, 2024 - April 7, 2024' : 'May 1, 2024'}
                  readOnly
                />
              </label>
            </div>

            <div className="mgrPendForm__row">
              <label>
                <span>Reason for {selected.type === 'Leave' ? 'Leave:' : 'OT:'}</span>
                <textarea
                  value="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam blandit turpis vel sapien suscipit, ac rutrum ante iaculis."
                  readOnly
                />
              </label>
            </div>

            <div className="mgrPendForm__row mgrPendForm__row--2">
              <label className="mgrPendForm__inline">
                <span>Supporting Documents:</span>
                <button type="button">Click to View</button>
              </label>
              <label className="mgrPendForm__inline">
                <span>Signature:</span>
                <div className="mgrPendForm__sig">◌</div>
              </label>
            </div>

            <div className="mgrPendModal__rule" />

            <div className="mgrPendForm__row mgrPendForm__row--2">
              <label className="mgrPendForm__inline">
                <span>Administrative Approval:</span>
                <div className="mgrPendForm__actions">
                  <button type="button" className="is-primary">Approve</button>
                  <button type="button" className="is-primary">Deny</button>
                </div>
              </label>
            </div>

            <div className="mgrPendForm__row">
              <label>
                <span>Remarks:</span>
                <textarea placeholder="e.g. review remarks..." />
              </label>
            </div>

            <div className="mgrPendForm__row mgrPendForm__row--2">
              <label className="mgrPendForm__inline">
                <span>HR's Signature:</span>
                <button type="button">Upload Here</button>
              </label>
            </div>

            <div className="mgrPendModal__footer">
              <button type="button" className="is-primary" onClick={() => setSelectedId(null)}>
                Cancel
              </button>
              <button type="button" className="is-primary">Submit</button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
