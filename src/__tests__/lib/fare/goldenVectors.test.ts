import goldenVectors from '@/lib/fare/fare-golden-vectors.json';
import { calculateFare, getFareBreakdown } from '@/lib/fare/calculator';
import type { FarePolicySnapshot, PassengerType } from '@/types/fare';

/**
 * The mobile half of the cross-repo fare contract. The web app runs the same
 * cases against its own copy of the arithmetic in
 * frontend/src/__tests__/lib/fare/goldenVectors.test.ts.
 *
 * The two repos share no package and there is no CI between them, so this is
 * the only thing that catches an ordinance change applied to one side and not
 * the other. If it goes red, update BOTH fixture copies.
 */
interface GoldenCase {
  name: string;
  distanceKm: number;
  passengerType: PassengerType;
  policy: FarePolicySnapshot | null;
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

describe('fare golden vectors', () => {
  it('carries every case the shared fixture defines', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('$name', (testCase) => {
    expect(calculateFare(testCase.distanceKm, testCase.passengerType, testCase.policy)).toBe(
      testCase.expectedFare,
    );
  });

  it.each(cases)('$name — breakdown', (testCase) => {
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
