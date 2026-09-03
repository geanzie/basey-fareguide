import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetObjectCommand } from "@aws-sdk/client-s3";

// ============================================================
// Hoisted mocks — must be declared before any imports
// ============================================================

const prismaMock = vi.hoisted(() => ({
  discountCard: {
    findUnique: vi.fn(),
  },
}));

const s3SendMock = vi.hoisted(() => vi.fn());
const getSignedUrlMock = vi.hoisted(() => vi.fn());

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ message }), { status });
  }),
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

import { GET } from "@/app/api/discount-cards/[cardId]/photo/route";

// ============================================================
// Test helpers
// ============================================================

function makeRequest(cardId: string): Request {
  return new Request(`http://localhost/api/discount-cards/${cardId}/photo`) as never;
}

function call(cardId: string) {
  return GET(makeRequest(cardId) as never, {
    params: Promise.resolve({ cardId }),
  });
}

const ADMIN_USER = { id: "user-admin", userType: "ADMIN" };
const OWNER_USER = { id: "user-owner", userType: "PUBLIC" };
const OTHER_USER = { id: "user-other", userType: "PUBLIC" };

const BASE_CARD = {
  id: "card-1",
  userId: "user-owner",
  photoUrl: "discount-cards/user-owner_2f1c.jpg",
};

// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  getSignedUrlMock.mockResolvedValue(
    "https://minio.example.com/incident-evidence/discount-cards/user-owner_2f1c.jpg?X-Amz-Signature=fake",
  );
});

describe("GET /api/discount-cards/[cardId]/photo", () => {
  it("redirects an admin reviewer to a presigned URL (302)", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce(BASE_CARD);

    const response = await call("card-1");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("X-Amz-Signature");
  });

  it("redirects the applicant to their own photo", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(OWNER_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce(BASE_CARD);

    const response = await call("card-1");

    expect(response.status).toBe(302);
  });

  it("presigns the stored object key against the configured bucket", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce(BASE_CARD);

    await call("card-1");

    const [, command, options] = getSignedUrlMock.mock.calls[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "incident-evidence",
      Key: "discount-cards/user-owner_2f1c.jpg",
    });
    expect(options.expiresIn).toBe(300);
  });

  it("returns 403 for another public user — an ID photo is not readable by peers", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(OTHER_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce(BASE_CARD);

    const response = await call("card-1");

    expect(response.status).toBe(403);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the card does not exist", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce(null);

    const response = await call("missing");

    expect(response.status).toBe(404);
  });

  it("returns 404 when the application carries no photo", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce({
      ...BASE_CARD,
      photoUrl: null,
    });

    const response = await call("card-1");

    expect(response.status).toBe(404);
  });

  it("returns 410 for a legacy local upload path instead of presigning a missing key", async () => {
    authMock.requireRequestUser.mockResolvedValueOnce(ADMIN_USER);
    prismaMock.discountCard.findUnique.mockResolvedValueOnce({
      ...BASE_CARD,
      photoUrl: "/uploads/discount-cards/user-owner_old.jpg",
    });

    const response = await call("card-1");
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.code).toBe("PHOTO_UNAVAILABLE_LEGACY");
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it("propagates an unauthenticated request as 401", async () => {
    authMock.requireRequestUser.mockRejectedValueOnce(new Error("Unauthorized"));

    const response = await call("card-1");

    expect(response.status).toBe(401);
  });
});
