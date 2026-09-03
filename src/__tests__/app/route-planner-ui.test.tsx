vi.mock('@/components/PublicRideTagScanner', () => ({
  __esModule: true,
  default: ({ autoStart, onUseVehicle, onClearVehicle }: { autoStart?: boolean; onUseVehicle?: (vehicle: unknown) => void; onClearVehicle?: () => void }) =>
    React.createElement(
      'div',
      null,
      autoStart ? 'Mock scanner active' : 'Mock scanner idle',
      React.createElement(
        'button',
        {
          onClick: () =>
            onUseVehicle?.({
              id: 'vehicle-1',
              plateNumber: 'ABC-1234',
              permitPlateNumber: 'ABC-1234',
              vehicleType: 'TRICYCLE',
            }),
        },
        'Mock use vehicle',
      ),
      React.createElement(
        'button',
        { onClick: () => onClearVehicle?.() },
        'Mock clear vehicle',
      ),
    ),
}))
// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { SWRConfig } from 'swr'

import type { RoutePlannerMapProps } from '@/components/RoutePlannerMap'
import { swrFetcher } from '@/lib/swr'

const authState = vi.hoisted(() => ({
  user: null as { id: string; userType?: string } | null,
  status: 'unauthenticated' as 'authenticated' | 'unauthenticated',
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: authState.user, status: authState.status }),
}))

import RoutePlannerCalculator from '@/components/RoutePlannerCalculator'

/**
 * The map now lives behind a dialog, so it only renders once the rider asks for
 * it. Everything it echoes is still asserted the same way — the tests just have
 * to open it first, exactly as a rider does.
 */
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
    pointSource: 'barangay_hall',
    vehicleAccess: 'VEHICLE_ACCESSIBLE',
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
    pointSource: 'osm',
    vehicleAccess: 'VEHICLE_ACCESSIBLE',
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
    pointSource: 'barangay_hall',
    vehicleAccess: 'VEHICLE_ACCESSIBLE',
    barangay: 'Anglit',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'loc-4',
    // Hyphenated in the dataset, typed either way by riders.
    name: 'Balo-Og',
    type: 'BARANGAY',
    category: 'barangay',
    coordinates: { lat: 11.3054, lng: 125.0989 },
    address: 'Balo-Og, Basey, Samar',
    verified: true,
    source: 'database',
    pointSource: 'polygon_centroid',
    vehicleAccess: 'VEHICLE_ACCESSIBLE',
    barangay: 'Balo-Og',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
] as const

