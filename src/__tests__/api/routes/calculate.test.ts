import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FarePolicySnapshotDto } from "@/lib/contracts";
import {
  RoutingServiceError,
  type ShortestRoadRouteResult,
} from "@/lib/routing/types";

vi.mock("@/lib/routing", () => ({
  resolveRouteForQuote: vi.fn(),
}));

const mockEvaluateRouteTerrain = vi.hoisted(() => vi.fn());

vi.mock("@/lib/routing/terrainService", () => ({
  evaluateRouteTerrain: mockEvaluateRouteTerrain,
}));

vi.mock("@/lib/fare/rateService", () => ({
  getResolvedFareRates: vi.fn(),
}));

const mockCalculateWalking = vi.hoisted(() => vi.fn());

vi.mock("@/lib/routing/providers/ors", () => ({
  OrsProvider: class {
    calculateWalking = mockCalculateWalking;
  },
}));

/** Pin inside the school grounds, reachable only by stairs. */
const SCHOOL_PIN = vi.hoisted(() => ({ lat: 11.28185, lng: 125.06835 }));
/** The gate on the main road, where a habal-habal can actually stop. */
const SCHOOL_GATE = vi.hoisted(() => ({ lat: 11.28174, lng: 125.06754 }));

vi.mock("@/lib/locations/plannerLocations", () => ({
  resolvePlannerLocationByName: vi.fn((name: string) => {
    const normalized = name.trim().toLowerCase();
    const knownLocations: Record<
      string,
      {
        id: string;
        name: string;
        coordinates: { lat: number; lng: number };
        category?: "barangay" | "landmark" | "sitio";
        vehicleAccess?: string;
        dropoffCoordinates?: { lat: number; lng: number };
        accessNote?: string;
      }
    > = {
      amandayehan: {
        id: "loc-amandayehan",
        name: "Amandayehan",
        coordinates: { lat: 11.278823, lng: 125.001194 },
        category: "barangay",
      },
      anglit: {
        id: "loc-anglit",
        name: "Anglit",
        coordinates: { lat: 11.304796, lng: 125.10899 },
        category: "barangay",
      },
      // A vetted campus: the pin sits inside the grounds, up a flight of
      // stairs, so rides stop at the gate on the main road.
      "basey 1 central elementary school": {
        id: "loc-basey-1-central",
        name: "Basey 1 Central Elementary School",
        coordinates: SCHOOL_PIN,
        category: "landmark",
        vehicleAccess: "WALK_ONLY",
        dropoffCoordinates: SCHOOL_GATE,
        accessNote: "Stairs from the gate to the campus.",
      },
      // A Location row whose coordinate drifted outside the service area.
      // Nothing stops such a row existing, so the route must reject it.
      "strayed barangay": {
        id: "loc-strayed",
        name: "Strayed Barangay",
        coordinates: { lat: 14.5995, lng: 120.9842 },
      },
      "offshore landmark": {
        id: "loc-offshore",
        name: "Offshore Landmark",
        coordinates: { lat: 35.6762, lng: 139.6503 },
      },
    };

    return Promise.resolve(knownLocations[normalized] ?? null);
  }),
}));

import { POST } from "@/app/api/routes/calculate/route";
import { resolvePinLabel } from "@/lib/locations/pinLabelResolver";
import { getResolvedFareRates } from "@/lib/fare/rateService";
import { resolveRouteForQuote } from "@/lib/routing";
import { clearVehicleAccessCache } from "@/lib/routing/vehicleAccess";

const mockRouting = vi.mocked(resolveRouteForQuote);
const mockFareRates = vi.mocked(getResolvedFareRates);

const ACTIVE_FARE_POLICY: FarePolicySnapshotDto = {
  versionId: "fare-live",
  baseDistanceKm: 3,
  baseFare: 15,
  perKmRate: 3,
  effectiveAt: "2026-04-01T00:00:00.000Z",
};

