import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { RoleShell } from './RoleShell'

describe('RoleShell', () => {
  it('renders the shared shell with content and notifications', () => {
    render(
      <MemoryRouter initialEntries={['/employee/dashboard']}>
        <RoleShell
          brandLabel="Go to dashboard"
          drawerOpen={false}
          headerBadge="Employee"
          headerDepartment="Support"
          isMobileLayout={false}
          navSections={[
            {
              id: 'employee',
              label: 'Employee',
              defaultOpen: true,
              items: [{ to: '/employee/dashboard', label: 'Dashboard', icon: () => null }],
            },
          ]}
          notificationCenterProps={{
            bellRef: createRef(),
            panelRef: createRef(),
            notifOpen: false,
            unreadCount: 0,
            notifications: [],
            todayLabel: 'April 20',
            notificationPresence: { isMounted: false, isClosing: false },
            onBellClick: vi.fn(),
            onNotificationClick: vi.fn(),
            onPanelWheel: vi.fn(),
          }}
          onBrandClick={vi.fn()}
          onCloseDrawer={vi.fn()}
          onCloseSettings={vi.fn()}
          onLogout={vi.fn()}
          onOpenSettings={vi.fn()}
          onToggleSection={vi.fn()}
          onToggleSidebar={vi.fn()}
          openSections={{ employee: true }}
          settingsOpen={false}
          sidebarCollapsed={false}
        >
          <p>Dashboard body</p>
        </RoleShell>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard body')).toBeInTheDocument()
    expect(screen.getAllByText('Employee').length).toBeGreaterThan(0)
    expect(screen.getByText('Support')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('omits the notification center when no props are passed', () => {
    render(
      <MemoryRouter initialEntries={['/accounting/payroll-dashboard']}>
        <RoleShell
          brandLabel="Go to dashboard"
          drawerOpen={false}
          headerBadge="Accounting"
          isMobileLayout={false}
          navSections={[
            {
              id: 'payroll',
              label: 'Payroll',
              defaultOpen: true,
              items: [{ to: '/accounting/payroll-dashboard', label: 'Dashboard', icon: () => null }],
            },
          ]}
          onBrandClick={vi.fn()}
          onCloseDrawer={vi.fn()}
          onCloseSettings={vi.fn()}
          onLogout={vi.fn()}
          onOpenSettings={vi.fn()}
          onToggleSection={vi.fn()}
          onToggleSidebar={vi.fn()}
          openSections={{ payroll: true }}
          settingsOpen={false}
          sidebarCollapsed={false}
        >
          <p>Audit body</p>
        </RoleShell>
      </MemoryRouter>
    )

    expect(screen.getByText('Audit body')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument()
  })
})
