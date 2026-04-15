vi.mock('@/components/PublicRideTagScanner', () => ({
  __esModule: true,
  default: ({ autoStart }: { autoStart?: boolean }) =>
    React.createElement('div', null, autoStart ? 'Mock scanner active' : 'Mock scanner idle'),
}))
// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import type { RoutePlannerMapProps } from '@/components/RoutePlannerMap'

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  status: 'unauthenticated' as 'authenticated' | 'unauthenticated',
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: authState.user, status: authState.status }),
}))

import RoutePlannerCalculator from '@/components/RoutePlannerCalculator'

function repoPath(...parts: string[]) {
  return path.join(process.cwd(), ...parts)
}

function MockPlannerMap(props: RoutePlannerMapProps) {
  const destination = props.destination

  return React.createElement(
    'div',
    { 'data-testid': 'mock-planner-map' },
    React.createElement('div', null, `origin:${props.origin ? props.origin.label : 'none'}`),
    React.createElement('div', null, `destination:${props.destination ? props.destination.label : 'none'}`),
    React.createElement('div', null, `polyline:${props.polyline ?? 'none'}`),
    React.createElement('div', null, `fit:${props.fitBoundsToken ?? 0}`),
    React.createElement('div', null, `state:${props.plannerState}`),
    React.createElement(
      'button',
      {
        onClick: () =>
          props.onOriginChange({ lat: 11.2754, lng: 125.0689, label: 'Mercado' }),
      },
      'Mock place A',
    ),
    React.createElement(
      'button',
      {
        onClick: () =>
          props.onDestinationChange({ lat: 11.2854, lng: 125.0789, label: 'Amandayehan Wharf' }),
      },
      'Mock place B',
    ),
    React.createElement(
      'button',
      {
        onClick: () =>
          props.onDestinationChange({
            lat: 11.2954,
            lng: 125.0889,
            label: 'Moved destination',
          }),
      },
      'Mock move B',
    ),
    React.createElement(
      'button',
      {
        onClick: () => {
          if (!destination) return
          props.onDestinationChange(destination)
        },
      },
      'Mock same B',
    ),
  )
}

function makeResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const DEFAULT_FARE_POLICY = {
  versionId: 'fare-live',
  baseDistanceKm: 3,
  baseFare: 15,
  perKmRate: 3,
  effectiveAt: '2026-04-01T00:00:00.000Z',
}

