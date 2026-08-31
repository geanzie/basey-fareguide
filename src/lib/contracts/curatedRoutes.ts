import type { VehicleType } from "@prisma/client";

import type { PaginationDto } from "./common";

/** Where a curated distance came from, in descending order of trust. */
export type CuratedRouteSourceDto =
  | "SURVEYED"
  | "ORDINANCE"
  | "ADOPTED_FROM_ENGINE"
  | "BATCH_SEEDED";

/** One end of a curated route, named for the admin list. */
export interface CuratedRouteEndpointDto {
  id: string;
  name: string;
  barangay: string | null;
}

export interface CuratedRouteDto {
  id: string;
  origin: CuratedRouteEndpointDto;
  destination: CuratedRouteEndpointDto;
  vehicleType: VehicleType;
  distanceMeters: number;
  /** Convenience for display; always distanceMeters / 1000. */
  distanceKm: number;
  durationSeconds: number | null;
  polyline: string | null;
  isBidirectional: boolean;
  source: CuratedRouteSourceDto;
  /** True on rows produced in bulk that nobody has confirmed on the ground. */
  needsSurvey: boolean;
  notes: string | null;
  isActive: boolean;
  surveyedAt: string;
  surveyedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CuratedRoutesResponseDto {
  curatedRoutes: CuratedRouteDto[];
  pagination: PaginationDto;
}

export interface CuratedRouteMutationResponseDto {
  curatedRoute: CuratedRouteDto;
}

/**
 * One curated distance in the rider-facing corpus, as a positional tuple:
 * `[originIdx, destinationIdx, vehicleIdx, distanceMeters, durationSeconds, bidirectional]`
 *
 * `originIdx` / `destinationIdx` index into `locationIds`, `vehicleIdx` into
 * `vehicleTypes`, and `bidirectional` is 0 or 1.
 */
export type CuratedRouteCorpusRowDto = [
  number,
  number,
  number,
  number,
  number | null,
  0 | 1,
];

/**
 * The whole active curated corpus, sized for a phone on a weak rural
 * connection — which is the only reason this endpoint exists.
 *
 * Measured on Basey's 4,948 active rows over 51 places: serialized as
 * {@link CuratedRouteDto}-shaped objects the payload is 950 KB (48.5 KB gzipped);
 * as an id dictionary plus positional tuples it is 107 KB (31.4 KB gzipped).
 * Each location id repeats ~194 times, so the dictionary pays for itself many
 * times over. The gzipped saving is the smaller half of the point — the client
 * holds this in AsyncStorage, which is capped well below a megabyte's comfort
 * on Android, and stores what it parsed rather than what it downloaded.
 *
 * The rider never sees these fields, so there is no readability cost to trade.
 *
 * Deliberately omits `polyline`: the offline path draws no map, so shipping
 * geometry would be the largest field in the payload and the least used.
 */
export interface CuratedRouteCorpusDto {
  /** Location ids, referenced by index from {@link routes}. */
  locationIds: string[];
  /** Vehicle types, referenced by index from {@link routes}. */
  vehicleTypes: VehicleType[];
  routes: CuratedRouteCorpusRowDto[];
  count: number;
  /** ISO stamp of the newest row, so a client can tell whether to refetch. */
  generatedAt: string | null;
}
