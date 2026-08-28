import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  curatedRouteDistance: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  curatedRouteDistanceAudit: { create: vi.fn() },
  location: { findMany: vi.fn() },
}));

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    throw error;
  }),
}));

const invalidateCuratedRouteCache = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/auth", () => ({
  ADMIN_OR_ENCODER: ["ADMIN", "DATA_ENCODER"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

vi.mock("@/lib/routing", () => ({ invalidateCuratedRouteCache }));

import { GET, POST } from "@/app/api/admin/curated-routes/route";
import { DELETE, PATCH } from "@/app/api/admin/curated-routes/[id]/route";

const ROW = {
  id: "curated-1",
  vehicleType: "HABAL_HABAL",
  distanceMeters: 9200,
  durationSeconds: 780,
  polyline: "surveyedPolyline",
  isBidirectional: false,
  source: "SURVEYED",
  needsSurvey: false,
  notes: null,
  isActive: true,
  surveyedAt: new Date("2026-08-01T00:00:00.000Z"),
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
  origin: { id: "loc-amandayehan", name: "Amandayehan", barangay: "Amandayehan" },
  destination: { id: "loc-anglit", name: "Anglit", barangay: "Anglit" },
  surveyedByUser: { firstName: "Ana", lastName: "Cruz", username: "acruz" },
};

function makeRequest(url: string, body?: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const VALID_BODY = {
  originLocationId: "loc-amandayehan",
  destinationLocationId: "loc-anglit",
  vehicleType: "HABAL_HABAL",
  // Amandayehan and Anglit sit ~11.8 km apart in a straight line, so anything
  // below that is refused by the floor check — as an earlier version of this
  // fixture discovered.
  distanceMeters: 14800,
  source: "SURVEYED",
};

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireRequestRole.mockResolvedValue({ id: "encoder-1", userType: "DATA_ENCODER" });
  prismaMock.curatedRouteDistance.findMany.mockResolvedValue([ROW]);
  prismaMock.curatedRouteDistance.count.mockResolvedValue(1);
  prismaMock.curatedRouteDistance.findUnique.mockResolvedValue(null);
  prismaMock.curatedRouteDistance.create.mockResolvedValue(ROW);
  prismaMock.curatedRouteDistance.update.mockResolvedValue(ROW);
  prismaMock.location.findMany.mockResolvedValue([
    { id: "loc-amandayehan", coordinates: "11.278823,125.001194" },
    { id: "loc-anglit", coordinates: "11.304796,125.108990" },
  ]);
});