const ORS_RESULT: ShortestRoadRouteResult = {
  distanceKm: 14.8,
  durationMin: 22,
  distanceMeters: 14800,
  durationSeconds: 1320,
  polyline: "encodedPolyline",
  method: "ors",
  provider: "ors",
  isEstimate: false,
  fallbackReason: null,
  snappedOrigin: null,
  snappedDestination: null,
  diagnostics: {
    provider: "ors",
    routeFound: true,
    isEstimate: false,
    errorCode: null,
    errorMessage: null,
  },
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/routes/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const P = (name: string) => ({ type: "preset" as const, name });

/**
 * A road route that snapped both ends onto the requested coordinates. Real
 * providers always return snapped points for a successful road route, and the
 * ride-access guard fails closed without them, so the default mock supplies
 * them.
 */
function routeSnappedTo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): ShortestRoadRouteResult {
  return {
    ...ORS_RESULT,
    snappedOrigin: { ...origin, wasSnapped: false },
    snappedDestination: { ...destination, wasSnapped: false },
  };
}

/** Moves a coordinate north by roughly `meters`. */
function metersNorth(
  point: { lat: number; lng: number },
  meters: number,
): { lat: number; lng: number } {
  return { lat: point.lat + meters / 111_000, lng: point.lng };
}

/** No reading available — the default, and what an unconfigured system does. */
function uncheckedTerrain() {
  return {
    verdict: {
      checked: false,
      maxGradePercent: null,
      thresholdPercent: null,
      exceedsThreshold: false,
      demResolutionM: null,
    },
    shouldBlock: false,
    profile: null,
  };
}

/** A climb over the limit. `enforced` decides whether it actually refuses. */
function steepTerrain(enforced: boolean) {
  return {
    verdict: {
      checked: true,
      maxGradePercent: 18.4,
      thresholdPercent: 12,
      exceedsThreshold: true,
      demResolutionM: 153,
    },
    shouldBlock: enforced,
    profile: null,
  };
}

beforeEach(() => {
  clearVehicleAccessCache();
  mockEvaluateRouteTerrain.mockReset();
  mockEvaluateRouteTerrain.mockResolvedValue(uncheckedTerrain());
  mockCalculateWalking.mockReset();
  mockRouting.mockReset();
  mockRouting.mockImplementation(({ origin, destination }) =>
    Promise.resolve(routeSnappedTo(origin, destination)),
  );
  mockFareRates.mockResolvedValue({
    current: ACTIVE_FARE_POLICY,
    upcoming: null,
  });
});

describe("POST /api/routes/calculate - input validation", () => {
  it("returns 400 when origin is missing", async () => {
    const res = await POST(makeRequest({ destination: P("Anglit") }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/origin/i);
  });

  it("returns 400 when destination is missing", async () => {
    const res = await POST(makeRequest({ origin: P("Amandayehan") }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/destination/i);
  });

  it("returns 200 with zero fare when origin and destination are the same point", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Amandayehan") }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.distanceKm).toBe(0);
    expect(json.fare).toBe(0);
    expect(json.method).toBeNull();
    expect(json.provider).toBeNull();
    expect(json.isEstimate).toBe(false);
    expect(json.farePolicy).toEqual(ACTIVE_FARE_POLICY);
  });

  it("returns 200 with minimum fare for same location regardless of case", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("amandayehan") }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.distanceKm).toBe(0);
  });

  it("returns 400 when origin type is invalid", async () => {
    const res = await POST(
      makeRequest({ origin: { type: "unknown", name: "Anglit" }, destination: P("Anglit") }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/origin/i);
  });

  it("returns 400 when origin is an unknown location", async () => {
    const res = await POST(
      makeRequest({ origin: P("NoSuchPlace"), destination: P("Anglit") }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/NoSuchPlace/);
  });

  it("returns 400 when destination is an unknown location", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("NoSuchPlace") }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/NoSuchPlace/);
  });

  it("returns 400 for an invalid passengerType", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        passengerType: "CHILD",
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/CHILD/);
  });

  it("returns 400 for non-JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/routes/calculate", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when pin is outside the Philippines", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 35.0, lng: 139.0 },
        destination: P("Anglit"),
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/philippines/i);
  });

  it("returns 400 when pin is outside the Basey service area", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 14.5, lng: 121.0 },
        destination: P("Anglit"),
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/basey service area/i);
  });

  it("returns 422 when no road route can be found", async () => {
    mockRouting.mockRejectedValueOnce(
      new RoutingServiceError(
        "NO_ROAD_ROUTE_FOUND",
        "No road route could be found between these points.",
        { provider: "ors", reason: "no_route_found", status: 404 },
      ),
    );

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("NO_ROAD_ROUTE_FOUND");
    expect(json.message).toMatch(/no road route/i);
  });

  it("returns 503 when shortest-road routing is unavailable", async () => {
    mockRouting.mockRejectedValueOnce(
      new RoutingServiceError(
        "ROUTING_SERVICE_UNAVAILABLE",
        "ORS request timed out after 3500ms",
        { provider: "ors", reason: "timeout" },
      ),
    );

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.code).toBe("ROUTING_SERVICE_UNAVAILABLE");
  });

  it("returns route-unverified when both road providers fail verification", async () => {
    mockRouting.mockRejectedValueOnce(
      new RoutingServiceError(
        "ROUTE_UNVERIFIED",
        "Route could not be verified by the available road-routing providers.",
        { provider: "google_routes", reason: "no_route_found", status: 422 },
      ),
    );

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("ROUTE_UNVERIFIED");
    expect(json.message).toMatch(/official fare is unavailable/i);
  });
});

