import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  curatedRouteDistance: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET } from "@/app/api/curated-routes/route";

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  originLocationId: "loc-a",
  destinationLocationId: "loc-b",
  vehicleType: "TRICYCLE",
  distanceMeters: 4200,
  durationSeconds: 600,
  isBidirectional: true,
  updatedAt: new Date("2026-05-01T00:00:00.000Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/curated-routes", () => {
  it("packs rows into an id dictionary and positional tuples", async () => {
    prismaMock.curatedRouteDistance.findMany.mockResolvedValueOnce([
      row(),
      row({
        destinationLocationId: "loc-c",
        vehicleType: "HABAL_HABAL",
        distanceMeters: 5100,
        durationSeconds: null,
        isBidirectional: false,
        updatedAt: new Date("2026-06-02T00:00:00.000Z"),
      }),
    ]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.locationIds).toEqual(["loc-a", "loc-b", "loc-c"]);
    expect(json.vehicleTypes).toEqual(["TRICYCLE", "HABAL_HABAL"]);
    expect(json.routes).toEqual([
      [0, 1, 0, 4200, 600, 1],
      [0, 2, 1, 5100, null, 0],
    ]);
    expect(json.count).toBe(2);
  });

  it("reports the newest row as generatedAt so a client can tell when to refetch", async () => {
    prismaMock.curatedRouteDistance.findMany.mockResolvedValueOnce([
      row({ updatedAt: new Date("2026-05-01T00:00:00.000Z") }),
      row({ destinationLocationId: "loc-c", updatedAt: new Date("2026-06-02T00:00:00.000Z") }),
    ]);

    const json = await (await GET()).json();

    expect(json.generatedAt).toBe("2026-06-02T00:00:00.000Z");
  });

  it("asks the database only for active rows", async () => {
    prismaMock.curatedRouteDistance.findMany.mockResolvedValueOnce([]);

    await GET();

    expect(prismaMock.curatedRouteDistance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it("never ships polyline geometry the offline path cannot draw", async () => {
    prismaMock.curatedRouteDistance.findMany.mockResolvedValueOnce([row()]);

    await GET();

    const select = prismaMock.curatedRouteDistance.findMany.mock.calls[0][0].select;
    expect(select.polyline).toBeUndefined();
  });

  it("is cacheable for a client on a weak connection", async () => {
    prismaMock.curatedRouteDistance.findMany.mockResolvedValueOnce([]);

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
  });

  it("returns an empty corpus rather than throwing when nothing is curated", async () => {
    prismaMock.curatedRouteDistance.findMany.mockResolvedValueOnce([]);

    const json = await (await GET()).json();

    expect(json).toEqual({
      locationIds: [],
      vehicleTypes: [],
      routes: [],
      count: 0,
      generatedAt: null,
    });
  });

  it("returns 500 when the corpus cannot be loaded", async () => {
    prismaMock.curatedRouteDistance.findMany.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await GET();

    expect(response.status).toBe(500);
  });
});