describe("GET /api/admin/curated-routes", () => {
  it("rejects a caller without the encoder or admin role", async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error("Forbidden"));

    await expect(
      GET(makeRequest("http://localhost/api/admin/curated-routes", undefined, "GET") as never),
    ).rejects.toThrow("Forbidden");
  });

  it("returns serialized rows with pagination", async () => {
    const res = await GET(
      makeRequest("http://localhost/api/admin/curated-routes", undefined, "GET") as never,
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.curatedRoutes).toHaveLength(1);
    expect(json.curatedRoutes[0]).toMatchObject({
      id: "curated-1",
      distanceMeters: 9200,
      distanceKm: 9.2,
      surveyedByName: "Ana Cruz (@acruz)",
      surveyedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(json.pagination).toMatchObject({ page: 1, total: 1 });
  });

  it("surfaces unconfirmed rows first, since the list exists to be worked through", async () => {
    await GET(makeRequest("http://localhost/api/admin/curated-routes", undefined, "GET") as never);

    expect(prismaMock.curatedRouteDistance.findMany.mock.calls[0][0].orderBy[0]).toEqual({
      needsSurvey: "desc",
    });
  });

  it("filters by vehicle type and survey state", async () => {
    await GET(
      makeRequest(
        "http://localhost/api/admin/curated-routes?vehicleType=TRICYCLE&needsSurvey=true",
        undefined,
        "GET",
      ) as never,
    );

    expect(prismaMock.curatedRouteDistance.findMany.mock.calls[0][0].where).toEqual({
      vehicleType: "TRICYCLE",
      needsSurvey: true,
    });
  });

  it("ignores a vehicleType filter that is not a real vehicle type", async () => {
    await GET(
      makeRequest(
        "http://localhost/api/admin/curated-routes?vehicleType=HELICOPTER",
        undefined,
        "GET",
      ) as never,
    );

    expect(prismaMock.curatedRouteDistance.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("POST /api/admin/curated-routes", () => {
  it("creates a row, writes an audit entry, and clears the lookup cache", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", VALID_BODY) as never,
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.curatedRoute.id).toBe("curated-1");
    expect(prismaMock.curatedRouteDistanceAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", changedBy: "encoder-1" }),
      }),
    );
    // A curated distance sets a fare; it has to go live immediately.
    expect(invalidateCuratedRouteCache).toHaveBeenCalled();
  });

  it("rejects a distance stored in the wrong unit", async () => {
    // 9.2 here means somebody typed kilometres into a metres field. Accepting it
    // would undercharge every trip on this pair until a human noticed.
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", {
        ...VALID_BODY,
        distanceMeters: 9.2,
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/whole number of metres/);
    expect(prismaMock.curatedRouteDistance.create).not.toHaveBeenCalled();
  });

  it("rejects an implausibly long distance", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", {
        ...VALID_BODY,
        distanceMeters: 9_200_000,
      }) as never,
    );

    expect(res.status).toBe(400);
  });

  it("rejects a route from a place to itself", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", {
        ...VALID_BODY,
        destinationLocationId: VALID_BODY.originLocationId,
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/two different places/);
  });

  it("rejects an unknown vehicle type", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", {
        ...VALID_BODY,
        vehicleType: "HELICOPTER",
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/vehicleType/);
  });

  it("refuses an endpoint that is not a saved place", async () => {
    // A row keyed on something the quote path can never resolve is dead weight.
    prismaMock.location.findMany.mockResolvedValue([
      { id: "loc-amandayehan", coordinates: "11.278823,125.001194" },
    ]);

    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", VALID_BODY) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/saved places/);
  });

  it("refuses a duplicate pair rather than silently shadowing one", async () => {
    prismaMock.curatedRouteDistance.findUnique.mockResolvedValue({ id: "curated-existing" });

    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", VALID_BODY) as never,
    );

    expect(res.status).toBe(409);
    expect(prismaMock.curatedRouteDistance.create).not.toHaveBeenCalled();
  });

  it("reports errors under `message`, which is the only key mobile reads", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", { ...VALID_BODY, source: "GUESS" }) as never,
    );
    const json = await res.json();

    expect(json.message).toBeTruthy();
    expect(json.error).toBeUndefined();
  });
});

