import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  evidence: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
}));

const unlinkMock = vi.hoisted(() => vi.fn());
const existsSyncMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return {
    ...actual,
    unlink: unlinkMock,
  };
});

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: existsSyncMock,
  };
});

import { cleanupEvidenceFiles, getEvidenceStorageStats } from "@/lib/evidenceCleanup";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("evidence cleanup", () => {
  it("marks storage metadata without mutating review remarks", async () => {
    prismaMock.evidence.findMany.mockResolvedValueOnce([
      {
        id: "ev-1",
        fileName: "evidence_1.jpg",
        fileUrl: "/uploads/evidence/evidence_1.jpg",
        fileType: "IMAGE",
      },
    ]);
    existsSyncMock.mockReturnValue(true);
    prismaMock.evidence.updateMany.mockResolvedValueOnce({ count: 1 });

    await cleanupEvidenceFiles("inc-1");

    expect(unlinkMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.evidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          incidentId: "inc-1",
          storageStatus: "AVAILABLE",
        },
        data: expect.objectContaining({
          storageStatus: "DELETED",
          fileDeletedAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.evidence.updateMany.mock.calls[0][0].data.remarks).toBeUndefined();
  });

  it("reports storage stats from available files only", async () => {
    prismaMock.evidence.groupBy.mockResolvedValueOnce([]);
    prismaMock.evidence.aggregate.mockResolvedValueOnce({
      _sum: { fileSize: 4096 },
      _count: { id: 2 },
    });

    await getEvidenceStorageStats();

    expect(prismaMock.evidence.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          storageStatus: "AVAILABLE",
        },
      }),
    );
    expect(prismaMock.evidence.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          storageStatus: "AVAILABLE",
        },
      }),
    );
  });
});
