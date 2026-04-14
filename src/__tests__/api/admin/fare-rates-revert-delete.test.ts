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
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const txFareRateDeletionAuditMock = vi.hoisted(() => ({
  create: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  fareRateVersion: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  fareRateDeletionAudit: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { DELETE as DELETE_FARE_RATE_VERSION } from "@/app/api/admin/fare-rates/[id]/route";
import { POST as POST_REVERT_FARE_RATE } from "@/app/api/admin/fare-rates/revert/route";

function makeJsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body == null ? undefined : JSON.stringify(body),
  });
}

function makeFareRateVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "fare-1",
    baseFare: 15,
    perKmRate: 3,
    effectiveAt: new Date("2026-04-01T00:00:00.000Z"),
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    createdBy: "admin-1",
    notes: "Baseline fare version.",
    canceledAt: null,
    canceledBy: null,
    cancellationReason: null,
    createdByUser: {
      firstName: "Admin",
      lastName: "User",
      username: "admin",
    },
    canceledByUser: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-14T00:00:00.000Z"));

  authMock.requireRequestRole.mockResolvedValue({ id: "admin-1", userType: "ADMIN" });
  prismaMock.$transaction.mockImplementation(
    async (
      callback: (tx: {
        fareRateVersion: typeof txFareRateVersionMock;
        fareRateDeletionAudit: typeof txFareRateDeletionAuditMock;
      }) => unknown,
    ) => callback({ fareRateVersion: txFareRateVersionMock, fareRateDeletionAudit: txFareRateDeletionAuditMock }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin fare rate revert and delete routes", () => {
  it("reverts the live fare rate to the previous eligible version", async () => {
    const currentVersion = makeFareRateVersion({
      id: "fare-current",
      baseFare: 22,
      perKmRate: 5,
      effectiveAt: new Date("2026-04-10T00:00:00.000Z"),
      createdAt: new Date("2026-04-10T00:00:00.000Z"),
      notes: "Emergency increase.",
    });
    const previousVersion = makeFareRateVersion({
      id: "fare-previous",
      baseFare: 18,
      perKmRate: 4,
      effectiveAt: new Date("2026-04-05T00:00:00.000Z"),
      createdAt: new Date("2026-04-05T00:00:00.000Z"),
      notes: "Prior approved fare.",
    });

    txFareRateVersionMock.findFirst
      .mockResolvedValueOnce(currentVersion)
      .mockResolvedValueOnce(previousVersion);
    txFareRateVersionMock.update.mockResolvedValueOnce({ id: "fare-current" });

    const response = await POST_REVERT_FARE_RATE(
      makeJsonRequest("http://localhost/api/admin/fare-rates/revert", "POST", {
        reason: "Incorrect ordinance encoding.",
      }) as never,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(txFareRateVersionMock.findFirst).toHaveBeenCalledTimes(2);
    expect(txFareRateVersionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fare-current" },
        data: expect.objectContaining({
          canceledBy: "admin-1",
          cancellationReason: expect.stringContaining("Incorrect ordinance encoding."),
        }),
      }),
    );
    expect(json.revertedFromVersionId).toBe("fare-current");
    expect(json.fareRateVersion.id).toBe("fare-previous");
    expect(json.message).toMatch(/reverted/i);
  });

  it("rejects revert when no previous eligible version exists", async () => {
    txFareRateVersionMock.findFirst
      .mockResolvedValueOnce(makeFareRateVersion({
        id: "fare-current",
        baseFare: 22,
        perKmRate: 5,
        effectiveAt: new Date("2026-04-10T00:00:00.000Z"),
      }))
      .mockResolvedValueOnce(null);

    const response = await POST_REVERT_FARE_RATE(
      makeJsonRequest("http://localhost/api/admin/fare-rates/revert", "POST") as never,
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toMatch(/previous eligible/i);
    expect(txFareRateVersionMock.update).not.toHaveBeenCalled();
  });

  it("enforces admin authentication on revert", async () => {
    authMock.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

    const response = await POST_REVERT_FARE_RATE(
      makeJsonRequest("http://localhost/api/admin/fare-rates/revert", "POST") as never,
    );

    expect(response.status).toBe(401);
    expect(txFareRateVersionMock.findFirst).not.toHaveBeenCalled();
  });

  it("permanently deletes a non-live fare rate and writes an audit row", async () => {
    txFareRateVersionMock.findUnique.mockResolvedValueOnce(
      makeFareRateVersion({
        id: "fare-upcoming",
        baseFare: 24,
        perKmRate: 5.5,
        effectiveAt: new Date("2026-04-20T00:00:00.000Z"),
        createdAt: new Date("2026-04-12T00:00:00.000Z"),
        notes: "Mistaken entry.",
      }),
    );
    txFareRateDeletionAuditMock.create.mockResolvedValueOnce({ id: "audit-1" });
    txFareRateVersionMock.delete.mockResolvedValueOnce({ id: "fare-upcoming" });

    const response = await DELETE_FARE_RATE_VERSION(
      makeJsonRequest("http://localhost/api/admin/fare-rates/fare-upcoming", "DELETE", {
        reason: "Duplicate mistaken encoding.",
      }) as never,
      { params: Promise.resolve({ id: "fare-upcoming" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(txFareRateDeletionAuditMock.create).toHaveBeenCalledWith({
      data: {
        fareRateVersionId: "fare-upcoming",
        action: "fare_version_deleted",
        reason: "Duplicate mistaken encoding.",
        deletedBy: "admin-1",
      },
    });
    expect(txFareRateVersionMock.delete).toHaveBeenCalledWith({
      where: { id: "fare-upcoming" },
    });
    expect(json.deletedVersionId).toBe("fare-upcoming");
  });

  it("blocks deletion of the current live fare rate", async () => {
    txFareRateVersionMock.findUnique.mockResolvedValueOnce(
      makeFareRateVersion({
        id: "fare-current",
        baseFare: 22,
        perKmRate: 5,
        effectiveAt: new Date("2026-04-10T00:00:00.000Z"),
      }),
    );

    const response = await DELETE_FARE_RATE_VERSION(
      makeJsonRequest("http://localhost/api/admin/fare-rates/fare-current", "DELETE") as never,
      { params: Promise.resolve({ id: "fare-current" }) },
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toMatch(/current live/i);
    expect(txFareRateDeletionAuditMock.create).not.toHaveBeenCalled();
    expect(txFareRateVersionMock.delete).not.toHaveBeenCalled();
  });

  it("returns not found when deleting an unknown fare rate version", async () => {
    txFareRateVersionMock.findUnique.mockResolvedValueOnce(null);

    const response = await DELETE_FARE_RATE_VERSION(
      makeJsonRequest("http://localhost/api/admin/fare-rates/missing", "DELETE") as never,
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(txFareRateDeletionAuditMock.create).not.toHaveBeenCalled();
  });
});