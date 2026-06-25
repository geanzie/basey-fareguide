import { api } from './api';
import type {
  DiscountType,
  PassengerType,
  RouteCalculationResponse,
  FareCalculation,
  FareRate,
  FareRatesResponse,
  VehicleLookup,
} from '@/types/fare';
import type { PaginatedResponse } from '@/types/common';

export type { FareRatesResponse } from '@/types/fare';

function discountTypeToPassengerType(discountType: DiscountType): PassengerType {
  switch (discountType) {
    case 'STUDENT': return 'STUDENT';
    case 'SENIOR_CITIZEN': return 'SENIOR';
    case 'PWD': return 'PWD';
    default: return 'REGULAR';
  }
}

export async function calculateRoute(params: {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  discountType?: DiscountType;
}): Promise<RouteCalculationResponse> {
  return api.post<RouteCalculationResponse>('/api/routes/calculate', {
    origin: { type: 'pin', lat: params.originLat, lng: params.originLng },
    destination: { type: 'pin', lat: params.destinationLat, lng: params.destinationLng },
    passengerType: discountTypeToPassengerType(params.discountType ?? 'NONE'),
  });
}

export async function saveFareCalculation(payload: {
  originLat: number;
  originLng: number;
  originLabel: string;
  destinationLat: number;
  destinationLng: number;
  destinationLabel: string;
  distanceKm: number;
  fare: number;
  discountType: DiscountType;
  isEstimate: boolean;
  vehicleId: string;
  method: 'ors' | 'google_routes' | null;
  provider: 'ors' | 'google_routes' | null;
  polyline: string | null;
  farePolicySnapshot: { baseFare: number; baseDistanceKm: number; perKmRate: number };
}): Promise<{ success: boolean; tripRequestId?: string }> {
  return api.post<{ success: boolean; tripRequestId?: string }>('/api/fare-calculations', {
    fromLocation: payload.originLabel,
    toLocation: payload.destinationLabel,
    distance: payload.distanceKm,
    calculatedFare: payload.fare,
    calculationType: 'route',
    vehicleId: payload.vehicleId,
    discountType: payload.discountType !== 'NONE' ? payload.discountType : null,
    routeData: {
      method: payload.method,
      provider: payload.provider,
      isEstimate: payload.isEstimate,
      polyline: payload.polyline,
      originLat: payload.originLat,
      originLng: payload.originLng,
      destinationLat: payload.destinationLat,
      destinationLng: payload.destinationLng,
    },
    farePolicySnapshot: payload.farePolicySnapshot,
  });
}

function normalizeFareCalc(raw: Record<string, unknown>): FareCalculation {
  return {
    ...(raw as unknown as FareCalculation),
    originLabel: (raw.from ?? raw.fromLocation ?? raw.originLabel) as string,
    destinationLabel: (raw.to ?? raw.toLocation ?? raw.destinationLabel) as string,
    vehicle: (raw.vehicle as VehicleLookup) ?? null,
  };
}

export async function fetchFareHistory(page = 1, pageSize = 20): Promise<PaginatedResponse<FareCalculation>> {
  const res = await api.get<{ calculations: Record<string, unknown>[] }>(
    `/api/fare-calculations?page=${page}&pageSize=${pageSize}`,
  );
  return { items: (res.calculations ?? []).map(normalizeFareCalc), total: 0, page, pageSize, hasMore: false };
}

export async function fetchCurrentFareRates(): Promise<FareRatesResponse> {
  return api.get<FareRatesResponse>('/api/fare-rates');
}

export async function fetchAdminFareRates(): Promise<{ items: FareRate[] }> {
  const res = await api.get<{ history: FareRate[] }>('/api/admin/fare-rates');
  return { items: res.history ?? [] };
}

export async function createFareRate(payload: {
  baseFare: number;
  perKmRate: number;
  notes: string;
}): Promise<FareRate> {
  return api.post<FareRate>('/api/admin/fare-rates', payload);
}
