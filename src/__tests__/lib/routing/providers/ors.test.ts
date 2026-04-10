import { describe, it, expect, vi, afterEach } from "vitest";
import { OrsProvider } from "@/lib/routing/providers/ors";
import { RoutingServiceError } from "@/lib/routing/types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("OrsProvider constructor", () => {
  it("throws when OPENROUTESERVICE_API_KEY is not set", () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");
    expect(() => new OrsProvider()).toThrow("OPENROUTESERVICE_API_KEY");
  });

  it("does not throw when OPENROUTESERVICE_API_KEY is set", () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    expect(() => new OrsProvider()).not.toThrow();
  });
});

describe("OrsProvider.calculate", () => {
  const origin = { lat: 11.278823, lng: 125.001194 };
  const dest   = { lat: 11.304796, lng: 125.108990 };

  it("returns a RouteResult with method=ors on success", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    const mockOrsResponse = {
      routes: [
        {
          summary: { distance: 14800, duration: 1320 },
          geometry: "encodedPolylineString",
        },
      ],
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOrsResponse),
    }));

    const provider = new OrsProvider();
    const result = await provider.calculate(origin, dest);

    expect(result.method).toBe("ors");
    expect(result.provider).toBe("ors");
    expect(result.isEstimate).toBe(false);
    expect(result.distanceKm).toBeCloseTo(14.8);
    expect(result.durationMin).toBeCloseTo(22);
    expect(result.polyline).toBe("encodedPolylineString");
    expect(result.fallbackReason).toBeNull();
  });

  it("sends coordinates in [lng, lat] order (ORS requirement)", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    let capturedBody: { coordinates?: [number, number][] } | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ summary: { distance: 1000, duration: 60 }, geometry: null }],
        }),
      });
    }));

    const provider = new OrsProvider();
    await provider.calculate(origin, dest);

    expect(capturedBody!.coordinates![0]).toEqual([origin.lng, origin.lat]);
    expect(capturedBody!.coordinates![1]).toEqual([dest.lng, dest.lat]);
  });

  it("adds preference=shortest for shortest-road requests", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    let capturedBody:
      | {
          coordinates?: [number, number][];
          preference?: string;
        }
      | undefined;

    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          routes: [{ summary: { distance: 1000, duration: 60 }, geometry: null }],
        }),
      });
    }));

    const provider = new OrsProvider();
    await provider.calculateShortest(origin, dest);

    expect(capturedBody?.preference).toBe("shortest");
  });

  it("throws on non-OK HTTP response", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    }));

    const provider = new OrsProvider();
    await expect(provider.calculate(origin, dest)).rejects.toThrow("403");
  });

  it("throws when ORS response is missing routes[0].summary", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ routes: [] }),
    }));

    const provider = new OrsProvider();
    await expect(provider.calculate(origin, dest)).rejects.toThrow(
      "routes[0].summary"
    );
  });

  it("throws a typed no-route error when ORS reports no routable path", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Route could not be found between points"),
    }));

    const provider = new OrsProvider();

    await expect(provider.calculateShortest(origin, dest)).rejects.toMatchObject({
      code: "NO_ROAD_ROUTE_FOUND",
      provider: "ors",
      reason: "no_route_found",
    } satisfies Partial<RoutingServiceError>);
  });
});
