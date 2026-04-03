'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

import type { PlannerPoint, PlannerViewState } from '@/lib/planner/routePlanner'

function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let byte: number
    let shift = 0
    let result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coordinates.push([lat / 1e5, lng / 1e5])
  }

  return coordinates
}

const BASEY_CENTER: [number, number] = [11.2754, 125.0689]
const DEFAULT_ZOOM = 13

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
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const originMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const destinationMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const routeLayerRef = useRef<import('leaflet').Polyline | null>(null)
  const fitCoordinatesRef = useRef<[number, number][]>([])
  const latestOriginRef = useRef(origin)
  const latestDestinationRef = useRef(destination)
  const onOriginChangeRef = useRef(onOriginChange)
  const onDestinationChangeRef = useRef(onDestinationChange)
  const lastFitTokenRef = useRef(fitBoundsToken)

  latestOriginRef.current = origin
  latestDestinationRef.current = destination
  onOriginChangeRef.current = onOriginChange
  onDestinationChangeRef.current = onDestinationChange

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    const initializeMap = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current, { zoomControl: true })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      map.setView(BASEY_CENTER, DEFAULT_ZOOM)

      map.on('click', (event: import('leaflet').LeafletMouseEvent) => {
        const point: PlannerPoint = {
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        }

        if (!latestOriginRef.current) {
          onOriginChangeRef.current({ ...point, label: 'Pickup pin' })
          return
        }

        if (!latestDestinationRef.current) {
          onDestinationChangeRef.current({ ...point, label: 'Drop-off pin' })
        }
      })
    }

    initializeMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    let cancelled = false

    const updateMarkers = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return

      const createIcon = (letter: 'A' | 'B', background: string) =>
        L.divIcon({
          html: `<div style="background:${background};width:30px;height:30px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${letter}</div>`,
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        })

      if (origin) {
        if (!originMarkerRef.current) {
          originMarkerRef.current = L.marker([origin.lat, origin.lng], {
            icon: createIcon('A', '#16a34a'),
            draggable: true,
          }).addTo(mapRef.current)

          originMarkerRef.current.on('dragend', () => {
            const latLng = originMarkerRef.current?.getLatLng()
            if (!latLng) return
            onOriginChangeRef.current({
              lat: latLng.lat,
              lng: latLng.lng,
              label: latestOriginRef.current?.label ?? 'Pickup pin',
            })
          })
        }

        originMarkerRef.current.setLatLng([origin.lat, origin.lng])
        originMarkerRef.current.bindPopup(
          `<strong>Pickup (A)</strong><br/>${origin.label ?? 'Pickup pin'}`,
        )
      } else if (originMarkerRef.current) {
        originMarkerRef.current.remove()
        originMarkerRef.current = null
      }

      if (destination) {
        if (!destinationMarkerRef.current) {
          destinationMarkerRef.current = L.marker([destination.lat, destination.lng], {
            icon: createIcon('B', '#dc2626'),
            draggable: true,
          }).addTo(mapRef.current)

          destinationMarkerRef.current.on('dragend', () => {
            const latLng = destinationMarkerRef.current?.getLatLng()
            if (!latLng) return
            onDestinationChangeRef.current({
              lat: latLng.lat,
              lng: latLng.lng,
              label: latestDestinationRef.current?.label ?? 'Drop-off pin',
            })
          })
        }

        destinationMarkerRef.current.setLatLng([destination.lat, destination.lng])
        destinationMarkerRef.current.bindPopup(
          `<strong>Destination (B)</strong><br/>${destination.label ?? 'Drop-off pin'}`,
        )
      } else if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove()
        destinationMarkerRef.current = null
      }
    }

    updateMarkers()

    return () => {
      cancelled = true
    }
  }, [origin, destination])

  useEffect(() => {
    if (!mapRef.current) return

    let cancelled = false

    const updateRouteLayer = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return

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
          }).addTo(mapRef.current)
          fitCoordinates.push(...decoded)
        }
      }

      if (origin) {
        fitCoordinates.push([origin.lat, origin.lng])
      }

      if (destination) {
        fitCoordinates.push([destination.lat, destination.lng])
      }

      fitCoordinatesRef.current = fitCoordinates
    }

    updateRouteLayer()

    return () => {
      cancelled = true
    }
  }, [polyline, origin, destination])

  useEffect(() => {
    if (!mapRef.current) return
    if (fitBoundsToken === lastFitTokenRef.current) return
    lastFitTokenRef.current = fitBoundsToken

    const fitCoordinates = fitCoordinatesRef.current
    if (fitCoordinates.length === 0) return

    mapRef.current.fitBounds(fitCoordinates, {
      padding: [48, 48],
      maxZoom: 15,
    })
  }, [fitBoundsToken])

  const helperText =
    !origin && !destination
      ? 'Click the map to place pickup (A).'
      : origin && !destination
        ? 'Click again to place destination (B).'
        : 'Drag A or B to refine your route.'

  const toneClasses =
    plannerState === 'fallback_estimate'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : plannerState === 'network_error' || plannerState === 'out_of_service_area'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses}`}>
        <div className="font-medium">
          {plannerState === 'calculating' ? 'Calculating route...' : helperText}
        </div>
        {plannerMessage && <p className="mt-1 text-xs opacity-90">{plannerMessage}</p>}
      </div>

      <div className="relative">
        <div ref={containerRef} className={className} style={{ zIndex: 0 }} />
        {isCalculating && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/15 backdrop-blur-[1px]">
            <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg">
              Recalculating route...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
