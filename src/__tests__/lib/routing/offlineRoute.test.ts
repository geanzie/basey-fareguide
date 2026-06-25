import { describe, expect, it } from "vitest";

import { calculateFare } from "@/lib/fare/calculator";
import { DEFAULT_FARE_POLICY } from "@/lib/fare/policy";
import { estimatedRoadKm, haversineKm, ROAD_FACTOR } from "@/lib/routing/geo";
import {
  buildOfflineRouteEstimate,
  OFFLINE_FALLBACK_REASON,
} from "@/lib/routing/offlineRoute";

// Known Basey coordinates from src/data/basey-locations.json
const AMANDAYEHAN = { lat: 11.278823, lng: 125.001194 };
const BALUD = { lat: 11.292884, lng: 125.129768 };

describe("geo.haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(AMANDAYEHAN, AMANDAYEHAN)).toBe(0);
  });

  it("matches a known great-circle distance (~14 km)", () => {
    const km = haversineKm(AMANDAYEHAN, BALUD);
    expect(km).toBeGreaterThan(13);
    expect(km).toBeLessThan(15);
  });

  it("estimatedRoadKm applies the road factor", () => {
    const straight = haversineKm(AMANDAYEHAN, BALUD);
    expect(estimatedRoadKm(AMANDAYEHAN, BALUD)).toBeCloseTo(straight * ROAD_FACTOR, 6);
  });
});

describe("buildOfflineRouteEstimate", () => {
  it("produces an estimate with no road polyline", () => {
    const result = buildOfflineRouteEstimate({
      origin: AMANDAYEHAN,
      destination: BALUD,
      passengerType: "REGULAR",
    });

    expect(result.isEstimate).toBe(true);
    expect(result.polyline).toBeNull();
    expect(result.method).toBeNull();
    expect(result.provider).toBeNull();
    expect(result.fallbackReason).toBe(OFFLINE_FALLBACK_REASON);
    expect(result.distanceKm).toBeCloseTo(estimatedRoadKm(AMANDAYEHAN, BALUD), 6);
  });

  it("prices fare with the legacy default policy when none cached", () => {
    const result = buildOfflineRouteEstimate({
      origin: AMANDAYEHAN,
      destination: BALUD,
      passengerType: "REGULAR",
    });

    const expectedFare = calculateFare(result.distanceKm, "REGULAR", DEFAULT_FARE_POLICY);
    expect(result.fare).toBe(expectedFare);
    expect(result.fareBreakdown.total).toBe(expectedFare);
  });

  it("applies the discount for discounted passenger types", () => {
    const regular = buildOfflineRouteEstimate({
      origin: AMANDAYEHAN,
      destination: BALUD,
      passengerType: "REGULAR",
    });
    const student = buildOfflineRouteEstimate({
      origin: AMANDAYEHAN,
      destination: BALUD,
      passengerType: "STUDENT",
    });

    expect(student.fare).toBeLessThan(regular.fare);
    expect(student.fareBreakdown.discount).toBeGreaterThan(0);
  });

  it("uses a cached fare policy when supplied", () => {
    const customPolicy = {
      versionId: "v2",
      baseDistanceKm: 2,
      baseFare: 20,
      perKmRate: 5,
      effectiveAt: null,
    };
    const result = buildOfflineRouteEstimate({
      origin: AMANDAYEHAN,
      destination: BALUD,
      passengerType: "REGULAR",
      farePolicy: customPolicy,
    });

    expect(result.farePolicy.baseFare).toBe(20);
    expect(result.fare).toBe(calculateFare(result.distanceKm, "REGULAR", customPolicy));
  });
});