describe("POST /api/routes/calculate - successful responses", () => {
  it("returns 200 with correct shape for a valid request", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.origin).toBe("Amandayehan");
    expect(json.destination).toBe("Anglit");
    expect(typeof json.distanceKm).toBe("number");
    expect(typeof json.fare).toBe("number");
    expect(json.passengerType).toBe("REGULAR");
    expect(json.method).toBe("ors");
    expect(json.provider).toBe("ors");
    expect(json.isEstimate).toBe(false);
    expect(json.inputMode).toBe("preset");
    expect(json).toHaveProperty("fareBreakdown");
    expect(json).toHaveProperty("farePolicy");
    expect(json).toHaveProperty("polyline");
    expect(json).toHaveProperty("fallbackReason");
  });

  it("defaults passengerType to REGULAR when omitted", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );
    const json = await res.json();
    expect(json.passengerType).toBe("REGULAR");
  });

  it("accepts passengerType in lowercase and normalizes to uppercase", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        passengerType: "student",
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.passengerType).toBe("STUDENT");
  });

  it("uses the resolved fare policy instead of legacy hardcoded amounts", async () => {
    mockFareRates.mockResolvedValueOnce({
      current: {
        versionId: "fare-custom",
        baseDistanceKm: 3,
        baseFare: 20,
        perKmRate: 5,
        effectiveAt: "2026-04-03T00:00:00.000Z",
      },
      upcoming: null,
    });

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fare).toBe(80);
    expect(json.farePolicy).toMatchObject({
      versionId: "fare-custom",
      baseFare: 20,
      perKmRate: 5,
    });
  });

  it("applies discount correctly for SENIOR passenger", async () => {
    const regularRes = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );
    const seniorRes = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        passengerType: "SENIOR",
      }) as never,
    );

    const regularFare = (await regularRes.json()).fare;
    const seniorFare = (await seniorRes.json()).fare;
    expect(seniorFare).toBeLessThan(regularFare);
    expect(seniorFare).toBeCloseTo(regularFare * 0.8, 2);
  });

  it("returns 503 when fare policy resolution fails", async () => {
    mockFareRates.mockRejectedValueOnce(new Error("db unavailable"));

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.code).toBe("ROUTING_SERVICE_UNAVAILABLE");
    expect(json.message).toMatch(/fare policy/i);
  });
});

describe("POST /api/routes/calculate - pin mode", () => {
  it("returns 200 with inputMode 'pin' when origin is a pin", async () => {
    const resolved = resolvePinLabel(11.278823, 125.001194);
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 11.278823, lng: 125.001194 },
        destination: P("Anglit"),
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inputMode).toBe("pin");
    expect(json.origin).toBe(resolved.displayLabel);
    expect(json.originResolved).toEqual(resolved);
  });

  it("returns 200 with inputMode 'pin' when destination is a pin", async () => {
    const resolved = resolvePinLabel(11.278823, 125.001194);
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", lat: 11.278823, lng: 125.001194 },
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inputMode).toBe("pin");
    expect(json.destination).toBe(resolved.displayLabel);
    expect(json.destinationResolved).toEqual(resolved);
  });

  it("returns 200 with zero fare when two pin points are the same", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 11.278823, lng: 125.001194 },
        destination: { type: "pin", lat: 11.278823, lng: 125.001194 },
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.distanceKm).toBe(0);
    expect(json.fare).toBe(0);
    expect(json.method).toBeNull();
    expect(json.inputMode).toBe("pin");
  });

  it("returns 400 when pin lat/lng are non-numeric", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: "not-a-number", lng: 125.001 },
        destination: P("Anglit"),
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/origin/i);
  });
});

