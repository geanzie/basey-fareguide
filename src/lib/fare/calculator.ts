import type { FareBreakdown, FarePolicySnapshot, PassengerType } from '@/types/fare';
import { resolveFarePolicySnapshot } from './policy';

/**
 * PORTED from frontend/src/lib/fare/calculator.ts. Keep the arithmetic identical.
 *
 * This exists so an offline quote can be priced on device. It is only ever fed
 * a distance the server itself would have returned — a curated corpus entry or
 * a replay of a route this device already fetched — never an estimate. A fare
 * that disagrees with the driver's app is a dispute under Ordinance 105, so the
 * offline path shows an exact number or none at all.
 *
 * Guarded against drift by src/__tests__/lib/fare/goldenVectors.test.ts.
 */
const DISCOUNT_RATE = 0.8;

const DISCOUNTED_TYPES = new Set<PassengerType>(['STUDENT', 'SENIOR', 'PWD']);

/**
 * Calculate the passenger fare for a given distance.
 *
 * Formula:
 *   additionalFare = Math.ceil(Math.max(distanceKm - baseDistanceKm, 0)) * perKmRate
 *   subtotal = baseFare + additionalFare
 *   total = STUDENT/SENIOR/PWD: subtotal * 0.8, else subtotal
 *
 * The ceiling ensures whole-km billing for partial kilometres beyond the base.
 */
export function calculateFare(
  distanceKm: number,
  passengerType: PassengerType = 'REGULAR',
  farePolicy?: FarePolicySnapshot | null,
): number {
  const resolvedPolicy = resolveFarePolicySnapshot(farePolicy);
  const additionalKm = Math.max(distanceKm - resolvedPolicy.baseDistanceKm, 0);
  const additionalFare = Math.ceil(additionalKm) * resolvedPolicy.perKmRate;
  const subtotal = resolvedPolicy.baseFare + additionalFare;
  const total = DISCOUNTED_TYPES.has(passengerType) ? subtotal * DISCOUNT_RATE : subtotal;
  return Math.round(total * 100) / 100;
}

/**
 * Returns a detailed breakdown of the fare calculation.
 */
export function getFareBreakdown(
  distanceKm: number,
  passengerType: PassengerType = 'REGULAR',
  farePolicy?: FarePolicySnapshot | null,
): FareBreakdown {
  const resolvedPolicy = resolveFarePolicySnapshot(farePolicy);
  const additionalKm = Math.max(distanceKm - resolvedPolicy.baseDistanceKm, 0);
  const additionalFare = Math.ceil(additionalKm) * resolvedPolicy.perKmRate;
  const subtotal = resolvedPolicy.baseFare + additionalFare;
  const isDiscounted = DISCOUNTED_TYPES.has(passengerType);
  const discount = isDiscounted ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = isDiscounted ? Math.round(subtotal * DISCOUNT_RATE * 100) / 100 : subtotal;

  return {
    baseFare: resolvedPolicy.baseFare,
    additionalKm,
    additionalFare,
    discount,
    total,
  };
}
