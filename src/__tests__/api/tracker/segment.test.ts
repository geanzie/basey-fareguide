import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteResult } from "@/lib/routing/types";

const routingMock = vi.hoisted(() => ({
  calculateRouteWithFallback: vi.fn(),
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
}));

vi.mock("@/lib/routing", () => routingMock);
vi.mock("@/lib/rateLimit", () => rateLimitMock);

import { POST } from "@/app/api/tracker/segment/route";
import { calculateRouteWithFallback } from "@/lib/routing";

const mockRouting = vi.mocked(calculateRouteWithFallback);

const ORS_ROUTE: RouteResult = {
  distanceKm: 0.8,
  durationMin: 3,
  distanceMeters: 800,
  durationSeconds: 180,
  polyline: "encoded",
  method: "ors",
  provider: "ors",
  isEstimate: false,
  fallbackReason: null,
  snappedOrigin: { lat: 11.27541, lng: 125.06891, wasSnapped: false },
  snappedDestination: { lat: 11.2762, lng: 125.0694, wasSnapped: true },
  diagnostics: {
    provider: "ors",
    routeFound: true,
    isEstimate: false,
    errorCode: null,
    errorMessage: null,
  },
};

function makeBody(overrides?: Record<string, unknown>) {
  return {
    trackerSessionId: "trip-session-1",
    from: {
      lat: 11.2754,
      lng: 125.0689,
      accuracyM: 15,
      timestampMs: 1_700_000_000_000,
    },
    to: {
      lat: 11.2762,
      lng: 125.0694,
      accuracyM: 18,
      timestampMs: 1_700_000_015_000,
    },
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tracker/segment", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMock.getClientIdentifier.mockReturnValue("1.2.3.4");
  rateLimitMock.checkRateLimit.mockReturnValue({
    success: true,
    remaining: 5,
    resetTime: Date.now() + 60_000,
  });
  mockRouting.mockResolvedValue(ORS_ROUTE);
});

describe("POST /api/tracker/segment", () => {
  it("returns a road-aware response for accepted ORS segments", async () => {
    const res = await POST(makeRequest(makeBody()) as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(true);
    expect(json.confidence).toBe("road_aware");
    expect(json.method).toBe("ors");
    expect(json.distanceKm).toBe(0.8);
  });

  it("returns gps_estimate confidence when ORS falls back to GPS", async () => {
    mockRouting.mockResolvedValueOnce({
      distanceKm: 0.7,
      durationMin: null,
      distanceMeters: 700,
      durationSeconds: null,
      polyline: null,
      method: "gps",
      provider: "gps",
      isEstimate: true,
      fallbackReason: "ORS unavailable",
      snappedOrigin: null,
      snappedDestination: null,
      diagnostics: {
        provider: "gps",
        routeFound: false,
        isEstimate: true,
        errorCode: null,
        errorMessage: "ORS unavailable",
      },
    });

    const res = await POST(makeRequest(makeBody()) as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(true);
    expect(json.confidence).toBe("gps_estimate");
    expect(json.method).toBe("gps");
    expect(json.fallbackReason).toMatch(/ORS unavailable/);
  });

  it("returns 429 with retry metadata when rate-limited", async () => {
    rateLimitMock.checkRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
      retryAfter: 30,
    });

    const res = await POST(makeRequest(makeBody()) as never);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const json = await res.json();
    expect(json.retryAfter).toBe(30);
  });

  it("rejects non-monotonic timestamps as a tracker rejection", async () => {
    const res = await POST(
      makeRequest(
        makeBody({
          to: {
            lat: 11.2762,
            lng: 125.0694,
            accuracyM: 18,
            timestampMs: 1_700_000_000_000,
          },
        }),
      ) as never,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(false);
    expect(json.confidence).toBe("rejected");
    expect(json.reason).toBe("non_monotonic_timestamp");
  });

  it("rejects segments when ORS snapped endpoints are too far from the raw checkpoint", async () => {
    mockRouting.mockResolvedValueOnce({
      ...ORS_ROUTE,
      snappedDestination: {
        lat: 11.278,
        lng: 125.072,
        wasSnapped: true,
      },
    });

    const res = await POST(makeRequest(makeBody()) as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(false);
    expect(json.confidence).toBe("rejected");
    expect(json.reason).toBe("destination_snap_too_far");
  });
});
