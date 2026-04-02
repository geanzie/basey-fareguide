import type { PaginationDto } from "./common";
import type { PermitStatus, VehicleType } from "@prisma/client";

export interface PermitRenewalDto {
  id: string;
  previousExpiry: string;
  newExpiry: string;
  renewedBy: string;
  renewedAt: string;
  notes: string | null;
}

export interface PermitVehicleSummaryDto {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  ownerName: string;
  vehicleType: VehicleType | string;
}

export interface PermitDto {
  id: string;
  permitPlateNumber: string;
  driverFullName: string;
  vehicleType: VehicleType | string;
  issuedDate: string;
  expiryDate: string;
  status: PermitStatus | string;
  remarks: string | null;
  encodedBy: string;
  encodedAt: string;
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
  renewalHistory: PermitRenewalDto[];
  vehicle: PermitVehicleSummaryDto | null;
}

export interface PermitsResponseDto {
  permits: PermitDto[];
  pagination: PaginationDto;
}
