import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findRoutingSettings = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    routingSettings: { findUnique: findRoutingSettings },
    curatedRouteDistance: { findMany: vi.fn().mockResolvedValue([]) },
    roadRestrictionOverride: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const origin = { lat: 11.278823, lng: 125.001194 };
const dest = { lat: 11.304796, lng: 125.10899 };

function settingsRow(primaryProvider: "ORS" | "GOOGLE_ROUTES" | "VALHALLA") {
  return { primaryProvider, updatedBy: null, updatedAt: new Date(), updatedByUser: null };
}

/** Routes each provider by the URL it is called with. */
function routerFetch(handlers: {
  valhalla?: () => unknown;
  ors?: () => unknown;
  google?: () => unknown;
}) {
  return vi.fn((url: string) => {
    const target = String(url);

    if (target.includes("valhalla")) {
      if (!handlers.valhalla) return Promise.reject(new Error("valhalla not stubbed"));
      return Promise.resolve(handlers.valhalla());
    }
    if (target.includes("openrouteservice")) {
      if (!handlers.ors) return Promise.reject(new Error("ors not stubbed"));
      return Promise.resolve(handlers.ors());
    }
    if (!handlers.google) return Promise.reject(new Error("google not stubbed"));
    return Promise.resolve(handlers.google());
  });
}

const valhallaOk = () => ({
  ok: true,
  json: () =>
    Promise.resolve({ trip: { summary: { length: 9.2, time: 780 }, legs: [{ shape: "" }] } }),
});

const orsOk = () => ({
  ok: true,
  json: () =>
    Promise.resolve({
      routes: [{ summary: { distance: 14800, duration: 1320 }, geometry: "orsPolyline" }],
    }),
});

const googleOk = () => ({
  ok: true,
  json: () =>
    Promise.resolve({
      routes: [
        {
          distanceMeters: 15100,
          duration: "1380s",
          polyline: { encodedPolyline: "googlePolyline" },
          legs: [
            {
              startLocation: { latLng: { latitude: origin.lat, longitude: origin.lng } },
              endLocation: { latLng: { latitude: dest.lat, longitude: dest.lng } },
            },
          ],
        },
      ],
    }),
});

const dead = () => ({ ok: false, status: 500, text: () => Promise.resolve("down"), json: () => Promise.resolve({ error: "down" }) });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  vi.stubEnv("OPENROUTESERVICE_API_KEY", "ors-key");
  vi.stubEnv("GOOGLE_ROUTES_API_KEY", "google-key");
  vi.stubEnv("ROUTING_VALHALLA_URL", "http://valhalla.test:8002");
  vi.stubEnv("ROUTING_VALHALLA_ENABLED", "true");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  findRoutingSettings.mockResolvedValue(settingsRow("VALHALLA"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("provider chain order", () => {
  it("prefers the self-hosted engine when an admin selected it", async () => {
    vi.stubGlobal("fetch", routerFetch({ valhalla: valhallaOk, ors: orsOk, google: googleOk }));
    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    const route = await calculateShortestRoadRoute(origin, dest, { vehicleType: "TRICYCLE" });

    expect(route.provider).toBe("valhalla");
    expect(route.fallbackReason).toBeNull();
  });

  it("falls all the way through three providers rather than giving up at two", async () => {
    // The old two-tuple chain could not express this at all.
    vi.stubGlobal("fetch", routerFetch({ valhalla: dead, ors: dead, google: googleOk }));
    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    const route = await calculateShortestRoadRoute(origin, dest, { vehicleType: "TRICYCLE" });

    expect(route.provider).toBe("google_routes");
    expect(route.fallbackReason).toBeTruthy();
  });

  it("ignores the self-hosted engine when it is not configured", async () => {
    // Selecting Valhalla before the tiles exist must degrade, not fail.
    vi.stubEnv("ROUTING_VALHALLA_ENABLED", "false");
    const fetchMock = routerFetch({ ors: orsOk, google: googleOk });
    vi.stubGlobal("fetch", fetchMock);
    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    const route = await calculateShortestRoadRoute(origin, dest);

    expect(route.provider).toBe("ors");
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("valhalla"))).toBe(true);
  });

  it("leaves the cloud-only orders untouched", async () => {
    findRoutingSettings.mockResolvedValue(settingsRow("GOOGLE_ROUTES"));
    vi.stubGlobal("fetch", routerFetch({ valhalla: valhallaOk, ors: orsOk, google: googleOk }));
    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    const route = await calculateShortestRoadRoute(origin, dest);

    expect(route.provider).toBe("google_routes");
  });

  it("still refuses to price a guess when every engine fails", async () => {
    // No GPS tier in the fare path, whatever the chain length.
    vi.stubGlobal("fetch", routerFetch({ valhalla: dead, ors: dead, google: dead }));
    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    await expect(calculateShortestRoadRoute(origin, dest)).rejects.toMatchObject({
      code: "ROUTE_UNVERIFIED",
    });
  });

  it("still estimates for the tracker when every engine fails", async () => {
    vi.stubGlobal("fetch", routerFetch({ valhalla: dead, ors: dead, google: dead }));
    const { calculateRouteWithFallback } = await import("@/lib/routing");

    const route = await calculateRouteWithFallback(origin, dest);

    expect(route.provider).toBe("gps");
    expect(route.isEstimate).toBe(true);
  });
});

describe("getProviderOrder", () => {
  it("puts the cloud providers behind the self-hosted one, never in front", async () => {
    const { getProviderOrder } = await import("@/lib/routing");

    expect(getProviderOrder("valhalla")).toEqual(["valhalla", "ors", "google_routes"]);
    expect(getProviderOrder("ors")).toEqual(["ors", "google_routes"]);
    expect(getProviderOrder("google_routes")).toEqual(["google_routes", "ors"]);
  });

  it("drops the self-hosted engine from the order when it is unconfigured", async () => {
    vi.stubEnv("ROUTING_VALHALLA_ENABLED", "false");
    const { getProviderOrder } = await import("@/lib/routing");

    expect(getProviderOrder("valhalla")).toEqual(["ors", "google_routes"]);
  });
});
