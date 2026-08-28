import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ message }), { status });
  }),
}));

const prismaMock = vi.hoisted(() => ({
  location: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/auth", () => ({
  ADMIN_OR_ENCODER: ["ADMIN", "DATA_ENCODER"],
  requireRequestRole: authMocks.requireRequestRole,
  createAuthErrorResponse: authMocks.createAuthErrorResponse,
}));

vi.mock("@/lib/routing", () => ({ clearRoutingCache: vi.fn() }));

import { GET } from "@/app/api/locations/ride-access/route";
import { PUT } from "@/app/api/locations/[id]/ride-access/route";

/** Inside Poblacion, so the barangay polygon lookup accepts it. */
const SCHOOL_PIN = { lat: 11.28185, lng: 125.06835 };
const SCHOOL_GATE = { lat: 11.28174, lng: 125.06754 };

const SCHOOL_ROW = {
  id: "loc-school",
  name: "Basey 1 Central Elementary School",
  barangay: "Poblacion",
  coordinates: `${SCHOOL_PIN.lat},${SCHOOL_PIN.lng}`,
  vehicleAccess: "UNVERIFIED" as const,
  dropoffCoordinates: null,
  accessNote: null,
  accessVerifiedAt: null,
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

function putRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/locations/loc-school/ride-access",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const params = Promise.resolve({ id: "loc-school" });

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.requireRequestRole.mockResolvedValue({ id: "encoder-1" });
  prismaMock.location.findUnique.mockResolvedValue(SCHOOL_ROW);
  prismaMock.location.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...SCHOOL_ROW, ...data }),
  );
});

describe("GET /api/locations/ride-access", () => {
  it("rejects callers without the encoder or admin role", async () => {
    authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Forbidden"));

    const res = await GET(
      new NextRequest("http://localhost/api/locations/ride-access"),
    );

    expect(res.status).toBe(403);
  });

  it("defaults to the proposals nobody has confirmed yet", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([SCHOOL_ROW]);
    prismaMock.location.count.mockResolvedValueOnce(1);

    const res = await GET(
      new NextRequest("http://localhost/api/locations/ride-access"),
    );

    expect(res.status).toBe(200);
    // The queue is "has a proposed drop-off, access still unconfirmed". It must
    // not touch validationStatus — that governs whether the calculator can see
    // the place at all (plannerLocations.ts filters on VALIDATED).
    expect(prismaMock.location.findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      vehicleAccess: "UNVERIFIED",
      dropoffCoordinates: { not: null },
    });

    const json = await res.json();
    expect(json.locations[0]).toMatchObject({
      id: "loc-school",
      vehicleAccess: "UNVERIFIED",
      coordinates: SCHOOL_PIN,
      dropoffCoordinates: null,
    });
    expect(json.pagination.total).toBe(1);
  });
});

describe("GET /api/locations/ride-access — other filters", () => {
  it("still lists the never-checked places on request", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([]);
    prismaMock.location.count.mockResolvedValueOnce(0);

    await GET(
      new NextRequest("http://localhost/api/locations/ride-access?status=unverified"),
    );

    expect(prismaMock.location.findMany.mock.calls[0][0].where).toMatchObject({
      vehicleAccess: "UNVERIFIED",
    });
  });

  it("lists every active place when asked for all", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([]);
    prismaMock.location.count.mockResolvedValueOnce(0);

    await GET(new NextRequest("http://localhost/api/locations/ride-access?status=all"));

    expect(prismaMock.location.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });
});

describe("PUT /api/locations/[id]/ride-access", () => {
  it("records a drop-off for a walk-only place", async () => {
    const res = await PUT(
      putRequest({
        vehicleAccess: "WALK_ONLY",
        dropoffCoordinates: SCHOOL_GATE,
        accessNote: "Stairs from the gate to the campus.",
      }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(prismaMock.location.update.mock.calls[0][0].data).toMatchObject({
      vehicleAccess: "WALK_ONLY",
      dropoffCoordinates: `${SCHOOL_GATE.lat},${SCHOOL_GATE.lng}`,
      accessNote: "Stairs from the gate to the campus.",
      accessVerifiedBy: "encoder-1",
    });
  });

  it("refuses a walk-only place with no drop-off", async () => {
    const res = await PUT(putRequest({ vehicleAccess: "WALK_ONLY" }), { params });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/drop-off point/i);
    expect(prismaMock.location.update).not.toHaveBeenCalled();
  });

  it("refuses a drop-off outside Basey", async () => {
    const res = await PUT(
      putRequest({
        vehicleAccess: "WALK_ONLY",
        dropoffCoordinates: { lat: 14.5995, lng: 120.9842 },
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/outside Basey/i);
  });

  it("clears the drop-off when a place is marked reachable", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce({
      ...SCHOOL_ROW,
      vehicleAccess: "WALK_ONLY",
      dropoffCoordinates: `${SCHOOL_GATE.lat},${SCHOOL_GATE.lng}`,
    });

    const res = await PUT(
      putRequest({ vehicleAccess: "VEHICLE_ACCESSIBLE" }),
      { params },
    );

    expect(res.status).toBe(200);
    expect(prismaMock.location.update.mock.calls[0][0].data).toMatchObject({
      vehicleAccess: "VEHICLE_ACCESSIBLE",
      dropoffCoordinates: null,
    });
  });

  it("rejects an unknown access value", async () => {
    const res = await PUT(putRequest({ vehicleAccess: "MAYBE" }), { params });

    expect(res.status).toBe(400);
    expect(prismaMock.location.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a location that does not exist", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(null);

    const res = await PUT(
      putRequest({ vehicleAccess: "VEHICLE_ACCESSIBLE" }),
      { params },
    );

    expect(res.status).toBe(404);
  });
});
