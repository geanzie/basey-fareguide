import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place, PlaceCoordinates, PlaceSelection } from '@/types/places';

/**
 * The places a rider has actually quoted, kept on the device.
 *
 * Written only after a quote succeeds. A place that was mistyped, or that the
 * server refused as unroutable, is exactly the thing you do not want offered
 * back as a one-tap option later.
 *
 * Keyed per user because these phones get shared — a rider handing the app to
 * the next passenger should not hand over their trip history with it.
 */

const KEY_PREFIX = 'recent_places:v1:';

/** Named places and dropped pins are capped apart, so pins cannot crowd out the list. */
export const MAX_RECENT_PLACES = 10;
export const MAX_RECENT_PINS = 5;

/**
 * ~1 m. A pin dropped twice by hand never lands on the same coordinate, so
 * rounding is what makes "the same spot" mean anything for a pin.
 */
const PIN_DECIMALS = 5;

export type RecentEntry =
  | { kind: 'place'; place: Place; savedAt: number }
  | { kind: 'pin'; coordinates: PlaceCoordinates; label: string; savedAt: number };

/** Identity for dedupe and for React keys. */
export function recentKey(entry: RecentEntry): string {
  if (entry.kind === 'place') return `place:${entry.place.id}`;
  return pinKey(entry.coordinates);
}

function pinKey(coordinates: PlaceCoordinates): string {
  return `pin:${coordinates.lat.toFixed(PIN_DECIMALS)},${coordinates.lng.toFixed(PIN_DECIMALS)}`;
}

export function recentToSelection(entry: RecentEntry): PlaceSelection {
  if (entry.kind === 'place') return { kind: 'place', place: entry.place };
  return { kind: 'pin', coordinates: entry.coordinates, label: entry.label };
}

export function recentLabel(entry: RecentEntry): string {
  return entry.kind === 'place' ? entry.place.name : entry.label;
}

function toEntry(selection: PlaceSelection, now: number): RecentEntry | null {
  if (selection.kind === 'place') {
    // An id is what dedupe hangs on; without one the entry cannot be trusted.
    if (!selection.place?.id) return null;
    return { kind: 'place', place: selection.place, savedAt: now };
  }

  const { lat, lng } = selection.coordinates ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    kind: 'pin',
    coordinates: selection.coordinates,
    // Persisted rather than re-resolved, so the row still reads as a place name
    // when the rider opens the app with no signal.
    label: selection.label ?? 'Dropped pin',
    savedAt: now,
  };
}

/**
 * Folds new selections into the existing list, newest first.
 *
 * Pure, and the only place the ordering and eviction rules live — the storage
 * wrapper below is a thin shell around it.
 */
export function mergeRecents(
  existing: RecentEntry[],
  selections: PlaceSelection[],
  now: number = Date.now(),
): RecentEntry[] {
  const additions: RecentEntry[] = [];
  for (const selection of selections) {
    const entry = toEntry(selection, now);
    if (entry) additions.push(entry);
  }

  const merged: RecentEntry[] = [];
  const seen = new Set<string>();

  // Additions first, so re-quoting an old place promotes it to the top.
  for (const entry of [...additions, ...existing]) {
    const key = recentKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  const places = merged.filter((entry) => entry.kind === 'place').slice(0, MAX_RECENT_PLACES);
  const pins = merged.filter((entry) => entry.kind === 'pin').slice(0, MAX_RECENT_PINS);
  const kept = new Set([...places, ...pins].map(recentKey));

  // Rebuild in merged order rather than concatenating, so the two buckets stay
  // interleaved by recency instead of splitting into a places block and a pins block.
  return merged.filter((entry) => kept.has(recentKey(entry)));
}

/** Discards anything that no longer parses as an entry, so a bad write cannot wedge the list. */
function parseStored(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RecentEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<RecentEntry> & { kind?: string };
      if (candidate.kind === 'place') {
        return Boolean((candidate as { place?: Place }).place?.id);
      }
      if (candidate.kind === 'pin') {
        const coords = (candidate as { coordinates?: PlaceCoordinates }).coordinates;
        return Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng);
      }
      return false;
    });
  } catch {
    return [];
  }
}

export async function loadRecentPlaces(userId: string): Promise<RecentEntry[]> {
  try {
    return parseStored(await AsyncStorage.getItem(KEY_PREFIX + userId));
  } catch {
    // Storage being unavailable means no recents, never a broken screen.
    return [];
  }
}

/**
 * Records both ends of a completed quote and returns the new list, so the
 * caller can render it without a second read.
 */
export async function rememberRecentPlaces(
  userId: string,
  selections: PlaceSelection[],
): Promise<RecentEntry[]> {
  const merged = mergeRecents(await loadRecentPlaces(userId), selections);
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, JSON.stringify(merged));
  } catch {
    // The list is a convenience; failing to persist it is not worth surfacing.
  }
  return merged;
}

export async function clearRecentPlaces(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    // As above.
  }
}
