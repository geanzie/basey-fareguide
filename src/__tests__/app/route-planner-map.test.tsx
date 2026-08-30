// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import RoutePlannerMap from '@/components/RoutePlannerMap'

const leafletMap = {
  on: vi.fn(),
  setView: vi.fn(),
  remove: vi.fn(),
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
}

function createLayerStub() {
  const layer = {
    addTo: vi.fn(() => layer),
    on: vi.fn(),
    setLatLng: vi.fn(),
    bindPopup: vi.fn(),
    getLatLng: vi.fn(() => ({ lat: 0, lng: 0 })),
    remove: vi.fn(),
  }
  return layer
}

vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(() => leafletMap),
    marker: vi.fn(() => createLayerStub()),
    polyline: vi.fn(() => createLayerStub()),
    divIcon: vi.fn(() => ({})),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
  },
}))

vi.mock('@/lib/map/baseTileLayer', () => ({
  addBaseTileLayer: vi.fn(),
}))

describe('RoutePlannerMap', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    leafletMap.fitBounds.mockClear()
    leafletMap.invalidateSize.mockClear()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  const baseProps = {
    origin: { lat: 11.2754, lng: 125.0689, label: 'Mercado' },
    destination: { lat: 11.2854, lng: 125.0789, label: 'Wharf' },
    polyline: 'y}xzAms|hVkAaB',
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

  it('re-reads the container size before refitting the route', async () => {
    // Mount with no route: the Leaflet map is created asynchronously, so the
    // route layer only lands once the polyline arrives on a later render.
    await act(async () => {
      root.render(
        React.createElement(RoutePlannerMap, {
          ...baseProps,
          polyline: null,
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

    expect(leafletMap.invalidateSize).toHaveBeenCalled()
    expect(leafletMap.fitBounds).toHaveBeenCalled()
  })
})
