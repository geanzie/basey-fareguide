// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import AdminDashboard from '@/components/AdminDashboard'

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AdminDashboard', () => {
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

      if (url.includes('/api/admin/users')) {
        return Promise.resolve(
          makeJsonResponse({
            users: [
              { id: 'user-1', isActive: true, isVerified: true, userType: 'PUBLIC' },
              { id: 'user-2', isActive: true, isVerified: false, userType: 'ENFORCER' },
              { id: 'user-3', isActive: false, isVerified: true, userType: 'ADMIN' },
            ],
          }),
        )
      }

      if (url.includes('/api/admin/incidents/stats')) {
        return Promise.resolve(
          makeJsonResponse({
            total: 4,
            pending: 1,
            investigating: 1,
            resolved: 2,
            recent: [
              {
                id: 'incident-1',
                type: 'OVERCHARGING',
                description: 'Reported overcharging near the public market.',
                status: 'PENDING',
                location: 'Basey Public Market',
                createdAt: '2026-04-03T08:00:00.000Z',
              },
            ],
          }),
        )
      }

      if (url.includes('/api/admin/storage')) {
        return Promise.resolve(
          makeJsonResponse({
            storage: {
              total: {
                files: 12,
                sizeMB: 24.5,
              },
            },
            recommendations: {
              cleanupNeeded: true,
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

  it('renders stat labels and quick actions with visible text', async () => {
    await act(async () => {
      root.render(React.createElement(AdminDashboard))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Administration Overview')
    expect(container.textContent).toContain('Total Users')
    expect(container.textContent).toContain('Pending Approvals')
    expect(container.textContent).toContain('Open Incidents')
    expect(container.textContent).toContain('Storage Used')
    expect(container.textContent).toContain('User Breakdown')
    expect(container.textContent).toContain('Recent Incident Activity')
    expect(container.textContent).toContain('Refresh Data')
    expect(container.textContent).toContain('Manage Storage')
    expect(container.textContent).toContain('Manage Users')
    expect(container.textContent).toContain('Manage Fare Rates')

    const controls = Array.from(container.querySelectorAll('button, a'))

    expect(controls.length).toBeGreaterThan(0)
    expect(controls.every((control) => (control.textContent || '').trim().length > 0)).toBe(true)
  })
})
