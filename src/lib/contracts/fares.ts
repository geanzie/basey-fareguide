import type { DriverSessionRiderStatusDto } from "./driverSession";
import type { PaginationDto } from "./common";

export interface FareVehicleSummaryDto {
  id?: string;
  permitPlateNumber: string | null;
  plateNumber: string | null;
  vehicleType: string | null;
  hasVehicleContext: boolean;
}

export interface FareCalculationDto {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  /** Total owed. On a charter this covers every seat, not one. */
  fare: number;
  /**
   * Seats this fare bought. 1 on a shared ride. Greater than 1 means the
   * rider chartered the vehicle, which is what makes `fare` larger than a
   * single-passenger fare for the same distance.
   */
  seatsPaid: number;
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
  calculation: FareCalculationDto | null;
  tripRequestId: string | null;
  requestStatus: DriverSessionRiderStatusDto | null;
  /**
   * True when this vehicle type is suspended from the driver session flow, so
   * the trip started immediately instead of waiting on a driver to accept.
   */
  riderConfirmsTrip?: boolean;
  message: string;
}
