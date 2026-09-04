import type { VehicleType } from "@prisma/client";

import type { SeatCapacityMap } from "./vehicleCapacitySettings";

/**
 * Vehicle types the municipality has suspended from the driver trip-session
 * flow. For a suspended type the driver never goes online and never accepts:
 * the rider scans the vehicle's printed permit QR and records the trip itself.
 */
export interface DriverSessionSettingsDto {
  suspendedVehicleTypes: VehicleType[];
}

export interface AdminDriverSessionSettingsResponseDto
  extends DriverSessionSettingsDto {
  /** Every value the admin may pick from, so the page needs no local copy. */
  availableVehicleTypes: VehicleType[];
  lastUpdatedById: string | null;
  lastUpdatedByName: string | null;
  lastUpdatedAt: string | null;
  /** Set when the settings table has not been migrated yet. */
  warning?: string | null;
}

export interface AdminDriverSessionSettingsUpdateRequestDto {
  suspendedVehicleTypes: VehicleType[];
}

/**
 * The unauthenticated projection both clients read to decide which flow a
 * scanned vehicle takes. Riders scan before logging in, so this carries no
 * auth requirement and nothing sensitive.
 */
export interface TripFlowConfigDto {
  suspendedVehicleTypes: VehicleType[];
  /**
   * Seats each seat-managed type may sell. Carried on the same unauthenticated
   * response as the suspension list because a rider needs both on one screen —
   * which flow the scan takes, and how many seats a charter would buy — and a
   * second round-trip on the scan path buys nothing.
   *
   * A type absent from this map is not seat-managed: no ceiling, no charter.
   */
  seatCapacities: SeatCapacityMap;
}
