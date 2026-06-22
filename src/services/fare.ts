import { api } from './api';
import type {
  RouteCalculationRequest,
  RouteCalculationResponse,
  FareCalculation,
  FareRate,
  FareRatesResponse,
  VehicleLookup,
} from '@/types/fare';
import type { PaginatedResponse } from '@/types/common';

export type { FareRatesResponse } from '@/types/fare';

export async function calculateRoute(req: RouteCalculationRequest): Promise<RouteCalculationResponse> {
  return api.post<RouteCalculationResponse>('/api/routes/calculate', req);
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
  discountType: string;
  isEstimate: boolean;
}): Promise<FareCalculation> {
  return api.post<FareCalculation>('/api/fare-calculations', payload);
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
