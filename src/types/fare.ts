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
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  discountType?: DiscountType;
}

export interface RouteCalculationResponse {
  distanceKm: number;
  durationMin?: number;
  fare: number;
  isEstimate: boolean;
  fareBreakdown: FareBreakdown;
  farePolicy: FarePolicySnapshot;
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
