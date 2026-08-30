'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

import { addBaseTileLayer } from '@/lib/map/baseTileLayer'
import { resolvePinLabel } from '@/lib/locations/pinLabelResolver'
import { decodePolyline } from '@/lib/routeUtils'
import type { PlannerPoint, PlannerViewState } from '@/lib/planner/routePlanner'

/**
 * One shared import for the whole page. Leaflet is client-only, so it cannot be
 * imported at the top of a server-rendered module — but every mount firing its
 * own `import()` means concurrent loads of the same module (React StrictMode
 * remounts this effect immediately), so the promise is memoised.
 */
const importLeaflet = () => import('leaflet')

let leafletModulePromise: ReturnType<typeof importLeaflet> | null = null

function loadLeaflet() {
  leafletModulePromise ??= importLeaflet()
  return leafletModulePromise
}

const BASEY_CENTER: [number, number] = [11.2754, 125.0689]
const DEFAULT_ZOOM = 13

function createResolvedPlannerPoint(lat: number, lng: number): PlannerPoint {
  return {
    lat,
    lng,
    label: resolvePinLabel(lat, lng).displayLabel,
  }
}

export interface RoutePlannerMapProps {
  origin: PlannerPoint | null
  destination: PlannerPoint | null
  polyline?: string | null
  isCalculating?: boolean
  fitBoundsToken?: number
  plannerState: PlannerViewState
  plannerMessage?: string | null
  className?: string
  onOriginChange: (point: PlannerPoint) => void
  onDestinationChange: (point: PlannerPoint) => void
}

