import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  incident: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  fareCalculation: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  vehicle: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  permit: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    throw error;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    verifyAuth: authMock.verifyAuth,
    requireRequestUser: authMock.requireRequestUser,
    createAuthErrorResponse: authMock.createAuthErrorResponse,
  };
});

import { GET as getIncidents } from "@/app/api/incidents/route";
import { GET as getFareCalculations } from "@/app/api/fare-calculations/route";
import { GET as getUserProfile } from "@/app/api/user/profile/route";
import { GET as getVehicles } from "@/app/api/vehicles/route";
import { GET as getPermits } from "@/app/api/permits/route";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.verifyAuth.mockResolvedValue({
    id: "public-1",
    userType: "PUBLIC",
  });
  authMock.requireRequestUser.mockResolvedValue({
    id: "public-1",
    userType: "PUBLIC",
  });
});

describe("mounted page contract routes", () => {
  it("returns normalized incident DTO fields for history and dashboard consumers", async () => {
    prismaMock.incident.findMany.mockResolvedValueOnce([
      {
        id: "inc-1",
        incidentType: "FARE_OVERCHARGE",
        description: "Overcharge reported.",
        location: "Amandayehan",
        plateNumber: "ABC-1234",
        driverLicense: "DL-1",
        vehicleType: "TRICYCLE",
        incidentDate: new Date("2026-04-02T09:00:00.000Z"),
        status: "PENDING",
        ticketNumber: null,
        penaltyAmount: null,
        remarks: null,
        createdAt: new Date("2026-04-02T09:05:00.000Z"),
        updatedAt: new Date("2026-04-02T09:05:00.000Z"),
        reportedBy: {
          firstName: "Public",
          lastName: "User",
          userType: "PUBLIC",
        },
        handledBy: null,
        vehicle: null,
      },
    ]);
    prismaMock.incident.count.mockResolvedValueOnce(1);

    const res = await getIncidents(new NextRequest("http://localhost/api/incidents"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.incidents[0]).toMatchObject({
      type: "FARE_OVERCHARGE",
      typeLabel: "Fare Overcharge",
      date: "2026-04-02T09:00:00.000Z",
      statusLabel: "Pending",
    });
    expect(json.incidents[0].incidentType).toBeUndefined();
    expect(json.incidents[0].incidentDate).toBeUndefined();
  });

  it("returns normalized fare DTO fields for dashboard and history consumers", async () => {
    prismaMock.fareCalculation.findMany.mockResolvedValueOnce([
      {
        id: "calc-1",
        fromLocation: "Amandayehan",
        toLocation: "Anglit",
        distance: { toString: () => "12.5" },
        calculatedFare: { toString: () => "45" },
        actualFare: null,
        originalFare: { toString: () => "56.25" },
        discountApplied: { toString: () => "11.25" },
        discountType: "STUDENT",
        calculationType: "Road Route Planner",
        routeData: JSON.stringify({ method: "ors" }),
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
        vehicle: {
          plateNumber: "ABC-1234",
          vehicleType: "TRICYCLE",
        },
      },
    ]);
    prismaMock.fareCalculation.count.mockResolvedValueOnce(1);

    const res = await getFareCalculations(
      new NextRequest("http://localhost/api/fare-calculations")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.calculations[0]).toMatchObject({
      from: "Amandayehan",
      to: "Anglit",
      distanceKm: 12.5,
      fare: 45,
    });
    expect(json.calculations[0].fromLocation).toBeUndefined();
    expect(json.calculations[0].calculatedFare).toBeUndefined();
  });

  it("returns normalized profile DTO fields for session-aware consumers", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "public-1",
      username: "public-user",
      firstName: "Public",
      lastName: "User",
      email: null,
      phoneNumber: null,
      dateOfBirth: new Date("2000-05-15T00:00:00.000Z"),
      governmentId: null,
      idType: null,
      barangayResidence: null,
      userType: "PUBLIC",
      isActive: true,
      isVerified: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const res = await getUserProfile(new NextRequest("http://localhost/api/user/profile"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user).toMatchObject({
      username: "public-user",
      dateOfBirth: "2000-05-15",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns normalized vehicle and permit list DTOs for encoder consumers", async () => {
    prismaMock.vehicle.findMany.mockResolvedValueOnce([
      {
        id: "veh-1",
        plateNumber: "ABC-1234",
        vehicleType: "TRICYCLE",
        make: "Honda",
        model: "TMX",
        year: 2024,
        color: "Blue",
        capacity: 4,
        isActive: true,
        ownerName: "Owner Name",
        ownerContact: "09123456789",
        driverName: "Driver Name",
        driverLicense: "DL-1",
        registrationExpiry: new Date("2026-12-31T00:00:00.000Z"),
        insuranceExpiry: null,
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
        updatedAt: new Date("2026-04-02T01:00:00.000Z"),
        permit: null,
      },
    ]);
    prismaMock.vehicle.count.mockResolvedValueOnce(1);

    prismaMock.permit.findMany.mockResolvedValueOnce([
      {
        id: "permit-1",
        permitPlateNumber: "BP-1001",
        driverFullName: "Driver Name",
        vehicleType: "TRICYCLE",
        issuedDate: new Date("2026-01-01T00:00:00.000Z"),
        expiryDate: new Date("2027-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        remarks: null,
        encodedBy: "encoder-1",
        encodedAt: new Date("2026-01-01T00:00:00.000Z"),
        lastUpdatedBy: null,
        lastUpdatedAt: null,
        renewalHistory: [],
        vehicle: {
          id: "veh-1",
          plateNumber: "ABC-1234",
          make: "Honda",
          model: "TMX",
          ownerName: "Owner Name",
          vehicleType: "TRICYCLE",
        },
      },
    ]);
    prismaMock.permit.count.mockResolvedValueOnce(1);

    const vehiclesRes = await getVehicles(new NextRequest("http://localhost/api/vehicles"));
    const vehiclesJson = await vehiclesRes.json();
    const permitsRes = await getPermits(new NextRequest("http://localhost/api/permits"));
    const permitsJson = await permitsRes.json();

    expect(vehiclesRes.status).toBe(200);
    expect(vehiclesJson.vehicles[0].registrationExpiry).toBe("2026-12-31T00:00:00.000Z");
    expect(permitsRes.status).toBe(200);
    expect(permitsJson.permits[0].vehicle?.plateNumber).toBe("ABC-1234");
    expect(permitsJson.permits[0].issuedDate).toBe("2026-01-01T00:00:00.000Z");
  });
});
