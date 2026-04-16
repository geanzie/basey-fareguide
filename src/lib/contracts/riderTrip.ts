import type { DriverSessionRiderStatusDto } from "./driverSession";

export interface RiderTripStatusDto {
  id: string;
  fareCalculationId: string;
  status: DriverSessionRiderStatusDto;
  statusLabel: string;
  origin: string;
  destination: string;
  fare: number;
  discountType: string | null;
  joinedAt: string;
  acceptedAt: string | null;
  vehiclePlateNumber: string | null;
  vehicleType: string | null;
}

export interface RiderActiveTripStatusResponseDto {
  hasActiveTrip: boolean;
  trip: RiderTripStatusDto | null;
}
