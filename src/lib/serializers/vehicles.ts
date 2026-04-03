import type { VehicleDto, VehicleLookupDto } from "@/lib/contracts";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeVehicle(record: {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  year: number;
  color: string;
  capacity: number;
  isActive: boolean;
  ownerName: string;
  ownerContact: string;
  driverName?: string | null;
  driverLicense?: string | null;
  registrationExpiry: Date | string;
  insuranceExpiry?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  permit?: {
    id: string;
    permitPlateNumber: string;
    status: string;
    issuedDate: Date | string;
    expiryDate: Date | string;
  } | null;
}): VehicleDto {
  return {
    id: record.id,
    plateNumber: record.plateNumber,
    vehicleType: record.vehicleType,
    make: record.make,
    model: record.model,
    year: record.year,
    color: record.color,
    capacity: record.capacity,
    isActive: record.isActive,
    ownerName: record.ownerName,
    ownerContact: record.ownerContact,
    driverName: record.driverName ?? null,
    driverLicense: record.driverLicense ?? null,
    registrationExpiry: toIsoString(record.registrationExpiry) ?? new Date(0).toISOString(),
    insuranceExpiry: toIsoString(record.insuranceExpiry),
    createdAt: toIsoString(record.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date(0).toISOString(),
    permit: record.permit
      ? {
          id: record.permit.id,
          permitPlateNumber: record.permit.permitPlateNumber,
          status: record.permit.status,
          issuedDate: toIsoString(record.permit.issuedDate) ?? new Date(0).toISOString(),
          expiryDate: toIsoString(record.permit.expiryDate) ?? new Date(0).toISOString(),
        }
      : null,
  };
}

export function serializeVehicleLookup(record: {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  color: string;
  ownerName: string;
  driverName?: string | null;
  driverLicense?: string | null;
  permit?: {
    permitPlateNumber: string;
  } | null;
}): VehicleLookupDto {
  return {
    id: record.id,
    plateNumber: record.plateNumber,
    permitPlateNumber: record.permit?.permitPlateNumber ?? null,
    vehicleType: record.vehicleType,
    make: record.make,
    model: record.model,
    color: record.color,
    ownerName: record.ownerName,
    driverName: record.driverName ?? null,
    driverLicense: record.driverLicense ?? null,
  };
}
