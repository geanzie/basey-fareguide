import type { PlannerLocationDto } from "@/lib/contracts";
import type { PlannerPoint } from "@/lib/planner/routePlanner";
import { buildPinSelection, buildPlaceSelection, type PlannerSelection } from "@/lib/planner/selection";

/**
 * The places a rider has actually quoted, kept in this browser.
 *
 * Written only after a quote succeeds. A place that was mistyped, or that the
 * server refused as unroutable, is exactly the thing you do not want offered
 * back as a one-tap option later.
 *
 * Keyed per user because a household or a barangay hall shares one machine —
 * signing in as someone else should not inherit their trips.
 *
 * Ported from mobile/src/lib/recentPlaces.ts (AsyncStorage there, localStorage
 * here); keep the two in step.
 */

const KEY_PREFIX = "basey:recentPlaces:v1:";

/** Named places and dropped pins are capped apart, so pins cannot crowd out the list. */
export const MAX_RECENT_PLACES = 10;
export const MAX_RECENT_PINS = 5;

/**
 * ~1 m. A pin dropped twice by hand never lands on the same coordinate, so
 * rounding is what makes "the same spot" mean anything for a pin.
 */
const PIN_DECIMALS = 5;

export type RecentEntry =
  | { kind: "place"; place: PlannerLocationDto; savedAt: number }
  | { kind: "pin"; point: PlannerPoint; savedAt: number };

/** Identity for dedupe and for React keys. */
export function recentKey(entry: RecentEntry): string {
  if (entry.kind === "place") return `place:${entry.place.id}`;
  return `pin:${entry.point.lat.toFixed(PIN_DECIMALS)},${entry.point.lng.toFixed(PIN_DECIMALS)}`;
}

export function recentToSelection(entry: RecentEntry): PlannerSelection {
  return entry.kind === "place" ? buildPlaceSelection(entry.place) : buildPinSelection(entry.point);
}

export function recentLabel(entry: RecentEntry): string {
  return entry.kind === "place" ? entry.place.name : entry.point.label?.trim() || "Dropped pin";
}

function toEntry(selection: PlannerSelection, now: number): RecentEntry | null {
  if (selection.place) {
    // An id is what dedupe hangs on; without one the entry cannot be trusted.
    if (!selection.place.id) return null;
    return { kind: "place", place: selection.place, savedAt: now };
  }

  const { lat, lng } = selection.point ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    kind: "pin",
    // The resolved barangay label is persisted rather than re-derived, so the
    // row still reads as a place name rather than a coordinate.
    point: { lat, lng, label: selection.point.label ?? "Dropped pin" },
    savedAt: now,
  };
}

/**
 * Folds new selections into the existing list, newest first.
 *
 * Pure, and the only place the ordering and eviction rules live — the storage
 * wrappers below are thin shells around it.
 */
export function mergeRecents(
  existing: RecentEntry[],
  selections: PlannerSelection[],
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

  const places = merged.filter((entry) => entry.kind === "place").slice(0, MAX_RECENT_PLACES);
  const pins = merged.filter((entry) => entry.kind === "pin").slice(0, MAX_RECENT_PINS);
  const kept = new Set([...places, ...pins].map(recentKey));

  // Rebuild in merged order rather than concatenating, so the two buckets stay
  // interleaved by recency instead of splitting into a places block and a pins block.
  return merged.filter((entry) => kept.has(recentKey(entry)));
}

/** Discards anything that no longer parses, so one bad write cannot wedge the list. */
function parseStored(raw: string | null): RecentEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RecentEntry => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as { kind?: string; place?: PlannerLocationDto; point?: PlannerPoint };
      if (candidate.kind === "place") return Boolean(candidate.place?.id);
      if (candidate.kind === "pin") {
        return Number.isFinite(candidate.point?.lat) && Number.isFinite(candidate.point?.lng);
      }
      return false;
    });
  } catch {
    return [];
  }
}

export function loadRecentPlaces(userId: string): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStored(window.localStorage.getItem(KEY_PREFIX + userId));
  } catch {
    // Storage disabled or blocked means no recents, never a broken screen.
    return [];
  }
}

/**
 * Records both ends of a completed quote and returns the new list, so the
 * caller can render it without a second read.
 */
export function rememberRecentPlaces(
  userId: string,
  selections: PlannerSelection[],
): RecentEntry[] {
  const merged = mergeRecents(loadRecentPlaces(userId), selections);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(merged));
    } catch {
      // The list is a convenience; a full quota is not worth surfacing.
    }
  }
  return merged;
}

export function clearRecentPlaces(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    // As above.
  }
}
