// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import RoutePlannerMap from '@/components/RoutePlannerMap'

const mocks = vi.hoisted(() => {
  const mapInstances: Array<Record<string, ReturnType<typeof vi.fn>>> = []
  const resizeCallbacks: Array<() => void> = []

  const createLayerStub = () => {
    const layer = {
      addedTo: null as unknown,
      addTo(map: unknown) {
        layer.addedTo = map
        return layer
      },
      on: () => {},
      setLatLng: () => {},
      bindPopup: () => {},
      getLatLng: () => ({ lat: 0, lng: 0 }),
      remove: () => {},
    }
    return layer
  }

  const createMap = () => {
    const map = {
      on: vi.fn(),
      setView: vi.fn(),
      remove: vi.fn(),
      fitBounds: vi.fn(),
      invalidateSize: vi.fn(),
    }
    mapInstances.push(map)
    return map
  }

  return {
    mapInstances,
    resizeCallbacks,
    createMap,
    polylineFactory: vi.fn(() => createLayerStub()),
    markerFactory: vi.fn(() => createLayerStub()),
  }
})

const { mapInstances, resizeCallbacks, polylineFactory, markerFactory } = mocks

/** The map the component is currently drawing onto. */
function latestMap() {
  return mapInstances[mapInstances.length - 1]
}

vi.mock('leaflet', () => ({
  default: {
    map: () => mocks.createMap(),
    marker: (...args: unknown[]) => mocks.markerFactory(...(args as [])),
    polyline: (...args: unknown[]) => mocks.polylineFactory(...(args as [])),
    divIcon: () => ({}),
    Icon: { Default: { prototype: {}, mergeOptions: () => {} } },
  },
}))

vi.mock('@/lib/map/baseTileLayer', () => ({
  // Async now: the real one lazily imports the browser-only PMTiles renderer.
  addBaseTileLayer: vi.fn(() => Promise.resolve({})),
}))

describe('RoutePlannerMap', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    // Warm the module registry: the map's effects fire concurrent dynamic
    // `import('leaflet')` calls, and racing them past the mocker can hand one
    // of them the real module.
    await import('leaflet')

    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mapInstances.length = 0
    resizeCallbacks.length = 0
    polylineFactory.mockClear()
    markerFactory.mockClear()

    // jsdom has no ResizeObserver; the map only observes when one exists.
    class TestResizeObserver {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
  })

  afterEach(async () => {
    // Let the map's async draw effects settle before teardown; otherwise a
    // pending `import('leaflet')` resolves after the module mocks are gone.
    await act(async () => {})
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  const baseProps = {
    origin: { lat: 11.2754, lng: 125.0689, label: 'Mercado' },
    destination: { lat: 11.2854, lng: 125.0789, label: 'Wharf' },
    polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    plannerState: 'route_ready' as const,
    onOriginChange: vi.fn(),
    onDestinationChange: vi.fn(),
  }

  it('sizes the positioning wrapper, not just the inner Leaflet container', async () => {
    // The map lives in a full-screen modal that passes `h-full w-full`. If that
    // sizing lands on the inner container while the wrapper stays auto-height,
    // `height: 100%` resolves against an indefinite parent and the map collapses
    // to zero pixels — a blank modal.
    await act(async () => {
      root.render(React.createElement(RoutePlannerMap, { ...baseProps, className: 'h-full w-full' }))
    })

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('relative')
    expect(wrapper.className).toContain('h-full')
    expect(wrapper.className).toContain('w-full')

    const mapContainer = wrapper.firstElementChild as HTMLElement
    expect(mapContainer.className.split(/\s+/)).toEqual(expect.arrayContaining(['h-full', 'w-full']))
  })

  it('draws the route it is mounted with, without waiting for a prop change', async () => {
    // The planner modal mounts this map on an already-computed route, so every
    // prop is final at mount. Leaflet itself is created asynchronously, so the
    // drawing effects must re-run once the map exists or nothing is ever drawn.
    await act(async () => {
      root.render(React.createElement(RoutePlannerMap, { ...baseProps, className: 'h-full w-full' }))
    })

    // One more tick: the map is created in an async effect, and the draw
    // effects it unblocks await their own dynamic `import('leaflet')`.
    // One more tick: the map itself is created in an async effect, and the
    // effects that draw onto it only run once that resolves.
    await act(async () => {})

    expect(polylineFactory).toHaveBeenCalledTimes(1)
    expect(markerFactory).toHaveBeenCalledTimes(2)
    expect(latestMap().fitBounds).toHaveBeenCalled()
  })

  it('survives the StrictMode double-mount with one live, fully drawn map', async () => {
    // StrictMode runs the init effect, tears it down and runs it again on the
    // same component instance. The first pass is cancelled mid-import, so the
    // teardown has to leave nothing behind — a stale marker or route ref would
    // make the draw effects treat a layer of the discarded map as live and skip
    // the work they still owe the real one.
    await act(async () => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(RoutePlannerMap, { ...baseProps, className: 'h-full w-full' }),
        ),
      )
    })

    await act(async () => {})

    expect(mapInstances).toHaveLength(1)

    const live = latestMap()
    expect(live.remove).not.toHaveBeenCalled()

    const drawnOnLiveMap = [
      ...polylineFactory.mock.results.map((result) => result.value),
      ...markerFactory.mock.results.map((result) => result.value),
    ].filter((layer) => layer.addedTo === live)

    // The route line and both pins, all on the map that is actually mounted.
    expect(drawnOnLiveMap).toHaveLength(3)
    expect(live.fitBounds).toHaveBeenCalled()
  })

  it('re-reads its size when the container is resized', async () => {
    // The map fills a modal, so rotation and browser resizes change the
    // container after Leaflet has cached its dimensions.
    await act(async () => {
      root.render(React.createElement(RoutePlannerMap, { ...baseProps, className: 'h-full w-full' }))
    })

    await act(async () => {})

    const map = latestMap()
    map.invalidateSize.mockClear()

    expect(resizeCallbacks).toHaveLength(1)

    await act(async () => {
      resizeCallbacks[0]()
    })

    expect(map.invalidateSize).toHaveBeenCalled()
  })

  it('re-reads the container size before refitting the route', async () => {
    // Mount with no route: the Leaflet map is created asynchronously, so the
    // route layer only lands once the polyline arrives on a later render.
    await act(async () => {
      root.render(
        React.createElement(RoutePlannerMap, {
          ...baseProps,
          polyline: '_p~iF~ps|U_ulLnnqC',
          className: 'h-full w-full',
          fitBoundsToken: 0,
        }),
      )
    })

    await act(async () => {
      root.render(
        React.createElement(RoutePlannerMap, { ...baseProps, className: 'h-full w-full', fitBoundsToken: 0 }),
      )
    })

    await act(async () => {
      root.render(
        React.createElement(RoutePlannerMap, { ...baseProps, className: 'h-full w-full', fitBoundsToken: 1 }),
      )
    })

    expect(latestMap().invalidateSize).toHaveBeenCalled()
    expect(latestMap().fitBounds).toHaveBeenCalled()
  })
})
