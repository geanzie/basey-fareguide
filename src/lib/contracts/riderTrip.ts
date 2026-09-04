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
  /**
   * Seats this rider is holding. 1 on a shared ride; the vehicle's capacity
   * on a charter, where `fare` is the total for all of them.
   */
  seatsPaid: number;
  discountType: string | null;
  joinedAt: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  boardedAt: string | null;
  vehiclePlateNumber: string | null;
  vehicleType: string | null;
  /**
   * The FareRateVersion that was in force when this trip was priced, so a rider
   * can open the issuance behind the fare they are being charged.
   *
   * Derived from joinedAt rather than stored: FareCalculation records no rate
   * version, so this is the version live at that moment. Null when no version
   * row applies (the legacy DEFAULT_FARE_POLICY, or before migrations run).
   */
  fareVersionId: string | null;
  /** True when the rider opened this trip by scanning the vehicle's permit QR. */
  riderInitiated: boolean;
  /** Empty on a driver-run trip: the driver owns those transitions. */
  availableRiderActions: RiderTripActionButtonDto[];
}

export interface RiderActiveTripStatusResponseDto {
  hasActiveTrip: boolean;
  trip: RiderTripStatusDto | null;
}
