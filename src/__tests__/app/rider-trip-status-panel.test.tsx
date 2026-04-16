// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import useSWR from 'swr'

vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(),
}))

import RiderTripStatusPanel from '@/components/RiderTripStatusPanel'

const PENDING_RESPONSE = {
  hasActiveTrip: true,
  trip: {
    id: 'sr-1',
    fareCalculationId: null,
    status: 'PENDING',
    statusLabel: 'Waiting for driver',
    origin: 'Market',
    destination: 'Terminal',
    fare: 35,
    discountType: null,
    joinedAt: '2026-04-16T08:00:00.000Z',
    expiresAt: '2026-04-16T08:10:00.000Z',
    acceptedAt: null,
    boardedAt: null,
    vehiclePlateNumber: 'ABC-123',
    vehicleType: 'TRICYCLE',
  },
}

const ACCEPTED_RESPONSE = {
  ...PENDING_RESPONSE,
  trip: {
    ...PENDING_RESPONSE.trip,
    fareCalculationId: 'calc-1',
    status: 'ACCEPTED',
    statusLabel: 'Trip accepted',
    expiresAt: null,
    acceptedAt: '2026-04-16T08:02:00.000Z',
  },
}

const NO_TRIP_RESPONSE = { hasActiveTrip: false, trip: null }

function mountPanel(fareCalculationId = 'calc-1') {
  let container: HTMLDivElement
  let root: Root

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  return { container, root }
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  vi.clearAllMocks()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  document.body.innerHTML = ''
})

describe('RiderTripStatusPanel', () => {
  it('renders nothing when there is no active trip', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: NO_TRIP_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    expect(container.firstChild).toBeNull()
  })

  it('shows PENDING status with route and fare', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: PENDING_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Waiting for driver')
    expect(container.textContent).toContain('Market')
    expect(container.textContent).toContain('Terminal')
    expect(container.textContent).toContain('35')
    expect(container.textContent).toContain('ABC-123')
  })

  it('shows ACCEPTED status after driver accepts', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: ACCEPTED_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Trip accepted')
    expect(container.textContent).toContain('Market')
    expect(container.textContent).toContain('Terminal')
    expect(container.textContent).toContain('35')
  })

  it('shows toast when status transitions from PENDING to ACCEPTED', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: PENDING_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    // Simulate SWR returning accepted data on next render cycle
    vi.mocked(useSWR).mockReturnValue({
      data: ACCEPTED_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Driver accepted your trip')
  })

  it('does not show duplicate route metadata blocks', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: ACCEPTED_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    // Route summary appears exactly once — no duplicated detail blocks
    const routeText = container.textContent ?? ''
    const marketCount = (routeText.match(/Market/g) ?? []).length
    const terminalCount = (routeText.match(/Terminal/g) ?? []).length
    expect(marketCount).toBe(1)
    expect(terminalCount).toBe(1)
  })

  it('shows toast when status transitions from PENDING to BOARDED', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: PENDING_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    const BOARDED_RESPONSE = {
      ...PENDING_RESPONSE,
      trip: { ...PENDING_RESPONSE.trip, status: 'BOARDED', statusLabel: 'Trip accepted' },
    }

    vi.mocked(useSWR).mockReturnValue({
      data: BOARDED_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-1' }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Driver accepted your trip')
  })

  it('uses tripRequestId-scoped SWR key', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: NO_TRIP_RESPONSE,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never)

    const { container, root } = mountPanel()
    await act(async () => {
      root.render(React.createElement(RiderTripStatusPanel, { tripRequestId: 'sr-42' }))
      await Promise.resolve()
    })

    const swrCallKey = vi.mocked(useSWR).mock.calls[0][0]
    expect(String(swrCallKey)).toContain('tripRequestId=sr-42')
  })
})
