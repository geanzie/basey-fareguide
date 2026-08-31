import type { VehicleType } from "@prisma/client";

import type { CuratedRouteCorpusDto, CuratedRouteCorpusRowDto } from "@/lib/contracts";

const CORPUS_KEY = "basey:curatedCorpus";

/** Marks a quote answered from the surveyed corpus rather than a routing engine. */
export const OFFLINE_CURATED_REASON = "offline_curated";

/**
 * Persist the curated corpus so a trip between two saved places can be priced
 * with the radio off.
 *
 * Held in localStorage rather than IndexedDB alongside {@link routeCache}: the
 * corpus is one small document replaced wholesale, not a growing set of keyed
 * entries, and the read happens on the quote path where a synchronous hit beats
 * an awaited transaction. Measured at ~107 KB for Basey's 4,948 active rows,
 * comfortably inside a 5 MB budget.
 */
export function saveCuratedCorpus(corpus: CuratedRouteCorpusDto): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CORPUS_KEY, JSON.stringify(corpus));
  } catch {
    // Storage full / disabled — the offline path falls back to the cached
    // route, and failing that says it cannot price the trip.
  }
}

export function loadCuratedCorpus(): CuratedRouteCorpusDto | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CORPUS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CuratedRouteCorpusDto;

    // A corpus written by an older build, or a half-written one, must not throw
    // on the quote path.
    if (!Array.isArray(parsed?.locationIds) || !Array.isArray(parsed?.routes)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export interface CuratedCorpusMatch {
  distanceKm: number;
  durationMin: number | null;
  /** True when the stored row was measured in the opposite direction. */
  reversed: boolean;
}

function toMatch(row: CuratedRouteCorpusRowDto, reversed: boolean): CuratedCorpusMatch {
  const [, , , distanceMeters, durationSeconds] = row;

  return {
    // Both derivations mirror curatedRouteToResult exactly, including the
    // unrounded minutes: an offline quote that differs from the online one in
    // the last decimal is still a quote that disagrees with the driver's app.
    distanceKm: distanceMeters / 1000,
    durationMin: durationSeconds == null ? null : durationSeconds / 60,
    reversed,
  };
}

/**
 * Finds a surveyed distance for this trip in the cached corpus, or null.
 *
 * Mirrors `findCuratedRoute` on the server, deliberately and in full: same
 * vehicle-type requirement, same preference for the row measured in the
 * direction actually being travelled, and the same rule that a row stored the
 * other way only answers when its surveyor marked it bidirectional — Basey has
 * one-ways, so the reverse of a measured route is not automatically the same
 * distance. If the two ever disagree, the rider sees a fare the driver's app
 * does not, which is the dispute this whole corpus exists to prevent.
 */
export function findCuratedCorpusRoute(
  corpus: CuratedRouteCorpusDto | null,
  originLocationId: string | null | undefined,
  destinationLocationId: string | null | undefined,
  vehicleType: VehicleType | null | undefined,
): CuratedCorpusMatch | null {
  // A quote with no vehicle context has no business consuming a distance
  // measured for a specific vehicle.
  if (!corpus || !originLocationId || !destinationLocationId || !vehicleType) {
    return null;
  }

  const originIdx = corpus.locationIds.indexOf(originLocationId);
  const destinationIdx = corpus.locationIds.indexOf(destinationLocationId);
  const vehicleIdx = corpus.vehicleTypes.indexOf(vehicleType);

  if (originIdx < 0 || destinationIdx < 0 || vehicleIdx < 0) {
    return null;
  }

  let reverse: CuratedRouteCorpusRowDto | null = null;

  for (const row of corpus.routes) {
    const [rowOrigin, rowDestination, rowVehicle, , , bidirectional] = row;

    if (rowVehicle !== vehicleIdx) continue;

    // At most one row can match forward, so the first is the answer.
    if (rowOrigin === originIdx && rowDestination === destinationIdx) {
      return toMatch(row, false);
    }

    if (
      reverse === null &&
      bidirectional === 1 &&
      rowOrigin === destinationIdx &&
      rowDestination === originIdx
    ) {
      reverse = row;
    }
  }

  return reverse === null ? null : toMatch(reverse, true);
}
