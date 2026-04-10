import type { RouteResult } from "../types";
import type { Coordinates, RoutingProvider } from "./base";

const ROAD_FACTOR = 1.4;
const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2Lat = Math.sin(dLat / 2) ** 2;
  const sin2Lng = Math.sin(dLng / 2) ** 2;
  const chord =
    sin2Lat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2Lng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(chord));
}

export class GpsProvider implements RoutingProvider {
  async calculate(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    const straightLineKm = haversineKm(origin, destination);
    const distanceKm = straightLineKm * ROAD_FACTOR;

    return {
      distanceKm,
      durationMin: null,
      /** GPS estimates have no road path — UI must render markers only. */
      polyline: null,
      method: "gps",
      provider: "gps",
      isEstimate: true,
      fallbackReason: null,
      snappedOrigin: null,
      snappedDestination: null,
    };
  }
}
