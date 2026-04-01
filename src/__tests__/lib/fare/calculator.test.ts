import { describe, it, expect } from "vitest";
import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";

describe("calculateFare", () => {
  describe("REGULAR passenger", () => {
    it("returns base fare for distance at or below 3 km", () => {
      expect(calculateFare(3, "REGULAR")).toBe(15);
    });

    it("returns base fare for distance below 3 km", () => {
      expect(calculateFare(1, "REGULAR")).toBe(15);
    });

    it("adds one fare increment for 1 km over base", () => {
      // 4 km: ceil(1) * 3 = 3 → 15 + 3 = 18
      expect(calculateFare(4, "REGULAR")).toBe(18);
    });

    it("rounds up fractional kilometres beyond base (ceiling billing)", () => {
      // 4.5 km: additionalKm = 1.5, ceil(1.5) = 2, 2 * 3 = 6 → 15 + 6 = 21
      expect(calculateFare(4.5, "REGULAR")).toBe(21);
    });

    it("handles exactly 2 km over base", () => {
      // 5 km: ceil(2) * 3 = 6 → 15 + 6 = 21
      expect(calculateFare(5, "REGULAR")).toBe(21);
    });

    it("handles a long 15 km trip", () => {
      // 15 km: additionalKm = 12, ceil(12) * 3 = 36 → 15 + 36 = 51
      expect(calculateFare(15, "REGULAR")).toBe(51);
    });

    it("defaults passengerType to REGULAR when omitted", () => {
      expect(calculateFare(4)).toBe(calculateFare(4, "REGULAR"));
    });
  });

  describe("discounted passengers (STUDENT, SENIOR, PWD)", () => {
    it("applies 20% discount for STUDENT", () => {
      // 5 km subtotal = 21, 21 * 0.8 = 16.8
      expect(calculateFare(5, "STUDENT")).toBe(16.8);
    });

    it("applies 20% discount for SENIOR", () => {
      expect(calculateFare(5, "SENIOR")).toBe(16.8);
    });

    it("applies 20% discount for PWD", () => {
      expect(calculateFare(5, "PWD")).toBe(16.8);
    });

    it("STUDENT base fare is discounted too", () => {
      // 3 km subtotal = 15, 15 * 0.8 = 12
      expect(calculateFare(3, "STUDENT")).toBe(12);
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
    expect(result.discount).toBe(4.2); // 21 * 0.2
    expect(result.total).toBe(16.8);
  });

  it("additionalKm is zero for short trips", () => {
    const result = getFareBreakdown(2, "REGULAR");
    expect(result.additionalKm).toBe(0);
    expect(result.additionalFare).toBe(0);
    expect(result.total).toBe(15);
  });
});
