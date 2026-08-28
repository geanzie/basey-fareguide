import type { VehicleType } from "@prisma/client";

import type { FarePolicySnapshotDto } from "@/lib/contracts";
import type { ResolvedPinLabel } from "@/lib/locations/pinLabelResolver";

export type PassengerType = "REGULAR" | "STUDENT" | "SENIOR" | "PWD";

/**
 * Discriminated union for supplying a location to the /api/routes/calculate endpoint.
 * Use "preset" for named locations from the database-backed planner location registry.
 * Use "pin" for exact map-pin coordinates.
 */
export type LocationInput =
  | { type: "preset"; name: string }
  | { type: "pin"; lat: number; lng: number };

/**
 * A coordinate that has been road-snapped by the routing provider.
 * wasSnapped is true when the snapped point differs from the raw input by > ~11 m.
 */
export interface SnappedPoint {
  lat: number;
  lng: number;
  wasSnapped: boolean;
}

/**
 * Where a distance came from.
 *
 * "curated" is not an engine: it is a distance somebody measured on the ground
 * and saved against a pair of places. It outranks every engine, because OSM
 * coverage in Basey is the ceiling on all of them.
 *
 * Not every source can occur everywhere. A fare quote never yields "gps" —
 * calculateShortestRoadRoute throws instead of degrading to haversine. The trip
 * tracker never yields "curated" — it measures a GPS trail and has no pair of
 * saved places to look up. Those invariants are enforced where they hold, not
 * by splitting this union.
 */
export type RouteProvider = "ors" | "gps" | "google_routes" | "valhalla" | "curated";

export type RouteMethod = "ors" | "gps" | "google_routes" | "valhalla" | "curated";

export type RoutingFailureCode =
  | "NO_ROAD_ROUTE_FOUND"
  | "ROUTING_SERVICE_UNAVAILABLE"
  | "ROUTE_UNVERIFIED"
  | "NO_VEHICLE_ACCESS"
  /**
   * No route this vehicle can climb. Deliberately distinct from
   * ROUTE_UNVERIFIED, which means the providers were down or disagreed and
   * resolves to a 503: this one is deterministic and vehicle-specific, so the
   * rider needs "try a habal-habal", not "try again later".
   */
  | "NO_ROUTE_FOR_VEHICLE"
  /** The route crosses a closure an admin recorded. */
  | "ROUTE_BLOCKED_BY_RESTRICTION";

export type RoutingFailureReason =
  | "configuration_error"
  | "no_route_found"
  | "timeout"
  | "upstream_error"
  | "no_vehicle_access"
  | "no_route_for_vehicle"
  | "restricted";

/** Which end of the trip an access verdict refers to. */
export type RouteField = "origin" | "destination";

/**
 * What a requested coordinate represents.
 *
 * "doorstep" — somewhere a ride is expected to arrive: a dropped pin, or a
 *   landmark whose coordinate is the building itself.
 * "area" — an administrative point standing for a whole area, typically a
 *   polygon centroid. 36 of Basey's 51 barangay coordinates sit more than 80 m
 *   from any road because that is what a centroid is. The ride stops where the
 *   road into the area ends, which is ordinary and must not refuse a fare.
 */
export type AccessPolicy = "doorstep" | "area";

/**
 * A point a habal-habal or tricycle can actually reach, offered when the
 * requested point is only reachable on foot.
 */
export interface DropoffSuggestion {
  lat: number;
  lng: number;
  /** Human label for the drop-off, e.g. "Basey 1 Central Elementary School gate". */
  label: string;
  /** Walking metres from the drop-off to the requested point. */
  walkMeters: number;
  /** How the drop-off was determined. */
  source: "curated" | "foot_probe" | "road_snap";
}

/**
 * Result of checking whether a requested point sits on the vehicle road network.
 * "walk_only" means a road exists nearby but the last stretch is footpath or
 * stairs; "no_road" means there is no usable road within reach at all.
 */
export type VehicleAccessVerdict =
  | { status: "reachable" }
  | {
      status: "walk_only";
      field: RouteField;
      snapMeters: number;
      dropoff: DropoffSuggestion;
    }
  | { status: "no_road"; field: RouteField; snapMeters: number };

/** A verdict that names an end of the trip — anything but "reachable". */
export type BlockedVehicleAccessVerdict = Exclude<
  VehicleAccessVerdict,
  { status: "reachable" }
>;

/**
 * Attached to a successful response when the trip was quoted to a curated
 * drop-off instead of the requested point.
 */
