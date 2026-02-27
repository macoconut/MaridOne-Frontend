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
} from 'react-icons/fi';
import '../../employee/layout/EmployeeLayout.css';
import { clearSession } from '../../../lib/session';

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
};

const notifications: NotificationItem[] = [];

export default function HrLayout() {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
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

  return (
    <div className="employeeLayout">
      <aside className="eSide">
        <div className="eSide__brand">
          <div className="eSide__logo" aria-hidden="true" />
          <div className="eSide__name">MaridOne</div>
        </div>

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
          <Outlet />
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
