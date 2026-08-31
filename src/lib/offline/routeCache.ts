import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FarePolicySnapshot, VehicleType } from '@/types/fare';
import type { PlaceSelection } from '@/types/places';

const ROUTE_CACHE_KEY = 'route_cache:v1';

/**
 * How many pairs to keep. A rider works a handful of routes; the cap exists so
 * a shared phone cannot grow this without bound, not because space is tight.
 */
const MAX_ENTRIES = 200;

/**
 * A distance the server measured, kept so it can be replayed offline.
 *
 * Note what is NOT stored: the fare. Distance does not change when the
 * ordinance rate does, so the fare is recomputed from the policy at display
 * time. Cache a peso figure and it goes quietly wrong the day rates change.
 */
export interface CachedRoute {
  distanceKm: number;
  durationMin: number | null;
  /** The policy in force when the distance was measured. */
  farePolicy: FarePolicySnapshot;
  /** Epoch ms, for eviction ordering only — entries do not expire. */
  storedAt: number;
}

type RouteCacheMap = Record<string, CachedRoute>;

let cached: RouteCacheMap | null = null;

/**
 * Key for a pair of chosen endpoints.
 *
 * Presets key on name, pins on coordinates rounded to 4 dp (~11 m), matching
 * the precision of the server routing cache and of web's routePairKey so the
 * same pin pair lands on the same entry.
 *
 * Presets deliberately do NOT key on coordinates: a saved place is a stable
 * identity, and re-seeding a barangay centroid would otherwise orphan every
 * route the rider had cached for it. With no estimate fallback left, a cache
 * miss is a dead end rather than a degraded answer, so hit rate is the feature.
 */
export function routeCacheKey(
  origin: PlaceSelection,
  destination: PlaceSelection,
  vehicleType: VehicleType | null | undefined,
): string {
  const suffix = vehicleType ? `#${vehicleType}` : '';
  return `${selectionKey(origin)}->${selectionKey(destination)}${suffix}`;
}

function selectionKey(selection: PlaceSelection): string {
  if (selection.kind === 'place') {
    return `preset:${selection.place.name}`;
  }
  const r = (n: number) => n.toFixed(4);
  return `pin:${r(selection.coordinates.lat)},${r(selection.coordinates.lng)}`;
}

async function readAll(): Promise<RouteCacheMap> {
  if (cached) return cached;

  try {
    const raw = await AsyncStorage.getItem(ROUTE_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cached = parsed && typeof parsed === 'object' ? (parsed as RouteCacheMap) : {};
  } catch {
    cached = {};
  }

  return cached;
}

export async function loadCachedRoute(key: string): Promise<CachedRoute | null> {
  const all = await readAll();
  return all[key] ?? null;
}

export async function saveCachedRoute(key: string, value: CachedRoute): Promise<void> {
  const all = await readAll();
  all[key] = value;

  // Oldest-first eviction. Cheap at this size and keeps the newest routes,
  // which are the ones the rider is most likely to repeat.
  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (all[a]?.storedAt ?? 0) - (all[b]?.storedAt ?? 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((stale) => delete all[stale]);
  }

  try {
    await AsyncStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(all));
  } catch {
    // The in-memory map still serves this session.
  }
}

/**
 * Drop the in-memory copy but keep what is on disk — what a fresh app launch
 * sees. Separate from {@link clearRouteCache} because forgetting a rider's
 * cached routes on every restart would empty the offline path completely.
 */
export function resetRouteCache(): void {
  cached = null;
}

/** Forget cached routes entirely. Used when a session is cleared. */
export function clearRouteCache(): void {
  cached = null;
  void AsyncStorage.removeItem(ROUTE_CACHE_KEY).catch(() => {});
}
