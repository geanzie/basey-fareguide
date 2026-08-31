import { describe, expect, it } from "vitest";

import goldenVectors from "@/lib/fare/__fixtures__/fare-golden-vectors.json";
import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";
import type { FarePolicySnapshotDto } from "@/lib/contracts";
import type { PassengerType } from "@/lib/routing/types";

/**
 * The web half of the cross-repo fare contract. The mobile app runs the same
 * cases against its own copy of the arithmetic in
 * mobile/src/__tests__/lib/fare/goldenVectors.test.ts.
 *
 * If this suite goes red after a deliberate ordinance change, update BOTH
 * fixture copies — a green mobile suite against a stale fixture is exactly the
 * silent disagreement this exists to prevent.
 */
interface GoldenCase {
  name: string;
  distanceKm: number;
  passengerType: PassengerType;
  policy: FarePolicySnapshotDto | null;
  expectedFare: number;
  expectedBreakdown: {
    baseFare: number;
    additionalKm: number;
    additionalFare: number;
    discount: number;
    total: number;
  };
}

const cases = goldenVectors.cases as GoldenCase[];

describe("fare golden vectors", () => {
  it("carries every case the shared fixture defines", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)("$name", (testCase) => {
    expect(calculateFare(testCase.distanceKm, testCase.passengerType, testCase.policy)).toBe(
      testCase.expectedFare,
    );
  });

  it.each(cases)("$name — breakdown", (testCase) => {
    const breakdown = getFareBreakdown(
      testCase.distanceKm,
      testCase.passengerType,
      testCase.policy,
    );

    expect(breakdown.baseFare).toBe(testCase.expectedBreakdown.baseFare);
    expect(breakdown.additionalKm).toBeCloseTo(testCase.expectedBreakdown.additionalKm, 6);
    expect(breakdown.additionalFare).toBe(testCase.expectedBreakdown.additionalFare);
    expect(breakdown.discount).toBe(testCase.expectedBreakdown.discount);
    expect(breakdown.total).toBe(testCase.expectedBreakdown.total);
  });
});
