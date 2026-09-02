'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from 'react'
import type { VehicleType } from '@prisma/client'
import dynamic from 'next/dynamic'
import useSWR from 'swr'

import { useAuth } from './AuthProvider'
import { DASHBOARD_ICONS, DashboardIconSlot } from './dashboardIcons'
import PlaceSearchList, { placeOptionId } from './PlaceSearchList'
import PublicRideTagScanner from './PublicRideTagScanner'
import RiderTripStatusPanel from './RiderTripStatusPanel'
import type { RoutePlannerMapProps } from './RoutePlannerMap'
import TripFields from './TripFields'
import VehicleLookupField from './VehicleLookupField'
import type {
  CuratedRouteCorpusDto,
  DiscountCardDto,
  DiscountCardMeResponseDto,
  FareCalculationMutationResponseDto,
  FarePolicySnapshotDto,
  PlannerLocationDto,
  RoutingPrimaryProviderDto,
  TripFlowConfigDto,
  VehicleLookupDto,
} from '@/lib/contracts'
import { resolveFarePolicySnapshot } from '@/lib/fare/policy'
import type { ResolvedPinLabel } from '@/lib/locations/pinLabelResolver'
import {
  CURRENT_LOCATION_MESSAGES,
  getCurrentLocationPoint,
  type CurrentLocationFailure,
} from '@/lib/locations/currentLocation'
import { buildPlaceRows, type PlaceOption } from '@/lib/locations/placeRows'
import {
  loadRecentPlaces,
  rememberRecentPlaces,
  type RecentEntry,
} from '@/lib/locations/recentPlaces'
import {
  classifyPlannerError,
  getRouteSourceBadge,
  pointsEffectivelyEqual,
  routePairEffectivelyEqual,
  type PlannerPoint,
  type PlannerViewState,
} from '@/lib/planner/routePlanner'
import {
  buildGpsSelection,
  buildPinSelection,
  buildPlaceSelection,
  selectionLabel,
  selectionToLocationInput,
  selectionToPoint,
  type PlannerSelection,
} from '@/lib/planner/selection'
import { calculateFare, getFareBreakdown } from '@/lib/fare/calculator'
import type { PassengerType } from '@/lib/routing/types'
import { loadLastFarePolicy, saveLastFarePolicy } from '@/lib/offline/farePolicyCache'
import { OFFLINE_CACHE_REASON, offlineUnpricedMessage } from '@/lib/offline/offlineQuote'
import {
  findCuratedCorpusRoute,
  loadCuratedCorpus,
  OFFLINE_CURATED_REASON,
  saveCuratedCorpus,
} from '@/lib/offline/curatedCorpus'
import { loadCachedRoute, routePairKeyForVehicle, saveCachedRoute } from '@/lib/offline/routeCache'
import { SWR_KEYS } from '@/lib/swrKeys'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const DynamicRoutePlannerMap = dynamic(() => import('./RoutePlannerMap'), { ssr: false }) as ComponentType<RoutePlannerMapProps>
const DynamicGoogleRoutePlannerMap = dynamic(() => import('./GoogleRoutePlannerMap'), {
  ssr: false,
}) as ComponentType<RoutePlannerMapProps>

type Slot = 'origin' | 'destination'

/**
 * The planner moves through three states rather than stacking everything above
 * a map: pick the ride, set the trip, read the fare.
 */
type Phase = 'vehicle' | 'trip' | 'fare'

interface RoutePlannerCalculatorProps {
  onError?: (error: string) => void
  MapComponent?: ComponentType<RoutePlannerMapProps>
  initialPrimaryProvider?: RoutingPrimaryProviderDto
}

interface PlannerLocationsResponse {
  success: boolean
  locations: PlannerLocationDto[]
  count: number
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
  vehicleType: VehicleType | null
  twoWheelerNotice: boolean
}

type CalculateRouteErrorCode =
  | 'INVALID_ROUTE_INPUT'
  | 'NO_ROAD_ROUTE_FOUND'
  | 'NO_VEHICLE_ACCESS'
  | 'NO_ROUTE_FOR_VEHICLE'
  | 'ROUTE_BLOCKED_BY_RESTRICTION'
  | 'ROUTE_UNVERIFIED'
  | 'ROUTING_SERVICE_UNAVAILABLE'

/** Where a ride can stop when the requested point is only reachable on foot. */
type DropoffSuggestion = {
  field: Slot
  lat: number
  lng: number
  label: string
  walkMeters: number
}

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
  /** Google requires a beta notice wherever a two-wheeled route is shown. */
  twoWheelerNotice: boolean
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

type IdentityInputMode = 'idle' | 'scan' | 'manual'

/**
 * The two rides this ordinance system is deployed for.
 *
 * Basey FareCheck is distributed to tricycle and habal-habal operators; the
 * other types the server enum knows about have no fleet behind them here. A
 * habal-habal takes trails a tricycle cannot, so this choice moves the distance
 * and therefore the fare — which is why it is asked first rather than offered
 * as an optional refinement.
 */
const VEHICLE_TYPE_CHOICES: Array<{
  value: VehicleType
  label: string
  icon: keyof typeof DASHBOARD_ICONS
  hint: string
}> = [
  {
    value: 'TRICYCLE',
    label: 'Tricycle',
    icon: 'tricycle',
    hint: 'Roads and paved streets',
  },
  {
    value: 'HABAL_HABAL',
    label: 'Habal-habal',
    icon: 'motorbike',
    hint: 'Reaches trails a tricycle cannot',
  },
]

const VEHICLE_TYPE_VALUES = new Set<string>([
  'TRICYCLE',
  'HABAL_HABAL',
  'JEEPNEY',
  'MULTICAB',
  'VAN',
  'BUS',
])

/** VehicleLookupDto types its vehicleType loosely, so narrow it before use. */
function toVehicleType(value: string | null | undefined): VehicleType | null {
  return value && VEHICLE_TYPE_VALUES.has(value) ? (value as VehicleType) : null
}

