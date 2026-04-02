import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  incident: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    throw error;
  }),
}));

const evidenceStorageMock = vi.hoisted(() => ({
  extractEvidenceFiles: vi.fn(),
  uploadEvidenceFiles: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireRequestUser: authMock.requireRequestUser,
    createAuthErrorResponse: authMock.createAuthErrorResponse,
  };
});

vi.mock("@/lib/evidenceStorage", () => ({
  extractEvidenceFiles: evidenceStorageMock.extractEvidenceFiles,
  uploadEvidenceFiles: evidenceStorageMock.uploadEvidenceFiles,
}));

import { POST as reportIncident } from "@/app/api/incidents/report/route";
import { POST as uploadIncidentEvidence } from "@/app/api/incidents/[incidentId]/evidence/route";

function makeIncidentReportRequest(file?: File) {
  const formData = new FormData();
  formData.set("incidentType", "FARE_OVERCHARGE");
  formData.set("description", "Driver charged more than the approved fare.");
  formData.set("location", "Amandayehan");
  formData.set("incidentDate", "2026-04-02");
  formData.set("incidentTime", "09:00");
  formData.set("vehicleId", "veh-1");
  formData.set("plateNumber", "ABC123");

  if (file) {
    formData.append("evidence_0", file);
  }

  return new NextRequest("http://localhost/api/incidents/report", {
    method: "POST",
    body: formData,
  });
}

function makeEvidenceUploadRequest(file?: File) {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }

  return new NextRequest("http://localhost/api/incidents/inc-1/evidence", {
    method: "POST",
    body: formData,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireRequestUser.mockResolvedValue({
    id: "public-1",
    userType: "PUBLIC",
  });
});

describe("incident evidence pipeline", () => {
  it("uses the canonical shared evidence upload pipeline during public incident reporting", async () => {
    const file = new File(["image-bytes"], "photo.jpg", { type: "image/jpeg" });
    evidenceStorageMock.extractEvidenceFiles.mockReturnValueOnce([file]);
    prismaMock.incident.create.mockResolvedValueOnce({
      id: "inc-1",
      location: "Amandayehan",
      reportedBy: {
        firstName: "Public",
        lastName: "Reporter",
        username: "public-1",
      },
    });
    evidenceStorageMock.uploadEvidenceFiles.mockResolvedValueOnce([
      { id: "ev-1", fileName: "photo.jpg" },
    ]);

    const res = await reportIncident(makeIncidentReportRequest(file));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.incident.create.mock.calls[0][0].data.evidenceUrls).toBeUndefined();
    expect(prismaMock.incident.create.mock.calls[0][0].data.vehicleId).toBe("veh-1");
    expect(evidenceStorageMock.uploadEvidenceFiles).toHaveBeenCalledWith({
      incidentId: "inc-1",
      files: [file],
      uploadedBy: "public-1",
    });
    expect(json.referenceNumber).toBe("inc-1");
    expect(json.evidenceCount).toBe(1);
  });

  it("rolls back the new incident when evidence persistence fails", async () => {
    const file = new File(["bad"], "bad.exe", { type: "application/octet-stream" });
    evidenceStorageMock.extractEvidenceFiles.mockReturnValueOnce([file]);
    prismaMock.incident.create.mockResolvedValueOnce({
      id: "inc-rollback",
      location: "Amandayehan",
      reportedBy: {
        firstName: "Public",
        lastName: "Reporter",
        username: "public-1",
      },
    });
    evidenceStorageMock.uploadEvidenceFiles.mockRejectedValueOnce(
      new Error("Invalid file type. Only images, videos, PDFs, and audio files are allowed."),
    );

    const res = await reportIncident(makeIncidentReportRequest(file));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toMatch(/invalid file type/i);
    expect(prismaMock.incident.delete).toHaveBeenCalledWith({
      where: { id: "inc-rollback" },
    });
  });

  it("uses the same shared evidence upload pipeline for follow-up incident uploads", async () => {
    const file = new File(["clip"], "clip.mp4", { type: "video/mp4" });
    prismaMock.incident.findUnique.mockResolvedValueOnce({
      id: "inc-1",
      reportedById: "public-1",
      handledById: null,
    });
    evidenceStorageMock.extractEvidenceFiles.mockReturnValueOnce([file]);
    evidenceStorageMock.uploadEvidenceFiles.mockResolvedValueOnce([
      { id: "ev-2", fileName: "clip.mp4" },
    ]);

    const res = await uploadIncidentEvidence(
      makeEvidenceUploadRequest(file),
      { params: Promise.resolve({ incidentId: "inc-1" }) },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(evidenceStorageMock.uploadEvidenceFiles).toHaveBeenCalledWith({
      incidentId: "inc-1",
      files: [file],
      uploadedBy: "public-1",
    });
    expect(json.evidenceCount).toBe(1);
  });
});
