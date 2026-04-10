'use client'

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import dynamic from 'next/dynamic'

import { useAuth } from './AuthProvider'
import type { RoutePlannerMapProps } from './RoutePlannerMap'
import VehicleLookupField from './VehicleLookupField'
import type {
  DiscountCardDto,
  DiscountCardMeResponseDto,
  FareCalculationMutationResponseDto,
  FarePolicySnapshotDto,
  VehicleLookupDto,
} from '@/lib/contracts'
import { resolveFarePolicySnapshot } from '@/lib/fare/policy'
import type { ResolvedPinLabel } from '@/lib/locations/pinLabelResolver'
import {
  classifyPlannerError,
  getRouteSourceBadge,
  pointsEffectivelyEqual,
  routePairEffectivelyEqual,
  type PlannerPoint,
  type PlannerViewState,
} from '@/lib/planner/routePlanner'
import type { LocationInput } from '@/lib/routing/types'

const DynamicRoutePlannerMap = dynamic(() => import('./RoutePlannerMap'), { ssr: false }) as ComponentType<RoutePlannerMapProps>

type PlannerSelection = {
  point: PlannerPoint
  source: 'map'
}

interface RoutePlannerCalculatorProps {
  onError?: (error: string) => void
  MapComponent?: ComponentType<RoutePlannerMapProps>
}

interface CalculateRouteResponse {
  origin: string
  destination: string
  originResolved: ResolvedPinLabel | null
  destinationResolved: ResolvedPinLabel | null
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
  method: 'ors' | 'google_routes' | null
  provider: 'ors' | 'google_routes' | null
  isEstimate: boolean
  fallbackReason: string | null
  polyline: string | null
  inputMode: 'preset' | 'pin'
}

type CalculateRouteErrorCode =
  | 'INVALID_ROUTE_INPUT'
  | 'NO_ROAD_ROUTE_FOUND'
  | 'ROUTE_UNVERIFIED'
  | 'ROUTING_SERVICE_UNAVAILABLE'

