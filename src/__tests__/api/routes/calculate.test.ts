import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RouteResult } from "@/lib/routing/types";

// Mock the routing module so we don't make real HTTP requests.
vi.mock("@/lib/routing", () => ({
  calculateRouteWithFallback: vi.fn(),
}));

vi.mock("@/lib/locations/plannerLocations", () => ({
  resolvePlannerLocationByName: vi.fn((name: string) => {
    const normalized = name.trim().toLowerCase();
    const knownLocations: Record<string, { name: string; coordinates: { lat: number; lng: number } }> = {
      amandayehan: {
        name: "Amandayehan",
        coordinates: { lat: 11.278823, lng: 125.001194 },
      },
      anglit: {
        name: "Anglit",
        coordinates: { lat: 11.304796, lng: 125.10899 },
      },
    };

    return Promise.resolve(knownLocations[normalized] ?? null);
  }),
}));

import { POST } from "@/app/api/routes/calculate/route";
import { calculateRouteWithFallback } from "@/lib/routing";

const mockRouting = vi.mocked(calculateRouteWithFallback);

const ORS_RESULT: RouteResult = {
  distanceKm: 14.8,
  durationMin: 22,
  polyline: "encodedPolyline",
  method: "ors",
  fallbackReason: null,
  snappedOrigin: null,
  snappedDestination: null,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/routes/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Shorthand for a preset LocationInput */
const P = (name: string) => ({ type: "preset" as const, name });

beforeEach(() => {
  mockRouting.mockResolvedValue(ORS_RESULT);
});

describe("POST /api/routes/calculate — input validation", () => {
  it("returns 400 when origin is missing", async () => {
    const res = await POST(makeRequest({ destination: P("Anglit") }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/origin/i);
  });

  it("returns 400 when destination is missing", async () => {
    const res = await POST(makeRequest({ origin: P("Amandayehan") }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/destination/i);
  });

  it("returns 200 with minimum fare when origin and destination are the same point", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Amandayehan") }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.distanceKm).toBe(0);
    expect(json.fare).toBe(15); // minimum fare = base ₱15
  });

  it("returns 200 with minimum fare for same location regardless of case", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("amandayehan") }) as never
    );
    // case-insensitive resolve → same coords → minimum fare
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.distanceKm).toBe(0);
  });

  it("returns 400 when origin type is invalid", async () => {
    const res = await POST(
      makeRequest({ origin: { type: "unknown", name: "Anglit" }, destination: P("Anglit") }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/origin/i);
  });

  it("returns 400 when origin is an unknown location", async () => {
    const res = await POST(
      makeRequest({ origin: P("NoSuchPlace"), destination: P("Anglit") }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/NoSuchPlace/);
  });

  it("returns 400 when destination is an unknown location", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("NoSuchPlace") }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/NoSuchPlace/);
  });

  it("returns 400 for an invalid passengerType", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        passengerType: "CHILD",
      }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/CHILD/);
  });

  it("returns 400 for non-JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/routes/calculate", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when pin is outside the Philippines", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 35.0, lng: 139.0 }, // Japan
        destination: P("Anglit"),
      }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/philippines/i);
  });

  it("returns 400 when pin is outside the Basey service area", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 14.5, lng: 121.0 }, // Manila area, in PH but outside Basey
        destination: P("Anglit"),
      }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/basey service area/i);
  });
});

describe("POST /api/routes/calculate — successful responses", () => {
  it("returns 200 with correct shape for a valid request", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.origin).toBe("Amandayehan");
    expect(json.destination).toBe("Anglit");
    expect(typeof json.distanceKm).toBe("number");
    expect(typeof json.fare).toBe("number");
    expect(json.passengerType).toBe("REGULAR");
    expect(json.method).toBe("ors");
    expect(json.inputMode).toBe("preset");
    expect(json).toHaveProperty("fareBreakdown");
    expect(json).toHaveProperty("polyline");
    expect(json).toHaveProperty("fallbackReason");
  });

  it("defaults passengerType to REGULAR when omitted", async () => {
    const res = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never
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
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.passengerType).toBe("STUDENT");
  });

  it("applies discount correctly for SENIOR passenger", async () => {
    const regularRes = await POST(
      makeRequest({ origin: P("Amandayehan"), destination: P("Anglit") }) as never
    );
    const seniorRes = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: P("Anglit"),
        passengerType: "SENIOR",
      }) as never
    );

    const regularFare = (await regularRes.json()).fare;
    const seniorFare  = (await seniorRes.json()).fare;
    expect(seniorFare).toBeLessThan(regularFare);
    expect(seniorFare).toBeCloseTo(regularFare * 0.8, 2);
  });
});

describe("POST /api/routes/calculate — pin mode", () => {
  it("returns 200 with inputMode 'pin' when origin is a pin", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 11.278823, lng: 125.001194 },
        destination: P("Anglit"),
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inputMode).toBe("pin");
    expect(json.origin).toBe("pin:11.278823,125.001194");
  });

  it("returns 200 with inputMode 'pin' when destination is a pin", async () => {
    const res = await POST(
      makeRequest({
        origin: P("Amandayehan"),
        destination: { type: "pin", lat: 11.278823, lng: 125.001194 },
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.inputMode).toBe("pin");
    expect(json.destination).toBe("pin:11.278823,125.001194");
  });

  it("returns 200 with minimum fare when two pin points are the same", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: 11.278823, lng: 125.001194 },
        destination: { type: "pin", lat: 11.278823, lng: 125.001194 },
      }) as never
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.distanceKm).toBe(0);
    expect(json.fare).toBe(15);
    expect(json.inputMode).toBe("pin");
  });

  it("returns 400 when pin lat/lng are non-numeric", async () => {
    const res = await POST(
      makeRequest({
        origin: { type: "pin", lat: "not-a-number", lng: 125.001 },
        destination: P("Anglit"),
      }) as never
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/origin/i);
  });
});
