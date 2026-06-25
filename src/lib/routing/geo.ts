import type { Coordinates } from "./providers/base";

/** Multiplier applied to straight-line distance to approximate road distance. */
export const ROAD_FACTOR = 1.4;

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle (straight-line) distance between two coordinates in kilometres.
 * Shared by the GPS provider (server) and the offline estimator (client) so both
 * paths use one source of truth.
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2Lat = Math.sin(dLat / 2) ** 2;
  const sin2Lng = Math.sin(dLng / 2) ** 2;
  const chord =
    sin2Lat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2Lng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(chord));
}

/** Straight-line distance scaled by ROAD_FACTOR to approximate a road route. */
export function estimatedRoadKm(a: Coordinates, b: Coordinates): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}
