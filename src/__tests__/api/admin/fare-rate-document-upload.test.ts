import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  requireRequestRole: vi.fn(),
  createAuthErrorResponse: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return new Response(JSON.stringify({ message }), { status });
  }),
}));

const prismaMock = vi.hoisted(() => ({
  fareRateVersion: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const storageMock = vi.hoisted(() => ({
  storeFareDocument: vi.fn(),
  removeFareDocument: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  ADMIN_ONLY: ["ADMIN"],
  requireRequestRole: authMock.requireRequestRole,
  createAuthErrorResponse: authMock.createAuthErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/fareDocumentStorage", () => ({
  storeFareDocument: storageMock.storeFareDocument,
  removeFareDocument: storageMock.removeFareDocument,
}));

import {
  DELETE as DELETE_DOCUMENT,
  POST as POST_DOCUMENT,
} from "@/app/api/admin/fare-rates/[id]/document/route";

const ADMIN = { id: "admin-1", userType: "ADMIN" };

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
    documentKey: null,
    documentTitle: null,
    documentReference: null,
    documentMimeType: null,
    documentFileName: null,
    documentSize: null,
    documentUploadedAt: null,
    documentUploadedBy: null,
    createdByUser: null,
    canceledByUser: null,
    documentUploadedByUser: null,
    ...overrides,
  };
}

function makeUploadRequest(fields: {
  file?: File | null;
  title?: string;
  reference?: string;
}): Request {
  const body = new FormData();
  if (fields.file) {
    body.append("document", fields.file);
  }
  if (fields.title !== undefined) {
    body.append("title", fields.title);
  }
  if (fields.reference !== undefined) {
    body.append("reference", fields.reference);
  }

  return new Request("http://localhost/api/admin/fare-rates/fare-live/document", {
    method: "POST",
    body,
  });
}

function makePdf(name = "resolution.pdf"): File {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

const params = Promise.resolve({ id: "fare-live" });

describe("POST /api/admin/fare-rates/[id]/document", () => {
  beforeEach(() => {
    authMock.requireRequestRole.mockResolvedValue(ADMIN);
    storageMock.storeFareDocument.mockResolvedValue("fare-documents/fare-live_abc.pdf");
    storageMock.removeFareDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a caller who is not an admin", async () => {
    authMock.requireRequestRole.mockRejectedValue(new Error("Forbidden"));

    const response = await POST_DOCUMENT(
      makeUploadRequest({ file: makePdf(), title: "Resolution" }) as never,
      { params: Promise.resolve({ id: "fare-live" }) },
    );

    expect(response.status).toBe(403);
    expect(storageMock.storeFareDocument).not.toHaveBeenCalled();
  });

  it("404s for an unknown fare rate version", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(null);

    const response = await POST_DOCUMENT(
      makeUploadRequest({ file: makePdf(), title: "Resolution" }) as never,
      { params: Promise.resolve({ id: "fare-live" }) },
    );

    expect(response.status).toBe(404);
    expect(storageMock.storeFareDocument).not.toHaveBeenCalled();
  });

  it("400s when no file is attached", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(makeVersion());

    const response = await POST_DOCUMENT(makeUploadRequest({ title: "Resolution" }) as never, {
      params: Promise.resolve({ id: "fare-live" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("file is required"),
    });
  });

  it("400s when the title is blank", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(makeVersion());

    const response = await POST_DOCUMENT(
      makeUploadRequest({ file: makePdf(), title: "   " }) as never,
      { params: Promise.resolve({ id: "fare-live" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("title is required"),
    });
  });

  it("surfaces a rejected file type as a 400 with the validator's message", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(makeVersion());
    storageMock.storeFareDocument.mockRejectedValue(
      new Error("Supporting document must be a PDF, JPEG, PNG, or WebP file"),
    );

    const response = await POST_DOCUMENT(
      makeUploadRequest({
        file: new File(["x"], "notes.docx", { type: "application/msword" }),
        title: "Resolution",
      }) as never,
      { params: Promise.resolve({ id: "fare-live" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: "Supporting document must be a PDF, JPEG, PNG, or WebP file",
    });
    expect(prismaMock.fareRateVersion.update).not.toHaveBeenCalled();
  });

  it("stores every document column and returns the serialized version", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(makeVersion());
    prismaMock.fareRateVersion.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => makeVersion(data),
    );

    const response = await POST_DOCUMENT(
      makeUploadRequest({
        file: makePdf(),
        title: "Resolution approving the adjusted fare rates",
        reference: "SB Resolution No. 42, Series of 2026",
      }) as never,
      { params },
    );

    expect(response.status).toBe(200);

    const updateArgs = prismaMock.fareRateVersion.update.mock.calls[0][0];
    expect(updateArgs.data).toMatchObject({
      documentKey: "fare-documents/fare-live_abc.pdf",
      documentTitle: "Resolution approving the adjusted fare rates",
      documentReference: "SB Resolution No. 42, Series of 2026",
      documentMimeType: "application/pdf",
      documentFileName: "resolution.pdf",
      documentUploadedBy: "admin-1",
    });
    expect(updateArgs.data.documentUploadedAt).toBeInstanceOf(Date);

    const payload = await response.json();
    expect(payload.fareRateVersion.document).toMatchObject({
      title: "Resolution approving the adjusted fare rates",
      reference: "SB Resolution No. 42, Series of 2026",
      mimeType: "application/pdf",
      downloadUrl: "/api/fare-rates/fare-live/document",
    });
    // Nothing to clean up on a first attach.
    expect(storageMock.removeFareDocument).not.toHaveBeenCalled();
  });

  it("stores a blank reference as null rather than an empty string", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(makeVersion());
    prismaMock.fareRateVersion.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => makeVersion(data),
    );

    await POST_DOCUMENT(
      makeUploadRequest({ file: makePdf(), title: "Resolution", reference: "  " }) as never,
      { params },
    );

    expect(prismaMock.fareRateVersion.update.mock.calls[0][0].data.documentReference).toBeNull();
  });

  it("deletes the replaced object only after the row points at the new one", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(
      makeVersion({ documentKey: "fare-documents/old.pdf", documentTitle: "Old resolution" }),
    );
    prismaMock.fareRateVersion.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => makeVersion(data),
    );

    const response = await POST_DOCUMENT(
      makeUploadRequest({ file: makePdf(), title: "Replacement" }) as never,
      { params },
    );

    expect(response.status).toBe(200);
    expect(storageMock.removeFareDocument).toHaveBeenCalledWith("fare-documents/old.pdf");
    expect(prismaMock.fareRateVersion.update.mock.invocationCallOrder[0]).toBeLessThan(
      storageMock.removeFareDocument.mock.invocationCallOrder[0],
    );
  });

  it("still succeeds when deleting the replaced object fails", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(
      makeVersion({ documentKey: "fare-documents/old.pdf" }),
    );
    prismaMock.fareRateVersion.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => makeVersion(data),
    );
    storageMock.removeFareDocument.mockRejectedValue(new Error("S3 unreachable"));

    const response = await POST_DOCUMENT(
      makeUploadRequest({ file: makePdf(), title: "Replacement" }) as never,
      { params },
    );

    // An orphaned object is recoverable; a row pointing at nothing is not.
    expect(response.status).toBe(200);
  });
});

