import type { LocationCoordinatesDto, PlannerLocationDto } from "@/lib/contracts";
import type { PlannerPoint } from "@/lib/planner/routePlanner";
import { browsePlaces, searchPlaces } from "@/lib/locations/placeSearch";
import { recentKey, recentLabel, type RecentEntry } from "@/lib/locations/recentPlaces";

/**
 * Builds the one list the rider actually reads: recents on top, then everything
 * else nearest-first, replaced wholesale by results once they start typing.
 *
 * Pure and React-free so the calculator can own keyboard focus over it — arrow
 * keys need the flattened option order, which only exists once the sections are
 * interleaved.
 */

export type PlaceRow =
  | { type: "header"; key: string; title: string }
  | { type: "place"; key: string; place: PlannerLocationDto; recent: boolean }
  | { type: "pin"; key: string; point: PlannerPoint; recent: boolean };

/** The subset of rows a rider can actually choose, in display order. */
export type PlaceOption = Exclude<PlaceRow, { type: "header" }>;

export interface PlaceRowsResult {
  rows: PlaceRow[];
  options: PlaceOption[];
  /** True when nothing matched directly and these are spelling near-misses. */
  isFuzzy: boolean;
  /** True when the rider has typed something, so the list is results rather than browse. */
  searching: boolean;
}

export function buildPlaceRows({
  places,
  recents,
  query,
  originCoordinates,
}: {
  places: PlannerLocationDto[];
  recents: RecentEntry[];
  query: string;
  originCoordinates: LocationCoordinatesDto | null;
}): PlaceRowsResult {
  const searching = query.trim().length > 0;

  if (searching) {
    const { places: results, isFuzzy } = searchPlaces(places, query);
    const rows: PlaceRow[] = results.map((place) => ({
      type: "place",
      key: `result:${place.id}`,
      place,
      recent: false,
    }));
    return { rows, options: rows as PlaceOption[], isFuzzy, searching };
  }

  const rows: PlaceRow[] = [];

  if (recents.length > 0) {
    rows.push({ type: "header", key: "header:recent", title: "Recent" });
    // A stored recent carries the place as it was when it was quoted, so it is
    // re-resolved against the live list — a renamed or re-surveyed place shows
    // its current self rather than a snapshot.
    const byId = new Map(places.map((place) => [place.id, place]));
    for (const entry of recents) {
      const key = `recent:${recentKey(entry)}`;
      if (entry.kind === "place") {
        rows.push({
          type: "place",
          key,
          place: byId.get(entry.place.id) ?? entry.place,
          recent: true,
        });
      } else {
        rows.push({
          type: "pin",
          key,
          point: { ...entry.point, label: recentLabel(entry) },
          recent: true,
        });
      }
    }
  }

  const browse = browsePlaces(places, originCoordinates);
  if (browse.length > 0) {
    rows.push({
      type: "header",
      key: "header:browse",
      title: originCoordinates ? "Nearby" : "All places",
    });
    for (const place of browse) {
      rows.push({ type: "place", key: `browse:${place.id}`, place, recent: false });
    }
  }

  return {
    rows,
    options: rows.filter((row): row is PlaceOption => row.type !== "header"),
    isFuzzy: false,
    searching,
  };
}

/** How a row reads under its name. */
export function describePlace(place: PlannerLocationDto): string {
  if (place.category === "barangay") return "Barangay";
  return (
    [place.barangay, place.category === "sitio" ? "Sitio" : null].filter(Boolean).join(" · ") ||
    "Basey"
  );
}