describe("PATCH /api/admin/curated-routes/[id]", () => {
  beforeEach(() => {
    prismaMock.curatedRouteDistance.findUnique.mockResolvedValue(ROW);
  });

  it("404s on a row that does not exist", async () => {
    prismaMock.curatedRouteDistance.findUnique.mockResolvedValue(null);

    const res = await PATCH(
      makeRequest("http://localhost/api/admin/curated-routes/nope", { distanceMeters: 100 }, "PATCH") as never,
      ctx("nope"),
    );

    expect(res.status).toBe(404);
  });

  it("re-stamps the surveyor and clears the unconfirmed flag on a new measurement", async () => {
    await PATCH(
      makeRequest("http://localhost/api/admin/curated-routes/curated-1", { distanceMeters: 8800 }, "PATCH") as never,
      ctx("curated-1"),
    );

    const data = prismaMock.curatedRouteDistance.update.mock.calls[0][0].data;
    expect(data.distanceMeters).toBe(8800);
    expect(data.needsSurvey).toBe(false);
    expect(data.surveyedByUser).toEqual({ connect: { id: "encoder-1" } });
  });

  it("honours an explicit needsSurvey sent alongside a new distance", async () => {
    await PATCH(
      makeRequest(
        "http://localhost/api/admin/curated-routes/curated-1",
        { distanceMeters: 8800, needsSurvey: true },
        "PATCH",
      ) as never,
      ctx("curated-1"),
    );

    expect(prismaMock.curatedRouteDistance.update.mock.calls[0][0].data.needsSurvey).toBe(true);
  });

  it("does not re-stamp the surveyor when only a note changed", async () => {
    await PATCH(
      makeRequest("http://localhost/api/admin/curated-routes/curated-1", { notes: "via the ford" }, "PATCH") as never,
      ctx("curated-1"),
    );

    const data = prismaMock.curatedRouteDistance.update.mock.calls[0][0].data;
    expect(data.notes).toBe("via the ford");
    expect(data.surveyedByUser).toBeUndefined();
  });

  it("rejects a body with nothing updatable in it", async () => {
    const res = await PATCH(
      makeRequest("http://localhost/api/admin/curated-routes/curated-1", { colour: "red" }, "PATCH") as never,
      ctx("curated-1"),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.curatedRouteDistance.update).not.toHaveBeenCalled();
  });

  it("records the before and after in the audit trail", async () => {
    await PATCH(
      makeRequest("http://localhost/api/admin/curated-routes/curated-1", { distanceMeters: 8800 }, "PATCH") as never,
      ctx("curated-1"),
    );

    const audit = prismaMock.curatedRouteDistanceAudit.create.mock.calls[0][0].data;
    expect(audit.action).toBe("UPDATE");
    expect(audit.previous).toMatchObject({ distanceMeters: 9200 });
    expect(audit.next).toBeTruthy();
    expect(invalidateCuratedRouteCache).toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/curated-routes/[id]", () => {
  beforeEach(() => {
    prismaMock.curatedRouteDistance.findUnique.mockResolvedValue(ROW);
  });

  it("retires the row instead of deleting it", async () => {
    // The row is evidence for every fare already quoted from it.
    const res = await DELETE(
      makeRequest("http://localhost/api/admin/curated-routes/curated-1", undefined, "DELETE") as never,
      ctx("curated-1"),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.curatedRouteDistance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it("keeps the stated reason in the audit trail", async () => {
    await DELETE(
      makeRequest(
        "http://localhost/api/admin/curated-routes/curated-1?reason=road%20washed%20out",
        undefined,
        "DELETE",
      ) as never,
      ctx("curated-1"),
    );

    const audit = prismaMock.curatedRouteDistanceAudit.create.mock.calls[0][0].data;
    expect(audit.action).toBe("RETIRE");
    expect(audit.reason).toBe("road washed out");
    expect(invalidateCuratedRouteCache).toHaveBeenCalled();
  });

  it("404s on a row that does not exist", async () => {
    prismaMock.curatedRouteDistance.findUnique.mockResolvedValue(null);

    const res = await DELETE(
      makeRequest("http://localhost/api/admin/curated-routes/nope", undefined, "DELETE") as never,
      ctx("nope"),
    );

    expect(res.status).toBe(404);
  });
});

describe("the straight-line floor", () => {
  it("refuses a distance shorter than the line between its own endpoints", async () => {
    // Amandayehan to Anglit is ~11.8 km apart in a straight line. A stored
    // 550 m is what an engine returns when it snaps both centroids onto one
    // road — and 152 such rows reached production before this guard existed.
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", {
        ...VALID_BODY,
        distanceMeters: 550,
      }) as never,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/shorter than the straight-line/);
    expect(prismaMock.curatedRouteDistance.create).not.toHaveBeenCalled();
  });

  it("accepts a plausible road distance for the same pair", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/admin/curated-routes", {
        ...VALID_BODY,
        distanceMeters: 13000,
      }) as never,
    );

    expect(res.status).toBe(201);
  });

  it("applies the same floor when a distance is corrected", async () => {
    prismaMock.curatedRouteDistance.findUnique.mockResolvedValue({
      ...ROW,
      origin: { ...ROW.origin, coordinates: "11.278823,125.001194" },
      destination: { ...ROW.destination, coordinates: "11.304796,125.108990" },
    });

    const res = await PATCH(
      makeRequest(
        "http://localhost/api/admin/curated-routes/curated-1",
        { distanceMeters: 550 },
        "PATCH",
      ) as never,
      ctx("curated-1"),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.curatedRouteDistance.update).not.toHaveBeenCalled();
  });
});
