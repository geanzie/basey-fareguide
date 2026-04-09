import type { FareCalculationDto } from "@/lib/contracts";
import { hasVehicleContext } from "@/lib/incidents/reportTripSelection";
import { formatPinCoordinateLabel } from "@/lib/locations/pinLabelResolver";
import { parsePinLabel } from "@/lib/locations/pinSerializer";

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(String(value));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseRouteData(value: string | null | undefined): unknown | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function formatFareLocationLabel(value: string): string {
  const parsedPin = parsePinLabel(value);

  if (!parsedPin) {
    return value;
  }

  return formatPinCoordinateLabel(parsedPin.lat, parsedPin.lng);
}

export function serializeFareCalculation(record: {
  id: string;
  fromLocation: string;
  toLocation: string;
  distance: unknown;
  calculatedFare: unknown;
  actualFare?: unknown;
  originalFare?: unknown;
  discountApplied?: unknown;
  discountType?: string | null;
  calculationType: string;
  createdAt: Date | string;
  routeData?: string | null;
  vehicle?: {
    id?: string;
    plateNumber: string;
    vehicleType: string;
    permit?: {
      permitPlateNumber: string;
    } | null;
  } | null;
}): FareCalculationDto {
  return {
    id: record.id,
    from: formatFareLocationLabel(record.fromLocation),
    to: formatFareLocationLabel(record.toLocation),
    distanceKm: toNullableNumber(record.distance) ?? 0,
    fare: toNullableNumber(record.calculatedFare) ?? 0,
    actualFare: toNullableNumber(record.actualFare),
    originalFare: toNullableNumber(record.originalFare),
    discountApplied: toNullableNumber(record.discountApplied),
    discountType: record.discountType ?? null,
    calculationType: record.calculationType,
    createdAt: toIsoString(record.createdAt),
    routeData: parseRouteData(record.routeData),
    vehicle: record.vehicle
      ? {
          id: record.vehicle.id,
          permitPlateNumber: record.vehicle.permit?.permitPlateNumber ?? null,
          plateNumber: record.vehicle.plateNumber ?? null,
          vehicleType: record.vehicle.vehicleType ?? null,
          hasVehicleContext: hasVehicleContext(
            record.vehicle.permit?.permitPlateNumber ?? null,
            record.vehicle.plateNumber ?? null,
          ),
        }
      : null,
  };
}
