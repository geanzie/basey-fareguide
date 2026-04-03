'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import dynamic from 'next/dynamic'

import { useAuth } from './AuthProvider'
import FareRateBanner from '@/components/FareRateBanner'
import type { DiscountCardDto, DiscountCardMeResponseDto, FarePolicySnapshotDto } from '@/lib/contracts'
import { resolveFarePolicySnapshot } from '@/lib/fare/policy'
import {
  classifyPlannerError,
  getRouteSourceBadge,
  pointsEffectivelyEqual,
  routePairEffectivelyEqual,
  type PlannerPoint,
  type PlannerViewState,
} from '@/lib/planner/routePlanner'
import type { RoutePlannerMapProps } from './RoutePlannerMap'

const DynamicRoutePlannerMap = dynamic(() => import('./RoutePlannerMap'), { ssr: false }) as ComponentType<RoutePlannerMapProps>

interface RoutePlannerCalculatorProps {
  onError?: (error: string) => void
  MapComponent?: ComponentType<RoutePlannerMapProps>
}

interface CalculateRouteResponse {
  origin: string
  destination: string
  distanceKm: number
  durationMin: number | null
  fare: number
  farePolicy: FarePolicySnapshotDto
  fareBreakdown: {
    baseFare: number
    additionalKm: number
    additionalFare: number
    discount: number
  }
  method: 'ors' | 'gps' | null
  fallbackReason: string | null
  polyline: string | null
}

interface RouteResult {
  fare: number
  distanceKm: number
  durationText: string
  durationMin: number
  polyline: string | null
  method: 'ors' | 'gps' | null
  sourceBadge: string
  fallbackReason: string | null
  originalFare?: number
  discountApplied?: number
  discountRate?: number
  discountCard?: DiscountCardDto | null
  farePolicy: FarePolicySnapshotDto
  breakdown: {
    baseFare: number
    additionalDistance: number
    additionalFare: number
  }
  originLabel: string
  destinationLabel: string
}

function formatCurrency(value: number): string {
  return `PHP ${value.toFixed(2)}`
}

function formatPointLabel(point: PlannerPoint | null, fallback: string): string {
  return point?.label?.trim() || fallback
}

function buildDurationText(durationMin: number | null): string {
  if (durationMin == null) return 'N/A'
  return `${Math.round(durationMin)} min`
}

function PointSetter({
  title,
  letter,
  currentPoint,
  isLocating,
  onUseCurrentLocation,
}: {
  title: string
  letter: 'A' | 'B'
  currentPoint: PlannerPoint | null
  isLocating: boolean
  onUseCurrentLocation: () => void
}) {
  return (
    <div className="app-surface-inner rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              letter === 'A' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {letter}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">
              {currentPoint
                ? `${currentPoint.lat.toFixed(5)}, ${currentPoint.lng.toFixed(5)}`
                : 'Not set yet'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? 'Locating...' : `Use current location for ${letter}`}
        </button>
      </div>
    </div>
  )
}

