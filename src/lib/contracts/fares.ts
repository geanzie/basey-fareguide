import type { PaginationDto } from "./common";

export interface FareVehicleSummaryDto {
  id?: string;
  plateNumber: string;
  vehicleType: string;
}

export interface FareCalculationDto {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  fare: number;
  actualFare: number | null;
  originalFare: number | null;
  discountApplied: number | null;
  discountType: string | null;
  calculationType: string;
  createdAt: string;
  routeData: unknown | null;
  vehicle: FareVehicleSummaryDto | null;
}

export interface FareCalculationsResponseDto {
  calculations: FareCalculationDto[];
  pagination: PaginationDto;
  message?: string;
}

export interface FareCalculationMutationResponseDto {
  success: boolean;
  calculation: FareCalculationDto;
  message: string;
}
