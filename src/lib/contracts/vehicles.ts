import type { PaginationDto } from "./common";
import type { PermitStatus, VehicleType } from "@prisma/client";

export interface VehiclePermitSummaryDto {
  id: string;
  permitPlateNumber: string;
  status: PermitStatus | string;
  issuedDate: string;
  expiryDate: string;
}

export interface VehicleDto {
  id: string;
  plateNumber: string;
  vehicleType: VehicleType | string;
  make: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  isActive: boolean;
  ownerName: string;
  ownerContact: string;
  driverName: string | null;
  driverLicense: string | null;
  registrationExpiry: string;
  insuranceExpiry: string | null;
  createdAt: string;
  updatedAt: string;
  permit: VehiclePermitSummaryDto | null;
}

export interface VehicleLookupDto {
  id: string;
  plateNumber: string;
  permitPlateNumber: string | null;
  vehicleType: VehicleType | string;
  make: string;
  model: string;
  color: string;
  ownerName: string;
  driverName: string | null;
  driverLicense: string | null;
}

export interface VehiclesResponseDto {
  vehicles: VehicleDto[];
  pagination: PaginationDto;
}

export interface VehicleLookupResponseDto {
  vehicles: VehicleLookupDto[];
}
