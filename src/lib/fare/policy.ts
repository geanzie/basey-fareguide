import type { FarePolicySnapshot } from '@/types/fare';

/**
 * PORTED from frontend/src/lib/fare/policy.ts. Keep the arithmetic identical.
 *
 * The mobile app prices trips offline, so it needs the fare rules on device.
 * The web copy remains the source of truth; the shared golden-vector fixture
 * (src/lib/fare/fare-golden-vectors.json) is what stops the two drifting.
 */
export const FARE_BASE_DISTANCE_KM = 3;
export const LEGACY_BASE_FARE = 15;
export const LEGACY_PER_KM_RATE = 3;

export const DEFAULT_FARE_POLICY: FarePolicySnapshot = {
  versionId: null,
  baseDistanceKm: FARE_BASE_DISTANCE_KM,
  baseFare: LEGACY_BASE_FARE,
  perKmRate: LEGACY_PER_KM_RATE,
  effectiveAt: null,
};

export function resolveFarePolicySnapshot(
  farePolicy: FarePolicySnapshot | null | undefined,
): FarePolicySnapshot {
  if (!farePolicy) {
    return DEFAULT_FARE_POLICY;
  }

  return {
    versionId: farePolicy.versionId ?? null,
    baseDistanceKm: farePolicy.baseDistanceKm ?? FARE_BASE_DISTANCE_KM,
    baseFare: Number.isFinite(farePolicy.baseFare) ? farePolicy.baseFare : LEGACY_BASE_FARE,
    perKmRate: Number.isFinite(farePolicy.perKmRate) ? farePolicy.perKmRate : LEGACY_PER_KM_RATE,
    effectiveAt: farePolicy.effectiveAt ?? null,
  };
}
