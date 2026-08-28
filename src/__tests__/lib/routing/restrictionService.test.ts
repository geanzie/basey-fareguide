import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodePolyline } from "@/lib/routeUtils";
import type { RoadRestriction } from "@/lib/routing/restrictionService";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: { roadRestrictionOverride: { findMany } },
}));

/** A square around the Basey poblacion, as GeoJSON [lng, lat] positions. */
const SQUARE = {
  type: "Polygon",
  coordinates: [
    [
      [125.06, 11.28],
      [125.08, 11.28],
      [125.08, 11.29],
      [125.06, 11.29],
      [125.06, 11.28],
    ],
  ],
};

function restriction(overrides: Partial<RoadRestriction> = {}): RoadRestriction {
  return {
    id: "restriction-1",
    name: "Bridge out at Cogon",
    kind: "IMPASSABLE",
    geometryType: "POLYGON" as const,
    geometry: SQUARE,
    appliesTo: [] as RoadRestriction["appliesTo"],
    note: "Bridge washed out; use the inland road.",
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    ...overrides,
  };
}

async function loadModule() {
  const mod = await import("@/lib/routing/restrictionService");
  mod.invalidateRestrictionCache();
  return mod;
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

afterEach(async () => {
  const { invalidateRestrictionCache } = await import("@/lib/routing/restrictionService");
  invalidateRestrictionCache();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getActiveRestrictions", () => {
  it("asks only for rows inside their effective window", async () => {
    // A ford is impassable in the rainy season and fine the rest of the year.
    const { getActiveRestrictions } = await loadModule();
    const now = new Date("2026-08-28T00:00:00.000Z");

    await getActiveRestrictions(now);

    const where = findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(where.AND).toEqual([
      { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
    ]);
  });

  it("caches, then re-reads once an admin edits", async () => {
    findMany.mockResolvedValue([restriction()]);
    const { getActiveRestrictions, invalidateRestrictionCache } = await loadModule();

    await getActiveRestrictions();
    await getActiveRestrictions();
    expect(findMany).toHaveBeenCalledTimes(1);

    invalidateRestrictionCache();
    await getActiveRestrictions();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("returns nothing when the table has not been migrated yet", async () => {
    findMany.mockRejectedValue(
      new Error('The table `public.road_restriction_overrides` does not exist'),
    );
    const { getActiveRestrictions } = await loadModule();

    await expect(getActiveRestrictions()).resolves.toEqual([]);
  });
});

describe("restrictionsForVehicle", () => {
  it("applies an empty appliesTo to every vehicle", async () => {
    const { restrictionsForVehicle } = await loadModule();

    expect(restrictionsForVehicle([restriction()], "TRICYCLE")).toHaveLength(1);
    expect(restrictionsForVehicle([restriction()], null)).toHaveLength(1);
  });

  it("binds only the vehicle types named", async () => {
    const { restrictionsForVehicle } = await loadModule();
    const tricycleOnly = [restriction({ appliesTo: ["TRICYCLE"] })];

    expect(restrictionsForVehicle(tricycleOnly, "TRICYCLE")).toHaveLength(1);
    expect(restrictionsForVehicle(tricycleOnly, "HABAL_HABAL")).toHaveLength(0);
    expect(restrictionsForVehicle(tricycleOnly, null)).toHaveLength(0);
  });
});

describe("restrictionsVersion", () => {
  it("changes when a restriction is edited, so cached routes are dropped", async () => {
    const { restrictionsVersion } = await loadModule();
    const before = restrictionsVersion([restriction()]);
    const after = restrictionsVersion([
      restriction({ updatedAt: new Date("2026-08-29T00:00:00.000Z") }),
    ]);

    expect(before).not.toBe(after);
  });

  it("changes when one is added", async () => {
    const { restrictionsVersion } = await loadModule();

    expect(restrictionsVersion([])).not.toBe(restrictionsVersion([restriction()]));
  });
});

describe("geometry conversion", () => {
  it("hands Valhalla only the polygons", async () => {
    const { toExcludePolygons } = await loadModule();
    const mixed = [
      restriction(),
      restriction({ id: "r2", geometryType: "POINT", geometry: { lat: 11.28, lng: 125.07 } }),
    ];

    expect(toExcludePolygons(mixed)).toHaveLength(1);
  });

  it("hands Valhalla only the points", async () => {
    const { toExcludeLocations } = await loadModule();
    const mixed = [
      restriction(),
      restriction({ id: "r2", geometryType: "POINT", geometry: { lat: 11.28, lng: 125.07 } }),
    ];

    expect(toExcludeLocations(mixed)).toEqual([{ lat: 11.28, lng: 125.07 }]);
  });

  it("skips a ring too short to be a polygon", async () => {
    const { toExcludePolygons } = await loadModule();
    const broken = [restriction({ geometry: { type: "Polygon", coordinates: [[[125.06, 11.28]]] } })];

    expect(toExcludePolygons(broken)).toHaveLength(0);
  });
});

describe("findViolatedRestriction", () => {
  it("catches a route that runs through a closure", async () => {
    // The fallback for Google Routes, which has no polygon avoidance at all.
    const { findViolatedRestriction } = await loadModule();
    const through = encodePolyline([
      [11.275, 125.07],
      [11.285, 125.07],
      [11.295, 125.07],
    ]);

    expect(findViolatedRestriction(through, [restriction()])?.id).toBe("restriction-1");
  });

  it("passes a route that goes around it", async () => {
    const { findViolatedRestriction } = await loadModule();
    const around = encodePolyline([
      [11.275, 125.05],
      [11.285, 125.05],
      [11.295, 125.05],
    ]);

    expect(findViolatedRestriction(around, [restriction()])).toBeNull();
  });

  it("cannot judge a route with no shape", async () => {
    const { findViolatedRestriction } = await loadModule();

    expect(findViolatedRestriction(null, [restriction()])).toBeNull();
  });

  it("ignores point and way restrictions, which it cannot check", async () => {
    const { findViolatedRestriction } = await loadModule();
    const through = encodePolyline([
      [11.275, 125.07],
      [11.285, 125.07],
    ]);
    const nonPolygon = [
      restriction({ geometryType: "POINT", geometry: { lat: 11.285, lng: 125.07 } }),
      restriction({ id: "r3", geometryType: "OSM_WAY", geometry: { wayIds: [123] } }),
    ];

    expect(findViolatedRestriction(through, nonPolygon)).toBeNull();
  });
});