describe("POST /api/routes/calculate - preset bounds guard", () => {
  // The shared beforeEach re-stubs the resolved value but keeps the call log,
  // so clear it here to assert the request short-circuits before routing.
  beforeEach(() => {
    mockRouting.mockClear();
  });

  it("rejects a preset whose stored coordinate is outside the Basey service area", async () => {
    const res = await POST(
      makeRequest({ origin: P("Strayed Barangay"), destination: P("Anglit") }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/Strayed Barangay/);
    expect(json.message).toMatch(/service area/i);
    expect(mockRouting).not.toHaveBeenCalled();
  });

  it("rejects a preset destination whose stored coordinate is outside the Philippines", async () => {
    const res = await POST(
      makeRequest({ origin: P("Anglit"), destination: P("Offshore Landmark") }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/Offshore Landmark/);
    expect(json.message).toMatch(/Philippines/i);
    expect(mockRouting).not.toHaveBeenCalled();
  });

  it("still accepts a preset whose stored coordinate is inside the service area", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inputMode).toBe("preset");
  });

  it("bounds-checks a preset even when the other end is a pin", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 11.278823, lng: 125.001194 },
        destination: P("Strayed Barangay"),
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/service area/i);
  });
});

describe("POST /api/routes/calculate - ride-access guard", () => {
  it("blocks a preset whose coordinate is off the drivable network", async () => {
    // The school pin snaps 130 m out to the main road: the stairs in between
    // are not a road a habal-habal or tricycle can use.
    const roadPoint = metersNorth(SCHOOL_PIN, 130);
    mockRouting.mockImplementation(({ origin }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: { ...origin, wasSnapped: false },
        snappedDestination: { ...roadPoint, wasSnapped: true },
      }),
    );
    mockCalculateWalking.mockResolvedValue({ ...ORS_RESULT, distanceMeters: 148 });

    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", ...SCHOOL_PIN },
      }) as never,
    );

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("NO_VEHICLE_ACCESS");
    expect(json.details.field).toBe("destination");
    expect(json.details.dropoff.walkMeters).toBe(148);
    expect(json.details.dropoff.source).toBe("foot_probe");
    expect(json.message).toMatch(/on foot/i);
  });

  it("blocks a walking-only origin too, and names the origin", async () => {
    const roadPoint = metersNorth(SCHOOL_PIN, 130);
    mockRouting.mockImplementation(({ destination }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: { ...roadPoint, wasSnapped: true },
        snappedDestination: { ...destination, wasSnapped: false },
      }),
    );
    mockCalculateWalking.mockResolvedValue({ ...ORS_RESULT, distanceMeters: 148 });

    const res = await POST(
      makeRequest({
        origin: { type: "pin", ...SCHOOL_PIN },
        destination: P("Anglit"),
      }) as never,
    );

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("NO_VEHICLE_ACCESS");
    expect(json.details.field).toBe("origin");
  });

  it("still quotes a fare when the pin is within reach of a road", async () => {
    const roadPoint = metersNorth(SCHOOL_PIN, 40);
    mockRouting.mockImplementation(({ origin }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: { ...origin, wasSnapped: false },
        snappedDestination: { ...roadPoint, wasSnapped: true },
      }),
    );

    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", ...SCHOOL_PIN },
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("keeps the existing wording when nothing is within 200 m", async () => {
    const roadPoint = metersNorth(SCHOOL_PIN, 400);
    mockRouting.mockImplementation(({ origin }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: { ...origin, wasSnapped: false },
        snappedDestination: { ...roadPoint, wasSnapped: true },
      }),
    );

    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", ...SCHOOL_PIN },
      }) as never,
    );

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe("NO_ROAD_ROUTE_FOUND");
    expect(json.message).toMatch(/too far from any road/i);
  });

  it("fails closed on a doorstep when the provider returns no snapped points", async () => {
    mockRouting.mockResolvedValue(ORS_RESULT);

    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", ...SCHOOL_PIN },
      }) as never,
    );

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("NO_ROAD_ROUTE_FOUND");
  });

  it("still quotes an area coordinate when snapping metadata is missing", async () => {
    // The route itself is a verified road route; only the snap report is absent,
    // and a barangay centroid was never going to sit on the road anyway.
    mockRouting.mockResolvedValue(ORS_RESULT);

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(200);
    expect((await res.json()).dropoffNotices).toEqual([]);
  });

  it("quotes a curated walk-only place to its drop-off instead of blocking", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Basey 1 Central Elementary School"),
      }) as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    // The trip is measured to the gate, not to the pin inside the grounds.
    expect(mockRouting.mock.calls[0]?.[0]?.destination).toEqual(SCHOOL_GATE);
    expect(mockCalculateWalking).not.toHaveBeenCalled();
    expect(json.destination).toBe("Basey 1 Central Elementary School");
    expect(json.dropoffNotices).toHaveLength(1);
    expect(json.dropoffNotices[0]).toMatchObject({
      field: "destination",
      requestedLabel: "Basey 1 Central Elementary School",
      label: "Basey 1 Central Elementary School drop-off",
      note: "Stairs from the gate to the campus.",
    });
    expect(json.dropoffNotices[0].walkMeters).toBeGreaterThan(0);
  });

  it("reports no drop-off notice on an ordinary trip", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(200);
    expect((await res.json()).dropoffNotices).toEqual([]);
  });
});

