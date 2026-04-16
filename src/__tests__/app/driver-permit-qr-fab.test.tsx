// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'driver-1', username: 'ABC-123' } }),
}))

vi.mock('@/components/PermitQrCard', () => ({
  __esModule: true,
  default: ({
    permitPlateNumber,
    qrToken,
    driverFullName,
  }: {
    permitPlateNumber: string
    qrToken: string
    driverFullName: string
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'permit-qr-card' },
      `${permitPlateNumber}|${qrToken}|${driverFullName}`,
    ),
}))

import DriverDashboard from '@/components/DriverDashboard'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SESSION_ACTIVE_RESPONSE = {
  driver: { id: 'driver-1', firstName: 'Juan', lastName: 'Cruz', username: 'ABC-123' },
  vehicle: {
    id: 'vehicle-1',
    plateNumber: 'ABC-123',
    vehicleType: 'TRICYCLE',
    make: 'Honda',
    model: 'TMX',
    color: 'Blue',
    assignedAt: '2026-04-15T07:00:00.000Z',
  },
  session: {
    id: 'session-1',
    status: 'OPEN',
    statusLabel: 'Open',
    activeRiderCount: 0,
    pendingCount: 0,
    boardedCount: 0,
    completedCount: 0,
    archivedCount: 0,
    openedAt: '2026-04-15T08:00:00.000Z',
    closedAt: null,
    canStartSession: false,
    canCloseSession: true,
  },
  sections: [],
}

const PERMIT_QR_RESPONSE = {
  permitPlateNumber: 'PERM-ABC-123',
  qrToken: 'test-qr-token-xyz',
  driverFullName: 'Juan Cruz',
  permitStatus: 'ACTIVE',
  permitExpiryDate: '2027-04-15T00:00:00.000Z',
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('Driver permit QR floating action button', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>

  function makeFetchMock(qrResponse: { body: unknown; status?: number } = { body: PERMIT_QR_RESPONSE }) {
    return vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

      if (url.includes('/api/driver/session/active')) {
        return Promise.resolve(makeResponse(SESSION_ACTIVE_RESPONSE))
      }

      if (url.includes('/api/driver/permit/qr')) {
        return Promise.resolve(makeResponse(qrResponse.body, qrResponse.status ?? 200))
      }

      throw new Error(`Unhandled fetch: ${url}`)
    })
  }

  async function mountAndHydrate() {
    await act(async () => {
      root.render(React.createElement(DriverDashboard))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fetchMock = makeFetchMock()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  // ── presence ────────────────────────────────────────────────────────────────

  it('renders the floating QR button with the correct aria-label', async () => {
    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')
    expect(fab).not.toBeNull()
    expect(fab?.className).toContain('fixed')
    expect(fab?.className).toContain('right-4')
    // bottom is set via inline style using the --mobile-bottom-nav-height CSS variable
    expect((fab as HTMLElement | null)?.style.bottom).toMatch(/mobile-bottom-nav-height/)
  })

  it('does not show the QR modal or QR card before the button is clicked', async () => {
    await mountAndHydrate()

    expect(container.querySelector('[data-testid="permit-qr-card"]')).toBeNull()
    expect(container.textContent).not.toContain('My Permit QR')
  })

  // ── happy path ───────────────────────────────────────────────────────────────

  it('fetches /api/driver/permit/qr and shows the modal with PermitQrCard when FAB is clicked', async () => {
    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')!

    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const qrCalls = (fetchMock.mock.calls as Array<[RequestInfo | URL]>).filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      return url.includes('/api/driver/permit/qr')
    })
    expect(qrCalls).toHaveLength(1)

    expect(container.querySelector('[data-testid="permit-qr-card"]')).not.toBeNull()
    expect(container.textContent).toContain('My Permit QR')
    expect(container.textContent).toContain('PERM-ABC-123')
    expect(container.textContent).toContain('test-qr-token-xyz')
    expect(container.textContent).toContain('Juan Cruz')
  })

  it('does not re-fetch when the FAB is clicked a second time after the data is cached', async () => {
    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')!

    // First open
    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    // Close via × button
    const closeBtn = container.querySelector('button[aria-label="Close permit QR"]')!
    await act(async () => {
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    // Second open
    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const qrCalls = (fetchMock.mock.calls as Array<[RequestInfo | URL]>).filter(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      return url.includes('/api/driver/permit/qr')
    })
    expect(qrCalls).toHaveLength(1) // only fetched once
    expect(container.querySelector('[data-testid="permit-qr-card"]')).not.toBeNull()
  })

  // ── close interactions ───────────────────────────────────────────────────────

  it('closes the QR modal when the × button is clicked', async () => {
    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')!

    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="permit-qr-card"]')).not.toBeNull()

    const closeBtn = container.querySelector('button[aria-label="Close permit QR"]')!
    expect(closeBtn).not.toBeNull()

    await act(async () => {
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="permit-qr-card"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Close permit QR"]')).toBeNull()
  })

  it('closes the QR modal when the backdrop is clicked', async () => {
    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')!

    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="permit-qr-card"]')).not.toBeNull()

    // The outer backdrop div is the first fixed inset-0 element enclosing the modal
    const backdrop = container.querySelector('.fixed.inset-0.z-50') as HTMLElement
    expect(backdrop).not.toBeNull()

    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="permit-qr-card"]')).toBeNull()
  })

  // ── error states ─────────────────────────────────────────────────────────────

  it('shows an error toast when the API returns 409 (no QR token issued)', async () => {
    fetchMock = makeFetchMock({
      body: { error: 'No QR token has been issued for this permit yet. Contact the encoder to issue one.' },
      status: 409,
    })
    vi.stubGlobal('fetch', fetchMock)

    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')!

    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="permit-qr-card"]')).toBeNull()
    expect(container.textContent).toContain('No QR token has been issued for this permit yet')
  })

  it('shows an error toast when the API returns 404 (no permit for vehicle)', async () => {
    fetchMock = makeFetchMock({
      body: { error: 'No permit found for the assigned vehicle.' },
      status: 404,
    })
    vi.stubGlobal('fetch', fetchMock)

    await mountAndHydrate()

    const fab = container.querySelector('button[aria-label="View my permit QR"]')!

    await act(async () => {
      fab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="permit-qr-card"]')).toBeNull()
    expect(container.textContent).toContain('No permit found for the assigned vehicle.')
  })
})
