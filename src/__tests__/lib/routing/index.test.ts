import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateRouteWithFallback } from "@/lib/routing";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const origin = { lat: 11.278823, lng: 125.001194 };
const dest   = { lat: 11.304796, lng: 125.108990 };

describe("calculateRouteWithFallback", () => {
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

    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("ors");
    expect(result.polyline).toBe("encodedPolylineString");
    expect(result.fallbackReason).toBeNull();
  });

  it("falls back to GPS when ORS key is missing", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");

    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("gps");
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

    const result = await calculateRouteWithFallback(origin, dest);

    expect(result.method).toBe("gps");
    expect(result.polyline).toBeNull();
    expect(result.fallbackReason).toBeTruthy();
  });

  it("GPS fallback still returns a positive distanceKm", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");

    const result = await calculateRouteWithFallback(origin, dest);
    expect(result.distanceKm).toBeGreaterThan(0);
  });
});
