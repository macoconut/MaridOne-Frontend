import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { FiBarChart2, FiClipboard, FiMenu } from 'react-icons/fi';
import AppFooter from '../../components/layout/AppFooter';
import BackendTestPanel from '../../components/layout/BackendTestPanel';
import HeaderRefreshButton from '../../components/navigation/HeaderRefreshButton';
import RoleSidebar from '../../components/navigation/RoleSidebar';
import SettingsModal from '../../components/settings/SettingsModal';
import useResponsiveSidebar from '../../hooks/useResponsiveSidebar';
import type { NavSection } from '../../components/navigation/SidebarNavSection';
import '../shared/RoleLayout.css';
import { getUserEmail } from '../../lib/session';
import { BACKEND_TEST_MODE } from '../../config/flags';
import { apiFetchRaw, expireCurrentSession } from '../../lib/api';
import {
  extractFirstId,
  firstFromCollection,
  type PlaceholderContext,
} from '../../lib/backendTest';
import { PageRefreshProvider } from '../../lib/pageRefresh';
import { useBackendTestRunner, type BackendTestAction } from '../shared/useBackendTestRunner';
import { useHeaderBadge } from '../shared/useHeaderBadge';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen]))
  );
  const { drawerOpen, isMobileLayout, setDrawerOpen, sidebarCollapsed, toggleSidebar } = useResponsiveSidebar();
  const { headerBadge } = useHeaderBadge('Accounting');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDrawerOpen(false);
      setSettingsOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname, setDrawerOpen]);

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

  const fetchJsonWithAuth = useCallback(async (path: string) => {
    const response = await apiFetchRaw(path, { method: 'GET' });
    if (!response.ok) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const buildContext = useCallback(async (): Promise<PlaceholderContext> => {
    const username = getUserEmail();
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
  }, [fetchJsonWithAuth]);
  const { backendAction, backendResult, handleBackendTest, isLoading } = useBackendTestRunner(
    buildContext,
    { initialResult: 'Waiting for backend test.' }
  );

  useEffect(() => {
    if (!BACKEND_TEST_MODE) return;
    void handleBackendTest(backendActions[0]);
  }, [handleBackendTest]);

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
          {BACKEND_TEST_MODE ? (
            <BackendTestPanel
              actions={backendActions}
              ariaLabel="Accounting backend testing controls"
              isLoading={isLoading}
              lastAction={backendAction}
              onRun={handleBackendTest}
              result={backendResult}
              title="Backend Endpoint Testing"
              variant="details"
              summaryLabel="Accounting Backend Test Panel (click to expand)"
            />
          ) : null}
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

