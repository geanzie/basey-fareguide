import type { VehicleType } from './fare';

/**
 * Hand-written mirror of CuratedRouteCorpusDto in
 * frontend/src/lib/contracts/curatedRoutes.ts. Nothing generates this, so a
 * change to the wire shape has to be made on both sides.
 */

/**
 * One curated distance, as a positional tuple:
 * `[originIdx, destinationIdx, vehicleIdx, distanceMeters, durationSeconds, bidirectional]`
 *
 * Indices point into the corpus dictionaries. The corpus is ~4,950 rows over
 * ~51 places, so each id repeats roughly 194 times — the dictionary is what
 * keeps the payload at 107 KB instead of 950 KB, which matters both on the
 * rural connection that downloads it and in the AsyncStorage that holds it.
 */
export type CuratedRouteCorpusRow = [
  number,
  number,
  number,
  number,
  number | null,
  0 | 1,
];

export interface CuratedRouteCorpus {
  locationIds: string[];
  vehicleTypes: VehicleType[];
  routes: CuratedRouteCorpusRow[];
  count: number;
  /** ISO stamp of the newest row in the corpus. */
  generatedAt: string | null;
}

/** A curated distance resolved for one origin/destination/vehicle triple. */
export interface CuratedRouteMatch {
  distanceKm: number;
  durationMin: number | null;
  /** True when the corpus stored the reverse pair and it is bidirectional. */
  reversed: boolean;
}
