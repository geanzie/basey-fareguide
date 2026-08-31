import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CuratedRouteCorpus,
  CuratedRouteMatch,
} from '@/types/curatedRoutes';
import type { VehicleType } from '@/types/fare';

const CURATED_CACHE_KEY = 'curated_routes:v1';

/**
 * The municipality's surveyed distance corpus, held on device.
 *
 * This is what makes an offline fare possible at all. The server consults the
 * same corpus before any routing engine (resolveRouteForQuote), so a match here
 * is the identical number an online quote would return — not an approximation.
 * That is the only reason we are allowed to show a peso figure with the radio
 * off: under Ordinance 105 a fare that disagrees with the driver's app is a
 * dispute, so anything less exact than this shows no number at all.
 */
let corpus: CuratedRouteCorpus | null = null;

/** `originId|destinationId|vehicleType` -> row index. Built once per load. */
let index: Map<string, number> | null = null;

function pairKey(originId: string, destinationId: string, vehicleType: VehicleType): string {
  return `${originId}|${destinationId}|${vehicleType}`;
}

function buildIndex(loaded: CuratedRouteCorpus): Map<string, number> {
  const built = new Map<string, number>();

  loaded.routes.forEach((row, rowIndex) => {
    const [originIdx, destinationIdx, vehicleIdx] = row;
    const originId = loaded.locationIds[originIdx];
    const destinationId = loaded.locationIds[destinationIdx];
    const vehicleType = loaded.vehicleTypes[vehicleIdx];
    if (!originId || !destinationId || !vehicleType) return;

    built.set(pairKey(originId, destinationId, vehicleType), rowIndex);
  });

  return built;
}

function adopt(loaded: CuratedRouteCorpus): void {
  corpus = loaded;
  index = buildIndex(loaded);
}

/** Replace the on-device corpus with a freshly fetched one. */
export async function saveCuratedCorpus(next: CuratedRouteCorpus): Promise<void> {
  adopt(next);
  try {
    await AsyncStorage.setItem(CURATED_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Persisting is an optimisation; this session still has the corpus in memory.
  }
}

/**
 * The corpus as of the last successful fetch, without touching the network.
 * Returns null when this device has never held one.
 */
export async function loadCuratedCorpus(): Promise<CuratedRouteCorpus | null> {
  if (corpus) return corpus;

  try {
    const raw = await AsyncStorage.getItem(CURATED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CuratedRouteCorpus;
    if (!parsed || !Array.isArray(parsed.routes) || !Array.isArray(parsed.locationIds)) {
      return null;
    }
    adopt(parsed);
    return corpus;
  } catch {
    return null;
  }
}

/**
 * Find the surveyed distance for a trip, or null when the corpus does not
 * cover it.
 *
 * Mirrors the server's matching in frontend/src/lib/routing/curatedRoutes.ts:
 * exact vehicle type, forward pair preferred, reverse pair only when the stored
 * row is bidirectional.
 */
export async function lookupCurated(
  originLocationId: string | null | undefined,
  destinationLocationId: string | null | undefined,
  vehicleType: VehicleType | null | undefined,
): Promise<CuratedRouteMatch | null> {
  if (!originLocationId || !destinationLocationId || !vehicleType) return null;
  if (originLocationId === destinationLocationId) return null;

  const loaded = await loadCuratedCorpus();
  if (!loaded || !index) return null;

  const forward = index.get(pairKey(originLocationId, destinationLocationId, vehicleType));
  if (forward !== undefined) {
    return toMatch(loaded, forward, false);
  }

  const reverse = index.get(pairKey(destinationLocationId, originLocationId, vehicleType));
  if (reverse !== undefined && loaded.routes[reverse]?.[5] === 1) {
    return toMatch(loaded, reverse, true);
  }

  return null;
}

function toMatch(
  loaded: CuratedRouteCorpus,
  rowIndex: number,
  reversed: boolean,
): CuratedRouteMatch | null {
  const row = loaded.routes[rowIndex];
  if (!row) return null;

  const [, , , distanceMeters, durationSeconds] = row;

  return {
    distanceKm: distanceMeters / 1000,
    durationMin: durationSeconds === null ? null : durationSeconds / 60,
    reversed,
  };
}

/** Test seam. */
export function resetCuratedCache(): void {
  corpus = null;
  index = null;
}
