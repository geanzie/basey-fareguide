import { getBarangayFromCoordinate } from "@/utils/barangayBoundaries";

const COORDINATE_PRECISION = 6;

export interface ResolvedPinLabel {
  displayLabel: string;
  barangayName: string | null;
  rawCoordinates: string;
  isFallback: boolean;
}

const resolvedPinLabelCache = new Map<string, ResolvedPinLabel>();

export function formatPinCoordinateLabel(lat: number, lng: number): string {
  return `${lat.toFixed(COORDINATE_PRECISION)}, ${lng.toFixed(COORDINATE_PRECISION)}`;
}

export function resolvePinLabel(lat: number, lng: number): ResolvedPinLabel {
  const cacheKey = `${lat.toFixed(COORDINATE_PRECISION)},${lng.toFixed(COORDINATE_PRECISION)}`;
  const cached = resolvedPinLabelCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const barangay = getBarangayFromCoordinate(lng, lat);
  const rawCoordinates = formatPinCoordinateLabel(lat, lng);
  const resolved: ResolvedPinLabel = {
    displayLabel: barangay?.name ?? rawCoordinates,
    barangayName: barangay?.name ?? null,
    rawCoordinates,
    isFallback: !barangay,
  };

  resolvedPinLabelCache.set(cacheKey, resolved);
  return resolved;
}