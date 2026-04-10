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

export type RouteProvider = "ors" | "gps";

export type RoutingFailureCode =
  | "NO_ROAD_ROUTE_FOUND"
  | "ROUTING_SERVICE_UNAVAILABLE";

export type RoutingFailureReason =
  | "configuration_error"
  | "no_route_found"
  | "timeout"
  | "upstream_error";

export class RoutingServiceError extends Error {
  readonly code: RoutingFailureCode;
  readonly provider: "ors";
  readonly reason: RoutingFailureReason;
  readonly status: number | null;

  constructor(
    code: RoutingFailureCode,
    message: string,
    options: {
      provider?: "ors";
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
  /** Road polyline encoded string, or null when method is "gps" (estimate only). */
  polyline: string | null;
  method: "ors" | "gps";
  provider: RouteProvider;
  isEstimate: boolean;
  fallbackReason: string | null;
  /** Road-snapped origin returned by ORS. Null for GPS fallback routes. */
  snappedOrigin: SnappedPoint | null;
  /** Road-snapped destination returned by ORS. Null for GPS fallback routes. */
  snappedDestination: SnappedPoint | null;
}

export interface ShortestRoadRouteResult extends RouteResult {
  method: "ors";
  provider: "ors";
  isEstimate: false;
}

export interface FareBreakdown {
  baseFare: number;
  additionalKm: number;
  additionalFare: number;
  discount: number;
  total: number;
}

export interface CalculatedRouteResponse {
  origin: string;
  destination: string;
  originResolved: ResolvedPinLabel | null;
  destinationResolved: ResolvedPinLabel | null;
  distanceKm: number;
  durationMin: number | null;
  fare: number;
  passengerType: PassengerType;
  fareBreakdown: FareBreakdown;
  farePolicy: FarePolicySnapshotDto;
  method: "ors" | null;
  provider: "ors" | null;
  isEstimate: boolean;
  fallbackReason: string | null;
  polyline: string | null;
  snappedOrigin: SnappedPoint | null;
  snappedDestination: SnappedPoint | null;
  inputMode: "preset" | "pin";
}
