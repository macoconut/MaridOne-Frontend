import { FiMenu } from 'react-icons/fi'
import type { ComponentProps, ReactNode } from 'react'

import AppFooter from '@/components/layout/AppFooter'
import NotificationCenter from '@/components/layout/NotificationCenter'
import HeaderRefreshButton from '@/components/navigation/HeaderRefreshButton'
import type { NavSection } from '@/components/navigation/SidebarNavSection'
import RoleSidebar from '@/components/navigation/RoleSidebar'
import SettingsModal from '@/components/settings/SettingsModal'
import { PageRefreshProvider } from '@/lib/utils/pageRefresh'
import './RoleLayout.css'

type RoleShellProps = {
  brandLabel: string
  children: ReactNode
  drawerOpen: boolean
  headerBadge: string
  headerDepartment?: string
  isMobileLayout: boolean
  navSections: NavSection[]
  notificationCenterProps?: ComponentProps<typeof NotificationCenter>
  onBrandClick: () => void
  onCloseDrawer: () => void
  onCloseSettings: () => void
  onLogout: () => void | Promise<void>
  onOpenSettings: () => void
  onToggleSection?: (sectionId: string) => void
  onToggleSidebar: () => void
  openSections?: Record<string, boolean>
  settingsOpen: boolean
  sidebarCollapsed: boolean
}

export function RoleShell({
  brandLabel,
  children,
  drawerOpen,
  headerBadge,
  headerDepartment,
  isMobileLayout,
  navSections,
  notificationCenterProps,
  onBrandClick,
  onCloseDrawer,
  onCloseSettings,
  onLogout,
  onOpenSettings,
  onToggleSection,
  onToggleSidebar,
  openSections,
  settingsOpen,
  sidebarCollapsed,
}: RoleShellProps) {
  return (
    <PageRefreshProvider>
      <div className={`employeeLayout${!isMobileLayout && sidebarCollapsed ? ' employeeLayout--sidebarCollapsed' : ''}`}>
        <RoleSidebar
          brandLabel={brandLabel}
          collapsed={!isMobileLayout && sidebarCollapsed}
          drawerOpen={drawerOpen}
          isMobileLayout={isMobileLayout}
          navSections={navSections}
          onBrandClick={onBrandClick}
          onLogout={onLogout}
          onOpenSettings={onOpenSettings}
          onToggleSection={onToggleSection}
          onToggleSidebar={onToggleSidebar}
          openSections={openSections}
        />

        <div className="eMain">
          <header className="eTop">
            <div className="eTop__left">
              <button
                className="eTop__ham"
                type="button"
                aria-label={isMobileLayout ? (drawerOpen ? 'Close navigation menu' : 'Open navigation menu') : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
                onClick={onToggleSidebar}
              >
                <FiMenu />
              </button>
              <div className="eTop__badgeWrap">
                <span className="eTop__badge">{headerBadge}</span>
                {headerDepartment ? <span className="eTop__badgeMeta">{headerDepartment}</span> : null}
              </div>
            </div>

            <div className="eTop__actions">
              <HeaderRefreshButton />
              {notificationCenterProps ? <NotificationCenter {...notificationCenterProps} /> : null}
            </div>
          </header>

          <main className="eContent">{children}</main>

          <AppFooter />
        </div>
      </div>

      <button
        type="button"
        className={`drawerOverlay${drawerOpen ? ' is-open' : ''}`}
        aria-label="Close navigation menu"
        onClick={onCloseDrawer}
      />
      <SettingsModal open={settingsOpen} onClose={onCloseSettings} />
    </PageRefreshProvider>
  )
}