const PLANNER_LOCATIONS = [
  {
    id: 'loc-1',
    name: 'Mercado Terminal',
    type: 'BARANGAY',
    category: 'barangay',
    coordinates: { lat: 11.2754, lng: 125.0689 },
    address: 'Mercado Terminal, Basey, Samar',
    verified: true,
    source: 'database',
    barangay: 'Mercado',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'loc-2',
    name: 'Amandayehan Wharf',
    type: 'LANDMARK',
    category: 'landmark',
    coordinates: { lat: 11.2854, lng: 125.0789 },
    address: 'Amandayehan Wharf, Basey, Samar',
    verified: true,
    source: 'database',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'loc-3',
    name: 'Anglit Barangay Hall',
    type: 'BARANGAY',
    category: 'barangay',
    coordinates: { lat: 11.2454, lng: 125.0589 },
    address: 'Anglit Barangay Hall, Basey, Samar',
    verified: true,
    source: 'database',
    barangay: 'Anglit',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
] as const

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

describe('RoutePlannerCalculator', () => {
  let container: HTMLDivElement
  let root: Root
  let fetchMock: ReturnType<typeof vi.fn>
  let routeQueue: Array<Promise<Response> | Response>
  let routeBodies: Array<unknown>
  let savedCalculationBodies: Array<unknown>

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    authState.user = null
    authState.status = 'unauthenticated'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    routeQueue = []
    routeBodies = []
    savedCalculationBodies = []

    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/api/routes/calculate')) {
        routeBodies.push(JSON.parse(String(init?.body ?? '{}')))
        const next = routeQueue.shift()
        if (!next) {
          throw new Error('No queued route response')
        }

        return next instanceof Response ? Promise.resolve(next) : next
      }

      if (url.includes('/api/locations')) {
        return Promise.resolve(
          makeResponse({
            success: true,
            locations: PLANNER_LOCATIONS,
            count: PLANNER_LOCATIONS.length,
            metadata: {
              municipality: 'Basey',
              province: 'Samar',
              total_locations: PLANNER_LOCATIONS.length,
              last_updated: '2026-04-01T00:00:00.000Z',
              sources: ['database'],
            },
          }),
        )
      }

      if (url.includes('/api/fare-rates')) {
        return Promise.resolve(
          makeResponse({
            current: DEFAULT_FARE_POLICY,
            upcoming: null,
          }),
        )
      }

      if (url.includes('/api/discount-cards/me')) {
        return Promise.resolve(
          makeResponse({
            hasDiscountCard: false,
            isValid: false,
            discountCard: null,
          }),
        )
      }

      if (url.includes('/api/fare-calculations')) {
        savedCalculationBodies.push(JSON.parse(String(init?.body ?? '{}')))
        return Promise.resolve(makeResponse({ success: true, calculation: { id: 'calc-1' } }))
      }

      throw new Error(`Unhandled fetch url: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) =>
          success({
            coords: {
              latitude: 11.276,
              longitude: 125.07,
              accuracy: 15,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition),
        ),
      },
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    vi.useRealTimers()
  })

  function clickButton(label: string, index = 0) {
    const matches = Array.from(container.querySelectorAll('button')).filter((button) =>
      button.textContent?.includes(label),
    )

    if (!matches[index]) {
      throw new Error(`Button "${label}" not found`)
    }

    matches[index].dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

    it('replaces the old split-mode planner copy with a pin-only route surface and optional vehicle support', () => {
    const planner = readFileSync(repoPath('src', 'components', 'RoutePlannerCalculator.tsx'), 'utf8')
    const rideTagScanner = readFileSync(repoPath('src', 'components', 'PublicRideTagScanner.tsx'), 'utf8')

    expect(planner).toContain('Scan operator QR')
    expect(planner).toContain("Can't scan? Search manually")
      expect(rideTagScanner).toContain('Recommended for faster and more accurate trip identification.')
      expect(rideTagScanner).not.toContain('Tag this ride by scanning the operator QR')
    expect(planner).not.toContain('Optional: Search by plate number (BPLO-issued)')
      expect(planner).not.toContain('Set Origin')
      expect(planner).not.toContain('Set Destination')
      expect(planner).not.toContain('Calculate route')
      expect(planner).not.toContain('Use current location')
      expect(planner).not.toContain('Swap origin and destination')
      expect(planner).not.toContain('Reset planner')
    expect(planner).not.toContain('Quick Quote')
    expect(planner).not.toContain('Exact Quote (Map Pin)')
    expect(planner).not.toContain('Route Planned Successfully!')
  })

    it('keeps the pin-only planner surface free of typed origin and destination fields', async () => {
      await act(async () => {
        root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
        await Promise.resolve()
        await Promise.resolve()
      })

      expect(container.querySelectorAll('input[type="text"]')).toHaveLength(0)
      expect(container.textContent).not.toContain('Use current location')
      expect(container.textContent).not.toContain('Swap origin and destination')
      expect(container.textContent).not.toContain('Reset planner')
    })

  it('keeps scan and manual identity options on one row and only shows the active pane', async () => {
    authState.user = { id: 'public-1' }
    authState.status = 'authenticated'

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Scan operator QR')
    expect(container.textContent).toContain("Can't scan? Search manually")
    expect(container.textContent).not.toContain('Mock scanner active')
    expect(container.textContent).not.toContain('Search manually by plate number')

    await act(async () => {
      clickButton('Scan operator QR')
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('Scan operator QR')
    expect(container.textContent).not.toContain("Can't scan? Search manually")
    expect(container.textContent).toContain('Mock scanner active')
    expect(container.textContent).not.toContain('Search manually by plate number')

    await act(async () => {
      clickButton('Choose another option')
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Scan operator QR')
    expect(container.textContent).toContain("Can't scan? Search manually")
    expect(container.textContent).not.toContain('Mock scanner active')
    expect(container.textContent).not.toContain('Search manually by plate number')

    await act(async () => {
      clickButton("Can't scan? Search manually")
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('Scan operator QR')
    expect(container.textContent).not.toContain("Can't scan? Search manually")
    expect(container.textContent).not.toContain('Mock scanner active')
    expect(container.textContent).toContain('Search manually by plate number')
  })

  it('auto-calculates after placing two pins without saving until the rider explicitly confirms', async () => {
    routeQueue.push(
      makeResponse({
        origin: 'Mercado',
        destination: 'Amandayehan Wharf',
        distanceKm: 5.4,
        durationMin: 12,
        fare: 24,
        fareBreakdown: {
          baseFare: 15,
          additionalKm: 2.4,
          additionalFare: 9,
          discount: 0,
        },
        method: 'ors',
        provider: 'ors',
        fallbackReason: null,
        polyline: 'encoded-ors',
        inputMode: 'pin',
      }),
    )

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Mock place A')
      clickButton('Mock place B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(routeBodies).toHaveLength(1)
    expect(routeBodies[0]).toMatchObject({
      origin: { type: 'pin', lat: 11.2754, lng: 125.0689 },
      destination: { type: 'pin', lat: 11.2854, lng: 125.0789 },
    })
    expect(savedCalculationBodies).toHaveLength(0)
    expect(container.textContent).toContain('PHP 24.00')
    expect(container.textContent).toContain('polyline:encoded-ors')
    expect(container.textContent).toContain('Verified road route')
    expect(container.textContent).toContain('Log in to save this route to your history.')
  })

  it('saves only after an authenticated rider clicks save and persists planner routeData verification metadata', async () => {
    authState.user = { id: 'public-1' }
    authState.status = 'authenticated'

    routeQueue.push(
      makeResponse({
        origin: 'Mercado',
        destination: 'Amandayehan Wharf',
        distanceKm: 5.4,
        durationMin: 12,
        fare: 24,
        fareBreakdown: {
          baseFare: 15,
          additionalKm: 2.4,
          additionalFare: 9,
          discount: 0,
        },
        method: 'ors',
        provider: 'ors',
        fallbackReason: null,
        polyline: 'encoded-save',
        inputMode: 'pin',
      }),
    )

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Mock place A')
      clickButton('Mock place B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(savedCalculationBodies).toHaveLength(0)

    await act(async () => {
      clickButton('Save to history')
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(savedCalculationBodies).toHaveLength(1)
    expect(savedCalculationBodies[0]).toMatchObject({
      fromLocation: 'Mercado',
      toLocation: 'Amandayehan Wharf',
      vehicleId: null,
      distance: 5.4,
      calculatedFare: 24,
      calculationType: 'Road Route Planner',
      routeData: {
        method: 'ors',
        providerUsed: 'ors',
        routeVerified: true,
        isEstimate: false,
        failureCode: null,
        fallbackReason: null,
        polylinePresent: true,
      },
    })
    expect(container.textContent).toContain('Saved to fare history.')
  })

  it('lets riders reset both pins after a route has been created', async () => {
    routeQueue.push(
      makeResponse({
        origin: 'Mercado',
        destination: 'Amandayehan Wharf',
        distanceKm: 5.4,
        durationMin: 12,
        fare: 24,
        fareBreakdown: {
          baseFare: 15,
          additionalKm: 2.4,
          additionalFare: 9,
          discount: 0,
        },
        method: 'ors',
        provider: 'ors',
        fallbackReason: null,
        polyline: 'encoded-reset',
        inputMode: 'pin',
      }),
    )

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Mock place A')
      clickButton('Mock place B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Reset pins')
    })

    expect(container.textContent).toContain('origin:none')
    expect(container.textContent).toContain('destination:none')
    expect(container.textContent).toContain('polyline:none')
  })

  it('prevents stale responses and duplicate recalculation for unchanged routes while preserving first-fit behavior', async () => {
    const first = deferredResponse()
    const second = deferredResponse()

    routeQueue.push(first.promise)
    routeQueue.push(second.promise)

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Mock place A')
      clickButton('Mock place B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Mock move B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(routeBodies).toHaveLength(2)

    await act(async () => {
      second.resolve(
        makeResponse({
          origin: 'Mercado',
          destination: 'Moved destination',
          distanceKm: 9.1,
          durationMin: 20,
          fare: 33,
          fareBreakdown: {
            baseFare: 15,
            additionalKm: 6.1,
            additionalFare: 18,
            discount: 0,
          },
          method: 'ors',
          fallbackReason: null,
          polyline: 'newer-polyline',
          inputMode: 'pin',
        }),
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain('PHP 33.00')
    expect(container.textContent).toContain('polyline:newer-polyline')
    expect(container.textContent).toContain('fit:1')

    await act(async () => {
      first.resolve(
        makeResponse({
          origin: 'Mercado',
          destination: 'Amandayehan Wharf',
          distanceKm: 5.4,
          durationMin: 12,
          fare: 24,
          fareBreakdown: {
            baseFare: 15,
            additionalKm: 2.4,
            additionalFare: 9,
            discount: 0,
          },
          method: 'ors',
          fallbackReason: null,
          polyline: 'stale-polyline',
          inputMode: 'pin',
        }),
      )
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('stale-polyline')

    await act(async () => {
      clickButton('Mock same B')
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(routeBodies).toHaveLength(2)
    expect(container.textContent).toContain('fit:1')
  })

  it('shows no-route and service-failure states truthfully while keeping the current selections editable', async () => {
    routeQueue.push(
      makeResponse({ error: 'No road route could be found between these points.', code: 'NO_ROAD_ROUTE_FOUND' }, 422),
    )
    routeQueue.push(
      makeResponse(
        { error: 'Routing service unavailable right now.', code: 'ROUTING_SERVICE_UNAVAILABLE' },
        503,
      ),
    )

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton('Mock place A')
      clickButton('Mock place B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(container.textContent).toContain('No road route could be found between these points.')
    expect(container.textContent).not.toContain('Try again')

    await act(async () => {
      clickButton('Mock move B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(container.textContent).toContain('Routing service unavailable right now.')
    expect(container.textContent).toContain('origin:Mercado')
    expect(container.textContent).toContain('destination:Moved destination')
    expect(container.textContent).toContain('Try again')
  })
})
