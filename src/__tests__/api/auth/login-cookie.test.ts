import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SESSION_JWT_EXPIRES_IN,
  AUTH_SESSION_MAX_AGE_SECONDS,
} from "@/lib/authSession";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  rateLimitMock.getClientIdentifier.mockReturnValue("test-client");
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true });
});

describe("POST /api/auth/login", () => {
  it("issues an auth cookie and returns only user data for valid credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
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
    });
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
});