describe("DELETE /api/admin/fare-rates/[id]/document", () => {
  beforeEach(() => {
    authMock.requireRequestRole.mockResolvedValue(ADMIN);
    storageMock.removeFareDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeDeleteRequest(): Request {
    return new Request("http://localhost/api/admin/fare-rates/fare-live/document", {
      method: "DELETE",
    });
  }

  it("404s when the version carries no document", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(makeVersion());

    const response = await DELETE_DOCUMENT(makeDeleteRequest() as never, { params });

    expect(response.status).toBe(404);
    expect(prismaMock.fareRateVersion.update).not.toHaveBeenCalled();
  });

  it("clears every document column and removes the stored object", async () => {
    prismaMock.fareRateVersion.findUnique.mockResolvedValue(
      makeVersion({
        documentKey: "fare-documents/old.pdf",
        documentTitle: "Old resolution",
        documentReference: "SB Resolution No. 1",
        documentMimeType: "application/pdf",
        documentFileName: "old.pdf",
        documentSize: 1024,
        documentUploadedAt: new Date("2026-04-01T00:00:00.000Z"),
        documentUploadedBy: "admin-1",
      }),
    );
    prismaMock.fareRateVersion.update.mockResolvedValue(makeVersion());

    const response = await DELETE_DOCUMENT(makeDeleteRequest() as never, { params });

    expect(response.status).toBe(200);
    expect(prismaMock.fareRateVersion.update.mock.calls[0][0].data).toEqual({
      documentKey: null,
      documentTitle: null,
      documentReference: null,
      documentMimeType: null,
      documentFileName: null,
      documentSize: null,
      documentUploadedAt: null,
      documentUploadedBy: null,
    });
    expect(storageMock.removeFareDocument).toHaveBeenCalledWith("fare-documents/old.pdf");

    const payload = await response.json();
    expect(payload.fareRateVersion.document).toBeNull();
  });
});
