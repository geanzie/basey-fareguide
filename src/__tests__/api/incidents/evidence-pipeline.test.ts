import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  fareCalculation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
  },
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

const pinLabelResolverMock = vi.hoisted(() => ({
  resolvePinLabel: vi.fn(),
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

vi.mock("@/lib/locations/pinLabelResolver", () => ({
  resolvePinLabel: pinLabelResolverMock.resolvePinLabel,
}));

import { POST as reportIncident } from "@/app/api/incidents/report/route";
import { POST as uploadIncidentEvidence } from "@/app/api/incidents/[incidentId]/evidence/route";

function makeIncidentReportRequest(options: {
  file?: File;
  fareCalculationId?: string;
  location?: string;
  coordinates?: string;
  vehicleId?: string;
} = {}) {
  const formData = new FormData();
  formData.set("incidentType", "FARE_OVERCHARGE");
  formData.set("description", "Driver charged more than the approved fare.");
  formData.set("location", options.location ?? "Amandayehan");
  formData.set("incidentDate", "2026-04-02");
  formData.set("incidentTime", "09:00");
  formData.set("vehicleId", options.vehicleId ?? "veh-1");
  formData.set("plateNumber", "ABC123");

  if (options.fareCalculationId) {
    formData.set("fareCalculationId", options.fareCalculationId);
  }

  if (options.coordinates) {
    formData.set("coordinates", options.coordinates);
  }

  if (options.file) {
    formData.append("evidence_0", options.file);
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
  evidenceStorageMock.extractEvidenceFiles.mockReturnValue([]);
  evidenceStorageMock.uploadEvidenceFiles.mockResolvedValue([]);
  prismaMock.fareCalculation.findMany.mockResolvedValue([]);
  prismaMock.fareCalculation.findFirst.mockResolvedValue(null);
  prismaMock.vehicle.findUnique.mockResolvedValue({
    id: "veh-1",
    plateNumber: "ABC123",
    driverLicense: "DL-1",
    vehicleType: "TRICYCLE",
    isActive: true,
    permit: {
      status: "ACTIVE",
    },
  });
  pinLabelResolverMock.resolvePinLabel.mockReturnValue({
    displayLabel: "Amandayehan",
    barangayName: "Amandayehan",
    rawCoordinates: "11.278823, 125.001194",
    isFallback: false,
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

    const res = await reportIncident(makeIncidentReportRequest({ file }));
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

    const res = await reportIncident(makeIncidentReportRequest({ file }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toMatch(/invalid file type/i);
    expect(prismaMock.incident.delete).toHaveBeenCalledWith({
      where: { id: "inc-rollback" },
    });
  });

  it("derives the incident location from GPS coordinates when the location field is blank", async () => {
    prismaMock.incident.create.mockResolvedValueOnce({
      id: "inc-gps",
      location: "Amandayehan",
      reportedBy: {
        firstName: "Public",
        lastName: "Reporter",
        username: "public-1",
      },
    });

    const res = await reportIncident(
      makeIncidentReportRequest({
        location: "",
        coordinates: JSON.stringify({ latitude: 11.278823, longitude: 125.001194 }),
      }),
    );

    expect(res.status).toBe(200);
    expect(pinLabelResolverMock.resolvePinLabel).toHaveBeenCalledWith(11.278823, 125.001194);
    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          location: "Amandayehan",
          coordinates: JSON.stringify({ latitude: 11.278823, longitude: 125.001194 }),
        }),
      }),
    );
  });

  it("requires a selected trip when the public user has eligible recent trip history", async () => {
    prismaMock.fareCalculation.findMany.mockResolvedValueOnce([{ id: "calc-1" }]);

    const res = await reportIncident(makeIncidentReportRequest());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.message).toMatch(/select one of your 10 most recent trips/i);
    expect(prismaMock.incident.create).not.toHaveBeenCalled();
  });

  it("anchors the report to the selected trip and ignores manual location overrides", async () => {
    prismaMock.fareCalculation.findMany.mockResolvedValueOnce([{ id: "calc-1" }]);
    prismaMock.fareCalculation.findFirst.mockResolvedValueOnce({
      id: "calc-1",
      fromLocation: "Amandayehan",
      toLocation: "Anglit",
      calculatedFare: 45,
      discountType: "STUDENT",
      createdAt: new Date("2026-04-02T08:30:00.000Z"),
      calculationType: "Road Route Planner",
      vehicle: {
        id: "veh-trip",
        plateNumber: "ABC-1234",
        driverLicense: "DL-55",
        vehicleType: "TRICYCLE",
        permit: {
          permitPlateNumber: "PERMIT-001",
        },
      },
    });
    prismaMock.incident.create.mockResolvedValueOnce({
      id: "inc-trip",
      location: "Amandayehan to Anglit",
      reportedBy: {
        firstName: "Public",
        lastName: "Reporter",
        username: "public-1",
      },
    });

    const res = await reportIncident(
      makeIncidentReportRequest({
        fareCalculationId: "calc-1",
        location: "Manual override",
      }),
    );

    expect(res.status).toBe(200);
    expect(prismaMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fareCalculationId: "calc-1",
          location: "Amandayehan to Anglit",
          vehicleId: "veh-trip",
          tripPermitPlateNumber: "PERMIT-001",
          tripPlateNumber: "ABC-1234",
        }),
      }),
    );
    expect(pinLabelResolverMock.resolvePinLabel).not.toHaveBeenCalled();
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
