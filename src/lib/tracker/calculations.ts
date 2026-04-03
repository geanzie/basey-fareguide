import type { TrackerPoint } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const GPS_FALLBACK_ROAD_FACTOR = 1.4;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function speedMetersPerSecond(from: TrackerPoint, to: TrackerPoint): number {
  const elapsedMs = to.timestampMs - from.timestampMs;
  if (elapsedMs <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return haversineMeters(from, to) / (elapsedMs / 1000);
}

export function estimateFallbackDistanceKm(from: TrackerPoint, to: TrackerPoint): number {
  const straightLineKm = haversineMeters(from, to) / 1000;
  return straightLineKm * GPS_FALLBACK_ROAD_FACTOR;
}

export function isInBounds(
  lat: number,
  lng: number,
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number },
): boolean {
  return (
    lat >= bounds.latMin &&
    lat <= bounds.latMax &&
    lng >= bounds.lngMin &&
    lng <= bounds.lngMax
  );
}
