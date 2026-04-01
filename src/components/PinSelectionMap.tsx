'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

interface LatLng {
  lat: number
  lng: number
}

interface PinSelectionMapProps {
  onPinChange: (origin: LatLng | null, destination: LatLng | null) => void
  initialOrigin?: LatLng | null
  initialDestination?: LatLng | null
  className?: string
}

// Basey municipality center
const BASEY_CENTER: [number, number] = [11.2754, 125.0689]
const DEFAULT_ZOOM = 13

export default function PinSelectionMap({
  onPinChange,
  initialOrigin,
  initialDestination,
  className = 'w-full h-80',
}: PinSelectionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  // Keep mutable state in refs so Leaflet event handlers always read the latest values
  const originRef = useRef<LatLng | null>(initialOrigin ?? null)
  const destRef = useRef<LatLng | null>(initialDestination ?? null)
  const nextClickRef = useRef<'origin' | 'destination'>(
    initialOrigin && !initialDestination ? 'destination' : 'origin',
  )
  const originMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const destMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const onPinChangeRef = useRef(onPinChange)
  onPinChangeRef.current = onPinChange

  // React state — drives the coordinate readout below the map only
  const [pins, setPins] = useState<{ origin: LatLng | null; destination: LatLng | null }>({
    origin: initialOrigin ?? null,
    destination: initialDestination ?? null,
  })

  useEffect(() => {
    if (!containerRef.current) return
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

      // --- Icon factories ---
      const makeOriginIcon = () =>
        L.divIcon({
          html: `<div style="background:#22c55e;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;line-height:1;">A</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        })

      const makeDestIcon = () =>
        L.divIcon({
          html: `<div style="background:#ef4444;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;line-height:1;">B</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -16],
        })

      // --- Create a draggable marker and attach dragend listener ---
      const createOriginMarker = (coords: LatLng) => {
        const marker = L.marker([coords.lat, coords.lng], {
          icon: makeOriginIcon(),
          draggable: true,
        })
          .addTo(map)
          .bindPopup('<strong>Pickup</strong><br/>Drag to adjust')
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          const updated = { lat: ll.lat, lng: ll.lng }
          originRef.current = updated
          setPins((p) => {
            const next = { ...p, origin: updated }
            onPinChangeRef.current(next.origin, next.destination)
            return next
          })
        })
        return marker
      }

      const createDestMarker = (coords: LatLng) => {
        const marker = L.marker([coords.lat, coords.lng], {
          icon: makeDestIcon(),
          draggable: true,
        })
          .addTo(map)
          .bindPopup('<strong>Drop-off</strong><br/>Drag to adjust')
        marker.on('dragend', () => {
          const ll = marker.getLatLng()
          const updated = { lat: ll.lat, lng: ll.lng }
          destRef.current = updated
          setPins((p) => {
            const next = { ...p, destination: updated }
            onPinChangeRef.current(next.origin, next.destination)
            return next
          })
        })
        return marker
      }

      // Restore initial pins if provided
      if (originRef.current) {
        originMarkerRef.current = createOriginMarker(originRef.current)
      }
      if (destRef.current) {
        destMarkerRef.current = createDestMarker(destRef.current)
      }

      // --- Map click: alternate between placing origin and destination ---
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const coords: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng }

        if (nextClickRef.current === 'origin') {
          if (originMarkerRef.current) {
            originMarkerRef.current.remove()
            originMarkerRef.current = null
          }
          originRef.current = coords
          originMarkerRef.current = createOriginMarker(coords)
          originMarkerRef.current.openPopup()
          nextClickRef.current = 'destination'
        } else {
          if (destMarkerRef.current) {
            destMarkerRef.current.remove()
            destMarkerRef.current = null
          }
          destRef.current = coords
          destMarkerRef.current = createDestMarker(coords)
          destMarkerRef.current.openPopup()
          nextClickRef.current = 'origin'
        }

        const snap = { origin: originRef.current, destination: destRef.current }
        setPins(snap)
        onPinChangeRef.current(snap.origin, snap.destination)
      })
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // Map initialised once; state managed via refs

  const fmtCoord = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W'
    return `${Math.abs(val).toFixed(5)}°${dir}`
  }

  return (
    <div>
      {/* Instruction banner above the map */}
      <div className="mb-2 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2
        bg-blue-50 border border-blue-200 text-blue-800">
        <span className="text-base" aria-hidden="true">
          {!pins.origin && !pins.destination && '1️⃣'}
          {pins.origin && !pins.destination && '2️⃣'}
          {pins.origin && pins.destination && '✅'}
        </span>
        <span>
          {!pins.origin && !pins.destination && 'Click on the map to place your pickup point (A)'}
          {pins.origin && !pins.destination && 'Now click to place your drop-off point (B)'}
          {pins.origin && pins.destination && 'Both points set — drag a pin to adjust its position'}
        </span>
      </div>
      <div ref={containerRef} className={className} style={{ zIndex: 0 }} />
      <div className="mt-2 px-1 text-xs text-gray-500 space-y-1">
        {pins.origin && (
          <p>
            <span
              className="inline-flex items-center justify-center w-4 h-4 bg-green-500 text-white rounded-full text-xs font-bold mr-1"
              aria-hidden="true"
            >
              A
            </span>
            Pickup: {fmtCoord(pins.origin.lat, true)}, {fmtCoord(pins.origin.lng, false)}
          </p>
        )}
        {pins.destination && (
          <p>
            <span
              className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white rounded-full text-xs font-bold mr-1"
              aria-hidden="true"
            >
              B
            </span>
            Drop-off: {fmtCoord(pins.destination.lat, true)}, {fmtCoord(pins.destination.lng, false)}
          </p>
        )}
      </div>
    </div>
  )
}