describe("POST /api/routes/calculate - area vs doorstep coordinates", () => {
  /** Anglit's centroid is 819 m from the nearest mapped road. */
  const FAR_OFF_ROAD_M = 819;

  it("quotes a barangay whose centroid sits far off the road, with a notice", async () => {
    mockRouting.mockImplementation(({ origin }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: { ...origin, wasSnapped: false },
        snappedDestination: {
          ...metersNorth({ lat: 11.304796, lng: 125.10899 }, FAR_OFF_ROAD_M),
          wasSnapped: true,
        },
      }),
    );

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    // A polygon centroid is not a doorstep: the ride stops where the road ends.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fare).toBeGreaterThan(0);
    expect(json.dropoffNotices).toHaveLength(1);
    expect(json.dropoffNotices[0]).toMatchObject({
      field: "destination",
      requestedLabel: "Anglit",
      label: "the road into Anglit",
      walkMeters: FAR_OFF_ROAD_M,
    });
    expect(mockCalculateWalking).not.toHaveBeenCalled();
  });

  it("still blocks a landmark at the same distance", async () => {
    mockRouting.mockImplementation(({ origin }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: { ...origin, wasSnapped: false },
        snappedDestination: { ...metersNorth(SCHOOL_PIN, 130), wasSnapped: true },
      }),
    );
    mockCalculateWalking.mockResolvedValue({ ...ORS_RESULT, distanceMeters: 148 });

    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", ...SCHOOL_PIN },
      }) as never,
    );

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("NO_VEHICLE_ACCESS");
  });

  it("reports the walk on the origin end too", async () => {
    mockRouting.mockImplementation(({ destination }) =>
      Promise.resolve({
        ...ORS_RESULT,
        snappedOrigin: {
          ...metersNorth({ lat: 11.278823, lng: 125.001194 }, 400),
          wasSnapped: true,
        },
        snappedDestination: { ...destination, wasSnapped: false },
      }),
    );

    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );

    expect(res.status).toBe(200);
    const notices = (await res.json()).dropoffNotices;
    expect(notices.map((n: { field: string }) => n.field)).toContain("origin");
  });
});

