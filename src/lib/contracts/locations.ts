import type { PaginationDto } from "./common";

export interface LocationCoordinatesDto {
  lat: number;
  lng: number;
}

export type PlannerLocationCategory = "barangay" | "landmark" | "sitio";

export interface PlannerLocationDto {
  id: string;
  name: string;
  type: string;
  category: PlannerLocationCategory;
  coordinates: LocationCoordinatesDto;
  address: string;
  verified: boolean;
  source: string;
  barangay?: string;
  description?: string;
  updatedAt: string;
}

export interface PlannerLocationsMetadataDto {
  municipality: string;
  province: string;
  total_locations: number;
  last_updated: string | null;
  sources: string[];
}

export interface PlannerLocationsResponseDto {
  success: boolean;
  locations: PlannerLocationDto[];
  count: number;
  metadata: PlannerLocationsMetadataDto | null;
  error?: string;
}

export interface AdminLocationDto {
  id: string;
  name: string;
  type: string;
  coordinates: string;
  barangay: string | null;
  description: string | null;
  isActive: boolean;
  validationStatus: string;
  googleFormattedAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLocationsResponseDto {
  locations: AdminLocationDto[];
  pagination: PaginationDto & {
    pages?: number;
  };
}
