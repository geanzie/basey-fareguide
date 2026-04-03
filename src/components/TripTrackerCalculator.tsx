'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateFare } from '@/lib/fare/calculator'
import FareRateBanner from '@/components/FareRateBanner'
import type { FarePolicySnapshotDto, FareRatesResponseDto, TrackerSegmentResponseDto } from '@/lib/contracts'
import { DEFAULT_FARE_POLICY, resolveFarePolicySnapshot } from '@/lib/fare/policy'
import {
  CLIENT_SEGMENT_REQUEST_INTERVAL_MS,
  MAX_CONSECUTIVE_REJECTIONS_FOR_POOR_SIGNAL,
  MAX_RAW_SAMPLE_ACCURACY_M,
  TRACKER_SESSION_STORAGE_KEY,
  estimateFallbackDistanceKm,
  evaluateCheckpointCandidate,
  evaluateRawSample,
} from '@/lib/tracker'
import type {
  TrackerPoint,
  TrackerSegmentRecord,
  TrackerTripState,
  TrackerUiState,
} from '@/lib/tracker'
import TripTrackerMap from '@/components/TripTrackerMap'

function createTrackerSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `tracker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createEmptyTripState(): TrackerTripState {
  return {
    trackerSessionId: createTrackerSessionId(),
    uiState: 'waiting_permission',
    isTracking: false,
    startedAtMs: null,
    endedAtMs: null,
    startPoint: null,
    endPoint: null,
    currentPosition: null,
    lastAcceptedRawPoint: null,
    confirmedCheckpoints: [],
    segments: [],
    totalDistanceKm: 0,
    durationMin: 0,
    fare: 0,
    farePolicy: null,
    hasFallbackSegments: false,
    lastSegmentRequestAtMs: null,
    rateLimitedUntilMs: null,
    consecutiveRejectedSamples: 0,
    lastRejectionReason: null,
    gpsError: null,
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

function formatAccuracyLabel(accuracyM: number): string {
  if (accuracyM <= 10) return 'Excellent'
  if (accuracyM <= 30) return 'Good'
  if (accuracyM <= 50) return 'Usable'
  return 'Poor'
}

function getTrackingUiState(
  isTracking: boolean,
  segments: TrackerSegmentRecord[],
  hasFallbackSegments: boolean,
  consecutiveRejectedSamples: number,
  finished: boolean,
): TrackerUiState {
  if (finished) {
    return 'completed'
  }

  if (!isTracking) {
    return segments.length > 0 ? 'paused' : 'calibrating'
  }

  if (consecutiveRejectedSamples >= MAX_CONSECUTIVE_REJECTIONS_FOR_POOR_SIGNAL) {
    return 'poor_signal'
  }

  if (segments.length === 0) {
    return 'calibrating'
  }

  return hasFallbackSegments ? 'tracking_estimated' : 'tracking_road_aware'
}

function pointFromPosition(position: GeolocationPosition): TrackerPoint {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: position.coords.accuracy,
    timestampMs: typeof position.timestamp === 'number' ? position.timestamp : Date.now(),
  }
}

function buildGpsFallbackSegment(
  from: TrackerPoint,
  to: TrackerPoint,
  reason: string,
): TrackerSegmentResponseDto {
  return {
    accepted: true,
    reason,
    distanceKm: roundToHundredths(estimateFallbackDistanceKm(from, to)),
    durationMin: roundToHundredths((to.timestampMs - from.timestampMs) / 60_000),
    confidence: 'gps_estimate',
    method: 'gps',
    fallbackReason: reason,
    polyline: null,
    snappedFrom: null,
    snappedTo: null,
  }
}

async function fetchCurrentFarePolicy(): Promise<FarePolicySnapshotDto> {
  const response = await fetch('/api/fare-rates')
  const payload = (await response.json()) as Partial<FareRatesResponseDto> & { error?: string }

  if (!response.ok || !payload.current) {
    throw new Error(payload.error || 'Failed to load current fare policy')
  }

  return resolveFarePolicySnapshot(payload.current)
}

function parseStoredTripState(raw: string | null): TrackerTripState | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TrackerTripState>
    if (
      typeof parsed !== 'object' ||
      parsed == null ||
      typeof parsed.trackerSessionId !== 'string' ||
      !Array.isArray(parsed.confirmedCheckpoints) ||
      !Array.isArray(parsed.segments)
    ) {
      return null
    }

    return {
      ...createEmptyTripState(),
      ...parsed,
      trackerSessionId: parsed.trackerSessionId,
      confirmedCheckpoints: parsed.confirmedCheckpoints as TrackerPoint[],
      segments: parsed.segments as TrackerSegmentRecord[],
    }
  } catch {
    return null
  }
}

function getStateBanner(uiState: TrackerUiState, hasFallbackSegments: boolean) {
  switch (uiState) {
    case 'waiting_permission':
      return {
        title: 'Waiting for location permission',
        detail: 'Allow location access so the tracker can calibrate your first checkpoint.',
        tone: 'slate' as const,
      }
    case 'calibrating':
      return {
        title: 'Calibrating GPS',
        detail: 'The tracker is collecting a stable fix before it measures meaningful movement.',
        tone: 'amber' as const,
      }
    case 'tracking_road_aware':
      return {
        title: 'Road-aware tracking active',
        detail: 'Confirmed checkpoints are being measured with OpenRouteService.',
        tone: 'emerald' as const,
      }
    case 'tracking_estimated':
      return {
        title: 'Estimated tracking active',
        detail: 'At least one segment is using lower-confidence GPS fallback instead of road correction.',
        tone: 'orange' as const,
      }
    case 'poor_signal':
      return {
        title: 'Poor signal detected',
        detail: 'Recent samples were rejected. Keep the page open and wait for a stronger location fix.',
        tone: 'red' as const,
      }
    case 'paused':
      return {
        title: 'Tracking paused',
        detail: hasFallbackSegments
          ? 'Resume to keep collecting segments. This trip already includes estimated fallback segments.'
          : 'Resume when you are ready to continue collecting road-aware segments.',
        tone: 'blue' as const,
      }
    case 'completed':
      return {
        title: hasFallbackSegments ? 'Estimated trip summary' : 'Trip completed',
        detail: hasFallbackSegments
          ? 'This summary includes at least one fallback segment, so treat the total as an estimate.'
          : 'All confirmed segments were road-aware when OpenRouteService was available.',
        tone: hasFallbackSegments ? 'orange' as const : ('blue' as const),
      }
    default:
      return {
        title: 'Tracker ready',
        detail: 'Start a trip when your GPS accuracy is usable.',
        tone: 'slate' as const,
      }
  }
}

function toneClasses(tone: 'slate' | 'amber' | 'emerald' | 'orange' | 'red' | 'blue'): string {
  switch (tone) {
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    case 'orange':
      return 'border-orange-200 bg-orange-50 text-orange-900'
    case 'red':
      return 'border-red-200 bg-red-50 text-red-900'
    case 'blue':
      return 'border-blue-200 bg-blue-50 text-blue-900'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-900'
  }
}

const TripTrackerCalculator = () => {
  const [tripState, setTripState] = useState<TrackerTripState>(() => createEmptyTripState())
  const [isSupported, setIsSupported] = useState(true)
  const tripStateRef = useRef(tripState)
  const requestInFlightRef = useRef(false)

  useEffect(() => {
    tripStateRef.current = tripState
  }, [tripState])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!navigator.geolocation) {
      setIsSupported(false)
      setTripState((prev) => ({
        ...prev,
        uiState: 'waiting_permission',
        gpsError: 'GPS or geolocation is not supported by this browser.',
      }))
      return
    }

    const storedState = parseStoredTripState(sessionStorage.getItem(TRACKER_SESSION_STORAGE_KEY))
    if (storedState) {
      setTripState(storedState)
    }

    void getCurrentPosition()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const shouldClearStorage =
      !tripState.isTracking &&
      tripState.startPoint == null &&
      tripState.endPoint == null &&
      tripState.segments.length === 0

    if (shouldClearStorage) {
      sessionStorage.removeItem(TRACKER_SESSION_STORAGE_KEY)
      return
    }

    sessionStorage.setItem(TRACKER_SESSION_STORAGE_KEY, JSON.stringify(tripState))
  }, [tripState])

  useEffect(() => {
    if (!tripState.isTracking || !navigator.geolocation) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void handlePositionUpdate(position)
      },
      (error) => {
        setTripState((prev) => ({
          ...prev,
          gpsError: `GPS error: ${error.message}`,
          uiState: getTrackingUiState(
            prev.isTracking,
            prev.segments,
            prev.hasFallbackSegments,
            prev.consecutiveRejectedSamples,
            false,
          ),
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 1_000,
      },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [tripState.isTracking])

  const currentPosition = tripState.currentPosition
  const lastCheckpoint = tripState.confirmedCheckpoints[tripState.confirmedCheckpoints.length - 1] ?? null
  const banner = getStateBanner(tripState.uiState, tripState.hasFallbackSegments)
  const activeFarePolicy = resolveFarePolicySnapshot(tripState.farePolicy)
  const readyToStart =
    currentPosition != null &&
    currentPosition.accuracyM <= MAX_RAW_SAMPLE_ACCURACY_M &&
    tripState.startPoint == null
  const fallbackSegmentCount = tripState.segments.filter((segment) => segment.confidence === 'gps_estimate').length
  const roadAwareSegmentCount = tripState.segments.filter((segment) => segment.confidence === 'road_aware').length

  const activeSegment = useMemo(() => {
    if (!tripState.isTracking || !lastCheckpoint || !currentPosition) {
      return null
    }

    if (lastCheckpoint.timestampMs === currentPosition.timestampMs) {
      return null
    }

    return {
      from: { lat: lastCheckpoint.lat, lng: lastCheckpoint.lng },
      to: { lat: currentPosition.lat, lng: currentPosition.lng },
    }
  }, [currentPosition, lastCheckpoint, tripState.isTracking])

  async function getCurrentPosition() {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = pointFromPosition(position)
        setTripState((prev) => ({
          ...prev,
          currentPosition: point,
          gpsError: null,
          uiState:
            prev.startPoint == null && point.accuracyM > MAX_RAW_SAMPLE_ACCURACY_M
              ? 'calibrating'
              : prev.uiState === 'waiting_permission'
                ? 'calibrating'
                : prev.uiState,
        }))
      },
      (error) => {
        setTripState((prev) => ({
          ...prev,
          gpsError: `GPS error: ${error.message}`,
          uiState: 'waiting_permission',
        }))
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 5_000,
      },
    )
  }

  function registerRejectedSample(reason: string) {
    setTripState((prev) => {
      const consecutiveRejectedSamples = prev.consecutiveRejectedSamples + 1
      return {
        ...prev,
        consecutiveRejectedSamples,
        lastRejectionReason: reason,
        uiState: getTrackingUiState(
          prev.isTracking,
          prev.segments,
          prev.hasFallbackSegments,
          consecutiveRejectedSamples,
          false,
        ),
      }
    })
  }

  function commitSegment(
    fromPoint: TrackerPoint,
    toPoint: TrackerPoint,
    response: TrackerSegmentResponseDto,
    rateLimitedUntilMs: number | null,
  ) {
    setTripState((prev) => {
      const currentCheckpoint = prev.confirmedCheckpoints[prev.confirmedCheckpoints.length - 1]
      if (
        !prev.isTracking ||
        !currentCheckpoint ||
        currentCheckpoint.timestampMs !== fromPoint.timestampMs
      ) {
        return prev
      }

      const nextSegment: TrackerSegmentRecord = {
        id: `${toPoint.timestampMs}-${prev.segments.length + 1}`,
        from: fromPoint,
        to: toPoint,
        distanceKm: response.distanceKm,
        durationMin: response.durationMin,
        confidence: response.confidence === 'road_aware' ? 'road_aware' : 'gps_estimate',
        method: response.method,
        fallbackReason: response.fallbackReason,
        polyline: response.polyline,
      }

      const nextSegments = [...prev.segments, nextSegment]
      const totalDistanceKm = roundToHundredths(prev.totalDistanceKm + response.distanceKm)
      const durationMin =
        prev.startedAtMs != null
          ? roundToHundredths((toPoint.timestampMs - prev.startedAtMs) / 60_000)
          : prev.durationMin
      const hasFallbackSegments =
        prev.hasFallbackSegments || response.confidence !== 'road_aware'
      const farePolicy = resolveFarePolicySnapshot(prev.farePolicy)

      return {
        ...prev,
        currentPosition: toPoint,
        endPoint: null,
        lastAcceptedRawPoint: toPoint,
        confirmedCheckpoints: [...prev.confirmedCheckpoints, toPoint],
        segments: nextSegments,
        totalDistanceKm,
        durationMin,
        fare: calculateFare(totalDistanceKm, 'REGULAR', farePolicy),
        hasFallbackSegments,
        lastSegmentRequestAtMs: toPoint.timestampMs,
        rateLimitedUntilMs,
        consecutiveRejectedSamples: 0,
        lastRejectionReason: null,
        gpsError: null,
        uiState: getTrackingUiState(true, nextSegments, hasFallbackSegments, 0, false),
      }
    })
  }

  async function handlePositionUpdate(position: GeolocationPosition) {
    const point = pointFromPosition(position)

    setTripState((prev) => ({
      ...prev,
      currentPosition: point,
      durationMin:
        prev.startedAtMs != null ? roundToHundredths((point.timestampMs - prev.startedAtMs) / 60_000) : prev.durationMin,
      gpsError: null,
    }))

    const snapshot = tripStateRef.current
    const rawDecision = evaluateRawSample(snapshot.lastAcceptedRawPoint, point)
    if (!rawDecision.accepted) {
      registerRejectedSample(rawDecision.reason ?? 'raw_sample_rejected')
      return
    }

    setTripState((prev) => ({
      ...prev,
      lastAcceptedRawPoint: point,
    }))

    const lastConfirmedCheckpoint =
      snapshot.confirmedCheckpoints[snapshot.confirmedCheckpoints.length - 1] ?? null
    const checkpointDecision = evaluateCheckpointCandidate(lastConfirmedCheckpoint, point)
    if (!checkpointDecision.accepted || !lastConfirmedCheckpoint) {
      if (checkpointDecision.reason && checkpointDecision.reason !== 'checkpoint_too_soon') {
        registerRejectedSample(checkpointDecision.reason)
      }
      return
    }

    if (requestInFlightRef.current) {
      return
    }

    if (
      snapshot.lastSegmentRequestAtMs != null &&
      point.timestampMs - snapshot.lastSegmentRequestAtMs < CLIENT_SEGMENT_REQUEST_INTERVAL_MS
    ) {
      return
    }

    requestInFlightRef.current = true

    try {
      const rateLimitedUntilMs = snapshot.rateLimitedUntilMs
      if (rateLimitedUntilMs != null && point.timestampMs < rateLimitedUntilMs) {
        commitSegment(
          lastConfirmedCheckpoint,
          point,
          buildGpsFallbackSegment(lastConfirmedCheckpoint, point, 'tracker_rate_limited'),
          rateLimitedUntilMs,
        )
        return
      }

      setTripState((prev) => ({
        ...prev,
        lastSegmentRequestAtMs: point.timestampMs,
      }))

      const response = await fetch('/api/tracker/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackerSessionId: snapshot.trackerSessionId,
          from: lastConfirmedCheckpoint,
          to: point,
        }),
      })

      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? '60')
        const retryUntil = Date.now() + retryAfterSeconds * 1000
        commitSegment(
          lastConfirmedCheckpoint,
          point,
          buildGpsFallbackSegment(lastConfirmedCheckpoint, point, 'tracker_rate_limited'),
          retryUntil,
        )
        return
      }

      if (!response.ok) {
        commitSegment(
          lastConfirmedCheckpoint,
          point,
          buildGpsFallbackSegment(lastConfirmedCheckpoint, point, 'tracker_service_unavailable'),
          null,
        )
        return
      }

      const segment = (await response.json()) as TrackerSegmentResponseDto
      if (!segment.accepted || segment.confidence === 'rejected') {
        registerRejectedSample(segment.reason ?? 'segment_rejected')
        return
      }

      commitSegment(lastConfirmedCheckpoint, point, segment, null)
    } catch {
      commitSegment(
        lastConfirmedCheckpoint,
        point,
        buildGpsFallbackSegment(lastConfirmedCheckpoint, point, 'tracker_network_error'),
        null,
      )
    } finally {
      requestInFlightRef.current = false
    }
  }

  async function startTrip() {
    if (!currentPosition) {
      setTripState((prev) => ({
        ...prev,
        gpsError: 'Wait for GPS to acquire your location before starting.',
      }))
      return
    }

    if (currentPosition.accuracyM > MAX_RAW_SAMPLE_ACCURACY_M) {
      setTripState((prev) => ({
        ...prev,
        gpsError: 'GPS accuracy is still poor. Wait for a stronger location fix before starting.',
        uiState: 'calibrating',
      }))
      return
    }

    let farePolicy = DEFAULT_FARE_POLICY
    try {
      farePolicy = await fetchCurrentFarePolicy()
    } catch {
      farePolicy = DEFAULT_FARE_POLICY
    }

    setTripState({
      trackerSessionId: createTrackerSessionId(),
      uiState: 'calibrating',
      isTracking: true,
      startedAtMs: currentPosition.timestampMs,
      endedAtMs: null,
      startPoint: currentPosition,
      endPoint: null,
      currentPosition,
      lastAcceptedRawPoint: currentPosition,
      confirmedCheckpoints: [currentPosition],
      segments: [],
      totalDistanceKm: 0,
      durationMin: 0,
      fare: calculateFare(0, 'REGULAR', farePolicy),
      farePolicy,
      hasFallbackSegments: false,
      lastSegmentRequestAtMs: null,
      rateLimitedUntilMs: null,
      consecutiveRejectedSamples: 0,
      lastRejectionReason: null,
      gpsError: null,
    })
  }

  function pauseTrip() {
    setTripState((prev) => ({
      ...prev,
      isTracking: false,
      uiState: getTrackingUiState(false, prev.segments, prev.hasFallbackSegments, prev.consecutiveRejectedSamples, false),
    }))
  }

  function resumeTrip() {
    setTripState((prev) => ({
      ...prev,
      isTracking: true,
      endedAtMs: null,
      uiState: getTrackingUiState(true, prev.segments, prev.hasFallbackSegments, 0, false),
      consecutiveRejectedSamples: 0,
      lastRejectionReason: null,
      gpsError: null,
    }))
  }

  function endTrip() {
    setTripState((prev) => ({
      ...prev,
      isTracking: false,
      endedAtMs: prev.currentPosition?.timestampMs ?? Date.now(),
      endPoint: prev.currentPosition,
      uiState: 'completed',
      durationMin:
        prev.startedAtMs != null && prev.currentPosition != null
          ? roundToHundredths((prev.currentPosition.timestampMs - prev.startedAtMs) / 60_000)
          : prev.durationMin,
    }))
  }

  function resetTrip() {
    const nextState = createEmptyTripState()
    setTripState(nextState)
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TRACKER_SESSION_STORAGE_KEY)
    }
  }

  if (!isSupported) {
    return (
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Trip Tracker unavailable</h2>
        <p className="mt-3 text-sm text-slate-600">
          This browser does not support geolocation, so live trip tracking cannot run here.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <FareRateBanner />

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-slate-900">Trip Tracker</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Road-aware while the page stays open. The tracker confirms meaningful checkpoints,
              measures each segment with OpenRouteService when available, and falls back to a
              lower-confidence GPS estimate when road correction is unavailable.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses(banner.tone)}`}>
            <div className="font-semibold">{banner.title}</div>
            <div className="mt-1 text-sm">{banner.detail}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
            <TripTrackerMap
              confirmedCheckpoints={tripState.confirmedCheckpoints}
              segments={tripState.segments}
              currentPosition={tripState.currentPosition}
              activeSegment={activeSegment}
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Live tracker status</h3>
                <button
                  type="button"
                  onClick={() => void getCurrentPosition()}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                >
                  Refresh GPS
                </button>
              </div>

              {currentPosition ? (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Latitude</span>
                    <span className="font-mono">{currentPosition.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Longitude</span>
                    <span className="font-mono">{currentPosition.lng.toFixed(6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Accuracy</span>
                    <span className="font-semibold">
                      {formatAccuracyLabel(currentPosition.accuracyM)} ({Math.round(currentPosition.accuracyM)}m)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Session state</span>
                    <span className="font-semibold">{tripState.uiState.replaceAll('_', ' ')}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  Waiting for the first GPS fix.
                </div>
              )}

              {tripState.gpsError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {tripState.gpsError}
                </div>
              )}

              {tripState.lastRejectionReason && tripState.isTracking && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Last rejected sample: {tripState.lastRejectionReason.replaceAll('_', ' ')}.
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Current fare</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">PHP {tripState.fare.toFixed(2)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {tripState.hasFallbackSegments ? 'Includes estimated segments' : 'All confirmed segments are road-aware'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirmed distance</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{tripState.totalDistanceKm.toFixed(2)} km</div>
                <div className="mt-1 text-xs text-slate-500">
                  {tripState.confirmedCheckpoints.length} checkpoints, {tripState.segments.length} measured segments
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{formatDuration(tripState.durationMin)}</div>
                <div className="mt-1 text-xs text-slate-500">Measured from the moment tracking started</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Confidence mix</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {roadAwareSegmentCount} road-aware / {fallbackSegmentCount} estimated
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Estimated segments never use road-aware wording in the UI or summary.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {tripState.startPoint == null ? (
                <button
                  type="button"
                  onClick={startTrip}
                  disabled={!readyToStart}
                  className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Start tracking
                </button>
              ) : tripState.isTracking ? (
                <>
                  <button
                    type="button"
                    onClick={pauseTrip}
                    className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={endTrip}
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    End trip
                  </button>
                </>
              ) : tripState.uiState === 'completed' ? null : (
                <>
                  <button
                    type="button"
                    onClick={resumeTrip}
                    className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={endTrip}
                    className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    End trip
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={resetTrip}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>

            {!readyToStart && tripState.startPoint == null && (
              <p className="text-xs text-slate-500">
                The Start button unlocks when GPS accuracy is at or below {MAX_RAW_SAMPLE_ACCURACY_M}m.
              </p>
            )}
          </div>
        </div>
      </div>

      {tripState.uiState === 'completed' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="text-2xl font-semibold text-slate-900">
            {tripState.hasFallbackSegments ? 'Estimated Trip Summary' : 'Trip Summary'}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {tripState.hasFallbackSegments
              ? 'At least one segment used fallback GPS distance because road correction was unavailable or throttled.'
              : 'Every confirmed segment used OpenRouteService road measurement.'}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Final fare</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">PHP {tripState.fare.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Distance</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{tripState.totalDistanceKm.toFixed(2)} km</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatDuration(tripState.durationMin)}</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">Fare breakdown</div>
            <div className="mt-3 flex items-center justify-between">
              <span>Base fare (first {activeFarePolicy.baseDistanceKm} km)</span>
              <span>PHP {activeFarePolicy.baseFare.toFixed(2)}</span>
            </div>
            {tripState.totalDistanceKm > activeFarePolicy.baseDistanceKm && (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <span>Additional distance</span>
                  <span>{(tripState.totalDistanceKm - activeFarePolicy.baseDistanceKm).toFixed(2)} km</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>Additional fare</span>
                  <span>PHP {(tripState.fare - activeFarePolicy.baseFare).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-lg font-semibold text-amber-900">How this tracker works</h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            <li>It filters weak GPS samples before they affect your fare.</li>
            <li>It promotes only meaningful movement into confirmed checkpoints.</li>
            <li>It measures each confirmed segment with OpenRouteService when available.</li>
            <li>It falls back to lower-confidence GPS estimation when road correction is unavailable.</li>
            <li>It keeps the active trip in session storage so a refresh can recover the current session.</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900">Truthfulness note</h3>
          <div className="mt-3 space-y-3 text-sm text-blue-900">
            <p>
              This is a foreground web tracker. Keep the page open during the trip so the browser can keep
              receiving location updates.
            </p>
            <p>
              OpenRouteService relies on OSM-derived routing graphs, so very recent road edits or closures
              may not appear immediately. Treat the map as road-aware, not instantly synced to every new road change.
            </p>
            <p>
              When the tracker shows an estimated state, that segment is not road-aware and should be treated as
              lower confidence than an OpenRouteService-measured segment.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TripTrackerCalculator
