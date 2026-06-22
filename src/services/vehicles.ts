import { api } from './api';
import type { VehicleLookup } from '@/types/fare';

export async function searchVehicles(query: string): Promise<VehicleLookup[]> {
  if (query.trim().length < 2) return [];
  const res = await api.get<{ vehicles: VehicleLookup[] }>(
    `/api/vehicles/options?search=${encodeURIComponent(query.trim())}`,
  );
  return res.vehicles ?? [];
}

export async function setVehicleActive(id: string, isActive: boolean): Promise<unknown> {
  return api.patch(`/api/vehicles/${id}`, { isActive });
}

export async function lookupByRideTag(token: string): Promise<VehicleLookup | null> {
  const res = await api.post<{ matchFound: boolean; vehicle?: VehicleLookup }>(
    '/api/public/ride-tag/lookup',
    { token },
  );
  return res.matchFound && res.vehicle ? res.vehicle : null;
}
