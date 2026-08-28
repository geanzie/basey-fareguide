import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  roadRestrictionOverride: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  roadRestrictionOverrideAudit: { create: vi.fn() },
}));

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    throw error;
  }),
}));

const invalidateRestrictionCache = vi.hoisted(() => vi.fn());
const clearRoutingCache = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));
vi.mock("@/lib/routing", () => ({ invalidateRestrictionCache, clearRoutingCache }));

import { GET, POST } from "@/app/api/admin/road-restrictions/route";
import { DELETE, PATCH } from "@/app/api/admin/road-restrictions/[id]/route";

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

const ROW = {
  id: "restriction-1",
  name: "Bridge out at Cogon",
  kind: "IMPASSABLE",
  geometryType: "POLYGON",
  geometry: SQUARE,
  appliesTo: [],
  isActive: true,
  effectiveFrom: null,
  effectiveTo: null,
  note: "Bridge washed out.",
  createdAt: new Date("2026-08-28T00:00:00.000Z"),
  updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  createdByUser: { firstName: "Ana", lastName: "Cruz", username: "acruz" },
  updatedByUser: null,
};

const VALID_BODY = {
  name: "Bridge out at Cogon",
  kind: "IMPASSABLE",
  geometryType: "POLYGON",
  geometry: SQUARE,
};

function makeRequest(url: string, body?: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const BASE = "http://localhost/api/admin/road-restrictions";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireRequestRole.mockResolvedValue({ id: "admin-1", userType: "ADMIN" });
  prismaMock.roadRestrictionOverride.findMany.mockResolvedValue([ROW]);
  prismaMock.roadRestrictionOverride.findUnique.mockResolvedValue(null);
  prismaMock.roadRestrictionOverride.create.mockResolvedValue(ROW);
  prismaMock.roadRestrictionOverride.update.mockResolvedValue(ROW);
});

describe("GET /api/admin/road-restrictions", () => {
  it("rejects anyone who is not an admin", async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error("Forbidden"));

    await expect(GET(makeRequest(BASE, undefined, "GET") as never)).rejects.toThrow("Forbidden");
  });

  it("returns serialized restrictions", async () => {
    const res = await GET(makeRequest(BASE, undefined, "GET") as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.roadRestrictions[0]).toMatchObject({
      id: "restriction-1",
      inEffect: true,
      createdByName: "Ana Cruz (@acruz)",
    });
  });

  it("marks an out-of-season restriction as not in effect", async () => {
    // Active but outside its window: the list has to show that differently
    // from one that is simply switched off.
    prismaMock.roadRestrictionOverride.findMany.mockResolvedValue([
      {
        ...ROW,
        effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2020-03-01T00:00:00.000Z"),
      },
    ]);

    const json = await (await GET(makeRequest(BASE, undefined, "GET") as never)).json();

    expect(json.roadRestrictions[0]).toMatchObject({ isActive: true, inEffect: false });
  });
});

