import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  FiGrid,
  FiCalendar,
  FiClock,
  FiFileText,
  FiBookOpen,
  FiLogOut,
  FiBell,
  FiCheckCircle,
} from 'react-icons/fi';

import './EmployeeLayout.css';

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
};

const notifications: NotificationItem[] = [
  { id: '1', title: 'Your leave request has been approved.', time: '1h ago' },
  {
    id: '2',
    title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    description: 'Nullam blandit turpis vel',
    time: '2h ago',
  },
  {
    id: '3',
    title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    description: 'Nullam blandit turpis vel',
    time: '2h ago',
  },
  {
    id: '4',
    title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    description: 'Nullam blandit turpis vel',
    time: '2h ago',
  },
];

export default function EmployeeLayout() {
  const [notifOpen, setNotifOpen] = useState(false);

  const bellRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close notif on outside click / ESC
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

  const unreadCount = 2; // match figma for now

  return (
    <div className="employeeLayout">
      {/* SIDEBAR */}
      <aside className="eSide">
        <div className="eSide__brand">
          <div className="eSide__logo" aria-hidden="true" />
          <div className="eSide__name">MaridOne</div>
        </div>

        <nav className="eSide__nav">
          <NavLink
            to="/employee/dashboard"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiGrid className="eSide__icon" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/employee/attendance"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiCalendar className="eSide__icon" />
            <span>Attendance</span>
          </NavLink>

          <NavLink
            to="/employee/approvals"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiClock className="eSide__icon" />
            <span>View Approvals</span>
          </NavLink>

          <NavLink
            to="/employee/payslip"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiFileText className="eSide__icon" />
            <span>Payslip</span>
          </NavLink>

          <NavLink
            to="/employee/training"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiBookOpen className="eSide__icon" />
            <span>Training Materials</span>
          </NavLink>
        </nav>

        <button className="eSide__logout" type="button">
          <FiLogOut className="eSide__icon" />
          <span>Logout</span>
        </button>
      </aside>

      {/* MAIN */}
      <div className="eMain">
        {/* top bar */}
        <header className="eTop">
          <div className="eTop__left">
            <div className="eTop__title">Employee#67</div>
            <span className="eTop__badge">Employee</span>
          </div>

          {/* Bell + Notif */}
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
              <span className="notif__badge">{unreadCount}</span>
            </button>

            {/* Backdrop */}
            {notifOpen && <div className="notif__backdrop" />}

            {/* Panel */}
            {notifOpen && (
              <div ref={panelRef} className="notifPanel" role="dialog" aria-label="Notifications">
                <div className="notifPanel__header">
                  <div className="notifPanel__title">Notifications ({unreadCount})</div>
                  <div className="notifPanel__date">Today, November 18</div>
                </div>

                <div className="notifPanel__list">
                  {notifications.map((n) => (
                    <div key={n.id} className="notifItem">
                      <div className="notifItem__icon">
                        <FiCheckCircle />
                      </div>

                      <div className="notifItem__body">
                        <div className="notifItem__title">{n.title}</div>
                        {n.description && <div className="notifItem__msg">{n.description}</div>}
                      </div>

                      <div className="notifItem__time">{n.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* page */}
        <main className="eContent">
          <Outlet />
        </main>
      </div>

      {/* FOOTER */}
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

            <div className="eFooter__slogan">insert slogan of Marid Industries here</div>
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
