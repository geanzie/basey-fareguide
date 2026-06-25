import { api } from './api';

export type RiderTripStatus = 'PENDING' | 'ACCEPTED' | 'BOARDED' | 'COMPLETED';

export interface RiderTrip {
  id: string;
  fareCalculationId: string | null;
  status: RiderTripStatus;
  statusLabel: string;
  origin: string;
  destination: string;
  fare: number;
  discountType: string | null;
  joinedAt: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  boardedAt: string | null;
  vehiclePlateNumber: string;
  vehicleType: string;
}

export interface RiderActiveTripStatus {
  hasActiveTrip: boolean;
  trip: RiderTrip | null;
}

/** The rider's current active trip request (PENDING/ACCEPTED/BOARDED/COMPLETED), if any. */
export async function fetchActiveTripStatus(): Promise<RiderActiveTripStatus> {
  return api.get<RiderActiveTripStatus>('/api/public/trip-status');
}
