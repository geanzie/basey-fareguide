import type { DriverSessionRiderStatusDto } from "./driverSession";

/**
 * What the rider may do to their own trip. Only ever populated for a
 * rider-initiated trip (a suspended vehicle type), because on the normal flow
 * these transitions belong to the driver.
 */
export type RiderTripActionDto = "DROPPED_OFF" | "CANCELLED";

export interface RiderTripActionButtonDto {
  action: RiderTripActionDto;
  label: string;
  kind: "positive" | "negative";
}

export interface RiderTripStatusDto {
  id: string;
  fareCalculationId: string | null;
  status: DriverSessionRiderStatusDto;
  statusLabel: string;
  origin: string;
  destination: string;
  fare: number;
  discountType: string | null;
  joinedAt: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  boardedAt: string | null;
  vehiclePlateNumber: string | null;
  vehicleType: string | null;
  /** True when the rider opened this trip by scanning the vehicle's permit QR. */
  riderInitiated: boolean;
  /** Empty on a driver-run trip: the driver owns those transitions. */
  availableRiderActions: RiderTripActionButtonDto[];
}

export interface RiderActiveTripStatusResponseDto {
  hasActiveTrip: boolean;
  trip: RiderTripStatusDto | null;
}
