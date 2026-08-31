export type PassengerType = 'REGULAR' | 'STUDENT' | 'SENIOR' | 'PWD';

/**
 * Hand-written mirror of the Prisma `VehicleType` enum in
 * frontend/prisma/schema.prisma. Nothing generates this, so a new member added
 * to the schema has to be added here too.
 */
export type VehicleType =
  | 'JEEPNEY'
  | 'TRICYCLE'
  | 'HABAL_HABAL'
  | 'MULTICAB'
  | 'BUS'
  | 'VAN';
export type DiscountType = 'NONE' | 'STUDENT' | 'SENIOR_CITIZEN' | 'PWD';

/** Sources a fare quote can come from. Never 'gps' — the fare path refuses to price a guess. */
export type RouteSource = 'ors' | 'google_routes' | 'valhalla' | 'curated';

/**
 * Mirror of FarePolicySnapshotDto in frontend/src/lib/contracts/fareRates.ts.
 *
 * Every field is required, as on the server. They were optional here and the
 * looseness cost something real: the offline calculator prices a trip from a
 * cached copy of this object, and an undefined perKmRate would silently fall
 * back to the legacy default instead of failing loudly.
 */
export interface FarePolicySnapshot {
  versionId: string | null;
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  /** ISO date the rate took effect. Cited under the fare as the tariff's authority. */
  effectiveAt: string | null;
}

export interface FareBreakdown {
  baseFare: number;
  additionalKm: number;
  additionalFare: number;
  discount: number;
  total: number;
}

/** A coordinate the server pulled onto the road network. */
export interface SnappedPoint {
  lat: number;
  lng: number;
  wasSnapped?: boolean;
}

/**
 * Mirrors LocationInput in frontend/src/lib/routing/types.ts. A `preset` is a
 * curated Place resolved server-side by name; a `pin` is an arbitrary
 * coordinate that the server bounds-checks against the Basey service area.
 */
export type LocationInput =
  | { type: 'preset'; name: string }
  | { type: 'pin'; lat: number; lng: number };

/**
 * Where a ride can stop when the requested point is only reachable on foot.
 * Mirrors DropoffSuggestion in frontend/src/lib/routing/types.ts and arrives in
 * the `details` of a NO_VEHICLE_ACCESS error.
 */
export interface DropoffSuggestion {
  lat: number;
  lng: number;
  label: string;
  walkMeters: number;
  source: 'curated' | 'foot_probe' | 'road_snap';
}

/** The `details` payload of a NO_VEHICLE_ACCESS error. */
export interface NoVehicleAccessDetails {
  field: 'origin' | 'destination';
  dropoff: DropoffSuggestion;
}

/**
 * Sent on a successful quote when one end was measured to a curated drop-off
 * instead of the place the rider picked. Mirrors DropoffNotice.
 */
export interface DropoffNotice {
  field: 'origin' | 'destination';
  requestedLabel: string;
  label: string;
  lat: number;
  lng: number;
  walkMeters: number;
  note: string | null;
}

/**
 * Terrain reading attached to a quote. Mirrors RouteValidityDto in
 * frontend/src/lib/routing/types.ts.
 */
export interface RouteValidity {
  /** False when no elevation data was available. Not the same as "fine". */
  checked: boolean;
  maxGradePercent: number | null;
  thresholdPercent: number | null;
  exceedsThreshold: boolean;
  /** Resolution of the elevation data, in metres. Bounds what the reading means. */
  demResolutionM: number | null;
  /** While false the reading is shown but never refuses a quote. */
  enforced: boolean;
}

export interface RouteCalculationRequest {
  origin: LocationInput;
  destination: LocationInput;
  passengerType: PassengerType;
  /**
   * Optional. A habal-habal and a tricycle do not take the same roads, so this
   * changes the measured distance and therefore the fare. Omitted means "no
   * vehicle context", which the server routes as a car.
   */
  vehicleType?: VehicleType | null;
}

export interface RouteCalculationResponse {
  distanceKm: number;
  durationMin?: number;
  fare: number;
  isEstimate: boolean;
  fareBreakdown: FareBreakdown;
  farePolicy: FarePolicySnapshot;
  /**
   * Which source measured the trip. "valhalla" is the self-hosted engine;
   * "curated" is a distance somebody surveyed between two saved places, and
   * outranks every engine. Mirrors RouteMethod in
   * frontend/src/lib/routing/types.ts minus "gps", which the fare path never
   * produces.
   */
  method: RouteSource | null;
  provider: RouteSource | null;
  fallbackReason: string | null;
  polyline: string | null;
  snappedOrigin: SnappedPoint | null;
  snappedDestination: SnappedPoint | null;
  passengerType: PassengerType;
  origin: string;
  destination: string;
  inputMode?: 'preset' | 'pin';
  /** Echoed back from the request. Null when none was sent. */
  vehicleType: VehicleType | null;
  /**
   * True when the quote came from Google in two-wheeler mode. Google requires
   * a beta notice to be shown wherever such a route is displayed, so this is a
   * compliance flag, not a hint.
   */
  twoWheelerNotice: boolean;
  /**
   * What the terrain check found, or null when no route was measured.
   * Diagnostic only — it never changes the fare, which prices distance alone.
   */
  routeValidity: RouteValidity | null;
  /** Empty on an ordinary trip; one entry per end quoted to a drop-off. */
  dropoffNotices?: DropoffNotice[];
}

export interface VehicleLookup {
  id?: string;
  plateNumber: string | null;
  permitPlateNumber: string | null;
  /** Loose on purpose: the lookup endpoint returns whatever the row holds. */
  vehicleType: string | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  /** Only the fare-history serializer returns this; vehicle lookups do not. */
  hasVehicleContext?: boolean;
}

/** Permit state carried back by the ride-tag QR lookup. */
export type PermitStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';

/** Mirrors PublicRideTagLookupResultDto in frontend/src/lib/contracts/rideTag.ts. */
export interface RideTagLookupResult {
  matchFound: boolean;
  permitStatus: PermitStatus | null;
  vehicle: VehicleLookup | null;
  message: string;
}

export interface FareCalculation {
  id: string;
  originLabel: string;
  destinationLabel: string;
  distanceKm: number;
  fare: number;
  discountType: DiscountType;
  isEstimate: boolean;
  createdAt: string;
  vehicle: VehicleLookup | null;
}

export interface FareRate {
  id: string;
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  notes?: string;
  isActive: boolean;
  effectiveAt: string;
  createdAt: string;
}

/**
 * A resolved fare policy as returned by GET /api/fare-rates.
 *
 * The server has one shape for this, so mobile has one too. There used to be a
 * separate narrower `FareRateSnapshot` here that dropped `versionId`, which
 * meant the rate-card response and the quote response were different types for
 * the same thing and neither could be cached as the other.
 */
export type FareRateSnapshot = FarePolicySnapshot;

export interface FareRatesResponse {
  current: FareRateSnapshot;
  upcoming: FareRateSnapshot | null;
}
