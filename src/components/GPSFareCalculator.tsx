'use client'

import { useEffect, useState } from 'react'

import FareRateBanner from '@/components/FareRateBanner'
import type { FarePolicySnapshotDto, FareRatesResponseDto } from '@/lib/contracts'
import { calculateFare, getFareBreakdown } from '@/lib/fare/calculator'
import { DEFAULT_FARE_POLICY, resolveFarePolicySnapshot } from '@/lib/fare/policy'

interface GPSPosition {
  latitude: number
  longitude: number
  timestamp: number
  accuracy: number
}

interface TripData {
  startPosition: GPSPosition | null
  endPosition: GPSPosition | null
  totalDistance: number
  duration: number
  fare: number
  isActive: boolean
  waypoints: GPSPosition[]
  farePolicy: FarePolicySnapshotDto | null
}

function createEmptyTripData(): TripData {
  return {
    startPosition: null,
    endPosition: null,
    totalDistance: 0,
    duration: 0,
    fare: 0,
    isActive: false,
    waypoints: [],
    farePolicy: null,
  }
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

function formatAccuracy(accuracy: number): string {
  if (accuracy < 10) return 'Excellent'
  if (accuracy < 30) return 'Good'
  if (accuracy < 100) return 'Fair'
  return 'Poor'
}

function calculateDistance(from: GPSPosition, to: GPSPosition): number {
  const earthRadiusM = 6_371_000
  const lat1Rad = (from.latitude * Math.PI) / 180
  const lat2Rad = (to.latitude * Math.PI) / 180
  const deltaLatRad = ((to.latitude - from.latitude) * Math.PI) / 180
  const deltaLngRad = ((to.longitude - from.longitude) * Math.PI) / 180

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return roundToHundredths((earthRadiusM * c) / 1000)
}

async function fetchCurrentFarePolicy(): Promise<FarePolicySnapshotDto> {
  const response = await fetch('/api/fare-rates')
  const payload = (await response.json()) as Partial<FareRatesResponseDto> & { error?: string }

  if (!response.ok || !payload.current) {
    throw new Error(payload.error || 'Failed to load current fare policy')
  }

  return resolveFarePolicySnapshot(payload.current)
}

const GPSFareCalculator = () => {
  const [tripData, setTripData] = useState<TripData>(() => createEmptyTripData())
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  const activeFarePolicy = resolveFarePolicySnapshot(tripData.farePolicy)
  const fareBreakdown = getFareBreakdown(tripData.totalDistance, 'REGULAR', activeFarePolicy)

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsSupported(false)
      setGpsError('GPS or geolocation is not supported by this browser.')
      return
    }

    getCurrentPosition()
  }, [])

  useEffect(() => {
    if (!tripData.isActive || !navigator.geolocation) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy,
        }

        setCurrentPosition(newPosition)
        void updateTripData(newPosition)
      },
      (error) => {
        setGpsError(`GPS error: ${error.message}`)
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 5_000,
      },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [tripData.isActive])

  function getCurrentPosition() {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy,
        }

        setCurrentPosition(nextPosition)
        setGpsError(null)
      },
      (error) => {
        setGpsError(`GPS error: ${error.message}`)
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 5_000,
      },
    )
  }

  async function updateTripData(newPosition: GPSPosition) {
    setTripData((prev) => {
      const updatedWaypoints = [...prev.waypoints, newPosition]
      let gpsDistance = 0

      for (let index = 1; index < updatedWaypoints.length; index += 1) {
        gpsDistance += calculateDistance(updatedWaypoints[index - 1], updatedWaypoints[index])
      }

      const totalDistance = roundToHundredths(gpsDistance)
      const duration =
        prev.startPosition != null
          ? roundToHundredths((newPosition.timestamp - prev.startPosition.timestamp) / 60_000)
          : 0
      const farePolicy = resolveFarePolicySnapshot(prev.farePolicy)

      return {
        ...prev,
        totalDistance,
        duration,
        fare: calculateFare(totalDistance, 'REGULAR', farePolicy),
        waypoints: updatedWaypoints,
      }
    })
  }

  async function startTrip() {
    if (!currentPosition) {
      setGpsError('Please wait for GPS to get your current location.')
      return
    }

    let farePolicy = DEFAULT_FARE_POLICY
    try {
      farePolicy = await fetchCurrentFarePolicy()
    } catch {
      farePolicy = DEFAULT_FARE_POLICY
    }

    setTripData({
      startPosition: currentPosition,
      endPosition: null,
      totalDistance: 0,
      duration: 0,
      fare: calculateFare(0, 'REGULAR', farePolicy),
      isActive: true,
      waypoints: [currentPosition],
      farePolicy,
    })
    setGpsError(null)
  }

  function endTrip() {
    if (!currentPosition) {
      setGpsError('Cannot end the trip without a GPS position.')
      return
    }

    setTripData((prev) => ({
      ...prev,
      endPosition: currentPosition,
      isActive: false,
    }))
  }

  function resetTrip() {
    setTripData(createEmptyTripData())
    setGpsError(null)
  }

  if (!isSupported) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">GPS tracker unavailable</h2>
        <p className="mt-3 text-sm text-slate-600">
          This browser does not support geolocation, so live GPS fare tracking cannot run here.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FareRateBanner />

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-slate-900">GPS Fare Tracker</h2>
          <p className="mt-2 text-sm text-slate-600">
            This tracker uses live GPS samples and locks the fare policy when the trip starts.
            If rates change mid-trip, they apply only to the next trip.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current fare</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">PHP {tripData.fare.toFixed(2)}</div>
            <div className="mt-1 text-xs text-slate-500">
              Locked at trip start using version {activeFarePolicy.versionId ?? 'legacy default'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Distance</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{tripData.totalDistance.toFixed(2)} km</div>
            <div className="mt-1 text-xs text-slate-500">{tripData.waypoints.length} GPS points recorded</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{formatDuration(tripData.duration)}</div>
            <div className="mt-1 text-xs text-slate-500">Measured from the moment tracking started</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">GPS status</h3>
            <button
              type="button"
              onClick={getCurrentPosition}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white"
            >
              Refresh GPS
            </button>
          </div>

          {currentPosition ? (
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
              <div className="flex items-center justify-between gap-3">
                <span>Latitude</span>
                <span className="font-mono">{currentPosition.latitude.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Longitude</span>
                <span className="font-mono">{currentPosition.longitude.toFixed(6)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Accuracy</span>
                <span className="font-semibold">
                  {formatAccuracy(currentPosition.accuracy)} ({Math.round(currentPosition.accuracy)}m)
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              Waiting for the first GPS fix.
            </div>
          )}

          {gpsError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {gpsError}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!tripData.isActive ? (
            <button
              type="button"
              onClick={() => void startTrip()}
              disabled={!currentPosition}
              className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Start trip
            </button>
          ) : (
            <button
              type="button"
              onClick={endTrip}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              End trip
            </button>
          )}

          <button
            type="button"
            onClick={resetTrip}
            className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {(tripData.isActive || tripData.endPosition) && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-2xl font-semibold text-slate-900">
            {tripData.isActive ? 'Live Fare Breakdown' : 'Trip Summary'}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            GPS tracking uses straight-line distance between accepted samples, so this is an estimate rather than a road-aware route measurement.
          </p>

          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Base fare (first {activeFarePolicy.baseDistanceKm} km)</span>
              <span>PHP {fareBreakdown.baseFare.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Additional distance</span>
              <span>{fareBreakdown.additionalKm.toFixed(2)} km</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Additional fare at PHP {activeFarePolicy.perKmRate.toFixed(2)} per km</span>
              <span>PHP {fareBreakdown.additionalFare.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                <span>Total fare</span>
                <span>PHP {tripData.fare.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GPSFareCalculator
