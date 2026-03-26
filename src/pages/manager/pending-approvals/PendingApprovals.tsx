import './PendingApprovals.css';

const availableToday = [
  'Managers can already view team attendance logs and notifications.',
  'The top-right notification bell still works for manager accounts.',
  'Attendance dashboards and reports are now backed by the team attendance endpoint.',
];

const missingBackend = [
  'Manager endpoint to list leave requests waiting for manager review.',
  'Manager endpoint to list overtime requests waiting for manager review.',
  'Manager approve and deny actions for leave requests.',
  'Manager approve and deny actions for overtime requests.',
  'Manager request detail response with employee, dates, and submitted reason.',
];

export default function ManagerPendingApprovals() {
  return (
    <div className="mgrPend">
      <section className="mgrPendHero">
        <div className="mgrPendHero__eyebrow">Manager Approvals</div>
        <h1>Approval Workflow Is Not Connected Yet</h1>
        <p>
          The current backend still routes approval actions through HR. We removed the fake approval rows here so the manager screen stays accurate.
        </p>
      </section>

      <div className="mgrPendGrid">
        <section className="mgrPendCard">
          <h2>Available Today</h2>
          <ul>
            {availableToday.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mgrPendCard mgrPendCard--accent">
          <h2>Missing Backend For This Page</h2>
          <ul>
            {missingBackend.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mgrPendCallout">
        <h2>What This Means For Frontend</h2>
        <p>
          We can style and route the manager approvals page, but we should not show request lists, request details, or approve/deny buttons until the manager-specific backend endpoints exist.
        </p>
      </section>
    </div>
  );
}
