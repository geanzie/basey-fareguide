import type { FarePolicySnapshotDto } from "@/lib/contracts";
import { calculateFare } from "./calculator";
import type { PassengerType } from "../routing/types";

/**
 * A charter (locally *pakyaw*) is a rider buying the vehicle's whole capacity
 * so it leaves immediately, instead of waiting at the per-seat fare for it to
 * fill. Ordinance 105 prices a passenger's trip and says nothing about this,
 * so the only defensible number is what those seats would otherwise have
 * earned: the per-seat fare, times the seats.
 *
 * The discount is deliberately NOT multiplied. A discount card belongs to a
 * person, and a charter buys seats nobody sits in — discounting all of them
 * would let one senior card buy a whole vehicle at 20% off and make the
 * municipality subsidise empty seats. The holder's own seat is discounted; the
 * rest pay the regular fare.
 *
 * Nothing here changes `calculateFare`. Its math is duplicated byte-for-byte
 * in the mobile app and pinned by golden-vector fixtures in both repos, so it
 * stays a pure per-seat function and charter composes above it.
 */
export interface CharterFareBreakdown {
  seats: number;
  /** Regular per-seat fare, before any discount. */
  perSeatFare: number;
  /** The holder's own seat after their discount, or perSeatFare if none. */
  discountedSeatFare: number;
  /** What the same seats would cost with no discount card at all. */
  originalTotal: number;
  /** originalTotal − total. Zero for a REGULAR passenger. */
  discountApplied: number;
  total: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Prices `seats` seats on one trip.
 *
 * `seats` of 1 is the ordinary shared ride and returns exactly what
 * `calculateFare` would, so callers need no branch of their own.
 */
export function getCharterFareBreakdown(
  distanceKm: number,
  seats: number,
  passengerType: PassengerType = "REGULAR",
  farePolicy?: FarePolicySnapshotDto | null,
): CharterFareBreakdown {
  // A non-positive or fractional seat count would silently produce a negative
  // or fractional fare, so clamp rather than trust the caller.
  const seatCount = Math.max(1, Math.floor(seats) || 1);

  const perSeatFare = calculateFare(distanceKm, "REGULAR", farePolicy);
  const discountedSeatFare = calculateFare(
    distanceKm,
    passengerType,
    farePolicy,
  );

  const originalTotal = round(perSeatFare * seatCount);
  const total = round(discountedSeatFare + perSeatFare * (seatCount - 1));

  return {
    seats: seatCount,
    perSeatFare,
    discountedSeatFare,
    originalTotal,
    discountApplied: round(originalTotal - total),
    total,
  };
}

/** The amount owed, for callers that need only the number. */
export function calculateCharterFare(
  distanceKm: number,
  seats: number,
  passengerType: PassengerType = "REGULAR",
  farePolicy?: FarePolicySnapshotDto | null,
): number {
  return getCharterFareBreakdown(distanceKm, seats, passengerType, farePolicy)
    .total;
}
