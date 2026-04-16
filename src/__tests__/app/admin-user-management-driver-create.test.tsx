// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

vi.mock('@/components/LoadingSpinner', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'loading'),
}))

vi.mock('@/components/ResponsiveTable', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'table'),
  ActionButton: ({ children }: { children: React.ReactNode }) => React.createElement('button', null, children),
  StatusBadge: ({ status }: { status: string }) => React.createElement('span', null, status),
}))

vi.mock('@/components/AdminPasswordReset', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'password reset'),
}))

import AdminUserManagement from '@/components/AdminUserManagement'

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AdminUserManagement driver create flow', () => {
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

      if (url.includes('/api/admin/users/driver-options')) {
        return Promise.resolve(
          makeResponse({
            success: true,
            data: {
              drivers: [
                {
                  vehicleId: 'vehicle-1',
                  driverName: 'Pedro Santos',
                  driverLicense: 'D-1234',
                  username: 'ABC-123',
                  plateNumber: 'ABC-123',
                  vehicleType: 'TRICYCLE',
                  permitPlateNumber: 'PERMIT-001',
                },
              ],
            },
          }),
        )
      }

      if (url.includes('/api/admin/users/create')) {
        return Promise.resolve(
          makeResponse({
            success: true,
            message: 'User created successfully',
            data: {
              tempPassword: 'driver-temp-1',
              user: {
                id: 'driver-1',
                username: 'ABC-123',
                firstName: 'Pedro',
                lastName: 'Santos',
                fullName: 'Pedro Santos',
                userType: 'DRIVER',
                creationSource: 'ADMIN_CREATED',
                isActive: true,
                createdAt: new Date().toISOString(),
              },
            },
          }),
        )
      }

      if (url.includes('/api/admin/users?page=')) {
        return Promise.resolve(
          makeResponse({
            success: true,
            data: {
              users: [],
              pagination: { totalPages: 1, total: 0, page: 1, limit: 100 },
              summary: {
                total: 0,
                active: 0,
                inactive: 0,
                adminCreated: 0,
                selfRegistered: 0,
                byType: {
                  ADMIN: 0,
                  DATA_ENCODER: 0,
                  ENFORCER: 0,
                  DRIVER: 0,
                  PUBLIC: 0,
                },
              },
            },
          }),
        )
      }

      throw new Error(`Unhandled fetch url: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('alert', vi.fn())
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('shows only registered-driver selection and temporary password setup for driver account creation', async () => {
    await act(async () => {
      root.render(React.createElement(AdminUserManagement))
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('Pending Verifications')

    const createTabButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Create Official User',
    ) as HTMLButtonElement | undefined

    expect(createTabButton).toBeDefined()

    await act(async () => {
      createTabButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const roleSelect = container.querySelector('#admin-user-role') as HTMLSelectElement

    expect(roleSelect).not.toBeNull()

    await act(async () => {
      roleSelect.value = 'DRIVER'
      roleSelect.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Registered driver')
    expect(container.textContent).not.toContain('First name')
    expect(container.textContent).not.toContain('Last name')
    expect(container.textContent).not.toContain('Phone number')
    expect(container.textContent).not.toContain('Employee ID')
    expect(container.textContent).not.toContain('Department')
    expect(container.textContent).not.toContain('Position')
    expect(container.textContent).not.toContain('Notes')

    const driverSelect = container.querySelector('#admin-driver-registered-option') as HTMLSelectElement

    await act(async () => {
      driverSelect.value = 'vehicle-1'
      driverSelect.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Username: ABC-123')
    expect(container.textContent).toContain('Temporary password')
    expect(container.querySelector('#admin-driver-temp-password')).not.toBeNull()
    expect(container.querySelector('#admin-user-username')).toBeNull()
  })
})