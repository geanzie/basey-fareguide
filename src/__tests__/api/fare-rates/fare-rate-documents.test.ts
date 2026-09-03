import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  requireRequestUser: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return new Response(JSON.stringify({ message }), { status });
  }),
}));

const prismaMock = vi.hoisted(() => ({
  fareRateVersion: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const s3Mock = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn(),
  ensureS3Configured: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRequestUser: authMock.requireRequestUser,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/s3Client", () => ({
  ensureS3Configured: s3Mock.ensureS3Configured,
  getS3Bucket: () => "test-bucket",
  getS3Client: () => ({ send: s3Mock.send }),
  getSignedUrlTtl: () => 300,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: s3Mock.getSignedUrl,
}));

import { GET as GET_DOCUMENT } from "@/app/api/fare-rates/[versionId]/document/route";
import { GET as GET_DOCUMENTS } from "@/app/api/fare-rates/documents/route";

const RIDER = { id: "public-1", userType: "PUBLIC" };

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "fare-live",
    baseFare: "16.00",
    perKmRate: "3.50",
    effectiveAt: new Date("2026-04-01T00:00:00.000Z"),
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    createdBy: "admin-1",
    notes: "Fuel price adjustment.",
    canceledAt: null,
    canceledBy: null,
    cancellationReason: null,
    documentKey: "fare-documents/fare-live_abc.pdf",
    documentTitle: "Resolution approving the adjusted fare rates",
    documentReference: "SB Resolution No. 42, Series of 2026",
    documentMimeType: "application/pdf",
    documentFileName: "resolution-42.pdf",
    documentSize: 240000,
    documentUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
    documentUploadedBy: "admin-1",
    createdByUser: null,
    canceledByUser: null,
    documentUploadedByUser: { firstName: "Admin", lastName: "User", username: "admin" },
    ...overrides,
  };
}

function makeRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/fare-rates/documents", () => {
  beforeEach(() => {
    authMock.requireRequestUser.mockResolvedValue(RIDER);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller", async () => {
    authMock.requireRequestUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await GET_DOCUMENTS(
      makeRequest("http://localhost/api/fare-rates/documents") as never,
    );

    expect(response.status).toBe(401);
  });

  it("queries only uncanceled versions that carry a document, newest first", async () => {
    prismaMock.fareRateVersion.findMany.mockResolvedValue([]);

    await GET_DOCUMENTS(makeRequest("http://localhost/api/fare-rates/documents") as never);

    const args = prismaMock.fareRateVersion.findMany.mock.calls[0][0];
    // A replaced or called-off schedule is not an official update.
    expect(args.where).toEqual({ canceledAt: null, documentKey: { not: null } });
    expect(args.orderBy).toEqual([{ effectiveAt: "desc" }, { createdAt: "desc" }]);
  });

  it("serializes the document and marks the live version as in force", async () => {
    prismaMock.fareRateVersion.findMany.mockResolvedValue([makeVersion()]);

    const response = await GET_DOCUMENTS(
      makeRequest("http://localhost/api/fare-rates/documents") as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    // Authenticated response — never a shared cache.
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(payload.documents).toHaveLength(1);
    expect(payload.documents[0]).toMatchObject({
      versionId: "fare-live",
      baseFare: 16,
      perKmRate: 3.5,
      baseDistanceKm: 3,
      isActive: true,
      isUpcoming: false,
    });
    expect(payload.documents[0].document).toMatchObject({
      title: "Resolution approving the adjusted fare rates",
      reference: "SB Resolution No. 42, Series of 2026",
      fileName: "resolution-42.pdf",
      mimeType: "application/pdf",
      sizeBytes: 240000,
      uploadedByName: "Admin User (@admin)",
      downloadUrl: "/api/fare-rates/fare-live/document",
    });
  });

  it("keeps an upcoming change, so a scheduled rate ships with its paper", async () => {
    prismaMock.fareRateVersion.findMany.mockResolvedValue([
      makeVersion({
        id: "fare-next",
        effectiveAt: new Date("2099-01-01T00:00:00.000Z"),
      }),
    ]);

    const response = await GET_DOCUMENTS(
      makeRequest("http://localhost/api/fare-rates/documents") as never,
    );
    const payload = await response.json();

    expect(payload.documents[0]).toMatchObject({ isUpcoming: true, isActive: false });
  });

  it("drops a row whose document columns are missing rather than emitting a broken card", async () => {
    prismaMock.fareRateVersion.findMany.mockResolvedValue([makeVersion({ documentKey: null })]);

    const response = await GET_DOCUMENTS(
      makeRequest("http://localhost/api/fare-rates/documents") as never,
    );

    await expect(response.json()).resolves.toEqual({ documents: [] });
  });

  it("answers with an empty list when the table has not been migrated yet", async () => {
    prismaMock.fareRateVersion.findMany.mockRejectedValue(
      new Error("P2021 the table `fare_rate_versions` does not exist"),
    );

    const response = await GET_DOCUMENTS(
      makeRequest("http://localhost/api/fare-rates/documents") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ documents: [] });
  });
});

