import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SESSION_JWT_EXPIRES_IN,
  AUTH_SESSION_MAX_AGE_SECONDS,
} from "@/lib/authSession";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
}));

const jwtMock = vi.hoisted(() => ({
  sign: vi.fn(),
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    AUTH_LOGIN: {
      maxAttempts: 5,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("bcryptjs", () => ({
  default: { compare: bcryptMock.compare },
  compare: bcryptMock.compare,
}));

vi.mock("jsonwebtoken", () => ({
  default: { sign: jwtMock.sign },
  sign: jwtMock.sign,
}));

vi.mock("@/lib/rateLimit", () => rateLimitMock);

import { POST } from "@/app/api/auth/login/route";

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    username: "public-user",
    password: "hashed-password",
    userType: "PUBLIC",
    firstName: "Public",
    lastName: "User",
    dateOfBirth: null,
    phoneNumber: null,
    governmentId: null,
    idType: null,
    isActive: true,
    isVerified: true,
    loginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  rateLimitMock.getClientIdentifier.mockReturnValue("test-client");
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true });
  prismaMock.user.update.mockResolvedValue({});
});

describe("POST /api/auth/login", () => {
  it("issues an auth cookie and returns only user data for valid credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser());
    bcryptMock.compare.mockResolvedValueOnce(true);
    jwtMock.sign.mockReturnValueOnce("signed-session-token");

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "public-user", password: "secret" }),
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: "user-1",
      username: "public-user",
      userType: "PUBLIC",
    });
    expect(json).not.toHaveProperty("token");
    expect(res.headers.get("set-cookie")).toContain("auth-token=signed-session-token");
    expect(res.headers.get("set-cookie")).toContain(`Max-Age=${AUTH_SESSION_MAX_AGE_SECONDS}`);
    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        username: "public-user",
        userType: "PUBLIC",
      }),
      "test-secret",
      { expiresIn: AUTH_SESSION_JWT_EXPIRES_IN },
    );
  });

  it("authenticates driver accounts with exact stored casing", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(
      buildUser({
        id: "driver-1",
        username: "ABC-123",
        userType: "DRIVER",
        firstName: "Driver",
      })
    );
    bcryptMock.compare.mockResolvedValueOnce(true);
    jwtMock.sign.mockReturnValueOnce("driver-session-token");

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "ABC-123", password: "secret" }),
      }) as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: "driver-1",
      username: "ABC-123",
      userType: "DRIVER",
    });
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("authenticates driver accounts with different username casing", async () => {
    const driverUser = buildUser({
      id: "driver-1",
      username: "ABC-123",
      userType: "DRIVER",
      firstName: "Driver",
    });

    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findMany.mockResolvedValueOnce([driverUser]);
    bcryptMock.compare.mockResolvedValueOnce(true);
    jwtMock.sign.mockReturnValueOnce("driver-session-token");

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "abc-123", password: "secret" }),
      }) as never
    );

    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        username: {
          equals: "ABC-123",
          mode: "insensitive",
        },
      },
    });
    expect(bcryptMock.compare).toHaveBeenCalledWith("secret", "hashed-password");
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: "driver-1",
      username: "ABC-123",
      userType: "DRIVER",
    });
  });

  it("still requires correct driver password during case-insensitive fallback", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildUser({
        id: "driver-1",
        username: "ABC-123",
        userType: "DRIVER",
      }),
    ]);
    bcryptMock.compare.mockResolvedValueOnce(false);

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "abc-123", password: "wrong-secret" }),
      }) as never
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: "Invalid credentials" });
  });

  it("keeps non-driver usernames case-sensitive", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildUser({
        id: "public-1",
        username: "Public-User",
        userType: "PUBLIC",
      }),
    ]);

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "public-user", password: "secret" }),
      }) as never
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: "Invalid credentials" });
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });

  it("fails closed when case-insensitive username match is ambiguous", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findMany.mockResolvedValueOnce([
      buildUser({
        id: "driver-1",
        username: "ABC-123",
        userType: "DRIVER",
      }),
      buildUser({
        id: "public-1",
        username: "abc-123",
        userType: "PUBLIC",
      }),
    ]);

    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "AbC-123", password: "secret" }),
      }) as never
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: "Invalid credentials" });
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });
});
