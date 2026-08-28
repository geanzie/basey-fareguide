import type { VehicleType } from "@prisma/client";

import type { RouteResult, ShortestRoadRouteResult } from "../types";

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Per-request routing context.
 *
 * Optional throughout: a caller with no vehicle in hand — the trip tracker, for
 * instance — omits it and gets car-equivalent routing, which is what every
 * caller got before vehicle types existed here.
 */
export interface RouteRequestOptions {
  /** Null or absent means "no vehicle context"; route as a car. */
  vehicleType?: VehicleType | null;
  /**
   * Admin road restrictions that bind this vehicle, already filtered.
   *
   * Providers honour what they can: Valhalla takes both, ORS takes polygons
   * only, Google Routes takes neither and is post-filtered instead.
   */
  excludePolygons?: Array<Array<[number, number]>>;
  excludeLocations?: Coordinates[];
}

export interface RoutingProvider {
  /**
   * Calculate a route between two coordinates.
   * Should throw if the provider fails so the caller can fall back.
   */
  calculate(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<RouteResult>;
  calculateShortest?(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<ShortestRoadRouteResult>;
}
