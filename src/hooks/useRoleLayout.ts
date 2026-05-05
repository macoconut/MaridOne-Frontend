import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import type { NavSection } from '../components/navigation/SidebarNavSection'
import { BACKEND_TEST_MODE } from '../config/flags'
import useResponsiveSidebar from './useResponsiveSidebar'
import { apiFetchRaw, expireCurrentSession } from '../lib/api/api'
import { getUserEmail } from '../lib/session'
import type { PlaceholderContext } from '../lib/test/backendTest'
import type { BackendTestAction } from '../layouts/shared/useBackendTestRunner'
import { useBackendTestRunner } from '../layouts/shared/useBackendTestRunner'
import { useHeaderBadge } from '../layouts/shared/useHeaderBadge'

type BuildRoleLayoutContextHelpers = {
  fetchJsonWithAuth: (path: string) => Promise<unknown>
  username: string | null
}

export type RoleLayoutBackendPanelConfig = {
  actions: BackendTestAction[]
  ariaLabel: string
  title: string
  buildContext: (helpers: BuildRoleLayoutContextHelpers) => Promise<PlaceholderContext>
  mode?: 'prepend' | 'replace'
  variant?: 'section' | 'details'
  summaryLabel?: string
  initialAction?: string
  initialResult?: string
  autoRunFirstAction?: boolean
}

type UseRoleLayoutOptions = {
  roleLabel: string
  homePath: string
  navSections: NavSection[]
  brandLabel?: string
}

type UseRoleLayoutOptionsWithBackend = UseRoleLayoutOptions & {
  backendPanel?: RoleLayoutBackendPanelConfig
}

export function useRoleLayout({
  roleLabel,
  homePath,
  navSections,
  brandLabel = 'Go to dashboard',
  backendPanel,
}: UseRoleLayoutOptionsWithBackend) {
  const navigate = useNavigate()
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((section) => [section.id, section.defaultOpen]))
  )
  const { drawerOpen, isMobileLayout, setDrawerOpen, sidebarCollapsed, toggleSidebar } = useResponsiveSidebar()
  const { headerBadge, headerDepartment } = useHeaderBadge(roleLabel)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDrawerOpen(false)
      setSettingsOpen(false)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [location.pathname, setDrawerOpen])

  const activeSectionId = useMemo(
    () =>
      navSections.find((section) =>
        section.items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      )?.id ?? null,
    [location.pathname, navSections]
  )

  const resolvedOpenSections = useMemo(
    () =>
      activeSectionId && !openSections[activeSectionId]
        ? { ...openSections, [activeSectionId]: true }
        : openSections,
    [activeSectionId, openSections]
  )

  const handleBrandClick = useCallback(() => {
    navigate(homePath, { replace: true })
  }, [homePath, navigate])

  const handleLogout = useCallback(async () => {
    await expireCurrentSession()
    navigate('/', { replace: true })
  }, [navigate])

  const handleOpenSettings = useCallback(() => {
    setDrawerOpen(false)
    setSettingsOpen(true)
  }, [setDrawerOpen])

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSections((previous) => ({ ...previous, [sectionId]: !previous[sectionId] }))
  }, [])

  const fetchJsonWithAuth = useCallback(async (path: string) => {
    const response = await apiFetchRaw(path, { method: 'GET' })
    if (!response.ok) return null

    try {
      return await response.json()
    } catch {
      return null
    }
  }, [])

  const buildContext = useCallback(async (): Promise<PlaceholderContext> => {
    if (!backendPanel) {
      return {}
    }

    return backendPanel.buildContext({
      fetchJsonWithAuth,
      username: getUserEmail(),
    })
  }, [backendPanel, fetchJsonWithAuth])

  const { backendAction, backendResult, handleBackendTest, isLoading } = useBackendTestRunner(buildContext, {
    initialAction: backendPanel?.initialAction,
    initialResult: backendPanel?.initialResult,
  })

  useEffect(() => {
    if (!BACKEND_TEST_MODE || !backendPanel?.autoRunFirstAction || !backendPanel.actions[0]) {
      return
    }

    void handleBackendTest(backendPanel.actions[0])
  }, [backendPanel, handleBackendTest])

  return {
    backendPanelMode: backendPanel?.mode ?? 'prepend',
    backendPanelProps: backendPanel
      ? {
          actions: backendPanel.actions,
          ariaLabel: backendPanel.ariaLabel,
          isLoading,
          lastAction: backendAction,
          onRun: handleBackendTest,
          result: backendResult,
          summaryLabel: backendPanel.summaryLabel,
          title: backendPanel.title,
          variant: backendPanel.variant,
        }
      : null,
    brandLabel,
    drawerOpen,
    handleBrandClick,
    handleLogout,
    handleOpenSettings,
    headerBadge,
    headerDepartment,
    isMobileLayout,
    openSections,
    resolvedOpenSections,
    settingsOpen,
    setDrawerOpen,
    setSettingsOpen,
    sidebarCollapsed,
    toggleSection,
    toggleSidebar,
  }
}
