import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Unauthorized" ? 401 :
      message === "Forbidden" ? 403 :
      500;

    return new Response(JSON.stringify({ message }), { status });
  }),
}));

const txFareRateVersionMock = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  fareRateVersion: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

const fareRateServiceMock = vi.hoisted(() => ({
  getAdminFareRates: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/fare/rateService", () => ({
  getAdminFareRates: fareRateServiceMock.getAdminFareRates,
}));

import { DELETE, GET, POST } from "@/app/api/admin/fare-rates/route";

function makeJsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body == null ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-03T00:00:00.000Z"));

  authMock.requireRequestRole.mockResolvedValue({ id: "admin-1", userType: "ADMIN" });
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: { fareRateVersion: typeof txFareRateVersionMock }) => unknown) =>
      callback({ fareRateVersion: txFareRateVersionMock }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin fare rate management route", () => {
  it("enforces admin authentication", async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

    const response = await GET(makeJsonRequest("http://localhost/api/admin/fare-rates", "GET") as never);

    expect(response.status).toBe(401);
    expect(fareRateServiceMock.getAdminFareRates).not.toHaveBeenCalled();
  });

  it("lists current, upcoming, and historical fare versions for admins", async () => {
    fareRateServiceMock.getAdminFareRates.mockResolvedValueOnce({
      current: {
        versionId: "fare-live",
        baseDistanceKm: 3,
        baseFare: 15,
        perKmRate: 3,
        effectiveAt: "2026-04-01T00:00:00.000Z",
      },
      upcoming: {
        versionId: "fare-next",
        baseDistanceKm: 3,
        baseFare: 18,
        perKmRate: 4,
        effectiveAt: "2026-04-10T00:00:00.000Z",
      },
      currentVersion: null,
      upcomingVersion: null,
      history: [],
    });

    const response = await GET(makeJsonRequest("http://localhost/api/admin/fare-rates", "GET") as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.current.baseFare).toBe(15);
    expect(json.upcoming.baseFare).toBe(18);
  });

  it("publishes an immediate fare version", async () => {
    txFareRateVersionMock.create.mockResolvedValueOnce({
      id: "fare-new",
      baseFare: 19.5,
      perKmRate: 4,
      effectiveAt: new Date("2026-04-03T00:00:00.000Z"),
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      createdBy: "admin-1",
      notes: "Approved emergency fuel adjustment.",
      canceledAt: null,
      canceledBy: null,
      cancellationReason: null,
      createdByUser: {
        firstName: "Admin",
        lastName: "User",
        username: "admin",
      },
      canceledByUser: null,
    });

    const response = await POST(
      makeJsonRequest("http://localhost/api/admin/fare-rates", "POST", {
        mode: "immediate",
        baseFare: 19.5,
        perKmRate: 4,
        notes: "Approved emergency fuel adjustment.",
      }) as never,
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(txFareRateVersionMock.findFirst).not.toHaveBeenCalled();
    expect(txFareRateVersionMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          baseFare: 19.5,
          perKmRate: 4,
          createdBy: "admin-1",
          notes: "Approved emergency fuel adjustment.",
        }),
      }),
    );
    expect(json.message).toMatch(/published successfully/i);
    expect(json.fareRateVersion.baseFare).toBe(19.5);
  });

  it("replaces an existing scheduled version and stores the Manila schedule in UTC", async () => {
    txFareRateVersionMock.findFirst.mockResolvedValueOnce({ id: "future-1" });
    txFareRateVersionMock.update.mockResolvedValueOnce({ id: "future-1" });
    txFareRateVersionMock.create.mockResolvedValueOnce({
      id: "fare-scheduled",
      baseFare: 22,
      perKmRate: 5,
      effectiveAt: new Date("2026-04-05T01:30:00.000Z"),
      createdAt: new Date("2026-04-03T00:00:00.000Z"),
      createdBy: "admin-1",
      notes: "Weekend rate update.",
      canceledAt: null,
      canceledBy: null,
      cancellationReason: null,
      createdByUser: {
        firstName: "Admin",
        lastName: "User",
        username: "admin",
      },
      canceledByUser: null,
    });

    const response = await POST(
      makeJsonRequest("http://localhost/api/admin/fare-rates", "POST", {
        mode: "scheduled",
        baseFare: 22,
        perKmRate: 5,
        effectiveAt: "2026-04-05T09:30",
        notes: "Weekend rate update.",
      }) as never,
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(txFareRateVersionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "future-1" },
        data: expect.objectContaining({
          canceledBy: "admin-1",
          cancellationReason: "Replaced by a newly scheduled fare rate version.",
        }),
      }),
    );
    expect(txFareRateVersionMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          effectiveAt: expect.any(Date),
        }),
      }),
    );
    const createCall = txFareRateVersionMock.create.mock.calls[0]?.[0];
    expect(createCall.data.effectiveAt.toISOString()).toBe("2026-04-05T01:30:00.000Z");
    expect(json.replacedVersionId).toBe("future-1");
  });

  it("cancels the next scheduled fare version", async () => {
    prismaMock.fareRateVersion.findFirst.mockResolvedValueOnce({ id: "future-1" });
    prismaMock.fareRateVersion.update.mockResolvedValueOnce({ id: "future-1" });

    const response = await DELETE(
      makeJsonRequest("http://localhost/api/admin/fare-rates", "DELETE", {
        reason: "Holiday announcement withdrawn.",
      }) as never,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.fareRateVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "future-1" },
        data: expect.objectContaining({
          canceledBy: "admin-1",
          cancellationReason: "Holiday announcement withdrawn.",
        }),
      }),
    );
    expect(json.canceledVersionId).toBe("future-1");
  });
});
