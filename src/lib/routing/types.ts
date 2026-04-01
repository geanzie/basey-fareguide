export type PassengerType = "REGULAR" | "STUDENT" | "SENIOR" | "PWD";

/**
 * Discriminated union for supplying a location to the /api/routes/calculate endpoint.
 * Use "preset" for named locations from basey-locations.json.
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

export interface RouteResult {
  distanceKm: number;
  durationMin: number | null;
  /** Road polyline encoded string, or null when method is "gps" (estimate only). */
  polyline: string | null;
  method: "ors" | "gps";
  fallbackReason: string | null;
  /** Road-snapped origin returned by ORS. Null for GPS fallback routes. */
  snappedOrigin: SnappedPoint | null;
  /** Road-snapped destination returned by ORS. Null for GPS fallback routes. */
  snappedDestination: SnappedPoint | null;
}

export interface FareBreakdown {
  baseFare: number;
  additionalKm: number;
  additionalFare: number;
  discount: number;
  total: number;
}