/**
 * A scanned plate can still name a type with no card on this screen. Show what
 * it says rather than refusing the scan.
 */
function vehicleTypeLabel(type: VehicleType): string {
  const choice = VEHICLE_TYPE_CHOICES.find((entry) => entry.value === type)
  if (choice) return choice.label
  const spaced = type.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const PHASE_TITLES: Record<Phase, string> = {
  vehicle: 'How are you riding?',
  trip: 'Your trip',
  fare: 'Your fare',
}

function formatCurrency(value: number): string {
  return `PHP ${value.toFixed(2)}`
}

function buildDurationText(durationMin: number | null): string {
  if (durationMin == null) return 'N/A'
  return `${Math.round(durationMin)} min`
}

function selectionsEffectivelyEqual(
  current: PlannerSelection | null,
  next: PlannerSelection | null,
): boolean {
  if (!current && !next) return true
  if (!current || !next) return false

  // Two selections on the same spot are still different requests when one is a
  // named place and the other a raw pin: only the named one is sent as a preset.
  if ((current.place?.id ?? null) !== (next.place?.id ?? null)) return false

  return (
    pointsEffectivelyEqual(current.point, next.point) &&
    (current.point.label || '') === (next.point.label || '')
  )
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
    farePolicySnapshot: routeResult.farePolicy,
  }
}

/**
 * Search first, map on request.
 *
 * The planner used to be a map with everything stacked above it, and the only
 * way to set a trip was to place two pins — the 154 curated barangays and
 * landmarks the API already serves were invisible. A rider almost always knows
 * the name of where they are going, so the name is the input now, and the map
 * is a tool they open: to drop a pin where no name exists, or to look at the
 * route once it has been measured.
 */
