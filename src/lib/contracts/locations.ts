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

