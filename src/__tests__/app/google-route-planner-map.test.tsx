// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'

import GoogleRoutePlannerMap from '@/components/GoogleRoutePlannerMap'

const fakeMap = {
  fitBounds: vi.fn(),
}

const polylineInstances: Array<{ setMap: ReturnType<typeof vi.fn> }> = []

const PolylineConstructor = vi.fn(function PolylineMock() {
  const instance = { setMap: vi.fn() }
  polylineInstances.push(instance)
  return instance
})

const googleMapsMock = {
  SymbolPath: { CIRCLE: 2 as google.maps.SymbolPath.CIRCLE },
  LatLngBounds: class {
    static readonly MAX_BOUNDS = {} as google.maps.LatLngBounds

    extend() {}
  } as unknown as typeof google.maps.LatLngBounds,
  Polyline: PolylineConstructor as unknown as typeof google.maps.Polyline,
}

vi.mock('@react-google-maps/api', async () => {
  const ReactModule = await import('react')

  return {
    GoogleMap: ({ children, onLoad, onUnmount }: React.PropsWithChildren<{
      onLoad?: (map: unknown) => void
      onUnmount?: () => void
    }>) => {
      ReactModule.useEffect(() => {
        onLoad?.(fakeMap)

        return () => {
          onUnmount?.()
        }
      }, [onLoad, onUnmount])

      return ReactModule.createElement('div', { 'data-testid': 'google-map' }, children)
    },
    Marker: () => null,
    useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
  }
})

describe('GoogleRoutePlannerMap', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-browser-key')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    polylineInstances.length = 0

    ;(globalThis as typeof globalThis & { google?: typeof google }).google = {
      maps: googleMapsMock as unknown as typeof google.maps,
    }
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })

  it('clears the Google route overlay when the planner polyline is reset', async () => {
    await act(async () => {
      root.render(
        React.createElement(GoogleRoutePlannerMap, {
          origin: { lat: 11.2754, lng: 125.0689, label: 'Mercado' },
          destination: { lat: 11.2854, lng: 125.0789, label: 'Wharf' },
          polyline: 'encoded-polyline',
          plannerState: 'route_ready',
          onOriginChange: vi.fn(),
          onDestinationChange: vi.fn(),
        }),
      )
    })

    expect(polylineInstances).toHaveLength(1)
    expect(polylineInstances[0].setMap).not.toHaveBeenCalled()

    await act(async () => {
      root.render(
        React.createElement(GoogleRoutePlannerMap, {
          origin: null,
          destination: null,
          polyline: null,
          plannerState: 'placing_points',
          onOriginChange: vi.fn(),
          onDestinationChange: vi.fn(),
        }),
      )
    })

    expect(polylineInstances[0].setMap).toHaveBeenCalledWith(null)
    expect(polylineInstances).toHaveLength(1)
  })
})