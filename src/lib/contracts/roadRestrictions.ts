import type { VehicleType } from "@prisma/client";

export type RoadRestrictionKindDto =
  | "IMPASSABLE"
  | "SEASONAL"
  | "GRADE_TOO_STEEP"
  | "SURFACE_UNSUITABLE"
  | "ONE_WAY_LOCAL";

export type RoadRestrictionGeometryDto = "POLYGON" | "POINT" | "OSM_WAY";

export interface RoadRestrictionDto {
  id: string;
  name: string;
  kind: RoadRestrictionKindDto;
  geometryType: RoadRestrictionGeometryDto;
  geometry: unknown;
  /** Empty means it applies to every vehicle type. */
  appliesTo: VehicleType[];
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  note: string | null;
  /** True when the restriction is active AND inside its effective window now. */
  inEffect: boolean;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoadRestrictionsResponseDto {
  roadRestrictions: RoadRestrictionDto[];
}

export interface RoadRestrictionMutationResponseDto {
  roadRestriction: RoadRestrictionDto;
}
