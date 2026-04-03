import type { FarePolicySnapshotDto } from "@/lib/contracts";
import type { PassengerType, FareBreakdown } from "../routing/types";
import { resolveFarePolicySnapshot } from "./policy";

export type { PassengerType, FareBreakdown };

const DISCOUNT_RATE = 0.8;

const DISCOUNTED_TYPES = new Set<PassengerType>(["STUDENT", "SENIOR", "PWD"]);

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
  passengerType: PassengerType = "REGULAR",
  farePolicy?: FarePolicySnapshotDto | null,
): number {
  const resolvedPolicy = resolveFarePolicySnapshot(farePolicy);
  const additionalKm = Math.max(distanceKm - resolvedPolicy.baseDistanceKm, 0);
  const additionalFare = Math.ceil(additionalKm) * resolvedPolicy.perKmRate;
  const subtotal = resolvedPolicy.baseFare + additionalFare;
  const total = DISCOUNTED_TYPES.has(passengerType)
    ? subtotal * DISCOUNT_RATE
    : subtotal;
  return Math.round(total * 100) / 100;
}

/**
 * Returns a detailed breakdown of the fare calculation.
 */
export function getFareBreakdown(
  distanceKm: number,
  passengerType: PassengerType = "REGULAR",
  farePolicy?: FarePolicySnapshotDto | null,
): FareBreakdown {
  const resolvedPolicy = resolveFarePolicySnapshot(farePolicy);
  const additionalKm = Math.max(distanceKm - resolvedPolicy.baseDistanceKm, 0);
  const additionalFare = Math.ceil(additionalKm) * resolvedPolicy.perKmRate;
  const subtotal = resolvedPolicy.baseFare + additionalFare;
  const isDiscounted = DISCOUNTED_TYPES.has(passengerType);
  const discount = isDiscounted ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = isDiscounted
    ? Math.round(subtotal * DISCOUNT_RATE * 100) / 100
    : subtotal;

  return {
    baseFare: resolvedPolicy.baseFare,
    additionalKm,
    additionalFare,
    discount,
    total,
  };
}
