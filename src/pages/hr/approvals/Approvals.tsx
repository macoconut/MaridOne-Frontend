import { useMemo, useState } from 'react';
import { FiSearch, FiFilter, FiXCircle } from 'react-icons/fi';
import './Approvals.css';

type RequestType = 'Leave' | 'OT';

type HrRequest = {
  id: string;
  employee: string;
  message: string;
  time: string;
  type: RequestType;
};

const requests: HrRequest[] = [
  {
    id: '1',
    employee: 'Employee # 67',
    message: 'Sick Leave Request - April 7, 2024',
    time: '11:07 AM',
    type: 'Leave',
  },
  {
    id: '2',
    employee: 'Employee # 67',
    message: 'Holiday OT Request - May 1, 2024',
    time: '11:07 AM',
    type: 'OT',
  },
  {
    id: '3',
    employee: 'Employee # 67',
    message: 'Sick Leave Request - April 7, 2024',
    time: '11:07 AM',
    type: 'Leave',
  },
  {
    id: '4',
    employee: 'Employee # 67',
    message: 'Sick Leave Request - April 7, 2024',
    time: '11:07 AM',
    type: 'Leave',
  },
  {
    id: '5',
    employee: 'Employee # 67',
    message: 'Holiday OT Request - May 1, 2024',
    time: '11:07 AM',
    type: 'OT',
  },
  {
    id: '6',
    employee: 'Employee # 67',
    message: 'Sick Leave Request - April 7, 2024',
    time: '11:07 AM',
    type: 'Leave',
  },
  {
    id: '7',
    employee: 'Employee # 67',
    message: 'Sick Leave Request - April 7, 2024',
    time: '11:07 AM',
    type: 'Leave',
  },
  {
    id: '8',
    employee: 'Employee # 67',
    message: 'Sick Leave Request - April 7, 2024',
    time: '11:07 AM',
    type: 'Leave',
  },
];

const cards = [
  { label: 'Approved', value: 67 },
  { label: 'Denied', value: 67 },
  { label: 'Pending', value: 67 },
];

export default function HrApprovals() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [selectedId]
  );

  return (
    <div className="hrAppr">
      <div className="hrAppr__head">
        <h1 className="hrAppr__title">
          {selected ? 'Pending Approvals from Employees' : 'Requests from Employees'}
          <span className="hrAppr__tools">
            <FiSearch />
            <FiFilter />
          </span>
        </h1>
      </div>

      <div className="hrAppr__cards">
        {cards.map((card) => (
          <article key={card.label} className="hrApprCard">
            <div className="hrApprCard__ring" />
            <div className="hrApprCard__body">
              <div className="hrApprCard__label">{card.label}</div>
              <div className="hrApprCard__value">{card.value}</div>
            </div>
          </article>
        ))}
      </div>

      <section className="hrApprTable">
        {requests.map((request) => (
          <button
            key={request.id}
            type="button"
            className="hrApprRow"
            onClick={() => setSelectedId(request.id)}
          >
            <span className="hrApprRow__employee">{request.employee}</span>
            <span className="hrApprRow__message">{request.message}</span>
            <span className="hrApprRow__time">{request.time}</span>
          </button>
        ))}
      </section>

      {selected && (
        <div className="hrApprModalBackdrop" role="dialog" aria-modal="true">
          <div className="hrApprModal">
            <button
              type="button"
              className="hrApprModal__close"
              onClick={() => setSelectedId(null)}
              aria-label="Close"
            >
              <FiXCircle />
            </button>

            <h2 className="hrApprModal__title">
              Employee#67 - {selected.type === 'Leave' ? 'Leave Application Form' : 'OT Application Form'}
            </h2>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label>
                <span>Department:</span>
                <input value="Research and Development" readOnly />
              </label>
              <label>
                <span>Position:</span>
                <input value="Head of Research" readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>{selected.type === 'Leave' ? 'Type of Leave Requested:' : 'Type of OT Requested:'}</span>
                <input value={selected.type === 'Leave' ? 'Sick Leave' : 'Holiday'} readOnly />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>{selected.type === 'Leave' ? 'Leave Duration:' : 'Date of OT:'}</span>
                <input
                  value={selected.type === 'Leave' ? 'April 7, 2024 - April 7, 2024' : 'May 1, 2024'}
                  readOnly
                />
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>{selected.type === 'Leave' ? 'Reason for Leave:' : 'Reason for OT:'}</span>
                <textarea
                  value="e.g. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam blandit turpis vel sapien suscipit, ac rutrum ante iaculis. Nunc id diam sagittis, facilisis sapien ac, efficitur enim. Maecenas sed ipsum rutrum, iaculis quam a, fermentum risus."
                  readOnly
                />
              </label>
            </div>

            <div className="hrApprForm__row hrApprForm__row--2">
              <label className="hrApprForm__inline">
                <span>Supporting Documents:</span>
                <button type="button">Click to View</button>
              </label>
              <label className="hrApprForm__inline">
                <span>Signature:</span>
                <div className="hrApprForm__signature">◌</div>
              </label>
            </div>

            <div className="hrApprModal__rule" />

            <div className="hrApprForm__row hrApprForm__row--2">
              <label className="hrApprForm__inline">
                <span>Administrative Approval:</span>
                <div className="hrApprForm__actions">
                  <button type="button">Approve</button>
                  <button type="button">Deny</button>
                </div>
              </label>
            </div>

            <div className="hrApprForm__row">
              <label>
                <span>Remarks:</span>
                <textarea
                  value="e.g. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam blandit turpis vel sapien suscipit, ac rutrum ante iaculis. Nunc id diam sagittis, facilisis sapien ac, efficitur enim. Maecenas sed ipsum rutrum, iaculis quam a, fermentum risus."
                  readOnly
                />
              </label>
            </div>

            <div className="hrApprModal__footer">
              <button type="button" onClick={() => setSelectedId(null)}>
                Cancel
              </button>
              <button type="button">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