describe("GET /api/fare-rates/[versionId]/document", () => {
  const params = Promise.resolve({ versionId: "fare-live" });

  beforeEach(() => {
    authMock.requireRequestUser.mockResolvedValue(RIDER);
    s3Mock.getSignedUrl.mockResolvedValue("https://minio.example/fare-documents/x?X-Amz-Signature=a");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller", async () => {
    authMock.requireRequestUser.mockRejectedValue(new Error("Unauthorized"));

    const response = await GET_DOCUMENT(
      makeRequest("http://localhost/api/fare-rates/fare-live/document") as never,
      { params: Promise.resolve({ versionId: "fare-live" }) },
    );

    expect(response.status).toBe(401);
  });

  it("404s for an unknown version", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(null);

    const response = await GET_DOCUMENT(
      makeRequest("http://localhost/api/fare-rates/fare-live/document") as never,
      { params: Promise.resolve({ versionId: "fare-live" }) },
    );

    expect(response.status).toBe(404);
  });

  it("404s when the version carries no document", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue({
      documentKey: null,
      documentMimeType: null,
      documentFileName: null,
    });

    const response = await GET_DOCUMENT(
      makeRequest("http://localhost/api/fare-rates/fare-live/document") as never,
      { params: Promise.resolve({ versionId: "fare-live" }) },
    );

    expect(response.status).toBe(404);
  });

  it("redirects to a short-lived presigned URL by default", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue({
      documentKey: "fare-documents/fare-live_abc.pdf",
      documentMimeType: "application/pdf",
      documentFileName: "resolution-42.pdf",
    });

    const response = await GET_DOCUMENT(
      makeRequest("http://localhost/api/fare-rates/fare-live/document") as never,
      { params },
    );

    // Mobile depends on this: WebBrowser cannot send a bearer header, so the app
    // follows this redirect and opens the anonymous URL it lands on.
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("X-Amz-Signature");
    expect(s3Mock.send).not.toHaveBeenCalled();
  });

  it("streams the bytes same-origin for ?inline=1, so pdf.js needs no bucket CORS", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue({
      documentKey: "fare-documents/fare-live_abc.pdf",
      documentMimeType: "application/pdf",
      documentFileName: "resolution-42.pdf",
    });
    s3Mock.send.mockResolvedValue({
      Body: {
        transformToWebStream: () =>
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("%PDF-1.4"));
              controller.close();
            },
          }),
      },
    });

    const response = await GET_DOCUMENT(
      makeRequest("http://localhost/api/fare-rates/fare-live/document?inline=1") as never,
      { params },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("resolution-42.pdf");
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(s3Mock.getSignedUrl).not.toHaveBeenCalled();
    await expect(response.text()).resolves.toBe("%PDF-1.4");
  });
});
