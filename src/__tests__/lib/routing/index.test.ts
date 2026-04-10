import { describe, it, expect, vi, afterEach } from "vitest";

import { RoutingServiceError } from "@/lib/routing/types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const origin = { lat: 11.278823, lng: 125.001194 };
const dest   = { lat: 11.304796, lng: 125.108990 };

describe("routing orchestrators", () => {
  async function loadRouting() {
    return import("@/lib/routing");
  }

  it("returns ORS result when ORS succeeds", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        routes: [
          {
            summary: { distance: 14800, duration: 1320 },
            geometry: "encodedPolylineString",
          },
        ],
      }),
    }));

    const { calculateRouteWithFallback } = await loadRouting();
    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("ors");
    expect(result.provider).toBe("ors");
    expect(result.isEstimate).toBe(false);
    expect(result.polyline).toBe("encodedPolylineString");
    expect(result.fallbackReason).toBeNull();
  });

  it("falls back to GPS when ORS key is missing", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");

    const { calculateRouteWithFallback } = await loadRouting();
    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("gps");
    expect(result.provider).toBe("gps");
    expect(result.isEstimate).toBe(true);
    expect(result.polyline).toBeNull();
    expect(result.fallbackReason).toMatch(/OPENROUTESERVICE_API_KEY/);
  });

  it("falls back to GPS when ORS returns an error", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    }));

    const { calculateRouteWithFallback } = await loadRouting();
    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("gps");
    expect(result.provider).toBe("gps");
    expect(result.polyline).toBeNull();
    expect(result.fallbackReason).toBeTruthy();
  });

  it("falls back to Google Routes before GPS when ORS fails but Google succeeds", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "google-test-key");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              routes: [
                {
                  distanceMeters: 15100,
                  duration: "1380s",
                  polyline: { encodedPolyline: "googleEncodedPolyline" },
                  legs: [
                    {
                      startLocation: {
                        latLng: { latitude: origin.lat, longitude: origin.lng },
                      },
                      endLocation: {
                        latLng: { latitude: dest.lat, longitude: dest.lng },
                      },
                    },
                  ],
                },
              ],
            }),
        }),
    );

    const { calculateRouteWithFallback } = await loadRouting();
    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("google_routes");
    expect(result.provider).toBe("google_routes");
    expect(result.isEstimate).toBe(false);
    expect(result.polyline).toBe("googleEncodedPolyline");
    expect(result.fallbackReason).toContain("ORS request failed");
  });

  it("GPS fallback still returns a positive distanceKm", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");

    const { calculateRouteWithFallback } = await loadRouting();
    const result = await calculateRouteWithFallback(origin, dest);
    expect(result.distanceKm).toBeGreaterThan(0);
  });

  it("reuses cached ORS results for repeated coordinates rounded to 4 decimals", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        routes: [
          {
            summary: { distance: 14800, duration: 1320 },
            geometry: "encodedPolylineString",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { calculateRouteWithFallback } = await loadRouting();

    await calculateRouteWithFallback(origin, dest);
    await calculateRouteWithFallback(
      { lat: 11.2788234, lng: 125.0011944 },
      { lat: 11.3047964, lng: 125.1089896 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the configured timeout value in the GPS fallback reason", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    vi.stubEnv("ROUTING_ORS_TIMEOUT_MS", "4200");

    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const { calculateRouteWithFallback } = await loadRouting();
    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("gps");
    expect(result.fallbackReason).toContain("4200");
  });

  it("returns exactly one ORS-backed shortest road route without estimate metadata", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        routes: [
          {
            summary: { distance: 14800, duration: 1320 },
            geometry: "encodedPolylineString",
          },
        ],
      }),
    }));

    const { calculateShortestRoadRoute } = await loadRouting();
    const result = await calculateShortestRoadRoute(origin, dest);

    expect(result.method).toBe("ors");
    expect(result.provider).toBe("ors");
    expect(result.isEstimate).toBe(false);
    expect(result.fallbackReason).toBeNull();
  });

  it("does not downgrade to GPS when shortest-road routing fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");

    const { calculateShortestRoadRoute } = await loadRouting();

    await expect(calculateShortestRoadRoute(origin, dest)).rejects.toMatchObject({
      code: "ROUTE_UNVERIFIED",
      provider: "google_routes",
      reason: "configuration_error",
    } satisfies Partial<RoutingServiceError>);
  });

  it("keeps shortest-route cache isolated from fallback cache entries", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        routes: [
          {
            summary: { distance: 14800, duration: 1320 },
            geometry: "encodedPolylineString",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { calculateRouteWithFallback, calculateShortestRoadRoute } = await loadRouting();

    await calculateRouteWithFallback(origin, dest);
    await calculateShortestRoadRoute(origin, dest);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
