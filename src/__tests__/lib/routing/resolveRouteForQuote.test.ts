import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
/** settingsService reads this too; no row means the env-default provider order. */
const findRoutingSettings = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const findRestrictions = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    curatedRouteDistance: { findMany },
    routingSettings: { findUnique: findRoutingSettings },
    roadRestrictionOverride: { findMany: findRestrictions },
  },
}));

const origin = { lat: 11.278823, lng: 125.001194 };
const dest = { lat: 11.304796, lng: 125.10899 };

/** ORS answering 14.8 km, so an engine result is distinguishable from a curated one. */
function orsResponse() {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        routes: [
          { summary: { distance: 14800, duration: 1320 }, geometry: "enginePolyline" },
        ],
      }),
  };
}

const SURVEYED_ROW = {
  id: "curated-1",
  originLocationId: "loc-amandayehan",
  distanceMeters: 9200,
  durationSeconds: 780,
  polyline: "surveyedPolyline",
  needsSurvey: false,
  source: "SURVEYED",
};

const PRESET_PAIR = {
  originLocationId: "loc-amandayehan",
  destinationLocationId: "loc-anglit",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  findMany.mockReset();
  findMany.mockResolvedValue([]);
  fetchMock = vi.fn().mockResolvedValue(orsResponse());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("resolveRouteForQuote tier order", () => {
  it("prices a surveyed distance and never asks an engine", async () => {
    findMany.mockResolvedValue([SURVEYED_ROW]);
    const { resolveRouteForQuote } = await import("@/lib/routing");

    const route = await resolveRouteForQuote({
      origin,
      destination: dest,
      ...PRESET_PAIR,
      vehicleType: "HABAL_HABAL",
    });

    expect(route.provider).toBe("curated");
    expect(route.distanceKm).toBeCloseTo(9.2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to the engines when nothing is surveyed for this pair", async () => {
    const { resolveRouteForQuote } = await import("@/lib/routing");

    const route = await resolveRouteForQuote({
      origin,
      destination: dest,
      ...PRESET_PAIR,
      vehicleType: "HABAL_HABAL",
    });

    expect(route.provider).toBe("ors");
    expect(route.distanceKm).toBeCloseTo(14.8);
  });

  it("skips the corpus entirely when either end is a dropped pin", async () => {
    // A pin cannot match a corpus row, so the lookup would only ever miss.
    findMany.mockResolvedValue([SURVEYED_ROW]);
    const { resolveRouteForQuote } = await import("@/lib/routing");

    const route = await resolveRouteForQuote({
      origin,
      destination: dest,
      originLocationId: "loc-amandayehan",
      destinationLocationId: null,
      vehicleType: "HABAL_HABAL",
    });

    expect(findMany).not.toHaveBeenCalled();
    expect(route.provider).toBe("ors");
  });

  it("skips the corpus when the rider named no vehicle", async () => {
    findMany.mockResolvedValue([SURVEYED_ROW]);
    const { resolveRouteForQuote } = await import("@/lib/routing");

    const route = await resolveRouteForQuote({
      origin,
      destination: dest,
      ...PRESET_PAIR,
      vehicleType: null,
    });

    expect(findMany).not.toHaveBeenCalled();
    expect(route.provider).toBe("ors");
  });

  it("passes the vehicle type down to the engine on a corpus miss", async () => {
    const { resolveRouteForQuote } = await import("@/lib/routing");

    await resolveRouteForQuote({
      origin,
      destination: dest,
      ...PRESET_PAIR,
      vehicleType: "TRICYCLE",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string).options).toEqual({
      avoid_features: ["ferries", "fords"],
    });
  });

  it("keeps a curated distance out of the estimate category", async () => {
    // It is the most trustworthy number in the system, not the least.
    findMany.mockResolvedValue([SURVEYED_ROW]);
    const { resolveRouteForQuote } = await import("@/lib/routing");

    const route = await resolveRouteForQuote({
      origin,
      destination: dest,
      ...PRESET_PAIR,
      vehicleType: "HABAL_HABAL",
    });

    expect(route.isEstimate).toBe(false);
    expect(route.fallbackReason).toBeNull();
  });
});
