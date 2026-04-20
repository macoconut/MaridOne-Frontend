import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { NavSection } from '../components/navigation/SidebarNavSection'
import { useRoleLayout } from './useRoleLayout'

const setDrawerOpen = vi.fn()
const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('./useResponsiveSidebar', () => ({
  default: () => ({
    drawerOpen: false,
    isMobileLayout: false,
    setDrawerOpen,
    sidebarCollapsed: false,
    toggleSidebar: vi.fn(),
  }),
}))

vi.mock('../layouts/shared/useHeaderBadge', () => ({
  useHeaderBadge: () => ({
    headerBadge: 'HR',
    headerDepartment: 'People Ops',
  }),
}))

vi.mock('../layouts/shared/useBackendTestRunner', () => ({
  useBackendTestRunner: () => ({
    backendAction: 'None',
    backendResult: '',
    handleBackendTest: vi.fn(),
    isLoading: false,
  }),
}))

const navSections: NavSection[] = [
  {
    id: 'self-service',
    label: 'Self-Service',
    defaultOpen: true,
    items: [{ to: '/hr/self-service/dashboard', label: 'Dashboard', icon: () => null }],
  },
  {
    id: 'ops',
    label: 'People Ops',
    defaultOpen: false,
    items: [{ to: '/hr/payslips', label: 'Payslips', icon: () => null }],
  },
]

describe('useRoleLayout', () => {
  it('forces the active section open even if it was toggled closed', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/hr/payslips']}>{children}</MemoryRouter>
    )

    const { result } = renderHook(
      () => useRoleLayout({ roleLabel: 'HR', homePath: '/hr/dashboard', navSections }),
      { wrapper }
    )

    expect(result.current.resolvedOpenSections.ops).toBe(true)

    act(() => result.current.toggleSection('ops'))
    act(() => result.current.toggleSection('ops'))

    expect(result.current.openSections.ops).toBe(false)
    expect(result.current.resolvedOpenSections.ops).toBe(true)
  })

  it('opens settings and closes the drawer', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/hr/dashboard']}>{children}</MemoryRouter>
    )

    const { result } = renderHook(
      () => useRoleLayout({ roleLabel: 'HR', homePath: '/hr/dashboard', navSections }),
      { wrapper }
    )

    act(() => result.current.handleOpenSettings())

    expect(setDrawerOpen).toHaveBeenCalledWith(false)
    expect(result.current.settingsOpen).toBe(true)
  })
})