const ROUTE_OK = {
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
  inputMode: 'preset',
}

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
    window.localStorage.clear()
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
        return Promise.resolve(
          makeResponse({ success: true, calculation: null, tripRequestId: 'sr-1', requestStatus: 'PENDING' }),
        )
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

  function plannerElement() {
    return React.createElement(
      SWRConfig,
      {
        value: {
          fetcher: swrFetcher,
          // A fresh cache per render, so one test's places never leak into the next.
          provider: () => new Map(),
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          shouldRetryOnError: false,
          dedupingInterval: 0,
        },
      },
      React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }),
    )
  }

  async function flush() {
    await act(async () => {
      for (let i = 0; i < 8; i += 1) {
        await Promise.resolve()
      }
    })
  }

  /** Mounts and settles the locations fetch and the GPS prefill. */
  async function mountPlanner() {
    await act(async () => {
      root.render(plannerElement())
    })
    await flush()
  }

  function buttons(label: string) {
    return Array.from(container.querySelectorAll('button')).filter((button) =>
      button.textContent?.includes(label),
    )
  }

  function clickButton(label: string, index = 0) {
    const match = buttons(label)[index]
    if (!match) {
      throw new Error(`Button "${label}" not found`)
    }
    match.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  async function click(label: string, index = 0) {
    await act(async () => {
      clickButton(label, index)
    })
    await flush()
  }

  function searchInput(): HTMLInputElement {
    const input = container.querySelector('input[role="combobox"]')
    if (!input) throw new Error('No search field is focused')
    return input as HTMLInputElement
  }

  function typeQuery(value: string) {
    const input = searchInput()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  async function search(value: string) {
    await act(async () => {
      typeQuery(value)
    })
    await flush()
  }

  function pressKey(key: string) {
    searchInput().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }

  function optionLabels() {
    return Array.from(container.querySelectorAll('[role="option"]')).map((option) =>
      option.textContent?.trim(),
    )
  }

  /** Clicks a button by its accessible name rather than its text. */
  async function clickLabelled(label: string) {
    await act(async () => {
      const element = container.querySelector(`button[aria-label="${label}"]`)
      if (!element) throw new Error(`No button labelled "${label}"`)
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flush()
  }

  /** Runs the 300 ms quote debounce and settles the response. */
  async function settleQuote() {
    await act(async () => {
      vi.advanceTimersByTime(301)
    })
    await flush()
  }

  /** The whole happy path: pick a ride, then a drop-off by name. */
  async function quoteAmandayehan() {
    await click('Tricycle')
    await search('amandayehan')
    await click('Amandayehan Wharf')
    await settleQuote()
  }

  describe('the ride step', () => {
    it('opens on the ride choice with no map mounted', async () => {
      await mountPlanner()

      expect(container.textContent).toContain('How are you riding?')
      expect(container.textContent).toContain('Tricycle')
      expect(container.textContent).toContain('Habal-habal')
      // The whole point of the redesign: nothing map-shaped has loaded yet.
      expect(container.querySelector('[data-testid="mock-planner-map"]')).toBeNull()
      expect(routeBodies).toHaveLength(0)
    })

    it('offers only the two rides this system is deployed for', async () => {
      await mountPlanner()

      expect(container.textContent).not.toContain('Jeepney')
      expect(container.textContent).not.toContain('Multicab')
      expect(container.textContent).not.toContain('Van')
    })

    it('advances to the trip step and opens a search field', async () => {
      await mountPlanner()
      await click('Tricycle')

      expect(container.textContent).toContain('Your trip')
      expect(container.querySelectorAll('input[role="combobox"]')).toHaveLength(1)
    })

    it('keeps scan and manual identity options on one row and only shows the active pane', async () => {
      authState.user = { id: 'public-1' }
      authState.status = 'authenticated'

      await mountPlanner()

      expect(container.textContent).toContain('Scan operator QR')
      expect(container.textContent).toContain("Can't scan? Search manually")
      expect(container.textContent).not.toContain('Mock scanner active')
      expect(container.textContent).not.toContain('Search manually by plate number')

      await click('Scan operator QR')

      expect(container.textContent).not.toContain("Can't scan? Search manually")
      expect(container.textContent).toContain('Mock scanner active')

      await click('Choose another option')

      expect(container.textContent).toContain('Scan operator QR')
      expect(container.textContent).not.toContain('Mock scanner active')

      await click("Can't scan? Search manually")

      expect(container.textContent).not.toContain('Scan operator QR')
      expect(container.textContent).toContain('Search manually by plate number')
    })

    it('treats a scanned plate as the ride choice and moves on', async () => {
      authState.user = { id: 'public-1' }
      authState.status = 'authenticated'

      await mountPlanner()
      await click('Scan operator QR')
      await click('Mock use vehicle')

      expect(container.textContent).toContain('Your trip')
      expect(container.textContent).toContain('Tricycle')
    })
  })

  describe('the trip step', () => {
    it('lists the curated places nearest-first before anything is typed', async () => {
      await mountPlanner()
      await click('Tricycle')

      expect(container.textContent).toContain('Nearby')
      // Measured from the GPS pickup at 11.276, 125.07.
      expect(optionLabels()[0]).toContain('Mercado Terminal')
      expect(optionLabels().join(' ')).toContain('Balo-Og')
    })

    it('filters the list as the rider types', async () => {
      await mountPlanner()
      await click('Tricycle')
      await search('amandayehan')

      expect(optionLabels()).toHaveLength(1)
      expect(optionLabels()[0]).toContain('Amandayehan Wharf')
    })

    it('still finds a place when the hyphen is dropped', async () => {
      await mountPlanner()
      await click('Tricycle')
      // "Balo-Og" and "Baloog" are the same barangay to everyone but a string compare.
      await search('baloog')

      expect(optionLabels()[0]).toContain('Balo-Og')
    })

    it('shows the pickup the GPS prefill resolved', async () => {
      await mountPlanner()
      await click('Tricycle')

      // Outside every barangay polygon, so this fix names itself by coordinate.
      // Either way the point of the test is that the pickup arrives filled.
      expect(container.textContent).toContain('11.276000, 125.070000')
      // With a pickup to measure from, the browse list is ordered by distance.
      expect(container.textContent).toContain('Nearby')
    })
  })

  describe('quoting', () => {
    it('sends a named place as a preset and a GPS pickup as a pin', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await quoteAmandayehan()

      expect(routeBodies).toHaveLength(1)
      expect(routeBodies[0]).toMatchObject({
        origin: { type: 'pin', lat: 11.276, lng: 125.07 },
        destination: { type: 'preset', name: 'Amandayehan Wharf' },
        vehicleType: 'TRICYCLE',
      })
      expect(container.textContent).toContain('PHP 24.00')
      expect(container.textContent).toContain('Verified road route')
    })

    it('quotes without saving until the rider explicitly confirms', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await quoteAmandayehan()

      expect(savedCalculationBodies).toHaveLength(0)
      expect(container.textContent).toContain('Log in to send this trip request.')
    })

    it('selects the highlighted result from the keyboard', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await click('Tricycle')
      await search('amandayehan')

      await act(async () => {
        pressKey('ArrowDown')
      })
      await flush()

      await act(async () => {
        pressKey('Enter')
      })
      await flush()
      await settleQuote()

      expect(routeBodies).toHaveLength(1)
      expect(routeBodies[0]).toMatchObject({
        destination: { type: 'preset', name: 'Amandayehan Wharf' },
      })
    })

    it('re-quotes when the rider changes the ride', async () => {
      // The dedupe key used to be the pin pair alone, so this second request
      // was swallowed and the fare never moved.
      routeQueue.push(makeResponse(ROUTE_OK))
      routeQueue.push(makeResponse({ ...ROUTE_OK, fare: 30, distanceKm: 7.1 }))

      await mountPlanner()
      await quoteAmandayehan()

      expect(routeBodies).toHaveLength(1)

      await click('Change')
      await click('Habal-habal')
      await settleQuote()

      expect(routeBodies).toHaveLength(2)
      expect(routeBodies[1]).toMatchObject({ vehicleType: 'HABAL_HABAL' })
      expect(container.textContent).toContain('PHP 30.00')
    })

    it('sends trip request only after an authenticated rider selects a vehicle and confirms', async () => {
      authState.user = { id: 'public-1', userType: 'PUBLIC' }
      authState.status = 'authenticated'
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await quoteAmandayehan()

      expect(savedCalculationBodies).toHaveLength(0)

      await click('Scan operator QR')
      await click('Mock use vehicle')
      await click('Send trip request')

      expect(savedCalculationBodies).toHaveLength(1)
      expect(savedCalculationBodies[0]).toMatchObject({
        fromLocation: 'Mercado',
        toLocation: 'Amandayehan Wharf',
        vehicleId: 'vehicle-1',
        distance: 5.4,
        calculatedFare: 24,
        calculationType: 'Road Route Planner',
        farePolicySnapshot: {
          baseDistanceKm: DEFAULT_FARE_POLICY.baseDistanceKm,
          baseFare: DEFAULT_FARE_POLICY.baseFare,
          perKmRate: DEFAULT_FARE_POLICY.perKmRate,
        },
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
      expect(container.textContent).toContain('Trip request sent to driver.')
    })

    it('explains a result that needs explaining, now that the map is not always open', async () => {
      // This copy used to live on the map overlay. With the map behind a
      // dialog it has to say itself on the fare view or it says nothing.
      routeQueue.push(
        makeResponse({
          ...ROUTE_OK,
          distanceKm: 0,
          fare: 15,
          method: null,
          provider: null,
          polyline: null,
          fareBreakdown: { baseFare: 15, additionalKm: 0, additionalFare: 0, discount: 0 },
        }),
      )

      await mountPlanner()
      await quoteAmandayehan()

      expect(container.textContent).toContain(
        'Origin and destination are the same point, so no road segment is needed.',
      )
    })

    it('clears both ends and returns to the trip step', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await quoteAmandayehan()
      // Reset lives only in the header now. There used to be a second
      // "Clear trip" button inside the result card calling the same handler.
      await click('Clear')

      expect(container.textContent).toContain('Your trip')
      expect(container.textContent).not.toContain('PHP 24.00')
    })

    it('ignores a stale response and does not re-quote an unchanged trip', async () => {
      const first = deferredResponse()
      const second = deferredResponse()
      routeQueue.push(first.promise)
      routeQueue.push(second.promise)

      await mountPlanner()
      await click('Tricycle')
      await search('amandayehan')
      await click('Amandayehan Wharf')
      await settleQuote()

      // Change the drop-off while the first request is still outstanding.
      await clickLabelled('Change the trip')
      await search('anglit')
      await click('Anglit Barangay Hall')
      await settleQuote()

      expect(routeBodies).toHaveLength(2)

      await act(async () => {
        second.resolve(
          makeResponse({
            ...ROUTE_OK,
            destination: 'Anglit Barangay Hall',
            fare: 33,
            distanceKm: 9.1,
            polyline: 'newer-polyline',
          }),
        )
      })
      await flush()

      expect(container.textContent).toContain('PHP 33.00')

      await act(async () => {
        first.resolve(makeResponse({ ...ROUTE_OK, fare: 24, polyline: 'stale-polyline' }))
      })
      await flush()

      expect(container.textContent).toContain('PHP 33.00')
      expect(container.textContent).not.toContain('PHP 24.00')
    })
  })

  describe('recent places', () => {
    it('offers back only the places that produced a fare', async () => {
      authState.user = { id: 'public-1', userType: 'PUBLIC' }
      authState.status = 'authenticated'
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await quoteAmandayehan()
      await clickLabelled('Go back')

      expect(container.textContent).toContain('Recent')
      expect(optionLabels().join(' ')).toContain('Amandayehan Wharf')
    })

    it('keeps one rider’s places out of the next rider’s list', async () => {
      authState.user = { id: 'public-1', userType: 'PUBLIC' }
      authState.status = 'authenticated'
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await quoteAmandayehan()

      expect(window.localStorage.getItem('basey:recentPlaces:v1:public-1')).toContain(
        'Amandayehan Wharf',
      )
      expect(window.localStorage.getItem('basey:recentPlaces:v1:public-2')).toBeNull()
    })
  })

  describe('the map', () => {
    it('mounts only once the rider opens it, and closes when a point is set', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))

      await mountPlanner()
      await click('Tricycle')

      expect(container.querySelector('[data-testid="mock-planner-map"]')).toBeNull()

      await click('Pick on the map')

      expect(container.querySelector('[data-testid="mock-planner-map"]')).not.toBeNull()
      // The map opens already carrying the pickup the GPS prefill found.
      expect(container.textContent).not.toContain('origin:none')

      await click('Mock place B')

      expect(container.querySelector('[data-testid="mock-planner-map"]')).toBeNull()

      await settleQuote()

      expect(routeBodies[0]).toMatchObject({
        destination: { type: 'pin', lat: 11.2854, lng: 125.0789 },
      })
    })

    it('stays open when a pin is moved in the route preview', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))
      await mountPlanner()
      await quoteAmandayehan()

      routeQueue.push(makeResponse(ROUTE_OK))
      await click('View the route on the map')

      expect(container.querySelector('[data-testid="mock-planner-map"]')).not.toBeNull()

      // The map's own helper text invites the rider to drag A or B. Closing the
      // map they came to look at would be the opposite of refining the route.
      await click('Mock place B')

      expect(container.querySelector('[data-testid="mock-planner-map"]')).not.toBeNull()

      await settleQuote()

      expect(container.querySelector('[data-testid="mock-planner-map"]')).not.toBeNull()
    })

    it('does not draw the previous route against a pin that has since moved', async () => {
      routeQueue.push(makeResponse(ROUTE_OK))
      await mountPlanner()
      await quoteAmandayehan()

      routeQueue.push(makeResponse(ROUTE_OK))
      await click('View the route on the map')

      expect(container.textContent).not.toContain('polyline:none')

      await click('Mock place B')

      // The quote for the moved pin has not landed yet, so there is no route to
      // show — the old one belongs to the old pair.
      expect(container.textContent).toContain('polyline:none')
    })
  })

  describe('failures', () => {
    it('explains a missing road route and offers a way to change the trip', async () => {
      routeQueue.push(
        makeResponse(
          { message: 'No road route could be found between these points.', code: 'NO_ROAD_ROUTE_FOUND' },
          422,
        ),
      )

      await mountPlanner()
      await quoteAmandayehan()

      expect(container.textContent).toContain('No road route could be found between these points.')
      // The panel names the control instead of duplicating it: the trip summary
      // that changes the locations is already on screen above the error.
      expect(container.textContent).toContain('Tap the trip summary above to change your locations.')
      expect(container.querySelector('[aria-label="Change the trip"]')).not.toBeNull()
      expect(container.textContent).not.toContain('Try again')
    })

    it('offers a retry when the routing service is down', async () => {
      routeQueue.push(
        makeResponse(
          { message: 'Routing service unavailable right now.', code: 'ROUTING_SERVICE_UNAVAILABLE' },
          503,
        ),
      )

      await mountPlanner()
      await quoteAmandayehan()

      expect(container.textContent).toContain('Routing service unavailable right now.')
      expect(container.textContent).toContain('Try again')
    })

    it('sends the rider back to the ride choice when no route suits this vehicle', async () => {
      // Classified before this change, then rendered nowhere — the rider saw a
      // blank result with no explanation and no way forward.
      routeQueue.push(
        makeResponse(
          { message: 'No route a tricycle can take.', code: 'NO_ROUTE_FOR_VEHICLE' },
          422,
        ),
      )

      await mountPlanner()
      await quoteAmandayehan()

      expect(container.textContent).toContain('No route a tricycle can take.')
      expect(container.textContent).toContain('Tap Change on the Ride card to pick another ride.')

      // the Ride card's own Change, rather than a second button in the panel
      await click('Change')

      expect(container.textContent).toContain('How are you riding?')
    })
  })

  describe('the GPS prefill', () => {
    function stubGeolocation(
      handler: (success: PositionCallback, failure?: PositionErrorCallback) => void,
    ) {
      Object.defineProperty(window.navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: vi.fn(handler) },
      })
    }

    function coords(latitude: number, longitude: number, accuracy: number): GeolocationPosition {
      return {
        coords: {
          latitude,
          longitude,
          accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition
    }

    it('resolves during the ride step and labels the pickup with its barangay', async () => {
      // Inside the Sulod polygon, so the pin gets a name rather than a coordinate.
      stubGeolocation((success) => success(coords(11.28185, 125.06835, 12)))

      await mountPlanner()
      await click('Tricycle')

      expect(container.textContent).toContain('SULOD')
      // One pickup quotes nothing.
      expect(routeBodies).toHaveLength(0)
    })

    it('leaves the planner usable when the rider refuses location, and offers a retry', async () => {
      let attempt = 0
      stubGeolocation((success, failure) => {
        attempt += 1
        if (attempt === 1) {
          failure?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError)
          return
        }
        success(coords(11.28185, 125.06835, 12))
      })

      await mountPlanner()
      await click('Tricycle')

      expect(container.textContent).toContain('Location permission is off.')
      // The empty pickup is the focused field, so its prompt is the placeholder.
      expect(searchInput().placeholder).toBe('Enter pickup location')

      await click('Use my location')

      // The pickup row still holds focus, so its resolved name is the placeholder.
      expect(searchInput().placeholder).toContain('SULOD')
      expect(container.textContent).not.toContain('Location permission is off.')
    })

    it('says so plainly when the rider is outside Basey rather than letting the server 400', async () => {
      stubGeolocation((success) => success(coords(52.52, 13.405, 10)))

      await mountPlanner()
      await click('Tricycle')

      expect(container.textContent).toContain("You're outside Basey")
      expect(routeBodies).toHaveLength(0)
    })

    it('refuses a fix too coarse to price a fare from', async () => {
      stubGeolocation((success) => success(coords(11.28185, 125.06835, 300)))

      await mountPlanner()
      await click('Tricycle')

      expect(container.textContent).toContain('Your GPS signal is too weak')
    })
  })
})
