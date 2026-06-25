export type PassengerType = 'REGULAR' | 'STUDENT' | 'SENIOR' | 'PWD';
export type DiscountType = 'NONE' | 'STUDENT' | 'SENIOR_CITIZEN' | 'PWD';

export interface FarePolicySnapshot {
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
}

export interface FareBreakdown {
  baseFare: number;
  additionalKm: number;
  additionalFare: number;
  discount: number;
}

export interface RouteCalculationRequest {
  origin: { type: 'pin'; lat: number; lng: number };
  destination: { type: 'pin'; lat: number; lng: number };
  passengerType: PassengerType;
}

export interface RouteCalculationResponse {
  distanceKm: number;
  durationMin?: number;
  fare: number;
  isEstimate: boolean;
  fareBreakdown: FareBreakdown;
  farePolicy: FarePolicySnapshot;
  method: 'ors' | 'google_routes' | null;
  provider: 'ors' | 'google_routes' | null;
  fallbackReason: string | null;
  polyline: string | null;
  snappedOrigin: { lat: number; lng: number } | null;
  snappedDestination: { lat: number; lng: number } | null;
  passengerType: PassengerType;
  origin: string;
  destination: string;
}

export interface VehicleLookup {
  id?: string;
  plateNumber: string | null;
  permitPlateNumber: string | null;
  vehicleType: string | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  hasVehicleContext: boolean;
}

export interface FareCalculation {
  id: string;
  originLabel: string;
  destinationLabel: string;
  distanceKm: number;
  fare: number;
  discountType: DiscountType;
  isEstimate: boolean;
  createdAt: string;
  vehicle: VehicleLookup | null;
}

export interface FareRate {
  id: string;
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  notes?: string;
  isActive: boolean;
  effectiveAt: string;
  createdAt: string;
}

/** A resolved fare policy as returned by GET /api/fare-rates. */
export interface FareRateSnapshot {
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  effectiveAt: string | null;
}

export interface FareRatesResponse {
  current: FareRateSnapshot;
  upcoming: FareRateSnapshot | null;
}