describe("POST /api/routes/calculate - vehicle type", () => {
  it("passes the requested vehicle type down to the router", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "HABAL_HABAL",
      }) as never,
    );

    expect(res.status).toBe(200);
    expect(mockRouting).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleType: "HABAL_HABAL" }),
    );
  });

  it("echoes the vehicle type back so the client knows what was quoted", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "TRICYCLE",
      }) as never,
    );
    const json = await res.json();

    expect(json.vehicleType).toBe("TRICYCLE");
  });

  it("accepts a lowercase vehicle type, as it already does for passenger type", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "tricycle",
      }) as never,
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.vehicleType).toBe("TRICYCLE");
  });

  it("rejects an unknown vehicle type", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "HELICOPTER",
      }) as never,
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("INVALID_ROUTE_INPUT");
    expect(json.message).toMatch(/vehicleType/i);
  });

  it("treats an absent vehicle type as no vehicle context", async () => {
    // This is every request made before the parameter existed, and it must keep
    // producing exactly the car route it always did.
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never,
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.vehicleType).toBeNull();
    expect(mockRouting).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleType: null }),
    );
  });

  it("raises Google's two-wheeler notice only for a two-wheeler route", async () => {
    // Google requires the beta notice wherever such a route is displayed.
    mockRouting.mockImplementation(({ origin, destination }) =>
      Promise.resolve({
        ...routeSnappedTo(origin, destination),
        method: "google_routes" as const,
        provider: "google_routes" as const,
      }),
    );

    const habal = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "HABAL_HABAL",
      }) as never,
    );
    expect((await habal.json()).twoWheelerNotice).toBe(true);

    const tricycle = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "TRICYCLE",
      }) as never,
    );
    expect((await tricycle.json()).twoWheelerNotice).toBe(false);
  });

  it("raises no notice for the same vehicle on a provider without that mode", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        vehicleType: "HABAL_HABAL",
      }) as never,
    );

    expect((await res.json()).twoWheelerNotice).toBe(false);
  });
});

describe("POST /api/routes/calculate - terrain gate", () => {
  const trip = { origin: P("Amandayehan"), destination: P("Anglit"), vehicleType: "TRICYCLE" };

  it("still quotes a steep route while the gate is only observing", async () => {
    // The seeded thresholds were reasoned about a ~30 m DEM and Google serves
    // ~153 m over Basey, so the gate ships observing. Refusing a fare on an
    // uncalibrated number would be worse than quoting one.
    mockEvaluateRouteTerrain.mockResolvedValue(steepTerrain(false));

    const res = await POST(makeRequest(trip) as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.fare).toBeGreaterThan(0);
    expect(json.routeValidity).toMatchObject({
      checked: true,
      maxGradePercent: 18.4,
      thresholdPercent: 12,
      exceedsThreshold: true,
      enforced: false,
    });
  });

  it("refuses the quote once an admin arms the gate", async () => {
    mockEvaluateRouteTerrain.mockResolvedValue(steepTerrain(true));

    const res = await POST(makeRequest(trip) as never);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.code).toBe("NO_ROUTE_FOR_VEHICLE");
    // The rider needs to know to try a different vehicle, not to try again later.
    expect(json.message).toMatch(/tricycle-passable/i);
    expect(json.message).toMatch(/18%/);
  });

  it("reports an unavailable reading as unchecked, not as a pass", async () => {
    const res = await POST(makeRequest(trip) as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.routeValidity).toMatchObject({ checked: false, exceedsThreshold: false });
  });

  it("attaches no terrain reading to a same-point result", async () => {
    const res = await POST(
      makeRequest({ ...trip, destination: P("Amandayehan") }) as never,
    );
    const json = await res.json();

    expect(json.distanceKm).toBe(0);
    expect(json.routeValidity).toBeNull();
  });

  it("prices two routes identically whatever their grade", async () => {
    // The load-bearing invariant of this whole feature. Ordinance 105 prices
    // distance; if terrain could move the fare it would be a surcharge nobody
    // authorised.
    mockEvaluateRouteTerrain.mockResolvedValue(uncheckedTerrain());
    const flat = await POST(makeRequest(trip) as never);
    const flatJson = await flat.json();

    mockEvaluateRouteTerrain.mockResolvedValue(steepTerrain(false));
    const steep = await POST(makeRequest(trip) as never);
    const steepJson = await steep.json();

    expect(steepJson.distanceKm).toBe(flatJson.distanceKm);
    expect(steepJson.fare).toBe(flatJson.fare);
    expect(steepJson.fareBreakdown).toEqual(flatJson.fareBreakdown);
  });

  it("measures the route that was actually quoted", async () => {
    await POST(makeRequest(trip) as never);

    expect(mockEvaluateRouteTerrain).toHaveBeenCalledWith("encodedPolyline", "TRICYCLE");
  });
});
