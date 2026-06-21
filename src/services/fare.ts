import { api } from './api';
import type { RouteCalculationRequest, RouteCalculationResponse, FareCalculation, FareRate } from '@/types/fare';
import type { PaginatedResponse } from '@/types/common';

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

export async function fetchFareHistory(page = 1, pageSize = 20): Promise<PaginatedResponse<FareCalculation>> {
  return api.get<PaginatedResponse<FareCalculation>>(
    `/api/fare-calculations?page=${page}&pageSize=${pageSize}`,
  );
}

export async function fetchCurrentFareRates(): Promise<FareRate> {
  return api.get<FareRate>('/api/fare-rates/current');
}

export async function fetchAdminFareRates(): Promise<{ items: FareRate[] }> {
  return api.get<{ items: FareRate[] }>('/api/fare-rates');
}

export async function createFareRate(payload: {
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  notes?: string;
  effectiveFrom: string;
}): Promise<FareRate> {
  return api.post<FareRate>('/api/admin/fare-rates', payload);
}