const RoutePlannerCalculator = ({
  onError,
  MapComponent = DynamicRoutePlannerMap,
}: RoutePlannerCalculatorProps) => {
  const [origin, setOrigin] = useState<PlannerPoint | null>(null)
  const [destination, setDestination] = useState<PlannerPoint | null>(null)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [plannerState, setPlannerState] = useState<PlannerViewState>('placing_points')
  const [routeMessage, setRouteMessage] = useState<string | null>(null)
  const [controlMessage, setControlMessage] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle')
  const [userDiscountCard, setUserDiscountCard] = useState<DiscountCardDto | null>(null)
  const [locatingTarget, setLocatingTarget] = useState<'origin' | 'destination' | null>(null)
  const [fitBoundsToken, setFitBoundsToken] = useState(0)
  const { user } = useAuth()

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const lastRequestedPairRef = useRef<{
    origin: PlannerPoint
    destination: PlannerPoint
  } | null>(null)
  const shouldFitNextSuccessRef = useRef(true)

  const hasTwoPoints = Boolean(origin && destination)

  useEffect(() => {
    const fetchUserDiscountCard = async () => {
      if (!user) {
        setUserDiscountCard(null)
        return
      }

      try {
        const response = await fetch('/api/discount-cards/me')
        if (!response.ok) {
          setUserDiscountCard(null)
          return
        }

        const data: DiscountCardMeResponseDto = await response.json()
        if (data.hasDiscountCard && data.isValid && data.discountCard) {
          setUserDiscountCard(data.discountCard)
        } else {
          setUserDiscountCard(null)
        }
      } catch {
        setUserDiscountCard(null)
      }
    }

    fetchUserDiscountCard()
  }, [user])

  useEffect(() => {
    if (!origin || !destination) {
      if (!isCalculating) {
        setPlannerState('placing_points')
        setRouteMessage(null)
      }
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      void calculateRoute()
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      abortControllerRef.current?.abort()
    }
  }, [])

  const passengerType = userDiscountCard
    ? userDiscountCard.discountType === 'SENIOR_CITIZEN'
      ? 'SENIOR'
      : userDiscountCard.discountType
    : 'REGULAR'

  const resetCalculationState = () => {
    abortControllerRef.current?.abort()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    requestSequenceRef.current += 1
    lastRequestedPairRef.current = null
    setIsCalculating(false)
    setRouteResult(null)
    setRouteMessage(null)
    setSaveStatus('idle')
    setPlannerState('placing_points')
    shouldFitNextSuccessRef.current = true
  }

  const updateOrigin = (nextOrigin: PlannerPoint | null) => {
    setControlMessage(null)

    if (!nextOrigin) {
      setOrigin(null)
      resetCalculationState()
      return
    }

    setOrigin((current) => {
      if (
        pointsEffectivelyEqual(current, nextOrigin) &&
        (current?.label || '') === (nextOrigin.label || '')
      ) {
        return current
      }

      return nextOrigin
    })
  }

  const updateDestination = (nextDestination: PlannerPoint | null) => {
    setControlMessage(null)

    if (!nextDestination) {
      setDestination(null)
      resetCalculationState()
      return
    }

    setDestination((current) => {
      if (
        pointsEffectivelyEqual(current, nextDestination) &&
        (current?.label || '') === (nextDestination.label || '')
      ) {
        return current
      }

      return nextDestination
    })
  }

  const saveFareCalculation = async (
    result: RouteResult,
    fromLabel: string,
    toLabel: string,
  ) => {
    try {
      const response = await fetch('/api/fare-calculations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromLocation: fromLabel,
          toLocation: toLabel,
          distance: result.distanceKm,
          calculatedFare: result.fare,
          calculationType: 'Road Route Planner',
          routeData: {
            distance: {
              kilometers: result.distanceKm,
            },
            duration: {
              text: result.durationText,
            },
            polyline: result.polyline,
            source: result.sourceBadge,
            fareBreakdown: result.breakdown,
            farePolicy: result.farePolicy,
          },
          discountCardId: result.discountCard?.id || null,
          originalFare: result.originalFare || null,
          discountApplied: result.discountApplied || null,
          discountType: result.discountCard?.discountType || null,
        }),
      })

      setSaveStatus(response.ok ? 'saved' : 'failed')
    } catch {
      setSaveStatus('failed')
    }
  }

  const calculateRoute = async (force = false) => {
    if (!origin || !destination) return

    const nextPair = {
      origin,
      destination,
    }

    if (!force && routePairEffectivelyEqual(lastRequestedPairRef.current, nextPair)) {
      return
    }

    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    lastRequestedPairRef.current = nextPair

    setIsCalculating(true)
    setPlannerState('calculating')
    setRouteMessage(routeResult ? 'Keeping your last good route visible while recalculating.' : null)
    setControlMessage(null)

    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: { type: 'pin', lat: origin.lat, lng: origin.lng },
          destination: { type: 'pin', lat: destination.lat, lng: destination.lng },
          passengerType,
        }),
      })

      const data = (await response.json()) as Partial<CalculateRouteResponse> & { error?: string }

      if (requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        const message = data.error || 'Unable to calculate this route right now.'
        const nextState = classifyPlannerError(message)
        setPlannerState(nextState)
        setRouteMessage(
          nextState === 'out_of_service_area'
            ? 'Move the pin back into the Basey service area and try again.'
            : nextState === 'no_route_found'
              ? 'Move one of the pins closer to a road or try a different pair of points.'
              : 'Check your connection and try again. Your current pins stayed in place.',
        )
        if (onError) onError(message)
        return
      }

      const subtotal = (data.fareBreakdown?.baseFare || 0) + (data.fareBreakdown?.additionalFare || 0)
      const farePolicy = resolveFarePolicySnapshot(data.farePolicy)
      const nextResult: RouteResult = {
        fare: data.fare || 0,
        distanceKm: data.distanceKm || 0,
        durationMin: data.durationMin || 0,
        durationText: buildDurationText(data.durationMin ?? null),
        polyline: data.polyline || null,
        method: data.method || null,
        sourceBadge: getRouteSourceBadge(data.method ?? null, data.distanceKm || 0),
        fallbackReason: data.fallbackReason || null,
        originalFare: (data.fareBreakdown?.discount || 0) > 0 ? subtotal : undefined,
        discountApplied: (data.fareBreakdown?.discount || 0) > 0 ? data.fareBreakdown?.discount : undefined,
        discountRate: (data.fareBreakdown?.discount || 0) > 0 ? 0.2 : undefined,
        discountCard: userDiscountCard,
        farePolicy,
        breakdown: {
          baseFare: data.fareBreakdown?.baseFare || 0,
          additionalDistance: data.fareBreakdown?.additionalKm || 0,
          additionalFare: data.fareBreakdown?.additionalFare || 0,
        },
        originLabel: formatPointLabel(origin, data.origin || 'Pickup pin'),
        destinationLabel: formatPointLabel(destination, data.destination || 'Drop-off pin'),
      }

      setRouteResult(nextResult)
      setPlannerState(nextResult.method === 'gps' ? 'fallback_estimate' : 'route_ready')
      setRouteMessage(
        nextResult.method === 'gps'
          ? 'Showing a lower-confidence GPS estimate because road routing is unavailable right now.'
          : null,
      )

      if (shouldFitNextSuccessRef.current) {
        setFitBoundsToken((current) => current + 1)
        shouldFitNextSuccessRef.current = false
      }

      void saveFareCalculation(nextResult, nextResult.originLabel, nextResult.destinationLabel)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      const message = error instanceof Error ? error.message : 'Unable to calculate this route right now.'
      if (requestId !== requestSequenceRef.current) {
        return
      }

      setPlannerState('network_error')
      setRouteMessage('Check your connection and try again. Your current pins stayed in place.')
      if (onError) onError(message)
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsCalculating(false)
      }
    }
  }

  const useCurrentLocation = (target: 'origin' | 'destination') => {
    if (!navigator.geolocation) {
      setControlMessage('Current location is not available in this browser. You can still place pins directly on the map.')
      return
    }

    setControlMessage(null)
    setLocatingTarget(target)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: PlannerPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'Current location',
        }

        if (target === 'origin') {
          updateOrigin(point)
        } else {
          updateDestination(point)
        }

        setLocatingTarget(null)
      },
      () => {
        setControlMessage('Unable to read your current location. Please allow location access or place the pin manually.')
        setLocatingTarget(null)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    )
  }

  const handleSwap = () => {
    if (!origin || !destination) return

    setControlMessage(null)
    setOrigin(destination)
    setDestination(origin)
  }

  const handleReset = () => {
    setControlMessage(null)
    setOrigin(null)
    setDestination(null)
    resetCalculationState()
  }

  const errorPanelVisible =
    plannerState === 'network_error' ||
    plannerState === 'out_of_service_area' ||
    plannerState === 'no_route_found'

  return (
    <div className="mx-auto max-w-6xl">
      <div className="space-y-5 sm:space-y-6">
        <FareRateBanner />

        {routeResult && (
          <section className="app-surface-card-strong rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
                  Estimated fare
                </p>
                <div className="mt-2 text-4xl font-bold text-gray-900 sm:text-5xl">
                  {formatCurrency(routeResult.fare)}
                </div>

                {routeResult.discountApplied && routeResult.originalFare ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm text-gray-500 line-through">
                      {formatCurrency(routeResult.originalFare)}
                    </p>
                    <p className="text-sm font-medium text-emerald-700">
                      Saved {formatCurrency(routeResult.discountApplied)}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                <span className="app-surface-inner rounded-full px-3 py-1 text-sm font-medium text-gray-700">
                  {routeResult.distanceKm.toFixed(2)} km
                </span>
                <span className="app-surface-inner rounded-full px-3 py-1 text-sm font-medium text-gray-700">
                  {routeResult.durationText}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    routeResult.method === 'gps'
                      ? 'border border-amber-200 bg-amber-50 text-amber-800'
                      : 'border border-blue-200 bg-blue-50 text-blue-800'
                  }`}
                >
                  {routeResult.sourceBadge}
                </span>
              </div>
            </div>

            {routeResult.fallbackReason && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Lower-confidence estimate: road routing was unavailable for this request.
              </p>
            )}

            {saveStatus === 'saved' && (
              <p className="mt-3 text-xs text-gray-500">Saved to fare history.</p>
            )}

            <details className="app-surface-inner mt-4 rounded-2xl px-4 py-3 text-sm text-gray-700">
              <summary className="cursor-pointer font-medium text-gray-800">
                How fare was computed
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Base fare (first {routeResult.farePolicy.baseDistanceKm} km)</span>
                  <span>{formatCurrency(routeResult.breakdown.baseFare)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Additional distance</span>
                  <span>{routeResult.breakdown.additionalDistance.toFixed(2)} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>
                    Additional fare at {formatCurrency(routeResult.farePolicy.perKmRate)} per km
                  </span>
                  <span>{formatCurrency(routeResult.breakdown.additionalFare)}</span>
                </div>
              </div>
            </details>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="app-surface-card rounded-3xl p-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pin your route</h3>
              <p className="mt-1 text-sm text-gray-600">
                Use your current location or click the map to place A and B.
              </p>
            </div>

            <PointSetter
              title="Pickup"
              letter="A"
              currentPoint={origin}
              isLocating={locatingTarget === 'origin'}
              onUseCurrentLocation={() => useCurrentLocation('origin')}
            />

            <PointSetter
              title="Destination"
              letter="B"
              currentPoint={destination}
              isLocating={locatingTarget === 'destination'}
              onUseCurrentLocation={() => useCurrentLocation('destination')}
            />

            {controlMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {controlMessage}
              </div>
            )}

            {errorPanelVisible && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-medium">
                  {plannerState === 'out_of_service_area' && 'Pins are outside the service area.'}
                  {plannerState === 'no_route_found' && 'No route could be calculated from the current pins.'}
                  {plannerState === 'network_error' && 'The route service is unavailable right now.'}
                </p>
                {routeMessage && <p className="mt-1 text-xs text-red-700">{routeMessage}</p>}
                {hasTwoPoints && (
                  <button
                    type="button"
                    onClick={() => void calculateRoute(true)}
                    className="mt-3 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Try again
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSwap}
                disabled={!hasTwoPoints}
                className="app-surface-inner rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Swap A / B
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={!origin && !destination}
                className="app-surface-inner rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset route
              </button>
              <button
                type="button"
                onClick={() => updateOrigin(null)}
                disabled={!origin}
                className="app-surface-inner rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear A
              </button>
              <button
                type="button"
                onClick={() => updateDestination(null)}
                disabled={!destination}
                className="app-surface-inner rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear B
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              OpenRouteService is used first for road-aware planning. If it becomes unavailable, the planner will clearly label any lower-confidence GPS estimate.
            </div>
          </aside>

          <section className="app-surface-card rounded-3xl p-5">
            <MapComponent
              origin={origin}
              destination={destination}
              polyline={routeResult?.polyline}
              isCalculating={isCalculating}
              fitBoundsToken={fitBoundsToken}
              plannerState={plannerState}
              plannerMessage={routeMessage}
              onOriginChange={updateOrigin}
              onDestinationChange={updateDestination}
              className="h-[520px] w-full rounded-2xl border border-gray-200"
            />
          </section>
        </div>

        <section className="app-surface-card rounded-3xl p-5">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl text-blue-700">
              A to B
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
                  Route Planner
                </p>
                <h2 className="text-xl font-bold text-gray-900">Plan one route on one map</h2>
              </div>
              <p className="text-sm text-gray-600">
                Tap the map or use your location to set A and B.
              </p>
              <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 sm:text-sm">
                <span className="font-medium">Routing:</span>
                <span className="sm:hidden">ORS first, GPS fallback.</span>
                <span className="hidden sm:inline">
                  OpenRouteService first, GPS fallback only when road routing is unavailable.
                </span>
              </div>
              {userDiscountCard && (
                <div className="inline-flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-sm">
                  <span className="text-xl">Discount</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      {userDiscountCard.discountType === 'SENIOR_CITIZEN' && 'Senior Citizen discount active'}
                      {userDiscountCard.discountType === 'PWD' && 'PWD discount active'}
                      {userDiscountCard.discountType === 'STUDENT' && 'Student discount active'}
                    </p>
                    <p className="text-xs text-emerald-700">
                      {userDiscountCard.discountPercentage}% discount will be applied automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default RoutePlannerCalculator
