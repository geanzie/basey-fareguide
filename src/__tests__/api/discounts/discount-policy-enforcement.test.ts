import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  discountCard: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  fareCalculation: {
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
});

describe("discount policy enforcement", () => {
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
    prismaMock.fareCalculation.create.mockResolvedValueOnce({ id: "calc-1" });
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
});
