import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  FiGrid,
  FiLogOut,
  FiBell,
  FiCheckCircle,
  FiCalendar,
  FiClock,
  FiFileText,
  FiUsers,
  FiCreditCard,
} from 'react-icons/fi';
import '../../employee/layout/EmployeeLayout.css';
import '../shared/hr-theme.css';
import { clearSession } from '../../../lib/session';
import { BACKEND_TEST_MODE } from '../../../config/flags';

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
};

type BackendTestAction = {
  label: string;
  description: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const notifications: NotificationItem[] = [];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const backendActions: BackendTestAction[] = [
  {
    label: 'Create Employee',
    description: 'Create a new employee record.',
    method: 'POST',
    path: '/api/employees/create',
    body: {
      firstName: 'Test',
      middleName: 'H',
      lastName: 'Employee',
      email: 'test.employee@example.com',
      contactNumber: '09171234567',
      position: 'STAFF',
      employmentStatus: 'REGULAR',
    },
  },
  {
    label: 'Get Employees',
    description: 'Fetch paginated employee list for HR.',
    method: 'GET',
    path: '/api/employees?page=0&size=20',
  },
  {
    label: 'Update Employee',
    description: 'Update employee details by employee ID.',
    method: 'PATCH',
    path: '/api/employees/1',
    body: {
      firstName: 'Updated',
      lastName: 'Employee',
    },
  },
  {
    label: 'Update Employee Status',
    description: 'Change employee status fields.',
    method: 'PATCH',
    path: '/api/employees/status/1',
    body: {
      accountStatus: 'ACTIVE',
    },
  },
  {
    label: 'Create User Account',
    description: 'Create login account for an employee.',
    method: 'POST',
    path: '/api/user/create',
    body: {
      username: 'test.employee',
      password: 'password123',
      role: 'EMPLOYEE',
      employeeId: 1,
    },
  },
  {
    label: 'Create Leave Balance',
    description: 'Create leave balance row for employee.',
    method: 'POST',
    path: '/api/leave/balance/1',
    body: {
      balanceHours: 8,
      leaveType: 'SICK',
    },
  },
  {
    label: 'Update Leave Balance',
    description: 'Adjust leave balance by leave type.',
    method: 'PATCH',
    path: '/api/leave/balance/update/1',
    body: {
      leaveType: 'SICK',
      type: 'ADD',
      balanceHours: 2,
    },
  },
  {
    label: 'Update Leave Request',
    description: 'Approve or deny leave request.',
    method: 'PATCH',
    path: '/api/leave/update/1',
    body: {
      status: 'APPROVED',
      remarks: 'Approved by HR',
    },
  },
  {
    label: 'Get Overtime Requests',
    description: 'Fetch all overtime requests for HR.',
    method: 'GET',
    path: '/api/overtime/all?page=0&size=20',
  },
  {
    label: 'Update Overtime Request',
    description: 'Approve or deny overtime request.',
    method: 'PATCH',
    path: '/api/overtime/update',
    body: {
      overtimeId: 1,
      status: 'APPROVED',
      remarks: 'Approved for payroll',
    },
  },
  {
    label: 'Add Shift Schedule',
    description: 'Create a template shift assignment.',
    method: 'POST',
    path: '/api/employee/schedule/add',
    body: {
      employeeId: 1,
      shiftDate: '2026-03-01',
      startTime: '08:00:00',
      endTime: '17:00:00',
    },
  },
  {
    label: 'Update Shift Schedule',
    description: 'Edit an existing shift assignment.',
    method: 'PATCH',
    path: '/api/employee/schedule/update',
    body: {
      shiftId: 1,
      startTime: '09:00:00',
      endTime: '18:00:00',
    },
  },
  {
    label: 'Create Calendar Event',
    description: 'Create company-wide calendar event.',
    method: 'POST',
    path: '/api/calendar/events/create',
    body: {
      title: 'Backend Test Event',
      month: 4,
      day: 10,
      year: 2026,
      isHoliday: false,
    },
  },
  {
    label: 'Update Calendar Event',
    description: 'Update existing calendar event.',
    method: 'PUT',
    path: '/api/calendar/events/update',
    body: {
      calendarId: 1,
      title: 'Updated Backend Test Event',
    },
  },
  {
    label: 'Delete Calendar Event',
    description: 'Soft-delete calendar event by ID.',
    method: 'PATCH',
    path: '/api/calendar/events/delete/1',
  },
  {
    label: 'Get Attendance Logs',
    description: 'Fetch attendance logs for HR review.',
    method: 'GET',
    path: '/api/logs/attendance?page=0&size=25',
  },
  {
    label: 'Get Activity Logs',
    description: 'Fetch activity logs for HR review.',
    method: 'GET',
    path: '/api/logs/activity?page=0&size=25',
  },
  {
    label: 'Create Payroll Run',
    description: 'Create payroll run period.',
    method: 'POST',
    path: '/api/payroll/run/create',
    body: {
      fromDate: '2026-02-01',
      toDate: '2026-02-15',
      runType: 'REGULAR',
    },
  },
  {
    label: 'Create Payroll Item',
    description: 'Create payroll item for one employee.',
    method: 'POST',
    path: '/api/payroll/item/create',
    body: {
      payId: 1,
      employeeId: 1,
    },
  },
  {
    label: 'Update Payroll Item',
    description: 'Update payroll item values by item ID.',
    method: 'PATCH',
    path: '/api/payroll/item/update/1',
    body: {
      baseSalary: 20000,
    },
  },
  {
    label: 'Get Run Items',
    description: 'Fetch payroll items under a run.',
    method: 'GET',
    path: '/api/payroll/run/1/items?page=0&size=20',
  },
  {
    label: 'Get Dispute Requests',
    description: 'Fetch payroll dispute requests for HR.',
    method: 'GET',
    path: '/api/payroll/item/dispute/all?page=0&size=20',
  },
  {
    label: 'Update Dispute Request',
    description: 'Resolve a payroll dispute request.',
    method: 'PATCH',
    path: '/api/payroll/item/dispute/update/1',
    body: {
      status: 'RESOLVED',
      remarks: 'Resolved during backend test',
    },
  },
  {
    label: 'Get Notifications',
    description: 'Fetch HR user notifications.',
    method: 'GET',
    path: '/api/notifications',
  },
];

export default function HrLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('No request sent yet.');
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!notifOpen) return;

      const target = e.target as Node;
      if (panelRef.current?.contains(target) || bellRef.current?.contains(target)) return;

      setNotifOpen(false);
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotifOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [notifOpen]);

  const unreadCount = notifications.length;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });

  function handleLogout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  async function handleBackendTest(action: BackendTestAction) {
    const requestLabel = `${action.method} ${action.path}`;
    setBackendAction(requestLabel);
    setIsLoading(true);
    setBackendResult(`Sending ${requestLabel} ...`);

    try {
      const response = await fetch(`${API_BASE_URL}${action.path}`, {
        method: action.method,
        headers: action.body ? { 'Content-Type': 'application/json' } : undefined,
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      const raw = await response.text();
      let formatted = raw;
      try {
        formatted = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        if (raw.trim().length === 0) formatted = '(no response body)';
      }

      setBackendResult(
        [
          `URL: ${API_BASE_URL}${action.path}`,
          `Status: ${response.status} ${response.statusText}`,
          '',
          formatted,
        ].join('\n')
      );
    } catch (error) {
      setBackendResult(
        [
          `URL: ${API_BASE_URL}${action.path}`,
          'Request failed before reaching backend.',
          String(error),
        ].join('\n')
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="employeeLayout">
      <aside className="eSide">
        <button
          type="button"
          className="eSide__brand eSide__brand--link"
          onClick={() => navigate('/login', { replace: true })}
          aria-label="Go to login"
        >
          <div className="eSide__logo" aria-hidden="true" />
          <div className="eSide__name">MaridOne</div>
        </button>

        <nav className="eSide__nav">
          <NavLink
            to="/hr/dashboard"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiGrid className="eSide__icon" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/hr/attendance-reports"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCalendar className="eSide__icon" />
            <span>Attendance Reports</span>
          </NavLink>
          <NavLink
            to="/hr/approvals"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiClock className="eSide__icon" />
            <span>Approvals</span>
          </NavLink>
          <NavLink
            to="/hr/payslips"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiFileText className="eSide__icon" />
            <span>Manage Payslips</span>
          </NavLink>
          <NavLink
            to="/hr/pay-run-reporting"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCreditCard className="eSide__icon" />
            <span>Pay Run Reporting</span>
          </NavLink>
          <NavLink
            to="/hr/manage-emp"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiUsers className="eSide__icon" />
            <span>Manage Employees</span>
          </NavLink>
        </nav>

        <button className="eSide__logout" type="button" onClick={handleLogout}>
          <FiLogOut className="eSide__icon" />
          <span>Logout</span>
        </button>
      </aside>

      <div className="eMain">
        <header className="eTop">
          <div className="eTop__left">
            <div className="eTop__title">HR#67</div>
            <span className="eTop__badge">Human Resources</span>
          </div>

          <div className="notif">
            <button
              ref={bellRef}
              className="eTop__bell"
              type="button"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <FiBell />
              {unreadCount > 0 && <span className="notif__badge">{unreadCount}</span>}
            </button>

            {notifOpen && <div className="notif__backdrop" />}

            {notifOpen && (
              <div ref={panelRef} className="notifPanel" role="dialog" aria-label="Notifications">
                <div className="notifPanel__header">
                  <div className="notifPanel__title">Notifications ({unreadCount})</div>
                  <div className="notifPanel__date">Today, {todayLabel}</div>
                </div>

                <div className="notifPanel__list">
                  <div className="notifItem">
                    <div className="notifItem__icon">
                      <FiCheckCircle />
                    </div>
                    <div className="notifItem__body">
                      <div className="notifItem__title">No new notifications.</div>
                    </div>
                    <div className="notifItem__time">Now</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="eContent">
          {BACKEND_TEST_MODE ? (
            <section className="backendTest" aria-label="HR backend testing controls">
              <div className="backendTest__head">
                <h2>Backend Testing w/ Arturtur</h2>
                <span>Last action: {backendAction}</span>
              </div>

              <div className="backendTest__actions">
                {backendActions.map((action) => (
                  <article key={`${action.method}-${action.path}`} className="backendTest__card">
                    <button type="button" onClick={() => handleBackendTest(action)} disabled={isLoading}>
                      {action.label}
                    </button>
                    <p>{action.description}</p>
                    <code>{action.method} {action.path}</code>
                  </article>
                ))}
              </div>
              <pre className="backendTest__result">{backendResult}</pre>
            </section>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <footer className="eFooter">
        <div className="eFooter__inner">
          <div className="eFooter__brand">
            <div className="eFooter__brandRow">
              <div className="eFooter__logo" aria-hidden="true" />
              <div>
                <div className="eFooter__brandTitle">Marid Industries</div>
                <div className="eFooter__brandTitle">Corporation</div>
              </div>
            </div>

            <div className="eFooter__slogan">Smart packaging solutions for modern food service.</div>
            <div className="eFooter__copy">© 2026 Marid Industries Corporation</div>
          </div>

          <div className="eFooter__col">
            <h4>Mission:</h4>
            <p>To ignite a culinary revolution with our self-heating food packaging solutions.</p>
          </div>

          <div className="eFooter__col">
            <h4>Vision:</h4>
            <p>
              To be the trailblazer of the self-heating food packaging industry, setting a new
              standard for quality and innovation across the globe.
            </p>

            <div className="eFooter__contact">
              <span className="eFooter__contactLabel">Contact Us:</span>
              <span className="eFooter__contactValue"> marid@marid.com</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