export default function RoutePlannerMap({
  origin,
  destination,
  polyline,
  isCalculating = false,
  fitBoundsToken = 0,
  plannerState,
  plannerMessage,
  className = 'h-[420px] w-full rounded-2xl border border-gray-200',
  onOriginChange,
  onDestinationChange,
}: RoutePlannerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Leaflet is loaded once, here, and reused by every effect below. Importing
  // it per effect means several concurrent dynamic imports for the same module.
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const originMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const destinationMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const routeLayerRef = useRef<import('leaflet').Polyline | null>(null)
  const fitCoordinatesRef = useRef<[number, number][]>([])
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const latestOriginRef = useRef(origin)
  const latestDestinationRef = useRef(destination)
  const onOriginChangeRef = useRef(onOriginChange)
  const onDestinationChangeRef = useRef(onDestinationChange)
  const lastFitTokenRef = useRef(fitBoundsToken)
  const hasAutoFittedRef = useRef(false)
  // Leaflet is imported and instantiated asynchronously, so the effects that
  // draw onto the map have to wait for it. Without this flag they run once
  // against a null map, bail, and — since their props never change again when
  // the map is opened on an already-computed route — never run a second time.
  const [mapReady, setMapReady] = useState(false)

  latestOriginRef.current = origin
  latestDestinationRef.current = destination
  onOriginChangeRef.current = onOriginChange
  onDestinationChangeRef.current = onDestinationChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    const initializeMap = async () => {
      const L = (await loadLeaflet()).default
      if (cancelled || !containerRef.current) return

      leafletRef.current = L

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      })

      const map = L.map(containerRef.current, { zoomControl: true })
      mapRef.current = map

      // Fire-and-forget: the basemap module is imported lazily, and nothing
      // below depends on the layer existing. `cancelled` covers the case where
      // the effect is torn down (and the map destroyed) mid-import.
      void addBaseTileLayer(map)
        .then((layer) => {
          if (cancelled) {
            map.removeLayer(layer)
          }
        })
        .catch((error) => {
          console.error('Basemap failed to load', error)
        })

      map.setView(BASEY_CENTER, DEFAULT_ZOOM)

      setMapReady(true)

      // The map lives in a full-screen modal: browser resizes, rotation and the
      // mobile URL bar all change the container after Leaflet has cached its
      // size. Without this the tiles leave grey bands.
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          map.invalidateSize()
        })
        observer.observe(containerRef.current)
        resizeObserverRef.current = observer
      }

      map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        const point = createResolvedPlannerPoint(event.latlng.lat, event.latlng.lng)

        if (!latestOriginRef.current) {
          onOriginChangeRef.current(point)
          return
        }

        if (!latestDestinationRef.current) {
          onDestinationChangeRef.current(point)
        }
      })
    }

    initializeMap()

    return () => {
      cancelled = true

      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      // Everything below belonged to the map that was just destroyed. This
      // effect can be torn down and set up again on the same component instance
      // (StrictMode, Fast Refresh, a re-mounted subtree), and refs survive that
      // — left populated, the draw effects would mistake layers of the discarded
      // map for live ones and never redraw onto the new one.
      originMarkerRef.current = null
      destinationMarkerRef.current = null
      routeLayerRef.current = null
      fitCoordinatesRef.current = []
      leafletRef.current = null
      hasAutoFittedRef.current = false
      setMapReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!mapReady || !map || !L) return

    const updateMarkers = () => {
      const createIcon = (letter: 'A' | 'B', background: string) =>
        L.divIcon({
          html: `<div style="background:${background};width:30px;height:30px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${letter}</div>`,
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        })

      if (origin) {
        let marker = originMarkerRef.current

        if (!marker) {
          marker = L.marker([origin.lat, origin.lng], {
            icon: createIcon('A', '#16a34a'),
            draggable: true,
          }).addTo(map)

          marker.on('dragend', () => {
            const latLng = originMarkerRef.current?.getLatLng()
            if (!latLng) return
            onOriginChangeRef.current(createResolvedPlannerPoint(latLng.lat, latLng.lng))
          })

          originMarkerRef.current = marker
        }

        marker.setLatLng([origin.lat, origin.lng])
        marker.bindPopup(`<strong>Pickup (A)</strong><br/>${origin.label ?? 'Pickup pin'}`)
      } else if (originMarkerRef.current) {
        originMarkerRef.current.remove()
        originMarkerRef.current = null
      }

      if (destination) {
        let marker = destinationMarkerRef.current

        if (!marker) {
          marker = L.marker([destination.lat, destination.lng], {
            icon: createIcon('B', '#dc2626'),
            draggable: true,
          }).addTo(map)

          marker.on('dragend', () => {
            const latLng = destinationMarkerRef.current?.getLatLng()
            if (!latLng) return
            onDestinationChangeRef.current(createResolvedPlannerPoint(latLng.lat, latLng.lng))
          })

          destinationMarkerRef.current = marker
        }

        marker.setLatLng([destination.lat, destination.lng])
        marker.bindPopup(
          `<strong>Destination (B)</strong><br/>${destination.label ?? 'Drop-off pin'}`,
        )
      } else if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove()
        destinationMarkerRef.current = null
      }
    }

    updateMarkers()
  }, [mapReady, origin, destination])

  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!mapReady || !map || !L) return

    const updateRouteLayer = () => {

      if (routeLayerRef.current) {
        routeLayerRef.current.remove()
        routeLayerRef.current = null
      }

      const fitCoordinates: [number, number][] = []

      if (polyline) {
        const decoded = decodePolyline(polyline)
        if (decoded.length > 0) {
          routeLayerRef.current = L.polyline(decoded, {
            color: '#2563eb',
            weight: 5,
            opacity: 0.9,
          }).addTo(map)
          fitCoordinates.push(...decoded)
        }
      } else if (origin && destination) {
        // No road polyline (offline estimate / GPS) — draw a dashed straight
        // line so the estimated connection is visible.
        routeLayerRef.current = L.polyline(
          [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ],
          { color: '#f59e0b', weight: 4, opacity: 0.85, dashArray: '8 8' },
        ).addTo(map)
      }

      if (origin) {
        fitCoordinates.push([origin.lat, origin.lng])
      }

      if (destination) {
        fitCoordinates.push([destination.lat, destination.lng])
      }

      fitCoordinatesRef.current = fitCoordinates

      // Frame the route the first time there is one. The map usually mounts
      // into a modal opened on an already-computed route, so there is no later
      // prop change to trigger a fit.
      if (!hasAutoFittedRef.current && fitCoordinates.length > 0) {
        hasAutoFittedRef.current = true
        map.invalidateSize()
        map.fitBounds(fitCoordinates, { padding: [48, 48], maxZoom: 15 })
      }
    }

    updateRouteLayer()
  }, [mapReady, polyline, origin, destination])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    if (fitBoundsToken === lastFitTokenRef.current) return
    lastFitTokenRef.current = fitBoundsToken

    // The map mounts inside a modal that may still be sizing itself, so make
    // Leaflet re-read the container before it computes a fit.
    mapRef.current.invalidateSize()

    const fitCoordinates = fitCoordinatesRef.current
    if (fitCoordinates.length === 0) return

    mapRef.current.fitBounds(fitCoordinates, {
      padding: [48, 48],
      maxZoom: 15,
    })
  }, [fitBoundsToken, mapReady])

  const helperText =
    plannerState === 'calculating'
      ? 'Calculating route...'
      : !origin && !destination
        ? 'Tap map to drop origin pin.'
        : origin && !destination
          ? 'Tap again to drop destination pin.'
          : 'Drag A or B to refine your route.'

  const toneClasses =
    plannerState === 'network_error' || plannerState === 'out_of_service_area'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full" style={{ zIndex: 0 }} />

      <div className="pointer-events-none absolute bottom-3 left-3 z-[350] max-w-[calc(100%-1.5rem)] sm:max-w-sm">
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-lg backdrop-blur-md sm:text-sm ${toneClasses}`}>
          <div className="font-medium">{helperText}</div>
          {plannerMessage ? <p className="mt-1 text-xs opacity-90">{plannerMessage}</p> : null}
        </div>
      </div>

      {isCalculating && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/15 backdrop-blur-[1px]">
          <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg">
            Recalculating route...
          </div>
        </div>
      )}
    </div>
  )
}
