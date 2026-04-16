import type { DriverSessionRiderStatusDto } from "./driverSession";

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
}

export interface RiderActiveTripStatusResponseDto {
  hasActiveTrip: boolean;
  trip: RiderTripStatusDto | null;
}
