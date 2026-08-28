import type { LocationCoordinatesDto, PlannerLocationDto } from "@/lib/contracts";

/**
 * Client-side matching over the curated Place list.
 *
 * Ported from mobile/src/lib/placeSearch.ts. The two repos are separate git
 * checkouts with no workspace between them and each maps `@/*` to its own
 * `src/`, so this is a deliberate duplicate rather than a shared module — the
 * same arrangement as the hand-mirrored DTO types. Keep the two in step.
 *
 * Normalisation matters more here than it looks. The dataset contains
 * "Basey Ⅰ Central Elementary school" written with U+2160 ROMAN NUMERAL ONE —
 * nobody will ever type that character — and barangay names vary between
 * hyphenated and unhyphenated spellings (Balo-Og / Baloog, Lo-Og / Loog,
 * Can-Manila / Canmanila). Folding to NFKD and stripping non-alphanumerics
 * makes all of them reachable from what a person actually types.
 */

/** Two results closer than this are the same real-world spot, not two answers. */
const DUPLICATE_RADIUS_M = 60;

const MAX_RESULTS = 25;

/** Only offer fuzzy near-misses for queries long enough to be meaningful. */
const MIN_FUZZY_QUERY_LENGTH = 4;
const MAX_FUZZY_DISTANCE = 2;

export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Normalized tokens, so "elementary" matches inside a longer name. */
function tokens(value: string): string[] {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const CATEGORY_RANK: Record<string, number> = {
  barangay: 0,
  sitio: 1,
  landmark: 2,
};

function scoreOf(place: PlannerLocationDto, query: string): number | null {
  const name = normalize(place.name);
  if (!name) return null;

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (tokens(place.name).some((token) => token.startsWith(query))) return 2;
  if (name.includes(query)) return 3;

  // Barangay is searchable as a fallback so "sohoton" style area queries still
  // surface the places inside that area.
  if (place.barangay && normalize(place.barangay).includes(query)) return 4;

  return null;
}

/** Bounded Levenshtein — returns maxDistance + 1 once it is clearly too far. */
function editDistance(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      rowBest = Math.min(rowBest, current[j]);
    }
    if (rowBest > maxDistance) return maxDistance + 1;
    previous = current;
  }

  return previous[b.length];
}

function metersBetween(a: LocationCoordinatesDto, b: LocationCoordinatesDto): number {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Drops results that sit on top of an already-kept result. Barangay points now
 * use their barangay hall coordinate, so "Sulod" and "Bahay Pamahalaan ng
 * Barangay Sulod" are the same spot — showing both is noise, and the
 * higher-ranked one is the one the passenger meant.
 */
function dropCoincident(places: PlannerLocationDto[]): PlannerLocationDto[] {
  const kept: PlannerLocationDto[] = [];

  for (const place of places) {
    const duplicate = kept.some(
      (existing) => metersBetween(existing.coordinates, place.coordinates) < DUPLICATE_RADIUS_M,
    );
    if (!duplicate) kept.push(place);
  }

  return kept;
}

export interface PlaceSearchResult {
  places: PlannerLocationDto[];
  /** True when nothing matched directly and these are spelling near-misses. */
  isFuzzy: boolean;
}

export function searchPlaces(
  places: PlannerLocationDto[],
  rawQuery: string,
): PlaceSearchResult {
  const query = normalize(rawQuery);
  if (!query) return { places: [], isFuzzy: false };

  const scored: Array<{ place: PlannerLocationDto; score: number }> = [];

  for (const place of places) {
    const score = scoreOf(place, query);
    if (score !== null) scored.push({ place, score });
  }

  if (scored.length > 0) {
    scored.sort(
      (a, b) =>
        a.score - b.score ||
        (CATEGORY_RANK[a.place.category] ?? 3) - (CATEGORY_RANK[b.place.category] ?? 3) ||
        a.place.name.localeCompare(b.place.name),
    );
    return {
      places: dropCoincident(scored.map((entry) => entry.place)).slice(0, MAX_RESULTS),
      isFuzzy: false,
    };
  }

  if (query.length < MIN_FUZZY_QUERY_LENGTH) return { places: [], isFuzzy: false };

  const near: Array<{ place: PlannerLocationDto; distance: number }> = [];
  for (const place of places) {
    const distance = Math.min(
      editDistance(query, normalize(place.name), MAX_FUZZY_DISTANCE),
      ...tokens(place.name).map((token) => editDistance(query, token, MAX_FUZZY_DISTANCE)),
    );
    if (distance <= MAX_FUZZY_DISTANCE) near.push({ place, distance });
  }

  near.sort((a, b) => a.distance - b.distance || a.place.name.localeCompare(b.place.name));

  return {
    places: dropCoincident(near.map((entry) => entry.place)).slice(0, MAX_RESULTS),
    isFuzzy: near.length > 0,
  };
}

/**
 * The list a rider sees before typing anything.
 *
 * Nearest-first against the detected pickup, which turns the emptiest moment in
 * the app — a first visit with no recents — into the most useful one. With no
 * GPS fix there is nothing to measure from, so it falls back to alphabetical.
 *
 * Coincident points are dropped the same way search drops them, but ranked by
 * category *before* the distance sort, so a barangay survives its own hall.
 */
export function browsePlaces(
  places: PlannerLocationDto[],
  origin: LocationCoordinatesDto | null,
): PlannerLocationDto[] {
  const ranked = [...places].sort(
    (a, b) =>
      (CATEGORY_RANK[a.category] ?? 3) - (CATEGORY_RANK[b.category] ?? 3) ||
      a.name.localeCompare(b.name),
  );

  const unique = dropCoincident(ranked);

  if (!origin) return unique.sort((a, b) => a.name.localeCompare(b.name));

  return unique.sort(
    (a, b) =>
      metersBetween(origin, a.coordinates) - metersBetween(origin, b.coordinates) ||
      a.name.localeCompare(b.name),
  );
}
