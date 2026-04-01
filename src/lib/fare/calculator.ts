import type { PassengerType, FareBreakdown } from "../routing/types";

export type { PassengerType, FareBreakdown };

const BASE_FARE = 15;
const BASE_KM = 3;
const RATE_PER_KM = 3;
const DISCOUNT_RATE = 0.8;

const DISCOUNTED_TYPES = new Set<PassengerType>(["STUDENT", "SENIOR", "PWD"]);

/**
 * Calculate the passenger fare for a given distance.
 *
 * Formula:
 *   additionalFare = Math.ceil(Math.max(distanceKm - BASE_KM, 0)) * RATE_PER_KM
 *   subtotal = BASE_FARE + additionalFare
 *   total = STUDENT/SENIOR/PWD: subtotal * 0.8, else subtotal
 *
 * The ceiling ensures whole-km billing for partial kilometres beyond the base.
 */
export function calculateFare(
  distanceKm: number,
  passengerType: PassengerType = "REGULAR"
): number {
  const additionalKm = Math.max(distanceKm - BASE_KM, 0);
  const additionalFare = Math.ceil(additionalKm) * RATE_PER_KM;
  const subtotal = BASE_FARE + additionalFare;
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
  passengerType: PassengerType = "REGULAR"
): FareBreakdown {
  const additionalKm = Math.max(distanceKm - BASE_KM, 0);
  const additionalFare = Math.ceil(additionalKm) * RATE_PER_KM;
  const subtotal = BASE_FARE + additionalFare;
  const isDiscounted = DISCOUNTED_TYPES.has(passengerType);
  const discount = isDiscounted ? Math.round(subtotal * 0.2 * 100) / 100 : 0;
  const total = isDiscounted
    ? Math.round(subtotal * DISCOUNT_RATE * 100) / 100
    : subtotal;

  return {
    baseFare: BASE_FARE,
    additionalKm,
    additionalFare,
    discount,
    total,
  };
}
