// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import path from 'node:path'
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import type { RoutePlannerMapProps } from '@/components/RoutePlannerMap'

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: null }),
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

  beforeEach(() => {
    vi.useFakeTimers()
    // Tell React this test environment supports act().
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    routeQueue = []
    routeBodies = []

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

      if (url.includes('/api/fare-calculations')) {
        return Promise.resolve(makeResponse({ success: true }))
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

  it('removes the old planner mode split and separate preview panel from the live component source', () => {
    const planner = readFileSync(repoPath('src', 'components', 'RoutePlannerCalculator.tsx'), 'utf8')

    expect(planner).not.toContain('Quick Quote')
    expect(planner).not.toContain('Exact Quote (Map Pin)')
    expect(planner).not.toContain('Planned Route Preview')
    expect(planner).not.toContain('Route Planned Successfully!')
    expect(planner).not.toContain('Search place for')
  })

  it('auto-calculates after placing two pins and renders the route on the same map surface', async () => {
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
        fallbackReason: null,
        polyline: 'encoded-ors',
      }),
    )

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
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
    expect(container.textContent).toContain('PHP 24.00')
    expect(container.textContent).toContain('polyline:encoded-ors')
    expect(container.textContent).toContain('Road-aware route')
  })

  it('removes the text-search controls while keeping current-location and route editing controls', async () => {
    routeQueue.push(
      makeResponse({
        origin: 'Current location',
        destination: 'Amandayehan Wharf',
        distanceKm: 3.4,
        durationMin: 9,
        fare: 18,
        fareBreakdown: {
          baseFare: 15,
          additionalKm: 1.4,
          additionalFare: 3,
          discount: 0,
        },
        method: 'ors',
        fallbackReason: null,
        polyline: 'encoded-swap',
      }),
    )
    routeQueue.push(
      makeResponse({
        origin: 'Amandayehan Wharf',
        destination: 'Current location',
        distanceKm: 3.4,
        durationMin: 9,
        fare: 18,
        fareBreakdown: {
          baseFare: 15,
          additionalKm: 1.4,
          additionalFare: 3,
          discount: 0,
        },
        method: 'ors',
        fallbackReason: null,
        polyline: 'encoded-swapped-back',
      }),
    )

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
      await Promise.resolve()
    })

    expect(container.querySelector('datalist')).toBeNull()
    expect(container.querySelector('input[list="planner-location-options"]')).toBeNull()
    expect(container.textContent).not.toContain('Search place for A')
    expect(container.textContent).not.toContain('Search place for B')
    expect(container.textContent).not.toContain('search a place')
    expect(container.textContent).not.toContain('Search for a saved place')
    expect(
      Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Set'),
    ).toBe(false)

    await act(async () => {
      clickButton('Mock place B')
      clickButton('Use current location for A')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(container.textContent).toContain('origin:Current location')
    expect(container.textContent).toContain('destination:Amandayehan Wharf')

    await act(async () => {
      clickButton('Swap A / B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(container.textContent).toContain('origin:Amandayehan Wharf')
    expect(container.textContent).toContain('destination:Current location')

    await act(async () => {
      clickButton('Clear A')
    })
    expect(container.textContent).toContain('origin:none')

    await act(async () => {
      clickButton('Reset route')
    })
    expect(container.textContent).toContain('destination:none')
  })

  it('prevents stale responses and duplicate recalculation for unchanged pins while preserving first-fit behavior', async () => {
    const first = deferredResponse()
    const second = deferredResponse()

    routeQueue.push(first.promise)
    routeQueue.push(second.promise)

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
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

  it('shows fallback and route failure states truthfully while keeping pins editable', async () => {
    routeQueue.push(
      makeResponse({
        origin: 'Mercado',
        destination: 'Amandayehan Wharf',
        distanceKm: 7.8,
        durationMin: 18,
        fare: 30,
        fareBreakdown: {
          baseFare: 15,
          additionalKm: 4.8,
          additionalFare: 15,
          discount: 0,
        },
        method: 'gps',
        fallbackReason: 'ORS unavailable',
        polyline: null,
      }),
    )
    routeQueue.push(makeResponse({ error: 'Destination pin is too far from any road' }, 400))

    await act(async () => {
      root.render(React.createElement(RoutePlannerCalculator, { MapComponent: MockPlannerMap }))
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

    expect(container.textContent).toContain('GPS estimate')
    expect(container.textContent).toContain('lower-confidence GPS estimate')

    await act(async () => {
      clickButton('Mock move B')
    })

    await act(async () => {
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
    })

    expect(container.textContent).toContain('No route could be calculated from the current pins.')
    expect(container.textContent).toContain('origin:Mercado')
    expect(container.textContent).toContain('destination:Moved destination')
    expect(container.textContent).toContain('Try again')
  })
})
