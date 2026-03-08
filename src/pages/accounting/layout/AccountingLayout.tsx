import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FiBarChart2, FiBookOpen, FiClipboard, FiLogOut } from 'react-icons/fi';
import '../../employee/layout/EmployeeLayout.css';
import { clearSession } from '../../../lib/session';
import { BACKEND_TEST_MODE } from '../../../config/flags';

type BackendTestAction = {
  label: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const backendActions: BackendTestAction[] = [
  {
    label: 'Get Notifications',
    method: 'GET',
    path: '/api/notifications',
  },
  {
    label: 'Get Run Items',
    method: 'GET',
    path: '/api/payroll/run/1/items?page=0&size=20',
  },
  {
    label: 'Get Disputes',
    method: 'GET',
    path: '/api/payroll/item/dispute/all?page=0&size=20',
  },
  {
    label: 'Get Payroll Item',
    method: 'GET',
    path: '/api/payroll/item/1',
  },
];

export default function AccountingLayout() {
  const navigate = useNavigate();
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('Waiting for backend test.');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!BACKEND_TEST_MODE) return;
    void handleBackendTest(backendActions[0]);
  }, []);

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
            to="/accounting/payroll-dashboard"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiBarChart2 className="eSide__icon" />
            <span>Payroll Dashboard</span>
          </NavLink>

          <NavLink
            to="/accounting/payroll-review"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiClipboard className="eSide__icon" />
            <span>Payroll Review</span>
          </NavLink>

          <NavLink
            to="/accounting/bookkeeping"
            className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
          >
            <FiBookOpen className="eSide__icon" />
            <span>Bookkeeping</span>
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
            <div className="eTop__title">Accountant#67</div>
            <span className="eTop__badge">Accounting</span>
          </div>
        </header>

        <main className="eContent">
          {BACKEND_TEST_MODE && (
            <details
              style={{
                border: '1.5px solid rgba(0,0,0,.18)',
                borderRadius: 12,
                background: '#fff',
                padding: 12,
                marginBottom: 12,
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                Accounting Backend Test Panel (click to expand)
              </summary>
              <div style={{ marginTop: 10, fontSize: 13, color: '#4a3e5e' }}>
                Last action: <strong>{backendAction}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {backendActions.map((action) => (
                  <button
                    key={`${action.method}-${action.path}`}
                    type="button"
                    onClick={() => void handleBackendTest(action)}
                    disabled={isLoading}
                    style={{
                      border: '1px solid rgba(0,0,0,.2)',
                      borderRadius: 8,
                      background: '#fff',
                      padding: '6px 10px',
                      cursor: isLoading ? 'default' : 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <pre
                style={{
                  marginTop: 10,
                  border: '1px solid rgba(0,0,0,.14)',
                  borderRadius: 8,
                  background: '#f8f8fb',
                  padding: 10,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 220,
                  overflow: 'auto',
                  fontSize: 11,
                }}
              >
                {backendResult}
              </pre>
            </details>
          )}
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