interface RouteResult {
  fare: number
  distanceKm: number
  durationText: string
  durationMin: number
  polyline: string | null
  method: 'ors' | 'google_routes' | null
  provider: 'ors' | 'google_routes' | null
  isEstimate: boolean
  fallbackReason: string | null
  sourceBadge: string
  originalFare?: number
  discountApplied?: number
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

function buildDurationText(durationMin: number | null): string {
  if (durationMin == null) return 'N/A'
  return `${Math.round(durationMin)} min`
}

function buildPinSelection(point: PlannerPoint): PlannerSelection {
  return {
    point,
    source: 'map',
  }
}

function selectionToPoint(selection: PlannerSelection | null): PlannerPoint | null {
  return selection?.point || null
}

function selectionToLocationInput(selection: PlannerSelection): LocationInput {
  return {
    type: 'pin',
    lat: selection.point.lat,
    lng: selection.point.lng,
  }
}

function getSelectionLabel(selection: PlannerSelection | null, fallback: string): string {
  if (!selection) return fallback
  return selection.point.label?.trim() || fallback
}

function selectionsEffectivelyEqual(current: PlannerSelection | null, next: PlannerSelection | null): boolean {
  if (!current && !next) return true
  if (!current || !next) return false

  return pointsEffectivelyEqual(current.point, next.point) && (current.point.label || '') === (next.point.label || '')
}

function buildFareCalculationPayload(routeResult: RouteResult, vehicle: VehicleLookupDto | null) {
  return {
    fromLocation: routeResult.originLabel,
    toLocation: routeResult.destinationLabel,
    distance: routeResult.distanceKm,
    calculatedFare: routeResult.fare,
    calculationType: 'Road Route Planner',
    routeData: {
      method: routeResult.method,
      providerUsed: routeResult.provider,
      routeVerified: routeResult.method != null && !routeResult.isEstimate,
      isEstimate: routeResult.isEstimate,
      failureCode: null,
      fallbackReason: routeResult.fallbackReason,
      polylinePresent: Boolean(routeResult.polyline),
    },
    vehicleId: vehicle?.id || null,
    discountCardId: routeResult.discountCard?.id || null,
    originalFare: routeResult.originalFare || null,
    discountApplied: routeResult.discountApplied || null,
    discountType: routeResult.discountCard?.discountType || null,
  }
}

const RoutePlannerCalculator = ({
  onError,
  MapComponent = DynamicRoutePlannerMap,
}: RoutePlannerCalculatorProps) => {
  const [originSelection, setOriginSelection] = useState<PlannerSelection | null>(null)
  const [destinationSelection, setDestinationSelection] = useState<PlannerSelection | null>(null)
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [plannerState, setPlannerState] = useState<PlannerViewState>('placing_points')
  const [routeMessage, setRouteMessage] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [userDiscountCard, setUserDiscountCard] = useState<DiscountCardDto | null>(null)
  const [fitBoundsToken, setFitBoundsToken] = useState(0)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookupDto | null>(null)
  const [displayedRoutePair, setDisplayedRoutePair] = useState<{
    origin: PlannerPoint
    destination: PlannerPoint
  } | null>(null)
  const { user } = useAuth()

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const displayedRouteVersionRef = useRef(0)
  const lastRequestedPairRef = useRef<{
    origin: PlannerPoint
    destination: PlannerPoint
  } | null>(null)
  const shouldFitNextSuccessRef = useRef(true)

  const origin = useMemo(() => selectionToPoint(originSelection), [originSelection])
  const destination = useMemo(() => selectionToPoint(destinationSelection), [destinationSelection])
  const hasTwoPoints = Boolean(origin && destination)
  const errorPanelVisible =
    plannerState === 'network_error' ||
    plannerState === 'out_of_service_area' ||
    plannerState === 'no_route_found'
  const regularFare = routeResult?.originalFare || routeResult?.fare || null
  const hasFreshDisplayedRoute =
    origin && destination && displayedRoutePair
      ? routePairEffectivelyEqual(displayedRoutePair, { origin, destination })
      : false
  const canSaveDisplayedRoute =
    Boolean(user) &&
    Boolean(routeResult) &&
    routeResult?.method != null &&
    !routeResult?.isEstimate &&
    hasFreshDisplayedRoute &&
    !isCalculating &&
    plannerState === 'route_ready'

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

    void fetchUserDiscountCard()
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

  const resetRoute = () => {
    abortControllerRef.current?.abort()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    requestSequenceRef.current += 1
    displayedRouteVersionRef.current += 1
    lastRequestedPairRef.current = null
    shouldFitNextSuccessRef.current = true
    setOriginSelection(null)
    setDestinationSelection(null)
    setRouteResult(null)
    setDisplayedRoutePair(null)
    setRouteMessage(null)
    setPlannerState('placing_points')
    setIsCalculating(false)
    setSaveStatus('idle')
  }

  const refitRoute = () => {
    if (!origin && !destination) {
      return
    }

    setFitBoundsToken((current) => current + 1)
  }

  const calculateRoute = async (force = false) => {
    if (!origin || !destination || !originSelection || !destinationSelection) return

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

    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: selectionToLocationInput(originSelection),
          destination: selectionToLocationInput(destinationSelection),
          passengerType,
        }),
      })

      const data = (await response.json()) as Partial<CalculateRouteResponse> & {
        error?: string
        code?: CalculateRouteErrorCode
      }

      if (requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        const message = data.error || 'Unable to calculate this route right now.'
        const nextState = classifyPlannerError(message, data.code)
        setPlannerState(nextState)
        setRouteMessage(
          nextState === 'out_of_service_area'
            ? 'Pin outside the service area.'
            : nextState === 'no_route_found'
              ? message
              : 'Routing service unavailable right now.',
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
        provider: data.provider || null,
        isEstimate: data.isEstimate ?? false,
        fallbackReason: data.fallbackReason ?? null,
        sourceBadge: getRouteSourceBadge(data.method ?? null, data.distanceKm || 0),
        originalFare: (data.fareBreakdown?.discount || 0) > 0 ? subtotal : undefined,
        discountApplied: (data.fareBreakdown?.discount || 0) > 0 ? data.fareBreakdown?.discount : undefined,
        discountCard: userDiscountCard,
        farePolicy,
        breakdown: {
          baseFare: data.fareBreakdown?.baseFare || 0,
          additionalDistance: data.fareBreakdown?.additionalKm || 0,
          additionalFare: data.fareBreakdown?.additionalFare || 0,
        },
        originLabel: data.origin || getSelectionLabel(originSelection, 'Origin pin'),
        destinationLabel: data.destination || getSelectionLabel(destinationSelection, 'Destination pin'),
      }

      setRouteResult(nextResult)
      displayedRouteVersionRef.current += 1
      setDisplayedRoutePair(nextPair)
      setSaveStatus('idle')
      setPlannerState('route_ready')
      setRouteMessage(
        nextResult.method == null && nextResult.distanceKm === 0
          ? 'Origin and destination are the same point, so no road segment is needed.'
          : null,
      )

      if (shouldFitNextSuccessRef.current) {
        setFitBoundsToken((current) => current + 1)
        shouldFitNextSuccessRef.current = false
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      const message = error instanceof Error ? error.message : 'Unable to calculate this route right now.'
      if (requestId !== requestSequenceRef.current) {
        return
      }

      setPlannerState('network_error')
      setRouteMessage('Route service unavailable right now.')
      if (onError) onError(message)
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsCalculating(false)
      }
    }
  }

  const saveCurrentRoute = async () => {
    if (!routeResult || !canSaveDisplayedRoute) {
      return
    }

    const displayedRouteVersion = displayedRouteVersionRef.current
    setSaveStatus('saving')

    try {
      const response = await fetch('/api/fare-calculations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildFareCalculationPayload(routeResult, selectedVehicle)),
      })

      const data = (await response.json()) as Partial<FareCalculationMutationResponseDto> & {
        error?: string
      }

      if (displayedRouteVersion !== displayedRouteVersionRef.current) {
        return
      }

      if (!response.ok || !data.success) {
        setSaveStatus('failed')
        if (onError) {
          onError(data.error || 'Unable to save this route right now.')
        }
        return
      }

      setSaveStatus('saved')
    } catch {
      if (displayedRouteVersion === displayedRouteVersionRef.current) {
        setSaveStatus('failed')
      }
    }
  }

  const handleMapPointChange = (target: 'origin' | 'destination', point: PlannerPoint) => {
    const nextSelection = buildPinSelection(point)
    const currentSelection = target === 'origin' ? originSelection : destinationSelection

    if (selectionsEffectivelyEqual(currentSelection, nextSelection)) {
      return
    }

    displayedRouteVersionRef.current += 1
    setDisplayedRoutePair(null)
    setSaveStatus('idle')

    if (target === 'origin') {
      setOriginSelection(nextSelection)
      return
    }

    setDestinationSelection(nextSelection)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="space-y-4 sm:space-y-5">
        {user ? (
          <section className="app-surface-card-strong rounded-[2rem] border border-slate-200/80 p-3 sm:p-4">
            <div className="max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm">
              <VehicleLookupField
                label="Optional: Search by plate number (BPLO-issued)"
                placeholder="Search"
                selectedVehicle={selectedVehicle}
                onSelect={(vehicle) => setSelectedVehicle(vehicle)}
                onClearSelection={() => setSelectedVehicle(null)}
                requireActivePermit={false}
              />
              <p className="mt-2 px-1 text-xs leading-5 text-slate-600 sm:text-sm">
                If you select a plate number, the vehicle is saved with the trip for easier incident reporting.
              </p>
            </div>
          </section>
        ) : null}

        <section className="app-surface-card overflow-hidden rounded-[2rem] p-2 sm:p-3">
          <div className="relative">
            <MapComponent
              origin={origin}
              destination={destination}
              polyline={routeResult?.polyline}
              isCalculating={isCalculating}
              fitBoundsToken={fitBoundsToken}
              plannerState={plannerState}
              plannerMessage={routeMessage}
              onOriginChange={(point) => handleMapPointChange('origin', point)}
              onDestinationChange={(point) => handleMapPointChange('destination', point)}
              className="h-[520px] w-full rounded-[1.75rem] border border-slate-200 min-[420px]:h-[580px] lg:h-[680px]"
            />

            {routeResult ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[460] px-3 pb-3">
                <div className="pointer-events-auto mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200/90 bg-white/97 shadow-2xl backdrop-blur-md">
                  <div className="px-4 pt-3 sm:px-5">
                    <div className="mx-auto h-1.5 w-14 rounded-full bg-slate-300/75" />
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              routeResult.method == null
                                ? 'border border-slate-200 bg-slate-100 text-slate-700'
                                : 'border border-violet-200 bg-violet-100 text-violet-800'
                            }`}
                          >
                            {routeResult.sourceBadge}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                            {routeResult.method == null ? 'No road segment needed' : 'Shortest verified road route'}
                          </span>
                          {selectedVehicle ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                              {selectedVehicle.permitPlateNumber || selectedVehicle.plateNumber}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-lg font-semibold leading-tight text-slate-900 sm:text-[1.75rem]">
                          {routeResult.originLabel} <span className="text-slate-400">→</span> {routeResult.destinationLabel}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <span>{routeResult.durationText}</span>
                          <span className="text-slate-300">•</span>
                          <span>{routeResult.distanceKm.toFixed(2)} km</span>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-[1.4rem] bg-slate-950 px-4 py-3 text-right text-white shadow-lg">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Fare</p>
                        <p className="mt-1 text-2xl font-bold sm:text-3xl">{formatCurrency(routeResult.fare)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-b-[2rem] border-t border-slate-200 bg-slate-200/80">
                    <div className="bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Regular</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">
                        {regularFare ? formatCurrency(regularFare) : formatCurrency(routeResult.fare)}
                      </p>
                    </div>
                    <div className="bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Your fare</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700">{formatCurrency(routeResult.fare)}</p>
                    </div>
                    {routeResult.discountApplied ? (
                      <div className="bg-slate-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Discount</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-700">-{formatCurrency(routeResult.discountApplied)}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
                    <div className="text-xs text-slate-500">
                      {!user && 'Log in to save this route to your history.'}
                      {user && saveStatus === 'saved' && 'Saved to fare history.'}
                      {user && saveStatus === 'failed' && 'Unable to save this route right now.'}
                      {user && saveStatus === 'saving' && 'Saving to fare history...'}
                      {user && saveStatus === 'idle' && routeResult.method == null && 'Same-point results are not saved.'}
                      {user && saveStatus === 'idle' && canSaveDisplayedRoute && 'This result is not yet saved.'}
                      {user && saveStatus === 'idle' && !canSaveDisplayedRoute && routeResult.method != null && 'Resolve the current verified route before saving.'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveCurrentRoute()}
                        disabled={!canSaveDisplayedRoute || saveStatus === 'saving' || saveStatus === 'saved'}
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {!user
                          ? 'Log in to save'
                          : saveStatus === 'saved'
                            ? 'Saved'
                            : saveStatus === 'saving'
                              ? 'Saving...'
                              : 'Save to history'}
                      </button>
                      <button
                        type="button"
                        onClick={refitRoute}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Recenter route
                      </button>
                      <button
                        type="button"
                        onClick={resetRoute}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Reset pins
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {hasTwoPoints && !routeResult ? (
              <div className="pointer-events-none absolute bottom-3 right-3 z-[430]">
                <button
                  type="button"
                  onClick={resetRoute}
                  className="pointer-events-auto rounded-full border border-slate-200 bg-white/96 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-sm transition hover:bg-slate-50"
                >
                  Reset pins
                </button>
              </div>
            ) : null}

            <span className="sr-only">
              OpenRouteService shortest-distance road routing is required for this planner.
            </span>
          </div>
        </section>

        {errorPanelVisible ? (
          <section className="app-surface-card-strong rounded-[2rem] border border-slate-200/80 p-3 sm:p-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <p>
                {plannerState === 'out_of_service_area'
                  ? 'Pin outside the service area.'
                  : plannerState === 'no_route_found'
                    ? routeMessage || 'No road route could be found between these points.'
                    : 'Routing service unavailable right now.'}
              </p>
              {hasTwoPoints && plannerState === 'network_error' ? (
                <button
                  type="button"
                  onClick={() => void calculateRoute(true)}
                  className="mt-2 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  Try again
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default RoutePlannerCalculator
