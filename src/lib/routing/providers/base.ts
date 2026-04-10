import type { RouteResult, ShortestRoadRouteResult } from "../types";

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
  calculateShortest?(origin: Coordinates, destination: Coordinates): Promise<ShortestRoadRouteResult>;
}
