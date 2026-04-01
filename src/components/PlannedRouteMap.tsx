'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

// Decode Google / ORS encoded polyline (precision 5)
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

interface PlannedRouteMapProps {
  polyline?: string | null
  origin?: { lat: number; lng: number; name?: string } | null
  destination?: { lat: number; lng: number; name?: string } | null
  fromName?: string
  toName?: string
  className?: string
  /** Make the origin marker draggable. Fires onOriginDrag on dragend. */
  draggableOrigin?: boolean
  /** Make the destination marker draggable. Fires onDestinationDrag on dragend. */
  draggableDestination?: boolean
  onOriginDrag?: (coords: { lat: number; lng: number }) => void
  onDestinationDrag?: (coords: { lat: number; lng: number }) => void
}

export default function PlannedRouteMap({
  polyline,
  origin,
  destination,
  fromName,
  toName,
  className = 'w-full h-80',
  draggableOrigin = false,
  draggableDestination = false,
  onOriginDrag,
  onDestinationDrag,
}: PlannedRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  // Use refs for drag callbacks to avoid stale closures without adding them to deps
  const onOriginDragRef = useRef(onOriginDrag)
  const onDestinationDragRef = useRef(onDestinationDrag)
  onOriginDragRef.current = onOriginDrag
  onDestinationDragRef.current = onDestinationDrag

  useEffect(() => {
    if (!containerRef.current) return

    // Remove any previous map instance to re-render with new data
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default

      if (cancelled || !containerRef.current) return

      // Fix broken default icons in Next.js / webpack builds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current, { zoomControl: true })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      const fitBoundsCoords: [number, number][] = []

      // Draw the ORS route polyline
      if (polyline) {
        const coords = decodePolyline(polyline)
        if (coords.length > 0) {
          L.polyline(coords, {
            color: '#3B82F6',
            weight: 5,
            opacity: 0.85,
          }).addTo(map)
          coords.forEach((c) => fitBoundsCoords.push(c))
        }
      }

      // Origin marker (green A)
      if (origin) {
        const icon = L.divIcon({
          html: `<div style="background:#22c55e;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;line-height:1;">A</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        })
        const originMarker = L.marker([origin.lat, origin.lng], { icon, draggable: draggableOrigin })
          .addTo(map)
          .bindPopup(
            `<strong>Start</strong><br/>${fromName ?? origin.name ?? 'Origin'}`,
          )
        if (draggableOrigin) {
          originMarker.on('dragend', () => {
            const ll = originMarker.getLatLng()
            onOriginDragRef.current?.({ lat: ll.lat, lng: ll.lng })
          })
        }
        fitBoundsCoords.push([origin.lat, origin.lng])
      }

      // Destination marker (red B)
      if (destination) {
        const icon = L.divIcon({
          html: `<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;line-height:1;">B</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        })
        const destMarker = L.marker([destination.lat, destination.lng], { icon, draggable: draggableDestination })
          .addTo(map)
          .bindPopup(
            `<strong>Destination</strong><br/>${toName ?? destination.name ?? 'Destination'}`,
          )
        if (draggableDestination) {
          destMarker.on('dragend', () => {
            const ll = destMarker.getLatLng()
            onDestinationDragRef.current?.({ lat: ll.lat, lng: ll.lng })
          })
        }
        fitBoundsCoords.push([destination.lat, destination.lng])
      }

      if (fitBoundsCoords.length > 0) {
        map.fitBounds(fitBoundsCoords as L.LatLngBoundsLiteral, {
          padding: [40, 40],
          maxZoom: 15,
        })
      } else {
        // Default: center on Basey Municipality
        map.setView([11.2754, 125.0689], 12)
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // Re-run whenever the route data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline, origin?.lat, origin?.lng, destination?.lat, destination?.lng])

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />
}