const RoutePlannerCalculator = ({
  onError,
  MapComponent,
  initialPrimaryProvider = 'ors',
}: RoutePlannerCalculatorProps) => {
  const ResolvedMapComponent =
    MapComponent ??
    (initialPrimaryProvider === 'google_routes'
      ? DynamicGoogleRoutePlannerMap
      : DynamicRoutePlannerMap)

  const [phase, setPhase] = useState<Phase>('vehicle')
  const [originSelection, setOriginSelection] = useState<PlannerSelection | null>(null)
  const [destinationSelection, setDestinationSelection] = useState<PlannerSelection | null>(null)
  const [activeField, setActiveField] = useState<Slot | null>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [mapOpen, setMapOpen] = useState(false)
  /** Which end a map click fills. Null means the map is a read-only preview. */
  const [mapPickTarget, setMapPickTarget] = useState<Slot | null>(null)
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [plannerState, setPlannerState] = useState<PlannerViewState>('placing_points')
  const [routeMessage, setRouteMessage] = useState<string | null>(null)
  const [dropoffSuggestion, setDropoffSuggestion] = useState<DropoffSuggestion | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [pendingTripRequestId, setPendingTripRequestId] = useState<string | null>(null)
  const [userDiscountCard, setUserDiscountCard] = useState<DiscountCardDto | null>(null)
  const [fitBoundsToken, setFitBoundsToken] = useState(0)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleLookupDto | null>(null)
  const [chosenVehicleType, setChosenVehicleType] = useState<VehicleType | null>(null)
  const [identityInputMode, setIdentityInputMode] = useState<IdentityInputMode>('idle')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'ready' | 'failed'>('idle')
  const [locationFailure, setLocationFailure] = useState<CurrentLocationFailure | null>(null)
  const [displayedRoutePair, setDisplayedRoutePair] = useState<{
    origin: PlannerPoint
    destination: PlannerPoint
  } | null>(null)
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const listboxId = useId()

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestSequenceRef = useRef(0)
  const displayedRouteVersionRef = useRef(0)
  /**
   * The pair *and* the ride the last request was for. The vehicle belongs in
   * this key: without it, changing the ride re-runs the effect and then falls
   * straight out of the dedupe below, so the fare never moves.
   */
  const lastRequestedRef = useRef<{
    pair: { origin: PlannerPoint; destination: PlannerPoint }
    vehicleType: VehicleType | null
  } | null>(null)
  const shouldFitNextSuccessRef = useRef(true)

  // A scanned or looked-up plate knows its own type, so it overrides the
  // chooser rather than sitting alongside it and disagreeing.
  const vehicleTypeFromPlate = toVehicleType(
    typeof selectedVehicle?.vehicleType === 'string' ? selectedVehicle.vehicleType : null,
  )
  const vehicleType = vehicleTypeFromPlate ?? chosenVehicleType

  const { data: locationsData, error: locationsError, isLoading: locationsLoading } =
    useSWR<PlannerLocationsResponse>(SWR_KEYS.plannerLocations)
  const places = useMemo(() => locationsData?.locations ?? [], [locationsData])

  // Fetched on mount rather than on demand: its whole purpose is to already be
  // on the device by the time the connection drops. A failure is silent — the
  // offline path simply falls back to the route cache.
  const { data: curatedCorpus } = useSWR<CuratedRouteCorpusDto>(SWR_KEYS.curatedRouteCorpus)
  // Which vehicle types the municipality has suspended from the driver session
  // flow. For those the scan itself starts the trip — no driver taps Accept.
  const { data: tripFlowConfig } = useSWR<TripFlowConfigDto>(SWR_KEYS.tripFlowConfig)
  const riderConfirmsTrip = Boolean(
    selectedVehicle?.vehicleType &&
      tripFlowConfig?.suspendedVehicleTypes?.includes(
        selectedVehicle.vehicleType as VehicleType,
      ),
  )

  useEffect(() => {
    if (curatedCorpus) {
      saveCuratedCorpus(curatedCorpus)
    }
  }, [curatedCorpus])

  const origin = useMemo(() => selectionToPoint(originSelection), [originSelection])
  const destination = useMemo(() => selectionToPoint(destinationSelection), [destinationSelection])
  const hasTwoPoints = Boolean(origin && destination)
  const errorPanelVisible =
    plannerState === 'network_error' ||
    plannerState === 'out_of_service_area' ||
    plannerState === 'no_route_found' ||
    // Both of these were classified and then rendered nowhere, so the rider was
    // shown a blank result with no explanation.
    plannerState === 'no_route_for_vehicle' ||
    plannerState === 'route_blocked'
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
    Boolean(selectedVehicle) &&
    plannerState === 'route_ready'

  const { rows, options, isFuzzy, searching } = useMemo(
    () =>
      buildPlaceRows({
        places,
        recents,
        query,
        originCoordinates: origin ? { lat: origin.lat, lng: origin.lng } : null,
      }),
    [places, recents, query, origin],
  )

  const activeOptionId =
    activeIndex >= 0 && options[activeIndex]
      ? placeOptionId(listboxId, options[activeIndex].key)
      : null

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

  // Recents are per rider: one machine gets shared, and signing in as someone
  // else should not inherit their trips.
  useEffect(() => {
    setRecents(user?.id ? loadRecentPlaces(user.id) : [])
  }, [user?.id])

  useEffect(() => {
    if (!origin || !destination) {
      if (!isCalculating) {
        setPlannerState('placing_points')
        setRouteMessage(null)
      }
      return
    }

    // Show the measuring state rather than a list the rider has finished with.
    setPhase('fare')
    setActiveField(null)
    setQuery('')

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
    // vehicleType is a dependency because a habal-habal and a tricycle do not
    // take the same roads: changing it changes the distance and the fare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, vehicleType])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      abortControllerRef.current?.abort()
    }
  }, [])

  const passengerType: PassengerType = userDiscountCard
    ? userDiscountCard.discountType === 'SENIOR_CITIZEN'
      ? 'SENIOR'
      : (userDiscountCard.discountType as PassengerType)
    : 'REGULAR'

  const passengerLabel = userDiscountCard
    ? userDiscountCard.discountType === 'SENIOR_CITIZEN'
      ? 'Senior citizen fare'
      : userDiscountCard.discountType === 'STUDENT'
        ? 'Student fare'
        : 'PWD fare'
    : 'Regular fare'

  const resetRoute = () => {
    abortControllerRef.current?.abort()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    requestSequenceRef.current += 1
    displayedRouteVersionRef.current += 1
    lastRequestedRef.current = null
    shouldFitNextSuccessRef.current = true
    setOriginSelection(null)
    setDestinationSelection(null)
    setRouteResult(null)
    setDisplayedRoutePair(null)
    setRouteMessage(null)
    setPlannerState('placing_points')
    setIsCalculating(false)
    setSaveStatus('idle')
    setPendingTripRequestId(null)
    setDropoffSuggestion(null)
    setQuery('')
    setActiveIndex(-1)
    // Clearing from the ride step is still just clearing: it must not skip the
    // rider past a choice they have not made yet.
    if (phase === 'vehicle') {
      setActiveField(null)
    } else {
      setPhase('trip')
      setActiveField('origin')
    }
  }

  const refitRoute = () => {
    if (!origin && !destination) {
      return
    }

    setFitBoundsToken((current) => current + 1)
  }

  /**
   * Price the trip from a distance the server measured, or say we cannot.
   *
   * There is deliberately no estimating fallback here. This used to degrade to
   * an on-device road graph and then to straight-line distance x 1.4, both of
   * which produce a number that disagrees with the server's. Under Ordinance
   * 105 that disagreement is an argument between a rider and a driver at the
   * roadside, so the only offline fare we will show is one the server itself
   * measured. Everything else shows the official rates and no fare at all.
   *
   * Two sources qualify, in this order:
   *
   * 1. The curated corpus, when both ends are saved places. This is the same
   *    tier `resolveRouteForQuote` consults before any routing engine, so the
   *    answer equals the one the rider would have got online — and it answers
   *    for pairs this browser has never requested.
   * 2. A route this browser measured online earlier, which is all a dropped pin
   *    or a GPS fix can ever have.
   */
  const applyOfflineQuote = async (
    nextPair: { origin: PlannerPoint; destination: PlannerPoint },
    requestId: number,
  ) => {
    if (requestId !== requestSequenceRef.current) return

    const originCoord = { lat: nextPair.origin.lat, lng: nextPair.origin.lng }
    const destCoord = { lat: nextPair.destination.lat, lng: nextPair.destination.lng }
    const lastPolicy = loadLastFarePolicy()

    /** Builds the result both offline sources share, differing only in provenance. */
    const buildResult = (
      source: {
        distanceKm: number
        durationMin: number | null
        polyline: string | null
        farePolicy: FarePolicySnapshotDto
        fallbackReason: string
        sourceBadge: string
      },
    ): RouteResult => {
      const fare = calculateFare(source.distanceKm, passengerType, source.farePolicy)
      const breakdown = getFareBreakdown(source.distanceKm, passengerType, source.farePolicy)
      const subtotal = breakdown.baseFare + breakdown.additionalFare
      const hasDiscount = breakdown.discount > 0

      return {
        fare,
        distanceKm: source.distanceKm,
        durationMin: source.durationMin ?? 0,
        durationText: buildDurationText(source.durationMin),
        polyline: source.polyline,
        method: null,
        provider: null,
        // Not an estimate either way: both are distances the server measured.
        isEstimate: false,
        fallbackReason: source.fallbackReason,
        sourceBadge: source.sourceBadge,
        twoWheelerNotice: false,
        originalFare: hasDiscount ? subtotal : undefined,
        discountApplied: hasDiscount ? breakdown.discount : undefined,
        discountCard: userDiscountCard,
        farePolicy: source.farePolicy,
        breakdown: {
          baseFare: breakdown.baseFare,
          additionalDistance: breakdown.additionalKm,
          additionalFare: breakdown.additionalFare,
        },
        originLabel: nextPair.origin.label || 'Start',
        destinationLabel: nextPair.destination.label || 'Destination',
      }
    }

    const commit = (nextResult: RouteResult, message: string) => {
      setRouteResult(nextResult)
      displayedRouteVersionRef.current += 1
      setDisplayedRoutePair(nextPair)
      setSaveStatus('idle')
      setPlannerState('route_ready')
      setRouteMessage(message)

      if (shouldFitNextSuccessRef.current) {
        setFitBoundsToken((current) => current + 1)
        shouldFitNextSuccessRef.current = false
      }
    }

    // 1. The surveyed corpus. Only saved places carry the location ids it is
    // keyed by, which is why a dropped pin can never be answered from here.
    const curated = findCuratedCorpusRoute(
      loadCuratedCorpus(),
      originSelection?.place?.id,
      destinationSelection?.place?.id,
      vehicleType,
    )

    if (curated) {
      // The corpus stores a distance, not a quote: a survey does not expire
      // when the rates change. So it is priced with the newest policy this
      // browser has seen rather than one captured alongside the measurement.
      commit(
        buildResult({
          distanceKm: curated.distanceKm,
          durationMin: curated.durationMin,
          // The corpus omits geometry, so there is no line to draw.
          polyline: null,
          farePolicy: resolveFarePolicySnapshot(lastPolicy),
          fallbackReason: OFFLINE_CURATED_REASON,
          sourceBadge: 'Offline (surveyed distance)',
        }),
        'Offline — using the surveyed distance for this pair, the same one the server would quote.',
      )
      return
    }

    // 2. A route this browser measured online earlier.
    const cached = await loadCachedRoute(
      routePairKeyForVehicle(originCoord, destCoord, vehicleType),
    )

    // A newer request superseded this one while awaiting.
    if (requestId !== requestSequenceRef.current) return

    if (!cached) {
      setRouteResult(null)
      setPlannerState('network_error')
      setRouteMessage(offlineUnpricedMessage(lastPolicy))
      return
    }

    commit(
      buildResult({
        distanceKm: cached.distanceKm,
        durationMin: cached.durationMin,
        polyline: cached.polyline,
        // The policy stored with the route wins: it was in force when the
        // distance was measured. Recomputing the fare here rather than caching
        // it is what stops a rate change replaying yesterday's price.
        farePolicy: resolveFarePolicySnapshot(cached.farePolicy ?? lastPolicy),
        fallbackReason: OFFLINE_CACHE_REASON,
        sourceBadge: 'Offline (your last verified route)',
      }),
      'Offline — replaying the verified route you already measured for this pair.',
    )
  }

  const calculateRoute = async (force = false) => {
    if (!origin || !destination || !originSelection || !destinationSelection) return

    const nextPair = {
      origin,
      destination,
    }

    if (
      !force &&
      lastRequestedRef.current &&
      lastRequestedRef.current.vehicleType === vehicleType &&
      routePairEffectivelyEqual(lastRequestedRef.current.pair, nextPair)
    ) {
      return
    }

    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    lastRequestedRef.current = { pair: nextPair, vehicleType }

    setIsCalculating(true)
    setPlannerState('calculating')
    setRouteMessage(routeResult ? 'Keeping your last good route visible while recalculating.' : null)

    // No connection: skip the round-trip and answer from what we already have.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await applyOfflineQuote(nextPair, requestId)
      if (requestId === requestSequenceRef.current) {
        setIsCalculating(false)
      }
      return
    }

    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: selectionToLocationInput(originSelection),
          destination: selectionToLocationInput(destinationSelection),
          passengerType,
          vehicleType,
        }),
      })

      const data = (await response.json()) as Partial<CalculateRouteResponse> & {
        message?: string
        code?: CalculateRouteErrorCode
        details?: {
          field?: Slot
          dropoff?: { lat: number; lng: number; label: string; walkMeters: number }
        }
      }

      if (requestId !== requestSequenceRef.current) {
        return
      }

      if (!response.ok) {
        const message = data.message || 'Unable to calculate this route right now.'
        const nextState = classifyPlannerError(message, data.code)
        const dropoff = data.details?.dropoff
        setPlannerState(nextState)
        setDropoffSuggestion(
          nextState === 'no_vehicle_access' && dropoff
            ? { field: data.details?.field ?? 'destination', ...dropoff }
            : null,
        )
        setRouteMessage(
          nextState === 'out_of_service_area'
            ? 'Pin outside the service area.'
            : nextState === 'no_route_found' ||
                nextState === 'no_vehicle_access' ||
                nextState === 'no_route_for_vehicle' ||
                nextState === 'route_blocked'
              ? message
              : 'Routing service unavailable right now.',
        )
        if (onError) onError(message)
        return
      }

      setDropoffSuggestion(null)

      const subtotal = (data.fareBreakdown?.baseFare || 0) + (data.fareBreakdown?.additionalFare || 0)
      const farePolicy = resolveFarePolicySnapshot(data.farePolicy)
      // Cache the live policy so offline estimates price with the real rates.
      saveLastFarePolicy(farePolicy)
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
        twoWheelerNotice: data.twoWheelerNotice ?? false,
        originalFare: (data.fareBreakdown?.discount || 0) > 0 ? subtotal : undefined,
        discountApplied: (data.fareBreakdown?.discount || 0) > 0 ? data.fareBreakdown?.discount : undefined,
        discountCard: userDiscountCard,
        farePolicy,
        breakdown: {
          baseFare: data.fareBreakdown?.baseFare || 0,
          additionalDistance: data.fareBreakdown?.additionalKm || 0,
          additionalFare: data.fareBreakdown?.additionalFare || 0,
        },
        originLabel: data.origin || selectionLabel(originSelection, 'Origin pin'),
        destinationLabel: data.destination || selectionLabel(destinationSelection, 'Destination pin'),
      }

      setRouteResult(nextResult)
      displayedRouteVersionRef.current += 1
      setDisplayedRoutePair(nextPair)
      setSaveStatus('idle')
      setPlannerState('route_ready')

      // Only places that actually produced a fare are worth offering back.
      if (user?.id) {
        setRecents(rememberRecentPlaces(user.id, [originSelection, destinationSelection]))
      }

      // Persist verified routes for exact offline replay of the same pin pair.
      // Keyed by vehicle to match the read side: a habal-habal route is not a
      // tricycle route, and an unscoped write can never be found again.
      if (nextResult.method != null) {
        void saveCachedRoute(
          routePairKeyForVehicle(
            { lat: nextPair.origin.lat, lng: nextPair.origin.lng },
            { lat: nextPair.destination.lat, lng: nextPair.destination.lng },
            vehicleType,
          ),
          {
            distanceKm: nextResult.distanceKm,
            durationMin: data.durationMin ?? null,
            polyline: nextResult.polyline,
            farePolicy,
          },
        )
      }
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

      // Network/API unreachable — fall back to a route this browser already
      // measured, or state plainly that no fare can be given.
      await applyOfflineQuote(nextPair, requestId)
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
        message?: string
      }

      if (displayedRouteVersion !== displayedRouteVersionRef.current) {
        return
      }

      if (!response.ok || !data.success) {
        setSaveStatus('failed')
        if (onError) {
          onError(data.message || 'Unable to save this route right now.')
        }
        return
      }

      setSaveStatus('saved')
      setPendingTripRequestId(data.tripRequestId ?? null)
    } catch {
      if (displayedRouteVersion === displayedRouteVersionRef.current) {
        setSaveStatus('failed')
      }
    }
  }

  const applySelection = (target: Slot, nextSelection: PlannerSelection) => {
    const currentSelection = target === 'origin' ? originSelection : destinationSelection

    if (selectionsEffectivelyEqual(currentSelection, nextSelection)) {
      return
    }

    displayedRouteVersionRef.current += 1
    setDisplayedRoutePair(null)
    setSaveStatus('idle')
    setPendingTripRequestId(null)
    setDropoffSuggestion(null)

    if (target === 'origin') {
      setOriginSelection(nextSelection)
      return
    }

    setDestinationSelection(nextSelection)
  }

  const handleMapPointChange = (
    target: Slot,
    point: PlannerPoint,
    source: 'map' | 'gps' = 'map',
  ) => {
    applySelection(target, source === 'gps' ? buildGpsSelection(point) : buildPinSelection(point))

    // Closing belongs to the pick flow: one click and the rider is done. In the
    // route preview (no pick target) the map is what they came to look at, and
    // the helper text invites them to drag A or B — so it stays open and
    // recalculates in place.
    if (source === 'map' && mapPickTarget) {
      setMapOpen(false)
      setMapPickTarget(null)
    }
  }

  /**
   * Fills the pickup from the browser's own geolocation.
   *
   * A prefill, never a lock: the rider can still search, or open the map and
   * place the pin themselves, and a refusal leaves the planner exactly as it
   * behaved before GPS existed.
   */
  const acquireCurrentLocationOrigin = async () => {
    setLocationStatus('locating')
    setLocationFailure(null)

    const result = await getCurrentLocationPoint()

    if (!result.ok) {
      setLocationStatus('failed')
      setLocationFailure(result.reason)
      return
    }

    setLocationStatus('ready')
    applySelection('origin', buildGpsSelection(result.point))
    // Frame the pin now. Waiting for a destination would leave the rider
    // looking at the whole municipality with their own pickup off-screen.
    setFitBoundsToken((current) => current + 1)
  }

  useEffect(() => {
    // Only ever a prefill for an empty planner — a re-run would fight the rider
    // for the origin pin, so this is mount-only by design. It runs while the
    // rider is still choosing a ride, so the pickup is usually already resolved
    // by the time the trip step appears.
    if (originSelection) return
    void acquireCurrentLocationOrigin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goToTrip = () => {
    setPhase('trip')
    setQuery('')
    setActiveIndex(-1)
    setActiveField(originSelection ? 'destination' : 'origin')
  }

  const chooseVehicleType = (value: VehicleType) => {
    setChosenVehicleType(value)
    goToTrip()
  }

  const handleVehicleSelected = (vehicle: VehicleLookupDto) => {
    setSelectedVehicle(vehicle)
    // A scanned plate carries its own type, so the ride is settled either way.
    if (phase === 'vehicle') goToTrip()
  }

  const focusField = (slot: Slot) => {
    setActiveField(slot)
    setQuery('')
    setActiveIndex(-1)
  }

  const selectOption = (option: PlaceOption) => {
    const slot = activeField ?? 'destination'
    const selection =
      option.type === 'place' ? buildPlaceSelection(option.place) : buildPinSelection(option.point)
    const current = slot === 'origin' ? originSelection : destinationSelection
    const other: Slot = slot === 'origin' ? 'destination' : 'origin'
    const otherFilled = Boolean(other === 'origin' ? originSelection : destinationSelection)

    setQuery('')
    setActiveIndex(-1)

    // Re-picking what is already there must not clear a fare the quote effect
    // will not recompute — the request is unchanged, so it would never re-fire
    // and the rider would be left looking at an empty result.
    if (selectionsEffectivelyEqual(current, selection)) {
      setActiveField(otherFilled ? null : other)
      if (otherFilled) setPhase('fare')
      return
    }

    applySelection(slot, selection)
    // Move to the end still empty, so a two-tap trip needs no third tap.
    setActiveField(otherFilled ? null : other)
  }

  const clearSlot = (slot: Slot) => {
    displayedRouteVersionRef.current += 1
    setDisplayedRoutePair(null)
    setSaveStatus('idle')
    setPendingTripRequestId(null)
    setDropoffSuggestion(null)
    setRouteResult(null)
    if (slot === 'origin') setOriginSelection(null)
    else setDestinationSelection(null)
    focusField(slot)
  }

  const swapEnds = () => {
    displayedRouteVersionRef.current += 1
    setDisplayedRoutePair(null)
    setSaveStatus('idle')
    setPendingTripRequestId(null)
    setDropoffSuggestion(null)
    setOriginSelection(destinationSelection)
    setDestinationSelection(originSelection)
    setQuery('')
    setActiveIndex(-1)
  }

  const openMapToPick = (slot: Slot) => {
    setActiveField(null)
    setMapPickTarget(slot)
    setMapOpen(true)
  }

  const openRoutePreview = () => {
    setMapPickTarget(null)
    setMapOpen(true)
  }

  const closeMap = useCallback(() => {
    setMapOpen(false)
    setMapPickTarget(null)
  }, [])

  const editTrip = (slot: Slot) => {
    setPhase('trip')
    setQuery('')
    setActiveIndex(-1)
    setActiveField(slot)
  }

  /** One step back through the phases; false means the planner is already at the start. */
  const stepBack = (): boolean => {
    if (mapOpen) {
      closeMap()
      return true
    }
    if (phase === 'fare') {
      setPhase('trip')
      setActiveField(null)
      return true
    }
    if (phase === 'trip') {
      setPhase('vehicle')
      setActiveField(null)
      return true
    }
    return false
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, options.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, -1))
      return
    }
    if (event.key === 'Enter') {
      const option = activeIndex >= 0 ? options[activeIndex] : undefined
      if (option) {
        event.preventDefault()
        selectOption(option)
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery('')
      setActiveIndex(-1)
      setActiveField(null)
    }
  }

  // Escape closes the map the same way it closes the list.
  useEffect(() => {
    if (!mapOpen) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMap()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mapOpen, closeMap])

  const identitySection = (
    <div className="space-y-3">
      {selectedVehicle ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {selectedVehicle.permitPlateNumber || selectedVehicle.plateNumber}
            </p>
            <p className="truncate text-xs text-slate-500">
              {[selectedVehicle.vehicleType, selectedVehicle.make, selectedVehicle.model]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedVehicle(null)
              setIdentityInputMode('idle')
            }}
            className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          {identityInputMode === 'idle' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIdentityInputMode('scan')}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Scan operator QR
              </button>
              <button
                type="button"
                onClick={() => setIdentityInputMode('manual')}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Can&apos;t scan? Search manually
              </button>
            </div>
          ) : null}

          {identityInputMode === 'scan' ? (
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Operator QR scanner</p>
                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    Scan the permit QR sticker on the vehicle, then confirm the operator
                    details here.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIdentityInputMode('idle')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Choose another option
                </button>
              </div>

              <div className="mt-4">
                <PublicRideTagScanner
                  autoStart
                  embedded
                  selectedVehicle={selectedVehicle}
                  onUseVehicle={handleVehicleSelected}
                  onClearVehicle={() => setSelectedVehicle(null)}
                />
              </div>
            </div>
          ) : null}

          {identityInputMode === 'manual' ? (
            <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Manual vehicle lookup</p>
                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    Use manual search for damaged stickers, older vehicles, or camera issues.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIdentityInputMode('idle')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Choose another option
                </button>
              </div>

              <VehicleLookupField
                label="Search manually by plate number"
                placeholder="Search"
                selectedVehicle={selectedVehicle}
                onSelect={handleVehicleSelected}
                onClearSelection={() => setSelectedVehicle(null)}
                requireActivePermit={false}
              />
              <p className="px-1 text-xs text-slate-600 sm:text-sm">
                If you select a plate number, the vehicle is saved with the trip for easier incident
                reporting.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  )

  return (
    <div className="w-full">
      <div className="space-y-4">
        {!isOnline ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 sm:text-sm">
            Offline — a straight-line fare estimate still works. Routes show as estimates until you
            reconnect.
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepBack()}
            disabled={phase === 'vehicle'}
            aria-label="Go back"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DashboardIconSlot icon={DASHBOARD_ICONS.back} size={18} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900">
            {PHASE_TITLES[phase]}
          </h2>
          {originSelection || destinationSelection ? (
            <button
              type="button"
              onClick={resetRoute}
              className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          ) : null}
        </div>

        {phase === 'vehicle' ? (
          <section className="space-y-4 rounded-[2rem] border border-surface-border bg-surface p-4 shadow-card">
            <p className="text-sm leading-6 text-slate-600">
              A habal-habal can take trails a tricycle cannot, so the ride you pick changes the
              distance and the fare.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {VEHICLE_TYPE_CHOICES.map((choice) => {
                const isSelected = vehicleType === choice.value
                const locked = Boolean(vehicleTypeFromPlate)

                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={locked}
                    onClick={() => chooseVehicleType(choice.value)}
                    className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed ${
                      isSelected
                        ? 'border-primary bg-surface-tint'
                        : 'border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50'
                    }`}
                  >
                    <span
                      className={`mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
                        isSelected ? 'bg-primary text-white' : 'bg-surface-tint text-primary-dark'
                      }`}
                    >
                      <DashboardIconSlot icon={DASHBOARD_ICONS[choice.icon]} size={26} />
                    </span>
                    <span className="text-base font-bold text-slate-900">{choice.label}</span>
                    <span className="text-xs text-slate-500">{choice.hint}</span>
                  </button>
                )
              })}
            </div>

            {vehicleTypeFromPlate ? (
              <p className="text-xs text-slate-500">
                Taken from the plate you selected: {vehicleTypeLabel(vehicleTypeFromPlate)}.
              </p>
            ) : null}

            {user ? (
              <div className="space-y-2 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Driver (optional)
                </p>
                {identitySection}
                <p className="text-xs text-slate-500">
                  Only needed to send the driver a trip request. Skip it to check a fare.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {phase === 'trip' ? (
          <section className="space-y-3">
            <TripFields
              origin={originSelection}
              destination={destinationSelection}
              activeField={activeField}
              query={query}
              onQueryChange={(value) => {
                setQuery(value)
                setActiveIndex(-1)
              }}
              onFocusField={focusField}
              onClear={clearSlot}
              onSwap={swapEnds}
              onPickOnMap={openMapToPick}
              onKeyDown={handleSearchKeyDown}
              listboxId={listboxId}
              activeOptionId={activeOptionId}
              listboxExpanded={options.length > 0}
              locating={locationStatus === 'locating'}
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-tint px-2.5 py-1 text-xs font-semibold text-primary-dark">
                <DashboardIconSlot icon={DASHBOARD_ICONS.discount} size={13} />
                {passengerLabel}
              </span>
              {vehicleType ? (
                <span className="text-xs text-slate-500">{vehicleTypeLabel(vehicleType)}</span>
              ) : null}
            </div>

            {locationStatus === 'failed' && locationFailure && !originSelection ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-600">
                  {CURRENT_LOCATION_MESSAGES[locationFailure]}
                </p>
                <button
                  type="button"
                  onClick={() => void acquireCurrentLocationOrigin()}
                  className="mt-1 text-xs font-semibold text-primary hover:text-primary-dark"
                >
                  Use my location
                </button>
              </div>
            ) : null}

            <PlaceSearchList
              rows={rows}
              options={options}
              isFuzzy={isFuzzy}
              searching={searching}
              query={query}
              loading={locationsLoading && places.length === 0}
              loadError={Boolean(locationsError)}
              activeIndex={activeIndex}
              listboxId={listboxId}
              onHighlight={setActiveIndex}
              onSelect={selectOption}
              onPickOnMap={() => openMapToPick(activeField ?? 'destination')}
              onUseCurrentLocation={
                (activeField ?? 'destination') === 'origin'
                  ? () => void acquireCurrentLocationOrigin()
                  : undefined
              }
              locating={locationStatus === 'locating'}
            />
          </section>
        ) : null}

        {phase === 'fare' ? (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => editTrip('destination')}
              aria-label="Change the trip"
              className="flex w-full items-center gap-2 rounded-2xl border border-surface-border bg-surface px-4 py-3 text-left shadow-card transition hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                <span className="font-semibold text-slate-900">
                  {selectionLabel(originSelection, 'Pickup')}
                </span>
                <span className="px-2 text-slate-400">→</span>
                <span className="font-semibold text-slate-900">
                  {selectionLabel(destinationSelection, 'Drop-off')}
                </span>
              </span>
              <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={16} />
            </button>

            <span className="sr-only">
              Verified road routing is required for this planner.
            </span>

            {isCalculating && !routeResult ? (
              <p className="rounded-2xl border border-surface-border bg-surface px-4 py-6 text-sm text-slate-500 shadow-card">
                Measuring the road route...
              </p>
            ) : null}

            {routeResult ? (
              <div className="overflow-hidden rounded-[2rem] border border-surface-border bg-surface shadow-card">
                <div className="px-4 pt-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        routeResult.method == null
                          ? 'border border-slate-200 bg-slate-100 text-slate-700'
                          : 'border border-violet-200 bg-violet-100 text-violet-800'
                      }`}
                    >
                      {routeResult.sourceBadge}
                    </span>
                    {selectedVehicle ? (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {selectedVehicle.permitPlateNumber || selectedVehicle.plateNumber}
                      </span>
                    ) : null}
                  </div>

                  {routeResult.twoWheelerNotice ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Two-wheeled routes are in beta and may be missing sidewalks, pedestrian paths,
                      or other restrictions.
                    </p>
                  ) : null}

                  <div className="mt-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-tight text-slate-900 sm:text-lg">
                        {routeResult.originLabel} <span className="text-slate-400">→</span>{' '}
                        {routeResult.destinationLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span>{routeResult.durationText}</span>
                        <span className="text-slate-300">•</span>
                        <span>{routeResult.distanceKm.toFixed(2)} km</span>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-[1.4rem] bg-slate-950 px-4 py-3 text-right text-white shadow-lg">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Fare
                      </p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(routeResult.fare)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200/80">
                  <div className="bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Regular
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {regularFare ? formatCurrency(regularFare) : formatCurrency(routeResult.fare)}
                    </p>
                  </div>
                  <div className="bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Your fare
                    </p>
                    <p className="mt-1 text-2xl font-bold text-primary-dark">
                      {formatCurrency(routeResult.fare)}
                    </p>
                  </div>
                  {routeResult.discountApplied ? (
                    <div className="bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Discount
                      </p>
                      <p className="mt-1 text-2xl font-bold text-primary-dark">
                        -{formatCurrency(routeResult.discountApplied)}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Offline replays, same-point results and "recalculating"
                    all explain themselves here. They used to sit on the map
                    overlay, which no longer opens on its own. */}
                {routeMessage && plannerState !== 'no_vehicle_access' && !errorPanelVisible ? (
                  <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:px-5">
                    {routeMessage}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={openRoutePreview}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    View the route on the map
                  </button>
                  <button
                    type="button"
                    onClick={resetRoute}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear trip
                  </button>
                </div>
              </div>
            ) : null}

            <section className="space-y-2 rounded-[2rem] border border-surface-border bg-surface p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Ride
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {vehicleType ? vehicleTypeLabel(vehicleType) : 'Not set'}
                </p>
                <button
                  type="button"
                  onClick={() => setPhase('vehicle')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Change
                </button>
              </div>
            </section>

            {user ? (
              <section className="space-y-2 rounded-[2rem] border border-surface-border bg-surface p-4 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Driver
                </p>
                {identitySection}
              </section>
            ) : null}

            {routeResult ? (
              <div className="space-y-2 rounded-[2rem] border border-surface-border bg-surface p-4 shadow-card">
                <div className="text-xs text-slate-500">
                  {!user && (riderConfirmsTrip ? 'Log in to start this trip.' : 'Log in to send this trip request.')}
                  {user && saveStatus === 'saved' && (riderConfirmsTrip ? 'Trip started. Tap Dropped off when you get off.' : 'Trip request sent to driver.')}
                  {user && saveStatus === 'failed' && (riderConfirmsTrip ? 'Unable to start this trip right now.' : 'Unable to send this trip request right now.')}
                  {user && saveStatus === 'saving' && (riderConfirmsTrip ? 'Starting trip...' : 'Sending trip request...')}
                  {user && saveStatus === 'idle' && routeResult.method == null && 'Same-point results are not saved.'}
                  {user && saveStatus === 'idle' && canSaveDisplayedRoute && (riderConfirmsTrip ? 'This trip has not been started yet.' : 'This trip request has not been sent yet.')}
                  {user && saveStatus === 'idle' && !selectedVehicle && routeResult.method != null && 'Scan the permit QR on the vehicle before recording this trip.'}
                  {user && saveStatus === 'idle' && selectedVehicle && !canSaveDisplayedRoute && routeResult.method != null && 'Resolve the current verified route before sending request.'}
                </div>
                <button
                  type="button"
                  onClick={() => void saveCurrentRoute()}
                  disabled={!canSaveDisplayedRoute || saveStatus === 'saving' || saveStatus === 'saved'}
                  className="w-full rounded-full bg-primary px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-primary/40"
                >
                  {!user
                    ? riderConfirmsTrip ? 'Log in to start trip' : 'Log in to request'
                    : saveStatus === 'saved'
                      ? riderConfirmsTrip ? 'Trip started' : 'Sent'
                      : saveStatus === 'saving'
                        ? riderConfirmsTrip ? 'Starting...' : 'Sending...'
                        : riderConfirmsTrip ? 'Start trip' : 'Send trip request'}
                </button>

                {saveStatus === 'saved' && pendingTripRequestId && user?.userType === 'PUBLIC' ? (
                  <RiderTripStatusPanel tripRequestId={pendingTripRequestId} />
                ) : null}
              </div>
            ) : null}

            {plannerState === 'no_vehicle_access' && dropoffSuggestion ? (
              <section className="rounded-[2rem] border border-surface-border bg-surface p-4 shadow-card">
                {/* A boundary, not a failure — kept out of the red error register. */}
                <div className="rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-700 sm:text-sm">
                  <p className="font-semibold text-slate-900">Ride can&rsquo;t reach this spot</p>
                  <p className="mt-1">{routeMessage}</p>
                  <dl className="mt-3 space-y-1 border-t border-dashed border-slate-300 pt-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Drop-off</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {dropoffSuggestion.label}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Walk from drop-off</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {dropoffSuggestion.walkMeters} m
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() =>
                      handleMapPointChange(dropoffSuggestion.field, {
                        lat: dropoffSuggestion.lat,
                        lng: dropoffSuggestion.lng,
                        label: dropoffSuggestion.label,
                      })
                    }
                    className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Use this drop-off
                  </button>
                </div>
              </section>
            ) : null}

            {errorPanelVisible ? (
              <section className="rounded-[2rem] border border-surface-border bg-surface p-4 shadow-card">
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <p>
                    {plannerState === 'out_of_service_area'
                      ? 'Pin outside the service area.'
                      : plannerState === 'no_route_found'
                        ? routeMessage || 'No road route could be found between these points.'
                        : plannerState === 'no_route_for_vehicle'
                          ? routeMessage ||
                            'No route this ride can take between these points.'
                          : plannerState === 'route_blocked'
                            ? routeMessage || 'The only route between these points is closed.'
                            : 'Routing service unavailable right now.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {hasTwoPoints && plannerState === 'network_error' ? (
                      <button
                        type="button"
                        onClick={() => void calculateRoute(true)}
                        className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Try again
                      </button>
                    ) : null}
                    {plannerState === 'no_route_for_vehicle' ? (
                      // The recovery for this one is a different ride, which is
                      // exactly the step behind us.
                      <button
                        type="button"
                        onClick={() => setPhase('vehicle')}
                        className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Choose another ride
                      </button>
                    ) : null}
                    {plannerState === 'route_blocked' || plannerState === 'no_route_found' ? (
                      <button
                        type="button"
                        onClick={() => editTrip('destination')}
                        className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Change locations
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* The map is a tool, not the page: it mounts only when it is asked for. */}
      {mapOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            mapPickTarget
              ? mapPickTarget === 'origin'
                ? 'Pick your pickup point'
                : 'Pick your drop-off point'
              : 'Route map'
          }
          className="fixed inset-0 z-map flex flex-col bg-white"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <button
              type="button"
              onClick={closeMap}
              aria-label="Close the map"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={18} />
            </button>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
              {mapPickTarget
                ? mapPickTarget === 'origin'
                  ? 'Click your pickup point'
                  : 'Click your drop-off point'
                : 'Route'}
            </p>
            <button
              type="button"
              onClick={refitRoute}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Recenter
            </button>
          </div>

          <div className="min-h-0 flex-1">
            {/* routeResult outlives a pin move until the recompute lands, so the
                polyline is passed only while it still describes these two pins —
                otherwise the map draws the old route against the new ones. */}
            <ResolvedMapComponent
              origin={origin}
              destination={destination}
              polyline={hasFreshDisplayedRoute ? routeResult?.polyline : null}
              isCalculating={isCalculating}
              fitBoundsToken={fitBoundsToken}
              plannerState={plannerState}
              plannerMessage={routeMessage}
              onOriginChange={(point) =>
                handleMapPointChange(mapPickTarget ?? 'origin', point)
              }
              onDestinationChange={(point) =>
                handleMapPointChange(mapPickTarget ?? 'destination', point)
              }
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default RoutePlannerCalculator
