import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  discountCard: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
  },
  fareCalculation: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  discountUsageLog: {
    create: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  requireRequestRole: vi.fn(),
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
    PUBLIC_ONLY: ["PUBLIC"],
    verifyAuth: authMock.verifyAuth,
    requireRequestRole: authMock.requireRequestRole,
    createAuthErrorResponse: authMock.createAuthErrorResponse,
  };
});

import { GET as getMyDiscountCard } from "@/app/api/discount-cards/me/route";
import { POST as saveFareCalculation } from "@/app/api/fare-calculations/route";

function makeFareSaveRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/fare-calculations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fromLocation: "Amandayehan",
      toLocation: "Anglit",
      distance: 10,
      calculatedFare: 24,
      calculationType: "Route Planner",
      discountCardId: "card-1",
      originalFare: 30,
      discountApplied: 6,
      discountType: "STUDENT",
      ...overrides,
    }),
  });
}

const validCard = {
  id: "card-1",
  userId: "public-1",
  discountType: "STUDENT",
  verificationStatus: "APPROVED",
  isActive: true,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2026-12-31T23:59:59.000Z"),
};

function makeStoredFareCalculation(overrides: Record<string, unknown> = {}) {
  return {
    id: "calc-1",
    fromLocation: "Amandayehan",
    toLocation: "Anglit",
    distance: 10,
    calculatedFare: 24,
    actualFare: null,
    originalFare: null,
    discountApplied: null,
    discountType: null,
    calculationType: "Route Planner",
    createdAt: new Date("2026-04-09T00:00:00.000Z"),
    routeData: null,
    vehicle: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.verifyAuth.mockResolvedValue({
    id: "public-1",
    userType: "PUBLIC",
  });
  authMock.requireRequestRole.mockResolvedValue({
    id: "public-1",
    userType: "PUBLIC",
  });
  prismaMock.fareCalculation.findFirst.mockResolvedValue(null);
  prismaMock.vehicle.findUnique.mockReset();
});

describe("discount policy enforcement", () => {
  it("rejects unauthenticated fare persistence requests before creating anonymous rows", async () => {
    authMock.verifyAuth.mockResolvedValueOnce(null);

    const res = await saveFareCalculation(
      makeFareSaveRequest({
        discountCardId: null,
        originalFare: null,
        discountApplied: null,
        discountType: null,
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/authentication required/i);
    expect(prismaMock.fareCalculation.create).not.toHaveBeenCalled();
  });

  it("uses the shared policy in the preview route for invalid cards", async () => {
    prismaMock.discountCard.findUnique.mockResolvedValueOnce({
      ...validCard,
      verificationStatus: "PENDING",
      isActive: false,
      user: {
        id: "public-1",
        firstName: "Public",
        lastName: "User",
        username: "public-1",
      },
    });

    const res = await getMyDiscountCard(new NextRequest("http://localhost/api/discount-cards/me"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isValid).toBe(false);
    expect(json.validationChecks.isActive).toBe(false);
    expect(json.validationChecks.isApproved).toBe(false);
  });

  it("rejects fare persistence when the discount card belongs to another user", async () => {
    prismaMock.discountCard.findUnique.mockResolvedValueOnce({
      ...validCard,
      userId: "other-user",
    });

    const res = await saveFareCalculation(makeFareSaveRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.validationChecks.isOwner).toBe(false);
  });

  it("rejects fare persistence when the discount card is expired", async () => {
    prismaMock.discountCard.findUnique.mockResolvedValueOnce({
      ...validCard,
      validUntil: new Date("2026-03-01T00:00:00.000Z"),
    });

    const res = await saveFareCalculation(makeFareSaveRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.validationChecks.isExpired).toBe(true);
  });

  it("persists and logs fare usage only when the discount card passes the canonical policy", async () => {
    prismaMock.discountCard.findUnique.mockResolvedValueOnce(validCard);
    prismaMock.fareCalculation.create.mockResolvedValueOnce(
      makeStoredFareCalculation({
        originalFare: 30,
        discountApplied: 6,
        discountType: "STUDENT",
      }),
    );
    prismaMock.discountUsageLog.create.mockResolvedValueOnce({ id: "log-1" });
    prismaMock.discountCard.update.mockResolvedValueOnce({ id: "card-1" });

    const res = await saveFareCalculation(makeFareSaveRequest());

    expect(res.status).toBe(201);
    expect(prismaMock.fareCalculation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountCardId: "card-1",
          discountType: "STUDENT",
        }),
      }),
    );
    expect(prismaMock.discountUsageLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.discountCard.update).toHaveBeenCalledTimes(1);
  });

  it("returns the existing fare record for a recent duplicate save request", async () => {
    prismaMock.fareCalculation.findFirst.mockResolvedValueOnce(makeStoredFareCalculation());

    const res = await saveFareCalculation(
      makeFareSaveRequest({
        discountCardId: null,
        originalFare: null,
        discountApplied: null,
        discountType: null,
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.message).toMatch(/already saved/i);
    expect(prismaMock.fareCalculation.create).not.toHaveBeenCalled();
    expect(prismaMock.discountUsageLog.create).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated vehicle attachment requests", async () => {
    authMock.verifyAuth.mockResolvedValueOnce(null);

    const res = await saveFareCalculation(
      makeFareSaveRequest({
        discountCardId: null,
        originalFare: null,
        discountApplied: null,
        discountType: null,
        vehicleId: "vehicle-1",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/authentication required/i);
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
  });

  it("rejects inactive vehicles before creating the fare record", async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({
      id: "vehicle-1",
      isActive: false,
    });

    const res = await saveFareCalculation(
      makeFareSaveRequest({
        discountCardId: null,
        originalFare: null,
        discountApplied: null,
        discountType: null,
        vehicleId: "vehicle-1",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/inactive/i);
    expect(prismaMock.fareCalculation.create).not.toHaveBeenCalled();
  });

  it("persists an optional active vehicle without changing fare computation", async () => {
    prismaMock.vehicle.findUnique.mockResolvedValueOnce({
      id: "vehicle-1",
      isActive: true,
    });
    prismaMock.fareCalculation.create.mockResolvedValueOnce(
      makeStoredFareCalculation({
        id: "calc-2",
        vehicle: {
          id: "vehicle-1",
          plateNumber: "ABC-1234",
          vehicleType: "JEEPNEY",
        },
      }),
    );

    const res = await saveFareCalculation(
      makeFareSaveRequest({
        discountCardId: null,
        originalFare: null,
        discountApplied: null,
        discountType: null,
        vehicleId: "vehicle-1",
      }),
    );

    expect(res.status).toBe(201);
    expect(prismaMock.fareCalculation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vehicleId: "vehicle-1",
          calculatedFare: 24,
        }),
      }),
    );
    expect(prismaMock.discountUsageLog.create).not.toHaveBeenCalled();
  });
});
