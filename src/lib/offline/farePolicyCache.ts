import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FarePolicySnapshot } from '@/types/fare';

const FARE_POLICY_KEY = 'basey:lastFarePolicy';

/**
 * The most recent fare policy the server sent us.
 *
 * The offline calculator prices a cached distance with this rather than the
 * legacy default, so a rider offline the day after an ordinance change still
 * sees the new rate. Mirrors frontend/src/lib/offline/farePolicyCache.ts.
 */
let cached: FarePolicySnapshot | null = null;

export async function saveLastFarePolicy(policy: FarePolicySnapshot): Promise<void> {
  cached = policy;
  try {
    await AsyncStorage.setItem(FARE_POLICY_KEY, JSON.stringify(policy));
  } catch {
    // Persisting is an optimisation; the in-memory copy still serves this session.
  }
}

export async function loadLastFarePolicy(): Promise<FarePolicySnapshot | null> {
  if (cached) return cached;

  try {
    const raw = await AsyncStorage.getItem(FARE_POLICY_KEY);
    if (!raw) return null;
    cached = JSON.parse(raw) as FarePolicySnapshot;
    return cached;
  } catch {
    // An unreadable cache is the same as no cache: the caller falls back to the
    // legacy default, which is what resolveFarePolicySnapshot does anyway.
    return null;
  }
}

/** Drop the in-memory copy, keeping what is on disk — what a fresh launch sees. */
export function resetFarePolicyCache(): void {
  cached = null;
}

/** Forget the cached policy entirely. Used when a session is cleared. */
export function clearFarePolicyCache(): void {
  cached = null;
  void AsyncStorage.removeItem(FARE_POLICY_KEY).catch(() => {});
}
