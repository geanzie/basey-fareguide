import { describe, expect, it } from "vitest";

import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";

const CUSTOM_FARE_POLICY = {
  versionId: "fare-custom",
  baseDistanceKm: 3,
  baseFare: 20,
  perKmRate: 5,
  effectiveAt: "2026-04-03T00:00:00.000Z",
} as const;

describe("calculateFare", () => {
  describe("REGULAR passenger", () => {
    it("returns base fare for distance at or below 3 km", () => {
      expect(calculateFare(3, "REGULAR")).toBe(15);
    });

    it("returns base fare for distance below 3 km", () => {
      expect(calculateFare(1, "REGULAR")).toBe(15);
    });

    it("adds one fare increment for 1 km over base", () => {
      expect(calculateFare(4, "REGULAR")).toBe(18);
    });

    it("rounds up fractional kilometres beyond base", () => {
      expect(calculateFare(4.5, "REGULAR")).toBe(21);
    });

    it("handles exactly 2 km over base", () => {
      expect(calculateFare(5, "REGULAR")).toBe(21);
    });

    it("handles a long 15 km trip", () => {
      expect(calculateFare(15, "REGULAR")).toBe(51);
    });

    it("defaults passengerType to REGULAR when omitted", () => {
      expect(calculateFare(4)).toBe(calculateFare(4, "REGULAR"));
    });
  });

  describe("discounted passengers", () => {
    it("applies 20% discount for STUDENT", () => {
      expect(calculateFare(5, "STUDENT")).toBe(16.8);
    });

    it("applies 20% discount for SENIOR", () => {
      expect(calculateFare(5, "SENIOR")).toBe(16.8);
    });

    it("applies 20% discount for PWD", () => {
      expect(calculateFare(5, "PWD")).toBe(16.8);
    });

    it("discounts the base fare too", () => {
      expect(calculateFare(3, "STUDENT")).toBe(12);
    });
  });

  describe("custom fare policies", () => {
    it("uses the supplied base fare and per-kilometer rate", () => {
      expect(calculateFare(4.2, "REGULAR", CUSTOM_FARE_POLICY)).toBe(30);
    });

    it("keeps the existing discount logic on top of the resolved policy", () => {
      expect(calculateFare(4.2, "SENIOR", CUSTOM_FARE_POLICY)).toBe(24);
    });
  });
});

describe("getFareBreakdown", () => {
  it("returns correct breakdown for REGULAR at 5 km", () => {
    const result = getFareBreakdown(5, "REGULAR");
    expect(result.baseFare).toBe(15);
    expect(result.additionalKm).toBe(2);
    expect(result.additionalFare).toBe(6);
    expect(result.discount).toBe(0);
    expect(result.total).toBe(21);
  });

  it("returns correct breakdown with discount for STUDENT at 5 km", () => {
    const result = getFareBreakdown(5, "STUDENT");
    expect(result.baseFare).toBe(15);
    expect(result.additionalFare).toBe(6);
    expect(result.discount).toBe(4.2);
    expect(result.total).toBe(16.8);
  });

  it("returns zero additional distance for short trips", () => {
    const result = getFareBreakdown(2, "REGULAR");
    expect(result.additionalKm).toBe(0);
    expect(result.additionalFare).toBe(0);
    expect(result.total).toBe(15);
  });

  it("returns the custom policy snapshot values in the breakdown", () => {
    const result = getFareBreakdown(4.2, "REGULAR", CUSTOM_FARE_POLICY);
    expect(result.baseFare).toBe(20);
    expect(result.additionalKm).toBeCloseTo(1.2, 5);
    expect(result.additionalFare).toBe(10);
    expect(result.total).toBe(30);
  });
});