describe("POST /api/admin/road-restrictions", () => {
  it("creates, audits, and drops both caches", async () => {
    const res = await POST(makeRequest(BASE, VALID_BODY) as never);

    expect(res.status).toBe(201);
    expect(prismaMock.roadRestrictionOverrideAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "CREATE" }) }),
    );
    // A closure has to be live immediately, not when a cache happens to expire.
    expect(invalidateRestrictionCache).toHaveBeenCalled();
    expect(clearRoutingCache).toHaveBeenCalled();
  });

  it("refuses an unclosed polygon ring", async () => {
    // A malformed geometry silently restricts nothing, which is the worst
    // possible failure for this layer — so it is caught on the way in.
    const res = await POST(
      makeRequest(BASE, {
        ...VALID_BODY,
        geometry: {
          type: "Polygon",
          coordinates: [[[125.06, 11.28], [125.08, 11.28], [125.08, 11.29], [125.07, 11.30]]],
        },
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/closed/);
    expect(prismaMock.roadRestrictionOverride.create).not.toHaveBeenCalled();
  });

  it("refuses a ring with too few positions", async () => {
    const res = await POST(
      makeRequest(BASE, {
        ...VALID_BODY,
        geometry: { type: "Polygon", coordinates: [[[125.06, 11.28], [125.08, 11.28]]] },
      }) as never,
    );

    expect(res.status).toBe(400);
  });

  it("refuses a point geometry that is not a coordinate", async () => {
    const res = await POST(
      makeRequest(BASE, {
        ...VALID_BODY,
        geometryType: "POINT",
        geometry: { lat: "eleven", lng: 125.07 },
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/lat, lng/);
  });

  it("accepts OSM way ids", async () => {
    prismaMock.roadRestrictionOverride.create.mockResolvedValue({
      ...ROW,
      geometryType: "OSM_WAY",
      geometry: { wayIds: [12345] },
    });

    const res = await POST(
      makeRequest(BASE, {
        ...VALID_BODY,
        geometryType: "OSM_WAY",
        geometry: { wayIds: [12345] },
      }) as never,
    );

    expect(res.status).toBe(201);
  });

  it("refuses an effective window that ends before it starts", async () => {
    const res = await POST(
      makeRequest(BASE, {
        ...VALID_BODY,
        effectiveFrom: "2026-10-01T00:00:00.000Z",
        effectiveTo: "2026-09-01T00:00:00.000Z",
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/must not be after/);
  });

  it("refuses an unknown vehicle type", async () => {
    const res = await POST(
      makeRequest(BASE, { ...VALID_BODY, appliesTo: ["HELICOPTER"] }) as never,
    );

    expect(res.status).toBe(400);
  });

  it("refuses a duplicate name", async () => {
    prismaMock.roadRestrictionOverride.findUnique.mockResolvedValue({ id: "existing" });

    const res = await POST(makeRequest(BASE, VALID_BODY) as never);

    expect(res.status).toBe(409);
  });

  it("reports errors under `message`, the only key mobile reads", async () => {
    const res = await POST(makeRequest(BASE, { ...VALID_BODY, kind: "NONSENSE" }) as never);
    const json = await res.json();

    expect(json.message).toBeTruthy();
    expect(json.error).toBeUndefined();
  });
});

describe("PATCH /api/admin/road-restrictions/[id]", () => {
  beforeEach(() => {
    prismaMock.roadRestrictionOverride.findUnique.mockResolvedValue(ROW);
  });

  it("404s on a row that does not exist", async () => {
    prismaMock.roadRestrictionOverride.findUnique.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest(`${BASE}/nope`, { note: "x" }, "PATCH") as never,
      ctx("nope"),
    );

    expect(res.status).toBe(404);
  });

  it("validates a replacement geometry against the stored geometry type", async () => {
    const res = await PATCH(
      makeRequest(`${BASE}/restriction-1`, { geometry: { lat: 11.28, lng: 125.07 } }, "PATCH") as never,
      ctx("restriction-1"),
    );

    // The stored type is POLYGON, so a point is not a valid replacement.
    expect(res.status).toBe(400);
  });

  it("records who changed it and drops the caches", async () => {
    await PATCH(
      makeRequest(`${BASE}/restriction-1`, { note: "reopened one lane" }, "PATCH") as never,
      ctx("restriction-1"),
    );

    const data = prismaMock.roadRestrictionOverride.update.mock.calls[0][0].data;
    expect(data.updatedByUser).toEqual({ connect: { id: "admin-1" } });
    expect(invalidateRestrictionCache).toHaveBeenCalled();
  });

  it("rejects a body with nothing updatable in it", async () => {
    const res = await PATCH(
      makeRequest(`${BASE}/restriction-1`, { colour: "red" }, "PATCH") as never,
      ctx("restriction-1"),
    );

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/road-restrictions/[id]", () => {
  beforeEach(() => {
    prismaMock.roadRestrictionOverride.findUnique.mockResolvedValue(ROW);
  });

  it("lifts the restriction instead of deleting it", async () => {
    // The row explains why routes were quoted the way they were while it stood.
    const res = await DELETE(
      makeRequest(`${BASE}/restriction-1?reason=bridge%20rebuilt`, undefined, "DELETE") as never,
      ctx("restriction-1"),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.roadRestrictionOverride.update.mock.calls[0][0].data.isActive).toBe(false);

    const audit = prismaMock.roadRestrictionOverrideAudit.create.mock.calls[0][0].data;
    expect(audit.action).toBe("LIFT");
    expect(audit.reason).toBe("bridge rebuilt");
    expect(clearRoutingCache).toHaveBeenCalled();
  });
});
