'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { decodePolyline } from '@/lib/routeUtils'

interface MapPoint {
  lat: number
  lng: number
}

interface TrackerMapSegment {
  id: string
  from: MapPoint
  to: MapPoint
  confidence: 'road_aware' | 'gps_estimate'
  polyline: string | null
}

interface TripTrackerMapProps {
  confirmedCheckpoints: MapPoint[]
  segments: TrackerMapSegment[]
  currentPosition: (MapPoint & { accuracyM: number }) | null
  activeSegment: { from: MapPoint; to: MapPoint } | null
  className?: string
}

const DEFAULT_CENTER: [number, number] = [11.2754, 125.0689]

export default function TripTrackerMap({
  confirmedCheckpoints,
  segments,
  currentPosition,
  activeSegment,
  className = 'w-full h-[26rem]',
}: TripTrackerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default

      if (cancelled || !containerRef.current) {
        return
      }

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

      const fitBoundsCoords: [number, number][] = []

      segments.forEach((segment) => {
        const coords =
          segment.polyline != null
            ? decodePolyline(segment.polyline)
            : [
                [segment.from.lat, segment.from.lng] as [number, number],
                [segment.to.lat, segment.to.lng] as [number, number],
              ]

        const color = segment.confidence === 'road_aware' ? '#2563eb' : '#f59e0b'
        const dashArray = segment.confidence === 'road_aware' ? undefined : '8 8'

        L.polyline(coords, {
          color,
          weight: 5,
          opacity: 0.85,
          dashArray,
        }).addTo(map)

        coords.forEach((coord) => fitBoundsCoords.push(coord))
      })

      confirmedCheckpoints.forEach((checkpoint, index) => {
        L.circleMarker([checkpoint.lat, checkpoint.lng], {
          radius: index === 0 ? 6 : 5,
          color: index === 0 ? '#16a34a' : '#1d4ed8',
          fillColor: index === 0 ? '#22c55e' : '#60a5fa',
          fillOpacity: 0.95,
          weight: 2,
        }).addTo(map)
        fitBoundsCoords.push([checkpoint.lat, checkpoint.lng])
      })

      if (activeSegment) {
        L.polyline(
          [
            [activeSegment.from.lat, activeSegment.from.lng],
            [activeSegment.to.lat, activeSegment.to.lng],
          ],
          {
            color: '#64748b',
            weight: 3,
            opacity: 0.8,
            dashArray: '6 6',
          },
        ).addTo(map)
        fitBoundsCoords.push([activeSegment.from.lat, activeSegment.from.lng])
        fitBoundsCoords.push([activeSegment.to.lat, activeSegment.to.lng])
      }

      if (currentPosition) {
        L.circle([currentPosition.lat, currentPosition.lng], {
          radius: currentPosition.accuracyM,
          color: '#0f766e',
          fillColor: '#5eead4',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map)

        L.circleMarker([currentPosition.lat, currentPosition.lng], {
          radius: 7,
          color: '#0f766e',
          fillColor: '#14b8a6',
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(`Current location (${Math.round(currentPosition.accuracyM)}m accuracy)`)

        fitBoundsCoords.push([currentPosition.lat, currentPosition.lng])
      }

      if (fitBoundsCoords.length > 0) {
        map.fitBounds(fitBoundsCoords as L.LatLngBoundsLiteral, {
          padding: [30, 30],
          maxZoom: 17,
        })
      } else {
        map.setView(DEFAULT_CENTER, 13)
      }
    }

    void initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [activeSegment, confirmedCheckpoints, currentPosition, segments])

  return <div ref={containerRef} className={className} style={{ zIndex: 0 }} />
}
