'use client'

import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { RoutePlannerMapProps } from './RoutePlannerMap'
import { resolvePinLabel } from '@/lib/locations/pinLabelResolver'
import { decodePolyline } from '@/lib/routeUtils'

const BASEY_CENTER = { lat: 11.2754, lng: 125.0689 }
const DEFAULT_ZOOM = 13

const MAP_OPTIONS: google.maps.MapOptions = {
  clickableIcons: false,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false,
}

function createResolvedPlannerPoint(lat: number, lng: number) {
  return {
    lat,
    lng,
    label: resolvePinLabel(lat, lng).displayLabel,
  }
}

function createMarkerIcon(backgroundColor: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: backgroundColor,
    fillOpacity: 1,
    scale: 11,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight: 3,
  }
}

export default function GoogleRoutePlannerMap({
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
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const lastFitTokenRef = useRef(fitBoundsToken)
  const routePolylineRef = useRef<google.maps.Polyline | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'route-planner-google-maps',
    googleMapsApiKey: apiKey,
  })

  const routePath = useMemo(
    () =>
      polyline
        ? decodePolyline(polyline).map(([lat, lng]) => ({ lat, lng }))
        : [],
    [polyline],
  )

  const fitPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = []

    if (routePath.length > 0) {
      points.push(...routePath)
    }

    if (origin) {
      points.push({ lat: origin.lat, lng: origin.lng })
    }

    if (destination) {
      points.push({ lat: destination.lat, lng: destination.lng })
    }

    return points
  }, [destination, origin, routePath])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    if (fitBoundsToken === lastFitTokenRef.current) {
      return
    }

    lastFitTokenRef.current = fitBoundsToken

    if (fitPoints.length === 0) {
      return
    }

    const bounds = new google.maps.LatLngBounds()
    fitPoints.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds, 48)
  }, [fitBoundsToken, fitPoints, isLoaded, map])

  useEffect(() => {
    if (!map || !isLoaded) {
      return
    }

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }

    if (routePath.length === 0) {
      return
    }

    routePolylineRef.current = new google.maps.Polyline({
      map,
      path: routePath,
      strokeColor: '#2563eb',
      strokeOpacity: 0.9,
      strokeWeight: 5,
    })

    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null)
        routePolylineRef.current = null
      }
    }
  }, [isLoaded, map, routePath])

  useEffect(() => {
    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null)
        routePolylineRef.current = null
      }
    }
  }, [])

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

  const googleMapsUnavailable = !apiKey || Boolean(loadError)

  return (
    <div className="relative">
      {googleMapsUnavailable ? (
        <div
          className={`${className} flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 text-center text-sm text-amber-900`}
          role="status"
        >
          Google Maps is selected for this planner, but the browser map key is unavailable. Add
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to restore the Google map surface.
        </div>
      ) : !isLoaded ? (
        <div
          className={`${className} flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-600`}
          role="status"
        >
          Loading Google map...
        </div>
      ) : (
        <GoogleMap
          mapContainerClassName={className}
          center={BASEY_CENTER}
          zoom={DEFAULT_ZOOM}
          options={MAP_OPTIONS}
          onLoad={(loadedMap) => setMap(loadedMap)}
          onUnmount={() => setMap(null)}
          onClick={(event) => {
            const latLng = event.latLng
            if (!latLng) {
              return
            }

            const point = createResolvedPlannerPoint(latLng.lat(), latLng.lng())

            if (!origin) {
              onOriginChange(point)
              return
            }

            if (!destination) {
              onDestinationChange(point)
            }
          }}
        >
          {origin ? (
            <Marker
              position={{ lat: origin.lat, lng: origin.lng }}
              draggable
              label={{ text: 'A', color: '#ffffff', fontWeight: '700' }}
              icon={createMarkerIcon('#16a34a')}
              onDragEnd={(event) => {
                const latLng = event.latLng
                if (!latLng) {
                  return
                }

                onOriginChange(createResolvedPlannerPoint(latLng.lat(), latLng.lng()))
              }}
            />
          ) : null}

          {destination ? (
            <Marker
              position={{ lat: destination.lat, lng: destination.lng }}
              draggable
              label={{ text: 'B', color: '#ffffff', fontWeight: '700' }}
              icon={createMarkerIcon('#dc2626')}
              onDragEnd={(event) => {
                const latLng = event.latLng
                if (!latLng) {
                  return
                }

                onDestinationChange(createResolvedPlannerPoint(latLng.lat(), latLng.lng()))
              }}
            />
          ) : null}

        </GoogleMap>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 z-[350] max-w-[calc(100%-1.5rem)] sm:max-w-sm">
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-lg backdrop-blur-md sm:text-sm ${toneClasses}`}>
          <div className="font-medium">{helperText}</div>
          {plannerMessage ? <p className="mt-1 text-[11px] opacity-90 sm:text-xs">{plannerMessage}</p> : null}
        </div>
      </div>

      {isCalculating ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/15 backdrop-blur-[1px]">
          <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-lg">
            Recalculating route...
          </div>
        </div>
      ) : null}
    </div>
  )
}