import type { FarePolicySnapshotDto } from "@/lib/contracts";

export const FARE_BASE_DISTANCE_KM = 3;
export const LEGACY_BASE_FARE = 15;
export const LEGACY_PER_KM_RATE = 3;

export const DEFAULT_FARE_POLICY: FarePolicySnapshotDto = {
  versionId: null,
  baseDistanceKm: FARE_BASE_DISTANCE_KM,
  baseFare: LEGACY_BASE_FARE,
  perKmRate: LEGACY_PER_KM_RATE,
  effectiveAt: null,
};

export function resolveFarePolicySnapshot(
  farePolicy: FarePolicySnapshotDto | null | undefined,
): FarePolicySnapshotDto {
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