export interface DropoffNotice {
  field: RouteField;
  /** Name of the place the rider asked for. */
  requestedLabel: string;
  /** Name of the point the ride actually stops at. */
  label: string;
  lat: number;
  lng: number;
  walkMeters: number;
  note: string | null;
}

export interface RouteDiagnostics {
  provider: RouteProvider | null;
  routeFound: boolean;
  isEstimate: boolean;
  errorCode: RoutingFailureCode | null;
  errorMessage: string | null;
}

export class RoutingServiceError extends Error {
  readonly code: RoutingFailureCode;
  readonly provider: Exclude<RouteProvider, "gps">;
  readonly reason: RoutingFailureReason;
  readonly status: number | null;

  constructor(
    code: RoutingFailureCode,
    message: string,
    options: {
      provider?: Exclude<RouteProvider, "gps">;
      reason: RoutingFailureReason;
      status?: number | null;
    },
  ) {
    super(message);
    this.name = "RoutingServiceError";
    this.code = code;
    this.provider = options.provider ?? "ors";
    this.reason = options.reason;
    this.status = options.status ?? null;
  }
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number | null;
  distanceMeters: number;
  durationSeconds: number | null;
  /** Road polyline encoded string, or null when method is "gps" (estimate only). */
  polyline: string | null;
  method: RouteMethod;
  provider: RouteProvider;
  isEstimate: boolean;
  fallbackReason: string | null;
  /** Road-snapped origin returned by ORS. Null for GPS fallback routes. */
  snappedOrigin: SnappedPoint | null;
  /** Road-snapped destination returned by ORS. Null for GPS fallback routes. */
  snappedDestination: SnappedPoint | null;
  diagnostics: RouteDiagnostics;
}

export interface ShortestRoadRouteResult extends RouteResult {
  method: Exclude<RouteMethod, "gps">;
  provider: Exclude<RouteProvider, "gps">;
  isEstimate: false;
}

export interface FareBreakdown {
  baseFare: number;
  additionalKm: number;
  additionalFare: number;
  discount: number;
  total: number;
}

/** Terrain reading attached to a quote. Never priced. */
export interface RouteValidityDto {
  /** False when no elevation data was available. Not the same as "fine". */
  checked: boolean;
  /** Steepest sustained climb found, in percent. */
  maxGradePercent: number | null;
  /** The limit this vehicle was measured against, if one is configured. */
  thresholdPercent: number | null;
  /** True when the measured climb exceeded the limit. */
  exceedsThreshold: boolean;
  /**
   * Resolution of the elevation data behind the reading, in metres. Reported
   * because it bounds what the reading can mean: over Basey this has been seen
   * at ~153 m, far coarser than a road-scale pitch, so a low grade here does
   * not prove a road is gentle.
   */
  demResolutionM: number | null;
  /**
   * Whether the gate is armed for this vehicle. While false the reading is
   * recorded and shown but never refuses a quote.
   */
  enforced: boolean;
}

export interface CalculatedRouteResponse {
  origin: string;
  destination: string;
  /**
   * The vehicle the quote was routed for. Null means the caller named none and
   * the route is a car route — which is what every quote was before vehicle
   * types reached the routing layer.
   */
  vehicleType: VehicleType | null;
  /**
   * Google requires a beta notice wherever a two-wheeled route is displayed, so
   * the clients have to be told when they are showing one. Compliance, not a
   * nicety.
   */
  twoWheelerNotice: boolean;
  /**
   * What the terrain check found. Diagnostic only — it never changes the fare,
   * because Ordinance 105 prices distance and nothing else.
   *
   * `checked: false` means no reading was available, which is NOT a pass.
   */
  routeValidity: RouteValidityDto | null;
  originResolved: ResolvedPinLabel | null;
  destinationResolved: ResolvedPinLabel | null;
  distanceKm: number;
  durationMin: number | null;
  fare: number;
  passengerType: PassengerType;
  fareBreakdown: FareBreakdown;
  farePolicy: FarePolicySnapshotDto;
  method: Exclude<RouteMethod, "gps"> | null;
  provider: Exclude<RouteProvider, "gps"> | null;
  isEstimate: boolean;
  fallbackReason: string | null;
  polyline: string | null;
  snappedOrigin: SnappedPoint | null;
  snappedDestination: SnappedPoint | null;
  inputMode: "preset" | "pin";
  /**
   * One entry per end of the trip that was quoted to a curated drop-off because
   * the requested place is only reachable on foot. Empty on ordinary trips.
   */
  dropoffNotices: DropoffNotice[];
}
