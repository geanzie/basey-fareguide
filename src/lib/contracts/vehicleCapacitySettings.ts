import type { VehicleType } from "@prisma/client";

/**
 * Seats a vehicle type may sell, set by an admin and uniform across every
 * vehicle of that type. Ordinance 105 prices a passenger's trip and names no
 * capacity, so this is municipal policy rather than ordinance text.
 *
 * Only types on the rider-scan flow are seat-managed. A type absent from the
 * map has no ceiling and no charter option — reading a missing key as zero
 * would block every scan against it.
 */
export type SeatCapacityMap = Partial<Record<VehicleType, number>>;

export interface VehicleCapacitySettingsDto {
  seatCapacities: SeatCapacityMap;
}

export interface AdminVehicleCapacitySettingsResponseDto
  extends VehicleCapacitySettingsDto {
  /** Types the admin may set, so the page needs no local copy. */
  configurableVehicleTypes: VehicleType[];
  minCapacity: number;
  maxCapacity: number;
  lastUpdatedById: string | null;
  lastUpdatedByName: string | null;
  lastUpdatedAt: string | null;
  /** Set when the settings table has not been migrated yet. */
  warning?: string | null;
}

export interface AdminVehicleCapacitySettingsUpdateRequestDto {
  seatCapacities: SeatCapacityMap;
}
