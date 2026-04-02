import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  location: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    throw error;
  }),
}));

const validationMock = vi.hoisted(() => ({
  validateLocation: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    ADMIN_ONLY: ["ADMIN"],
    requireRequestRole: authMock.requireRequestRole,
    createAuthErrorResponse: authMock.createAuthErrorResponse,
  };
});

vi.mock("@/utils/locationValidation", async () => {
  const actual = await vi.importActual<typeof import("@/utils/locationValidation")>("@/utils/locationValidation");
  return {
    ...actual,
    validateLocation: validationMock.validateLocation,
  };
});

import { POST as createLocation } from "@/app/api/admin/locations/route";
import { POST as validateLocationRoute } from "@/app/api/admin/locations/validate/route";

const sampleValidation = {
  isValid: true,
  errors: [],
  warnings: [],
  withinMunicipality: true,
  withinBarangay: true,
  detectedBarangay: "Amandayehan",
  expectedBarangay: "Amandayehan",
  googleMapsValid: true,
  googlePlaceId: "place-1",
  googleAddress: "Amandayehan, Basey, Samar",
  googleConfidence: "high" as const,
  parsedCoordinates: { lat: 11.278823, lng: 125.001194 },
  recommendations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.requireRequestRole.mockResolvedValue({ id: "admin-1", userType: "ADMIN" });
});

describe("location validation persistence", () => {
  it("creates a validation audit row when an admin creates a location with validation data", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(null);
    prismaMock.location.create.mockResolvedValueOnce({ id: "loc-1", name: "Amandayehan" });

    const res = await createLocation(
      new NextRequest("http://localhost/api/admin/locations", {
        method: "POST",
        body: JSON.stringify({
          name: "Amandayehan",
          type: "BARANGAY",
          coordinates: "11.278823,125.001194",
          barangay: "Amandayehan",
          validationResult: sampleValidation,
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(prismaMock.location.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: "admin-1",
          validationLogs: {
            create: expect.objectContaining({
              validatedBy: "admin-1",
              validationType: "CREATION",
              isValid: true,
            }),
          },
        }),
      }),
    );
  });

  it("persists a validation log when validating an existing location", async () => {
    validationMock.validateLocation.mockResolvedValueOnce(sampleValidation);
    prismaMock.location.findUnique.mockResolvedValueOnce({ id: "loc-1" });
    prismaMock.location.update.mockResolvedValueOnce({ id: "loc-1" });

    const res = await validateLocationRoute(
      new NextRequest("http://localhost/api/admin/locations/validate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
        },
        body: JSON.stringify({
          locationId: "loc-1",
          name: "Amandayehan",
          type: "BARANGAY",
          coordinates: "11.278823,125.001194",
          barangay: "Amandayehan",
        }),
      }),
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.persisted).toBe(true);
    expect(prismaMock.location.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "loc-1" },
        data: expect.objectContaining({
          validationLogs: {
            create: expect.objectContaining({
              validatedBy: "admin-1",
              validationType: "VALIDATE",
            }),
          },
        }),
      }),
    );
  });
});
