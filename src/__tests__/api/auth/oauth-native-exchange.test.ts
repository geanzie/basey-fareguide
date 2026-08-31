import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  logRateLimitHit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: { OAUTH_NATIVE_EXCHANGE: { name: "oauth-native-exchange", maxAttempts: 30 } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rateLimit", () => rateLimitMock);
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, invalidateAuthUserCache: vi.fn() };
});

import { POST } from "@/app/api/auth/oauth/native/exchange/route";
import { signHandoffTicket } from "@/lib/oauth/state";

function buildRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/oauth/native/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    username: "public-user",
    userType: "PUBLIC",
    firstName: "Public",
    lastName: "User",
    isActive: true,
    isVerified: true,
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

describe("POST /api/auth/oauth/native/exchange", () => {
  it("trades a valid ticket for a token in the body and sets no session cookie", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser());

    const res = await POST(buildRequest({ ticket: signHandoffTicket("user-1") }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toEqual(expect.any(String));
    // Same shape as /api/auth/login so the app can consume either.
    expect(body.user).toEqual({
      id: "user-1",
      username: "public-user",
      userType: "PUBLIC",
      firstName: "Public",
      lastName: "User",
      isActive: true,
      isVerified: true,
    });
    // The caller is not a browser; a Set-Cookie here would be dead weight.
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a malformed ticket", async () => {
    const res = await POST(buildRequest({ ticket: "not-a-jwt" }));

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("oauth_ticket_expired");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an expired ticket", async () => {
    const expired = jwt.sign({ typ: "oauth_handoff", userId: "user-1" }, "test-secret", {
      expiresIn: -1,
    });

    const res = await POST(buildRequest({ ticket: expired }));

    expect(res.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a signup ticket presented as a handoff ticket", async () => {
    // Both are signed with the same secret, so only the `typ` claim separates
    // them. Without that check a sign-up ticket would mint a session.
    const wrongType = jwt.sign({ typ: "oauth_signup", userId: "user-1" }, "test-secret", {
      expiresIn: 60,
    });

    const res = await POST(buildRequest({ ticket: wrongType }));

    expect(res.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses an account deactivated since the ticket was minted", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser({ isActive: false }));

    const res = await POST(buildRequest({ ticket: signHandoffTicket("user-1") }));

    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("oauth_inactive");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuses a ticket naming a user that no longer exists", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await POST(buildRequest({ ticket: signHandoffTicket("ghost") }));

    expect(res.status).toBe(401);
  });
});
