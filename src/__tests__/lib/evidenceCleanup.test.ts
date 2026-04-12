import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  incident: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  evidence: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
}));

const delMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@vercel/blob", async () => {
  const actual = await vi.importActual<typeof import("@vercel/blob")>("@vercel/blob");
  return {
    ...actual,
    del: delMock,
  };
});

import {
  cleanupEvidenceFiles,
  cleanupOldEvidenceFiles,
  getEvidenceStorageStats,
  previewOldEvidenceCleanup,
  MAX_EVIDENCE_CLEANUP_BATCH_SIZE,
} from "@/lib/evidenceCleanup";

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
    prismaMock.evidence.updateMany.mockResolvedValueOnce({ count: 1 });

    await cleanupEvidenceFiles("inc-1");

    expect(delMock).toHaveBeenCalledWith("/uploads/evidence/evidence_1.jpg");
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

  it("limits maintenance cleanup to a bounded oldest-first batch", async () => {
    prismaMock.incident.findMany.mockResolvedValueOnce([
      { id: "inc-1" },
      { id: "inc-2" },
    ]);
    prismaMock.incident.count.mockResolvedValueOnce(3);
    prismaMock.evidence.findMany
      .mockResolvedValueOnce([
        {
          id: "ev-1",
          fileName: "evidence_1.jpg",
          fileUrl: "/uploads/evidence/evidence_1.jpg",
          fileType: "IMAGE",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "ev-2",
          fileName: "evidence_2.jpg",
          fileUrl: "/uploads/evidence/evidence_2.jpg",
          fileType: "IMAGE",
        },
      ]);
    prismaMock.evidence.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const result = await cleanupOldEvidenceFiles(30, 2);

    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ resolvedAt: "asc" }, { id: "asc" }],
        where: expect.objectContaining({
          evidence: {
            some: {
              storageStatus: "AVAILABLE",
            },
          },
        }),
      }),
    );
    expect(result).toMatchObject({
      batchSize: 2,
      processedIncidents: 2,
      processedFiles: 2,
      markedEvidenceRecords: 2,
      fileErrors: 0,
      hasMore: true,
    });
  });

  it("previews only the first bounded incident batch while aggregating total cleanup scope", async () => {
    prismaMock.incident.findMany.mockResolvedValueOnce([
      {
        id: "inc-1",
        status: "RESOLVED",
        resolvedAt: new Date("2026-03-01T00:00:00.000Z"),
        evidence: [
          {
            id: "ev-1",
            fileName: "evidence_1.jpg",
            fileSize: 1024,
            fileType: "IMAGE",
          },
        ],
      },
    ]);
    prismaMock.incident.count.mockResolvedValueOnce(700);
    prismaMock.evidence.aggregate.mockResolvedValueOnce({
      _sum: { fileSize: 4096 },
      _count: { id: 4 },
    });

    const result = await previewOldEvidenceCleanup(30, 9999);

    expect(prismaMock.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: MAX_EVIDENCE_CLEANUP_BATCH_SIZE,
        orderBy: [{ resolvedAt: "asc" }, { id: "asc" }],
      }),
    );
    expect(result).toMatchObject({
      totalIncidents: 700,
      previewedIncidents: 1,
      totalFiles: 4,
      totalSizeBytes: 4096,
      batchSize: MAX_EVIDENCE_CLEANUP_BATCH_SIZE,
      hasMore: true,
    });
  });
});
