import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: { curatedRouteDistance: { findMany } },
}));

const origin = { lat: 11.278823, lng: 125.001194 };
const dest = { lat: 11.304796, lng: 125.10899 };

const FORWARD_ROW = {
  id: "curated-1",
  originLocationId: "loc-amandayehan",
  distanceMeters: 9200,
  durationSeconds: 780,
  polyline: "surveyedPolyline",
  needsSurvey: false,
  source: "SURVEYED",
};

/** The same trip stored the other way round, marked as answering both ways. */
const REVERSE_ROW = {
  ...FORWARD_ROW,
  id: "curated-2",
  originLocationId: "loc-anglit",
};

async function loadModule() {
  const mod = await import("@/lib/routing/curatedRoutes");
  mod.invalidateCuratedRouteCache();
  return mod;
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

afterEach(async () => {
  const { invalidateCuratedRouteCache } = await import("@/lib/routing/curatedRoutes");
  invalidateCuratedRouteCache();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("findCuratedRoute", () => {
  it("returns the surveyed row for the direction being travelled", async () => {
    findMany.mockResolvedValue([FORWARD_ROW]);
    const { findCuratedRoute } = await loadModule();

    const record = await findCuratedRoute({
      originLocationId: "loc-amandayehan",
      destinationLocationId: "loc-anglit",
      vehicleType: "HABAL_HABAL",
    });

    expect(record).toMatchObject({ id: "curated-1", distanceMeters: 9200, reversed: false });
  });

  it("marks a row stored the other way round as reversed", async () => {
    findMany.mockResolvedValue([REVERSE_ROW]);
    const { findCuratedRoute } = await loadModule();

    const record = await findCuratedRoute({
      originLocationId: "loc-amandayehan",
      destinationLocationId: "loc-anglit",
      vehicleType: "HABAL_HABAL",
    });

    expect(record?.reversed).toBe(true);
  });

  it("prefers the row measured in the travelled direction when both exist", async () => {
    // A one-way pair can have a genuinely different distance each way, so the
    // direction actually being travelled has to win.
    findMany.mockResolvedValue([REVERSE_ROW, FORWARD_ROW]);
    const { findCuratedRoute } = await loadModule();

    const record = await findCuratedRoute({
      originLocationId: "loc-amandayehan",
      destinationLocationId: "loc-anglit",
      vehicleType: "HABAL_HABAL",
    });

    expect(record?.id).toBe("curated-1");
    expect(record?.reversed).toBe(false);
  });

  it("only considers a reverse row when its surveyor marked it bidirectional", async () => {
    findMany.mockResolvedValue([]);
    const { findCuratedRoute } = await loadModule();

    await findCuratedRoute({
      originLocationId: "loc-amandayehan",
      destinationLocationId: "loc-anglit",
      vehicleType: "HABAL_HABAL",
    });

    const where = findMany.mock.calls[0][0].where;
    const reverseClause = where.OR.find(
      (clause: { originLocationId: string }) => clause.originLocationId === "loc-anglit",
    );
    expect(reverseClause.isBidirectional).toBe(true);
  });

  it("scopes the lookup to the requested vehicle type and active rows only", async () => {
    const { findCuratedRoute } = await loadModule();

    await findCuratedRoute({
      originLocationId: "loc-amandayehan",
      destinationLocationId: "loc-anglit",
      vehicleType: "TRICYCLE",
    });

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      isActive: true,
      vehicleType: "TRICYCLE",
    });
  });

  it("does not look up anything when no vehicle type was given", async () => {
    // A distance measured for a tricycle is not a distance for "some vehicle".
    const { findCuratedRoute } = await loadModule();

    const record = await findCuratedRoute({
      originLocationId: "loc-amandayehan",
      destinationLocationId: "loc-anglit",
      vehicleType: null,
    });

    expect(record).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("falls through quietly when the table has not been migrated yet", async () => {
    // The corpus is additive. Before its migration runs, a quote must still be
    // answerable by the engines rather than 500.
    findMany.mockRejectedValue(
      new Error('The table `public.curated_route_distances` does not exist'),
    );
    const { findCuratedRoute } = await loadModule();

    await expect(
      findCuratedRoute({
        originLocationId: "loc-amandayehan",
        destinationLocationId: "loc-anglit",
        vehicleType: "TRICYCLE",
      }),
    ).resolves.toBeNull();
  });

  it("rethrows a failure that is not a missing table", async () => {
    findMany.mockRejectedValue(new Error("connection terminated unexpectedly"));
    const { findCuratedRoute } = await loadModule();

    await expect(
      findCuratedRoute({
        originLocationId: "loc-amandayehan",
        destinationLocationId: "loc-anglit",
        vehicleType: "TRICYCLE",
      }),
    ).rejects.toThrow(/connection terminated/);
  });
});

describe("curated route cache", () => {
  const lookup = {
    originLocationId: "loc-amandayehan",
    destinationLocationId: "loc-anglit",
    vehicleType: "TRICYCLE" as const,
  };

  it("serves a repeat lookup without hitting the database", async () => {
    findMany.mockResolvedValue([FORWARD_ROW]);
    const { findCuratedRoute } = await loadModule();

    await findCuratedRoute(lookup);
    await findCuratedRoute(lookup);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("caches a miss too, since a miss is the common case", async () => {
    const { findCuratedRoute } = await loadModule();

    await findCuratedRoute(lookup);
    await findCuratedRoute(lookup);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps vehicle types apart", async () => {
    findMany.mockResolvedValue([FORWARD_ROW]);
    const { findCuratedRoute } = await loadModule();

    await findCuratedRoute(lookup);
    await findCuratedRoute({ ...lookup, vehicleType: "HABAL_HABAL" });

    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("re-reads after an admin edit, because a curated distance sets a fare", async () => {
    findMany.mockResolvedValue([FORWARD_ROW]);
    const { findCuratedRoute, invalidateCuratedRouteCache } = await loadModule();

    await findCuratedRoute(lookup);
    invalidateCuratedRouteCache();
    await findCuratedRoute(lookup);

    expect(findMany).toHaveBeenCalledTimes(2);
  });
});

describe("curatedRouteToResult", () => {
  it("presents a surveyed distance as a verified route, not an estimate", async () => {
    const { curatedRouteToResult } = await loadModule();

    const result = curatedRouteToResult(
      { ...FORWARD_ROW, reversed: false },
      origin,
      dest,
    );

    expect(result).toMatchObject({
      distanceKm: 9.2,
      distanceMeters: 9200,
      durationMin: 13,
      method: "curated",
      provider: "curated",
      isEstimate: false,
      fallbackReason: null,
      polyline: "surveyedPolyline",
    });
  });

  it("reports the requested places as their own snapped points", async () => {
    // The surveyed route begins and ends at these saved places, so the
    // ride-access guard should judge them on the places' recorded access rather
    // than on a snap no provider performed.
    const { curatedRouteToResult } = await loadModule();

    const result = curatedRouteToResult({ ...FORWARD_ROW, reversed: false }, origin, dest);

    expect(result.snappedOrigin).toEqual({ ...origin, wasSnapped: false });
    expect(result.snappedDestination).toEqual({ ...dest, wasSnapped: false });
  });

  it("drops the polyline on a reversed row but keeps the distance", async () => {
    // The stored line runs the other way, and Basey's one-ways mean the return
    // path is not necessarily the same road.
    const { curatedRouteToResult } = await loadModule();

    const result = curatedRouteToResult({ ...FORWARD_ROW, reversed: true }, origin, dest);

    expect(result.polyline).toBeNull();
    expect(result.distanceMeters).toBe(9200);
  });

  it("carries a null duration through rather than inventing one", async () => {
    // Batch-seeded rows can arrive with a distance and nothing else.
    const { curatedRouteToResult } = await loadModule();

    const result = curatedRouteToResult(
      { ...FORWARD_ROW, durationSeconds: null, reversed: false },
      origin,
      dest,
    );

    expect(result.durationMin).toBeNull();
    expect(result.durationSeconds).toBeNull();
  });
});
