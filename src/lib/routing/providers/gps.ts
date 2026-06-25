import type { RouteResult } from "../types";
import { haversineKm, ROAD_FACTOR } from "../geo";
import type { Coordinates, RoutingProvider } from "./base";

export class GpsProvider implements RoutingProvider {
  async calculate(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    const straightLineKm = haversineKm(origin, destination);
    const distanceKm = straightLineKm * ROAD_FACTOR;

    return {
      distanceKm,
      durationMin: null,
      distanceMeters: distanceKm * 1000,
      durationSeconds: null,
      /** GPS estimates have no road path — UI must render markers only. */
      polyline: null,
      method: "gps",
      provider: "gps",
      isEstimate: true,
      fallbackReason: null,
      snappedOrigin: null,
      snappedDestination: null,
      diagnostics: {
        provider: "gps",
        routeFound: false,
        isEstimate: true,
        errorCode: null,
        errorMessage: null,
      },
    };
  }
}
