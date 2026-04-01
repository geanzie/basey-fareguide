import type { RouteResult } from "../types";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutingProvider {
  /**
   * Calculate a route between two coordinates.
   * Should throw if the provider fails so the caller can fall back.
   */
  calculate(origin: Coordinates, destination: Coordinates): Promise<RouteResult>;
}
