import { describe, expect, it } from "vitest";

import {
  parseStoredCoordinates,
  validateAgainstStraightLine,
  validateDistanceMeters,
} from "@/lib/curatedRoutes/validation";

/** Canca-Iyas and Balo-Og: about 3.56 km apart in a straight line. */
const CANCA_IYAS = { lat: 11.3585, lng: 125.1421 };
const BALO_OG = { lat: 11.3861, lng: 125.1626 };

describe("validateAgainstStraightLine", () => {
  it("rejects the failure that put 152 bad rows in the corpus", () => {
    // Google snapped both barangay centroids onto one nearby road and returned
    // the gap between the snap points: 0.55 km for a 3.56 km separation.
    const result = validateAgainstStraightLine(550, CANCA_IYAS, BALO_OG);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/shorter than the straight-line/);
    expect(result.message).toMatch(/snapped both endpoints/);
  });

  it("accepts a road longer than the line it spans, which every real road is", () => {
    const result = validateAgainstStraightLine(5200, CANCA_IYAS, BALO_OG);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.straightLineMeters).toBeGreaterThan(3400);
    expect(result.straightLineMeters).toBeLessThan(3800);
  });

  it("accepts a road that runs almost perfectly straight", () => {
    // Unusual but physically fine, so it must not be rejected.
    expect(validateAgainstStraightLine(3800, CANCA_IYAS, BALO_OG).ok).toBe(true);
  });

  it("rejects a distance just under the floor, not only wild ones", () => {
    expect(validateAgainstStraightLine(3000, CANCA_IYAS, BALO_OG).ok).toBe(false);
  });
});

describe("parseStoredCoordinates", () => {
  it("reads the Location table's lat,lng column", () => {
    expect(parseStoredCoordinates("11.3585,125.1421")).toEqual({
      lat: 11.3585,
      lng: 125.1421,
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseStoredCoordinates(" 11.3585 , 125.1421 ")).toEqual({
      lat: 11.3585,
      lng: 125.1421,
    });
  });

  it("returns null rather than NaN coordinates", () => {
    // A NaN would sail through the floor check and disable it silently.
    for (const bad of ["", "not,coords", "11.3585", null, undefined]) {
      expect(parseStoredCoordinates(bad)).toBeNull();
    }
  });
});

describe("the two distance checks catch different mistakes", () => {
  it("unit check catches a kilometre value; the floor catches a snapped pair", () => {
    expect(validateDistanceMeters(9).ok).toBe(false);
    expect(validateDistanceMeters(9200).ok).toBe(true);
    expect(validateAgainstStraightLine(9200, CANCA_IYAS, BALO_OG).ok).toBe(true);
  });
});
