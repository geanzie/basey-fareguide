import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
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

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userVerificationLog: {
    create: vi.fn(),
  },
  vehicle: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  incident: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  evidence: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  ADMIN_OR_ENCODER: ["ADMIN", "DATA_ENCODER"],
  ENFORCER_ONLY: ["ENFORCER"],
  ADMIN_OR_ENFORCER: ["ADMIN", "ENFORCER"],
  requireRequestRole: authMocks.requireRequestRole,
  createAuthErrorResponse: authMocks.createAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { POST as verifyUser } from "@/app/api/admin/users/verify/route";
import { POST as createVehicle } from "@/app/api/vehicles/route";
import { PATCH as takeIncident } from "@/app/api/incidents/[incidentId]/take/route";
import { PATCH as reviewEvidence } from "@/app/api/evidence/[evidenceId]/review/route";

function makeJsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("privileged route authorization", () => {
  describe("admin-only routes", () => {
    it("rejects unauthenticated callers with 401", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

      const res = await verifyUser(
        makeJsonRequest("http://localhost/api/admin/users/verify", { userId: "u1", action: "approve" }) as never
      );

      expect(res.status).toBe(401);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("rejects wrong-role callers with 403", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Forbidden"));

      const res = await verifyUser(
        makeJsonRequest("http://localhost/api/admin/users/verify", { userId: "u1", action: "approve" }) as never
      );

      expect(res.status).toBe(403);
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("allows admins through the success path", async () => {
      authMocks.requireRequestRole.mockResolvedValueOnce({ id: "admin-1" });
      prismaMock.user.findUnique.mockResolvedValueOnce({ id: "user-1", isVerified: false });
      prismaMock.user.update.mockResolvedValueOnce({ id: "user-1" });
      prismaMock.userVerificationLog.create.mockResolvedValueOnce({ id: "log-1" });

      const res = await verifyUser(
        makeJsonRequest("http://localhost/api/admin/users/verify", { userId: "user-1", action: "approve" }) as never
      );

      expect(res.status).toBe(200);
      expect(authMocks.requireRequestRole).toHaveBeenCalledWith(expect.any(Request), ["ADMIN"]);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ verifiedBy: "admin-1" }),
        })
      );
    });
  });

  describe("admin-or-encoder routes", () => {
    const vehiclePayload = {
      plateNumber: "ABC123",
      vehicleType: "JEEPNEY",
      make: "Toyota",
      model: "HiAce",
      year: "2020",
      color: "White",
      capacity: "18",
      ownerName: "Owner Name",
      ownerContact: "09123456789",
      registrationExpiry: "2026-12-31",
    };

    it("rejects unauthenticated callers with 401", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

      const res = await createVehicle(
        makeJsonRequest("http://localhost/api/vehicles", vehiclePayload) as never
      );

      expect(res.status).toBe(401);
      expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
    });

    it("rejects wrong-role callers with 403", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Forbidden"));

      const res = await createVehicle(
        makeJsonRequest("http://localhost/api/vehicles", vehiclePayload) as never
      );

      expect(res.status).toBe(403);
      expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
    });

    it("allows admins or encoders through the success path", async () => {
      authMocks.requireRequestRole.mockResolvedValueOnce({ id: "encoder-1" });
      prismaMock.vehicle.findUnique.mockResolvedValueOnce(null);
      prismaMock.vehicle.create.mockResolvedValueOnce({ id: "vehicle-1", plateNumber: "ABC123" });

      const res = await createVehicle(
        makeJsonRequest("http://localhost/api/vehicles", vehiclePayload) as never
      );

      expect(res.status).toBe(201);
      expect(authMocks.requireRequestRole).toHaveBeenCalledWith(
        expect.any(Request),
        ["ADMIN", "DATA_ENCODER"]
      );
      expect(prismaMock.vehicle.create).toHaveBeenCalled();
    });
  });

  describe("enforcer-only routes", () => {
    it("rejects unauthenticated callers with 401", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

      const res = await takeIncident(
        makeJsonRequest("http://localhost/api/incidents/incident-1/take", {}, "PATCH") as never,
        { params: Promise.resolve({ incidentId: "incident-1" }) }
      );

      expect(res.status).toBe(401);
      expect(prismaMock.incident.findUnique).not.toHaveBeenCalled();
    });

    it("rejects wrong-role callers with 403", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Forbidden"));

      const res = await takeIncident(
        makeJsonRequest("http://localhost/api/incidents/incident-1/take", {}, "PATCH") as never,
        { params: Promise.resolve({ incidentId: "incident-1" }) }
      );

      expect(res.status).toBe(403);
      expect(prismaMock.incident.findUnique).not.toHaveBeenCalled();
    });

    it("allows enforcers through the success path", async () => {
      authMocks.requireRequestRole.mockResolvedValueOnce({ id: "enforcer-1" });
      prismaMock.incident.findUnique.mockResolvedValueOnce({ id: "incident-1", status: "PENDING" });
      prismaMock.incident.update.mockResolvedValueOnce({ id: "incident-1", status: "INVESTIGATING" });

      const res = await takeIncident(
        makeJsonRequest("http://localhost/api/incidents/incident-1/take", {}, "PATCH") as never,
        { params: Promise.resolve({ incidentId: "incident-1" }) }
      );

      expect(res.status).toBe(200);
      expect(authMocks.requireRequestRole).toHaveBeenCalledWith(expect.any(Request), ["ENFORCER"]);
      expect(prismaMock.incident.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            handledById: "enforcer-1",
            status: "INVESTIGATING",
          }),
        })
      );
    });
  });

  describe("admin-or-enforcer routes", () => {
    it("rejects unauthenticated callers with 401", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Unauthorized"));

      const res = await reviewEvidence(
        makeJsonRequest("http://localhost/api/evidence/e1/review", { status: "VERIFIED", remarks: "ok" }, "PATCH") as never,
        { params: Promise.resolve({ evidenceId: "e1" }) }
      );

      expect(res.status).toBe(401);
      expect(prismaMock.evidence.findUnique).not.toHaveBeenCalled();
    });

    it("rejects wrong-role callers with 403", async () => {
      authMocks.requireRequestRole.mockRejectedValueOnce(new Error("Forbidden"));

      const res = await reviewEvidence(
        makeJsonRequest("http://localhost/api/evidence/e1/review", { status: "VERIFIED", remarks: "ok" }, "PATCH") as never,
        { params: Promise.resolve({ evidenceId: "e1" }) }
      );

      expect(res.status).toBe(403);
      expect(prismaMock.evidence.findUnique).not.toHaveBeenCalled();
    });

    it("allows the assigned enforcer through the success path", async () => {
      authMocks.requireRequestRole.mockResolvedValueOnce({ id: "enforcer-1", userType: "ENFORCER" });
      prismaMock.evidence.findUnique.mockResolvedValueOnce({
        id: "e1",
        incident: { id: "incident-1", handledById: "enforcer-1", reportedById: "public-1" },
        uploader: { firstName: "Test", lastName: "User", username: "test" },
      });
      prismaMock.evidence.update.mockResolvedValueOnce({ id: "e1", status: "VERIFIED" });

      const res = await reviewEvidence(
        makeJsonRequest("http://localhost/api/evidence/e1/review", { status: "VERIFIED", remarks: "ok" }, "PATCH") as never,
        { params: Promise.resolve({ evidenceId: "e1" }) }
      );

      expect(res.status).toBe(200);
      expect(authMocks.requireRequestRole).toHaveBeenCalledWith(
        expect.any(Request),
        ["ADMIN", "ENFORCER"]
      );
      expect(prismaMock.evidence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewedBy: "enforcer-1",
            status: "VERIFIED",
          }),
        })
      );
    });
  });
});
