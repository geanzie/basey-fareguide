import { describe, expect, it, beforeEach, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  incident: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  evidence: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

import { GET } from "@/app/api/admin/reports/route";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireRequestRole.mockResolvedValue({ id: "admin-1", userType: "ADMIN" });
  prismaMock.incident.count.mockResolvedValue(4);
  prismaMock.incident.groupBy
    .mockResolvedValueOnce([
      { status: "PENDING", _count: 2 },
      { status: "RESOLVED", _count: 2 },
    ])
    .mockResolvedValueOnce([
      { incidentType: "FARE_OVERCHARGE", _count: 3 },
      { incidentType: "RECKLESS_DRIVING", _count: 1 },
    ]);
  prismaMock.incident.findMany.mockResolvedValue([
    { createdAt: new Date("2026-04-01T00:00:00.000Z"), status: "PENDING" },
    { createdAt: new Date("2026-04-02T00:00:00.000Z"), status: "RESOLVED" },
  ]);
  prismaMock.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
  prismaMock.user.groupBy.mockResolvedValue([
    { userType: "ADMIN", _count: 1 },
    { userType: "PUBLIC", _count: 9 },
  ]);
  prismaMock.user.findMany.mockResolvedValue([
    { createdAt: new Date("2026-04-01T00:00:00.000Z") },
    { createdAt: new Date("2026-04-02T00:00:00.000Z") },
  ]);
  prismaMock.evidence.aggregate.mockResolvedValue({
    _count: { _all: 2 },
    _sum: { fileSize: 3072 },
  });
  prismaMock.evidence.groupBy.mockResolvedValue([
    { fileType: "IMAGE", _count: { _all: 1 }, _sum: { fileSize: 1024 } },
    { fileType: "VIDEO", _count: { _all: 1 }, _sum: { fileSize: 2048 } },
  ]);
});

describe("GET /api/admin/reports", () => {
  it("returns only live report data and omits fake uptime or response-time fields", async () => {
    const res = await GET(new Request("http://localhost/api/admin/reports?period=30d") as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.data.incidents.total).toBe(4);
    expect(json.data.users.active).toBe(8);
    expect(json.data.storage.totalFiles).toBe(2);
    expect(json.data.system).toBeUndefined();
    expect(JSON.stringify(json.data)).not.toContain("uptime");
    expect(JSON.stringify(json.data)).not.toContain("responseTime");
    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5000,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5000,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });
});
