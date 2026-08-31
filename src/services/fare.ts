import { api } from './api';
import { saveLastFarePolicy } from '@/lib/offline/farePolicyCache';
import type {
  DiscountType,
  FarePolicySnapshot,
  LocationInput,
  PassengerType,
  RouteCalculationResponse,
  RouteSource,
  VehicleType,
  FareCalculation,
  FareRate,
  FareRatesResponse,
  VehicleLookup,
} from '@/types/fare';
import type { PaginatedResponse } from '@/types/common';
import type { PlaceSelection } from '@/types/places';

export type { FareRatesResponse } from '@/types/fare';

export function discountTypeToPassengerType(discountType: DiscountType): PassengerType {
  switch (discountType) {
    case 'STUDENT': return 'STUDENT';
    case 'SENIOR_CITIZEN': return 'SENIOR';
    case 'PWD': return 'PWD';
    default: return 'REGULAR';
  }
}

const VEHICLE_TYPES: readonly VehicleType[] = [
  'JEEPNEY',
  'TRICYCLE',
  'HABAL_HABAL',
  'MULTICAB',
  'BUS',
  'VAN',
];

/**
 * Narrows the loosely typed `vehicleType` a vehicle lookup returns. An
 * unrecognised value becomes null rather than being forwarded, so the server
 * rejects nothing and the quote falls back to car routing.
 */
export function toVehicleType(value: string | null | undefined): VehicleType | null {
  return value && (VEHICLE_TYPES as readonly string[]).includes(value)
    ? (value as VehicleType)
    : null;
}

export async function calculateRoute(params: {
  origin: LocationInput;
  destination: LocationInput;
  discountType?: DiscountType;
  vehicleType?: VehicleType | null;
}): Promise<RouteCalculationResponse> {
  return api.post<RouteCalculationResponse>('/api/routes/calculate', {
    origin: params.origin,
    destination: params.destination,
    passengerType: discountTypeToPassengerType(params.discountType ?? 'NONE'),
    vehicleType: params.vehicleType ?? null,
  });
}

/** Turns a chosen Place or dropped pin into the request shape the API expects. */
export function selectionToLocationInput(selection: PlaceSelection): LocationInput {
  if (selection.kind === 'place') {
    return { type: 'preset', name: selection.place.name };
  }
  return { type: 'pin', lat: selection.coordinates.lat, lng: selection.coordinates.lng };
}

export interface SaveFareCalculationResponse {
  success: boolean;
  tripRequestId?: string;
  requestStatus?: string;
  message?: string;
}

/**
 * Creates a PENDING trip request against the chosen vehicle's open driver
 * session. Despite the name it does not write a history row.
 */
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
  method: RouteSource | null;
  provider: RouteSource | null;
  polyline: string | null;
  farePolicySnapshot: FarePolicySnapshot;
  /**
   * Discount usage. The server validates these as a set: a discountCardId
   * without a positive discountApplied is a 400, so send all three or none.
   */
  discountCardId?: string | null;
  originalFare?: number | null;
  discountApplied?: number | null;
}): Promise<SaveFareCalculationResponse> {
  const usesDiscount =
    Boolean(payload.discountCardId) && (payload.discountApplied ?? 0) > 0;

  return api.post<SaveFareCalculationResponse>('/api/fare-calculations', {
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
    discountCardId: usesDiscount ? payload.discountCardId : null,
    originalFare: usesDiscount ? payload.originalFare : null,
    discountApplied: usesDiscount ? payload.discountApplied : null,
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
  const rates = await api.get<FareRatesResponse>('/api/fare-rates');
  // Every look at the rate card refreshes the copy the offline calculator
  // prices with, and the copy it shows a rider when it has no distance to
  // price at all. Failing to cache must not fail the fetch.
  if (rates?.current) {
    void saveLastFarePolicy(rates.current).catch(() => {});
  }
  return rates;
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
