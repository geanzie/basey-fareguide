import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetObjectCommand } from "@aws-sdk/client-s3";

// ============================================================
// Hoisted mocks — must be declared before any imports
// ============================================================

const prismaMock = vi.hoisted(() => ({
  evidence: {
    findUnique: vi.fn(),
  },
}));

const s3SendMock = vi.hoisted(() => vi.fn());
const getSignedUrlMock = vi.hoisted(() => vi.fn());

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ message }), { status });
  }),
}));

const evidenceAuthMock = vi.hoisted(() => ({
  canReadIncidentEvidence: vi.fn(),
  INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE:
    "You can only view evidence for incidents you reported, or if you are an enforcer or admin.",
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-s3")>(
    "@aws-sdk/client-s3",
  );
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({ send: s3SendMock })),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

vi.mock("@/lib/s3Client", () => ({
  getS3Client: () => ({ send: s3SendMock }),
  getS3Bucket: () => "incident-evidence",
  getSignedUrlTtl: () => 300,
  ensureS3Configured: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMock);
vi.mock("@/lib/incidents/evidenceAuthorization", () => evidenceAuthMock);

import { GET } from "@/app/api/evidence/[evidenceId]/download/route";

// ============================================================
// Test helpers
// ============================================================

function makeRequest(evidenceId: string): Request {
  return new Request(
    `http://localhost/api/evidence/${evidenceId}/download`,
  ) as never;
}

const ADMIN_USER = { id: "user-admin", userType: "ADMIN" };
const REPORTER_USER = { id: "user-reporter", userType: "PASSENGER" };

const BASE_EVIDENCE = {
  id: "ev-1",
  fileUrl: "evidence/evidence_inc1_1234_abc.jpg",
  storageStatus: "AVAILABLE",
  incident: { reportedById: "user-reporter", handledById: null },
};

// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  getSignedUrlMock.mockResolvedValue(
    "https://minio.example.com/incident-evidence/evidence_inc1_1234_abc.jpg?X-Amz-Signature=fake",
  );
});

describe("GET /api/evidence/[evidenceId]/download", () => {
  it("redirects authorized user to presigned URL (302)", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce(BASE_EVIDENCE);
    evidenceAuthMock.canReadIncidentEvidence.mockReturnValueOnce(true);

    const response = await GET(makeRequest("ev-1") as never, {
      params: Promise.resolve({ evidenceId: "ev-1" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("X-Amz-Signature");
  });

  it("passes correct GetObjectCommand with right bucket and key", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce(BASE_EVIDENCE);
    evidenceAuthMock.canReadIncidentEvidence.mockReturnValueOnce(true);

    await GET(makeRequest("ev-1") as never, {
      params: Promise.resolve({ evidenceId: "ev-1" }),
    });

    const [, command, options] = getSignedUrlMock.mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "incident-evidence",
      Key: "evidence/evidence_inc1_1234_abc.jpg",
    });
    expect(options.expiresIn).toBe(300);
  });

  it("returns 403 when user is not authorized to view the incident", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(REPORTER_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce({
      ...BASE_EVIDENCE,
      incident: { reportedById: "someone-else", handledById: null },
    });
    evidenceAuthMock.canReadIncidentEvidence.mockReturnValueOnce(false);

    const response = await GET(makeRequest("ev-1") as never, {
      params: Promise.resolve({ evidenceId: "ev-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe(
      evidenceAuthMock.INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE,
    );
  });

  it("returns 404 when evidence record does not exist", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce(null);

    const response = await GET(makeRequest("no-such-id") as never, {
      params: Promise.resolve({ evidenceId: "no-such-id" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe("Evidence not found");
  });

  it("returns 410 Gone when evidence file has been deleted from storage", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce({
      ...BASE_EVIDENCE,
      storageStatus: "DELETED",
    });
    evidenceAuthMock.canReadIncidentEvidence.mockReturnValueOnce(true);

    const response = await GET(makeRequest("ev-1") as never, {
      params: Promise.resolve({ evidenceId: "ev-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.message).toContain("removed from storage");
  });

  it("uses TTL from getSignedUrlTtl (300s)", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce(BASE_EVIDENCE);
    evidenceAuthMock.canReadIncidentEvidence.mockReturnValueOnce(true);

    await GET(makeRequest("ev-1") as never, {
      params: Promise.resolve({ evidenceId: "ev-1" }),
    });

    const [, , options] = getSignedUrlMock.mock.calls[0];
    expect(options.expiresIn).toBe(300);
  });

  it("does not call getSignedUrl for unauthorized requests", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(REPORTER_USER);
    prismaMock.evidence.findUnique.mockResolvedValueOnce({
      ...BASE_EVIDENCE,
      incident: { reportedById: "someone-else", handledById: null },
    });
    evidenceAuthMock.canReadIncidentEvidence.mockReturnValueOnce(false);

    await GET(makeRequest("ev-1") as never, {
      params: Promise.resolve({ evidenceId: "ev-1" }),
    });

    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });
});
