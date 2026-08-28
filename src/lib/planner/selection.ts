import type { PlannerLocationDto } from "@/lib/contracts";
import type { PlannerPoint } from "@/lib/planner/routePlanner";
import type { LocationInput } from "@/lib/routing/types";

/**
 * One end of a planned trip.
 *
 * Every selection carries a `point`, so the map, the bounds fitting and the
 * offline coordinate caches never need to know where it came from. `place` is
 * set only when the rider chose a curated location by name — that is what lets
 * the quote go out as a preset, which is how the server applies its vetted
 * coordinate, its ride-access rules and its drop-off notices. A dropped pin or
 * a GPS fix has no such record behind it and goes out as raw coordinates.
 */
export type PlannerSelectionSource = "map" | "gps" | "place";

export interface PlannerSelection {
  point: PlannerPoint;
  source: PlannerSelectionSource;
  place?: PlannerLocationDto;
}

export function buildPinSelection(point: PlannerPoint): PlannerSelection {
  return { point, source: "map" };
}

export function buildGpsSelection(point: PlannerPoint): PlannerSelection {
  return { point, source: "gps" };
}

export function buildPlaceSelection(place: PlannerLocationDto): PlannerSelection {
  return {
    point: { lat: place.coordinates.lat, lng: place.coordinates.lng, label: place.name },
    source: "place",
    place,
  };
}

export function selectionToPoint(selection: PlannerSelection | null): PlannerPoint | null {
  return selection?.point ?? null;
}

export function selectionToLocationInput(selection: PlannerSelection): LocationInput {
  if (selection.place) {
    return { type: "preset", name: selection.place.name };
  }

  return { type: "pin", lat: selection.point.lat, lng: selection.point.lng };
}

export function selectionLabel(selection: PlannerSelection | null, fallback: string): string {
  if (!selection) return fallback;
  return selection.place?.name ?? selection.point.label?.trim() ?? fallback ?? "";
}
