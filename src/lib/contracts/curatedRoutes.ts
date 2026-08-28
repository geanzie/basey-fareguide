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
