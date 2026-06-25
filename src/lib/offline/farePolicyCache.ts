import type { FarePolicySnapshotDto } from "@/lib/contracts";

const FARE_POLICY_KEY = "basey:lastFarePolicy";

/**
 * Persist the most recent fare policy snapshot so the offline estimator can
 * price routes with the real active policy instead of the legacy default.
 * No-ops outside the browser or when storage is unavailable.
 */
export function saveLastFarePolicy(policy: FarePolicySnapshotDto): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FARE_POLICY_KEY, JSON.stringify(policy));
  } catch {
    // Storage full / disabled — estimator falls back to the legacy default.
  }
}

export function loadLastFarePolicy(): FarePolicySnapshotDto | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FARE_POLICY_KEY);
    return raw ? (JSON.parse(raw) as FarePolicySnapshotDto) : null;
  } catch {
    return null;
  }
}
