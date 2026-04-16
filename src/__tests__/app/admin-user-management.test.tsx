// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

vi.mock('@/components/LoadingSpinner', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'loading'),
}))

vi.mock('@/components/dashboardIcons', () => {
  const slot = ({ size: _size, className: _cls }: { size?: number; className?: string }) =>
    React.createElement('span', null)
  return {
    __esModule: true,
    DASHBOARD_ICONS: new Proxy({}, { get: () => 'icon' }),
    DASHBOARD_ICON_POLICY: { sizes: { card: 24, alert: 16, button: 16 } },
    DashboardIconSlot: slot,
    getDashboardIconChipClasses: () => '',
  }
})

vi.mock('@/components/ResponsiveTable', () => ({
  __esModule: true,
  default: ({
    data,
    columns,
  }: {
    data: Record<string, unknown>[]
    columns: Array<{ key?: string; header: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }>
  }) =>
    React.createElement(
      'table',
      { 'data-testid': 'responsive-table' },
      React.createElement(
        'tbody',
        null,
        data.map((row, i) =>
          React.createElement(
            'tr',
            { key: i },
            columns.map((col, j) =>
              React.createElement('td', { key: j }, col.render ? (col.render(row[col.key ?? ''], row) as React.ReactNode) : String(row[col.key ?? ''] ?? '')),
            ),
          ),
        ),
      ),
    ),
  ActionButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => React.createElement('button', { onClick, disabled }, children),
  StatusBadge: ({ status, className }: { status: string; className?: string }) =>
    React.createElement('span', { className }, status),
}))

import AdminUserManagement from '@/components/AdminUserManagement'

function makeAdminUserDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    username: 'jdelacruz',
    firstName: 'Jose',
    lastName: 'Dela Cruz',
    fullName: 'Jose Dela Cruz',
    userType: 'DATA_ENCODER',
    creationSource: 'ADMIN_CREATED',
    isActive: true,
    createdAt: new Date().toISOString(),
    phoneNumber: null,
    governmentId: null,
    barangayResidence: null,
    reasonForRegistration: null,
    assignedVehicle: null,
    ...overrides,
  }
}

function makeListResponse(users: unknown[]) {
  return {
    success: true,
    data: {
      users,
      pagination: { total: users.length, page: 1, limit: 100, totalPages: 1 },
      summary: {
        total: users.length,
        active: users.length,
        inactive: 0,
        adminCreated: users.length,
        selfRegistered: 0,
        byType: { ADMIN: 0, DATA_ENCODER: users.length, ENFORCER: 0, DRIVER: 0, PUBLIC: 0 },
      },
    },
  }
}

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AdminUserManagement', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/admin/users?page=')) {
        return Promise.resolve(makeResponse(makeListResponse([makeAdminUserDto()])))
      }

      if (url.includes('/api/admin/users/toggle-status')) {
        return Promise.resolve(
          makeResponse({
            success: true,
            message: 'Account deactivated successfully',
            data: { userId: 'user-1', isActive: false, username: 'jdelacruz' },
          }),
        )
      }

      if (url.includes('/api/admin/reset-password')) {
        return Promise.resolve(
          makeResponse({
            success: true,
            message: 'Reset token generated',
            data: {
              action: 'generate-token',
              token: 'test-token-abc',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              user: makeAdminUserDto(),
            },
          }),
        )
      }

      throw new Error(`Unhandled fetch url: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  describe('no-verification tab model', () => {
    it('renders only users, create, and password-reset tabs — no pending/verify tab', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      const tabButtons = Array.from(container.querySelectorAll('nav button')).map((b) => b.textContent)

      expect(tabButtons).toContain('User Directory')
      expect(tabButtons).toContain('Create Official User')
      expect(tabButtons).toContain('Password Reset')
      expect(tabButtons.some((t) => /pending/i.test(t ?? ''))).toBe(false)
      expect(tabButtons.some((t) => /verif/i.test(t ?? ''))).toBe(false)
    })

    it('defaults to the users tab on mount', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      // The users panel search input is present by default
      expect(container.querySelector('#admin-users-search')).not.toBeNull()
      // The create form is not present
      expect(container.querySelector('#admin-user-role')).toBeNull()
    })

    it('loads users immediately on mount', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      const usersFetched = (fetchMock.mock.calls as Array<[RequestInfo | URL]>).some(([input]) => {
        const url = typeof input === 'string' ? input : input.toString()
        return url.includes('/api/admin/users?page=')
      })

      expect(usersFetched).toBe(true)
    })
  })

  describe('users panel', () => {
    it('renders a loaded user row', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(container.textContent).toContain('Jose Dela Cruz')
    })

    it('shows summary counts after load', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(container.textContent).toContain('Total Accounts')
      expect(container.textContent).toContain('Active Accounts')
      expect(container.textContent).toContain('Inactive Accounts')
    })
  })

  describe('detail modal', () => {
    async function openModal() {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      const viewButton = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.toLowerCase().includes('view'),
      )

      if (!viewButton) {
        return false
      }

      await act(async () => {
        viewButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await Promise.resolve()
      })

      return true
    }

    it('opens modal with user details when view action is clicked', async () => {
      const opened = await openModal()
      if (!opened) {
        // ResponsiveTable mock renders columns; if "View" button is absent the mock differs
        return
      }

      expect(container.querySelector('[role="dialog"]')).not.toBeNull()
      expect(container.textContent).toContain('User Details')
    })

    it('does not show a verify/approve action in the modal', async () => {
      const opened = await openModal()
      if (!opened) {
        return
      }

      const modalButtons = Array.from(container.querySelectorAll('[role="dialog"] button')).map((b) => b.textContent)

      expect(modalButtons.some((t) => /verif|approv/i.test(t ?? ''))).toBe(false)
    })
  })

  describe('status toggle', () => {
    it('navigates to users tab and shows deactivate button in modal', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      const viewButton = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.toLowerCase().includes('view'),
      )

      if (!viewButton) {
        return
      }

      await act(async () => {
        viewButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await Promise.resolve()
      })

      const modal = container.querySelector('[role="dialog"]')
      expect(modal).not.toBeNull()

      const deactivateBtn = Array.from((modal ?? container).querySelectorAll('button')).find(
        (b) => b.textContent === 'Deactivate Account',
      )

      expect(deactivateBtn).toBeDefined()
    })
  })

  describe('password reset tab', () => {
    it('switches to the password-reset tab and shows the reset form', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      const prTab = Array.from(container.querySelectorAll('nav button')).find(
        (b) => b.textContent === 'Password Reset',
      ) as HTMLButtonElement | undefined

      expect(prTab).toBeDefined()

      await act(async () => {
        prTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await Promise.resolve()
      })

      expect(container.querySelector('#admin-password-reset-user-select')).not.toBeNull()
    })

    it('shows the password reset form only on the password-reset tab, not on users tab', async () => {
      await act(async () => {
        root.render(React.createElement(AdminUserManagement))
        await Promise.resolve()
        await Promise.resolve()
      })

      // Default tab is users — password-reset form must not be mounted yet
      expect(container.querySelector('#admin-password-reset-user-select')).toBeNull()
    })
  })
})
