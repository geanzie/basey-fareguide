import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Hoisted mocks — must be declared before any imports
// ============================================================

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET } from "@/app/api/health/route";

// ============================================================

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function configureStorage() {
  process.env.S3_ENDPOINT = "https://example.r2.cloudflarestorage.com";
  process.env.S3_ACCESS_KEY_ID = "key";
  process.env.S3_SECRET_ACCESS_KEY = "secret";
}

function unconfigureStorage() {
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
}

describe("GET /api/health — storage check", () => {
  it("reports storage ok when the credentials are present", async () => {
    configureStorage();

    const response = await GET();
    const body = await response.json();

    expect(body.checks.storage).toMatchObject({ status: "ok", configured: true });
  });

  it("reports storage error when the credentials are missing", async () => {
    unconfigureStorage();

    const response = await GET();
    const body = await response.json();

    expect(body.checks.storage).toMatchObject({ status: "error", configured: false });
  });

  it("degrades overall status when storage is unconfigured — uploads fail closed", async () => {
    unconfigureStorage();

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("degraded");
    // Still 200: fares, trips, and permits are unaffected by storage.
    expect(response.status).toBe(200);
  });

  it("keeps the database failure as the more severe signal", async () => {
    unconfigureStorage();
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe("error");
    expect(response.status).toBe(503);
  });

  it("does not leak the storage endpoint or credentials", async () => {
    configureStorage();

    const response = await GET();
    const raw = JSON.stringify(await response.json());

    expect(raw).not.toContain("r2.cloudflarestorage.com");
    expect(raw).not.toContain("secret");
  });
});
