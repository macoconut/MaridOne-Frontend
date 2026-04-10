import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { FiBarChart2, FiClipboard, FiMenu } from 'react-icons/fi';
import AppFooter from '../../components/layout/AppFooter';
import HeaderRefreshButton from '../../components/navigation/HeaderRefreshButton';
import RoleSidebar from '../../components/navigation/RoleSidebar';
import SettingsModal from '../../components/settings/SettingsModal';
import useResponsiveSidebar from '../../hooks/useResponsiveSidebar';
import type { NavSection } from '../../components/navigation/SidebarNavSection';
import '../shared/RoleLayout.css';
import { getUserEmail } from '../../lib/session';
import { BACKEND_TEST_MODE } from '../../config/flags';
import { apiFetchRaw, expireCurrentSession, getApiBaseUrl } from '../../lib/api';
import { resolveHeaderBadge } from '../../lib/headerProfile';
import {
  applyBodyPlaceholders,
  applyPathPlaceholders,
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../lib/backendTest';
import { PageRefreshProvider } from '../../lib/pageRefresh';

type BackendTestAction = {
  label: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
};

const API_BASE_URL = getApiBaseUrl();

const backendActions: BackendTestAction[] = [
  {
    label: 'Get Notifications',
    method: 'GET',
    path: '/api/notifications',
  },
  {
    label: 'Get Runs',
    method: 'GET',
    path: '/api/payroll/run',
  },
  {
    label: 'Get Run Details',
    method: 'GET',
    path: '/api/payroll/run/{payId}',
  },
  {
    label: 'Get Run Items',
    method: 'GET',
    path: '/api/payroll/run/{payId}/items?page=0&size=20',
  },
  {
    label: 'Get Run Summary',
    method: 'GET',
    path: '/api/payroll/run/summary/{payId}',
  },
];

const navSections: NavSection[] = [
  {
    id: 'payroll',
    label: 'Payroll Audit',
    defaultOpen: true,
    items: [
      { to: '/accounting/payroll-dashboard', label: 'Payroll Dashboard', icon: FiBarChart2 },
      { to: '/accounting/payroll-review', label: 'Payslip Review', icon: FiClipboard },
    ],
  },
];

export default function AccountingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [headerBadge, setHeaderBadge] = useState('Accounting');
  const [backendAction, setBackendAction] = useState<string>('None');
  const [backendResult, setBackendResult] = useState<string>('Waiting for backend test.');
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen]))
  );
  const { drawerOpen, isMobileLayout, setDrawerOpen, sidebarCollapsed, toggleSidebar } = useResponsiveSidebar();

  useEffect(() => {
    void loadHeaderProfile();
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setSettingsOpen(false);
  }, [location.pathname, setDrawerOpen]);

  useEffect(() => {
    if (!BACKEND_TEST_MODE) return;
    void handleBackendTest(backendActions[0]);
  }, []);

  async function loadHeaderProfile() {
    try {
      setHeaderBadge(await resolveHeaderBadge(getUserEmail(), 'Accounting'));
    } catch {
      setHeaderBadge('Accounting');
    }
  }

  async function handleLogout() {
    await expireCurrentSession();
    navigate('/', { replace: true });
  }

  function handleBrandClick() {
    navigate('/accounting/payroll-dashboard', { replace: true });
  }

  function handleOpenSettings() {
    setDrawerOpen(false);
    setSettingsOpen(true);
  }

  function toggleSection(sectionId: string) {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  async function fetchJsonWithAuth(path: string) {
    const response = await apiFetchRaw(path, { method: 'GET' });
    if (!response.ok) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function buildContext(username: string | null): Promise<PlaceholderContext> {
    const context: PlaceholderContext = { username: username ?? undefined };
    const runs = await fetchJsonWithAuth('/api/payroll/run');
    const firstRun = firstFromCollection(runs);
    const payId = extractFirstId(firstRun, ['payId', 'id']);
    if (payId) {
      context.payId = payId;
    }

    if (!username) return context;
    const userDetails = await fetchJsonWithAuth(`/api/user/details/${encodeURIComponent(username)}`);
    const empId =
      extractFirstId(userDetails, ['employeeId', 'id']) ??
      extractFirstId(
        userDetails && typeof userDetails === 'object'
          ? (userDetails as Record<string, unknown>).employee
          : null,
        ['employeeId', 'id']
      );
    if (empId) {
      context.empId = empId;
    }
    return context;
  }

  async function handleBackendTest(action: BackendTestAction) {
    const context = await buildContext(getUserEmail());
    let pathResolved = applyPathPlaceholders(action.path, context);
    let bodyResolved = applyBodyPlaceholders(action.body, context);
    const missing = new Set([...pathResolved.missing, ...bodyResolved.missing]);

    for (const key of missing) {
      const entered = window.prompt(`Enter value for ${key}:`);
      if (!entered || entered.trim().length === 0) {
        setBackendResult(`Cancelled: missing required value "${key}".`);
        return;
      }
      context[key] = entered.trim();
    }

    pathResolved = applyPathPlaceholders(action.path, context);
    bodyResolved = applyBodyPlaceholders(action.body, context);
    const resolvedPath = pathResolved.value;
    const requestLabel = `${action.method} ${resolvedPath}`;
    setBackendAction(requestLabel);
    setIsLoading(true);
    setBackendResult(`Sending ${requestLabel} ...`);

    try {
      const headers: Record<string, string> = {};
      if (bodyResolved.value !== undefined) headers['Content-Type'] = 'application/json';

      const response = await apiFetchRaw(resolvedPath, {
        method: action.method,
        headers,
        body: bodyResolved.value !== undefined ? JSON.stringify(bodyResolved.value) : undefined,
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
          `URL: ${API_BASE_URL}${resolvedPath}`,
          `Status: ${response.status} ${response.statusText}`,
          '',
          formatted,
        ].join('\n')
      );
    } catch (error) {
      setBackendResult(
        [
          `URL: ${API_BASE_URL}${resolvedPath}`,
          'Request failed before reaching backend.',
          String(error),
        ].join('\n')
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageRefreshProvider>
      <div className={`employeeLayout${!isMobileLayout && sidebarCollapsed ? ' employeeLayout--sidebarCollapsed' : ''}`}>
      <RoleSidebar
        brandLabel="Go to dashboard"
        collapsed={!isMobileLayout && sidebarCollapsed}
        drawerOpen={drawerOpen}
        isMobileLayout={isMobileLayout}
        navSections={navSections}
        onBrandClick={handleBrandClick}
        onLogout={handleLogout}
        onOpenSettings={handleOpenSettings}
        onToggleSection={toggleSection}
        onToggleSidebar={toggleSidebar}
        openSections={openSections}
      />

      <div className="eMain">
        <header className="eTop">
          <div className="eTop__left">
            <button
              className="eTop__ham"
              type="button"
              aria-label={isMobileLayout ? (drawerOpen ? 'Close navigation menu' : 'Open navigation menu') : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              onClick={toggleSidebar}
            >
              <FiMenu />
            </button>
            <span className="eTop__badge">{headerBadge}</span>
          </div>

          <div className="eTop__actions">
            <HeaderRefreshButton />
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

        <AppFooter />
      </div>
      </div>
      <button
        type="button"
        className={`drawerOverlay${drawerOpen ? ' is-open' : ''}`}
        aria-label="Close navigation menu"
        onClick={() => setDrawerOpen(false)}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </PageRefreshProvider>
  );
}

