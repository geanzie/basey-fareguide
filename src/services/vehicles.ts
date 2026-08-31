import { api } from './api';
import type { RideTagLookupResult, VehicleLookup } from '@/types/fare';

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

/**
 * Resolve a scanned permit QR token to its vehicle.
 *
 * Returns the whole result rather than just the vehicle: `permitStatus` can be
 * EXPIRED / SUSPENDED / REVOKED on a match, and the caller has to warn before
 * letting that vehicle carry a trip request.
 */
export async function lookupByRideTag(token: string): Promise<RideTagLookupResult> {
  const res = await api.post<RideTagLookupResult>('/api/public/ride-tag/lookup', { token });
  return {
    matchFound: Boolean(res.matchFound),
    permitStatus: res.permitStatus ?? null,
    vehicle: res.vehicle ?? null,
    message: res.message ?? '',
  };
}
