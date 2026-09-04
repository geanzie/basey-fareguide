import { describe, expect, it } from "vitest";

import { calculateFare } from "@/lib/fare/calculator";
import {
  calculateCharterFare,
  getCharterFareBreakdown,
} from "@/lib/fare/charter";

// Legacy default policy: ₱15 base, 3km base distance, ₱3/km.
// A 5km trip is ₱15 + ceil(2) × ₱3 = ₱21 per seat.
const FIVE_KM = 5;
const PER_SEAT = 21;

describe("getCharterFareBreakdown", () => {
  it("prices a single seat exactly as calculateFare does", () => {
    for (const passengerType of ["REGULAR", "SENIOR", "STUDENT", "PWD"] as const) {
      expect(getCharterFareBreakdown(FIVE_KM, 1, passengerType).total).toBe(
        calculateFare(FIVE_KM, passengerType),
      );
    }
  });

  it("multiplies the per-seat fare across the capacity", () => {
    expect(calculateCharterFare(FIVE_KM, 3)).toBe(PER_SEAT * 3);
    expect(calculateCharterFare(FIVE_KM, 6)).toBe(PER_SEAT * 6);
  });

  it("discounts only the holder's own seat, not the empty ones", () => {
    const breakdown = getCharterFareBreakdown(FIVE_KM, 3, "SENIOR");

    // ₱21 × 0.8 = ₱16.80 for the senior, ₱42 for the two seats nobody sits in.
    expect(breakdown.discountedSeatFare).toBe(16.8);
    expect(breakdown.total).toBe(58.8);
    expect(breakdown.originalTotal).toBe(63);
    expect(breakdown.discountApplied).toBeCloseTo(4.2, 2);
  });

  it("never lets a discount card buy the whole vehicle at 20% off", () => {
    const senior = getCharterFareBreakdown(FIVE_KM, 3, "SENIOR");
    const wholeCharterDiscounted = 63 * 0.8;

    expect(senior.total).toBeGreaterThan(wholeCharterDiscounted);
  });

  it("clamps nonsense seat counts to one rather than pricing negatively", () => {
    for (const seats of [0, -4, Number.NaN, 0.4]) {
      expect(getCharterFareBreakdown(FIVE_KM, seats).total).toBe(PER_SEAT);
      expect(getCharterFareBreakdown(FIVE_KM, seats).seats).toBe(1);
    }
  });

  it("charges a regular passenger no discount at any seat count", () => {
    const breakdown = getCharterFareBreakdown(FIVE_KM, 6, "REGULAR");

    expect(breakdown.discountApplied).toBe(0);
    expect(breakdown.total).toBe(breakdown.originalTotal);
  });
});
