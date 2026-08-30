import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { CURRENT_PRIVACY_NOTICE_VERSION } from "@/lib/privacyNotice";

const prismaMock = vi.hoisted(() => ({
  user: { update: vi.fn() },
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  peekRateLimit: vi.fn(),
  consumeRateLimit: vi.fn(),
  logRateLimitHit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: {
    OAUTH_COMPLETE_REJECT: {
      name: "oauth-complete-reject",
      windowMs: 3_600_000,
      maxAttempts: 20,
    },
  },
}));

const signupMock = vi.hoisted(() => ({
  createOAuthUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rateLimit", () => rateLimitMock);
vi.mock("@/lib/oauth/signup", () => ({ createOAuthUser: signupMock.createOAuthUser }));

import { POST } from "@/app/api/auth/oauth/complete/route";
import { applySignupTicketCookie } from "@/lib/oauth/state";

const VALID_BODY = {
  phoneNumber: "09171234567",
  dateOfBirth: "1998-05-04",
  barangayResidence: "Cogon",
  idType: "",
  governmentId: "",
  privacyNoticeAcknowledged: true,
  privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
};

function buildRequest(body: Record<string, unknown>, options: { ticket?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (options.ticket !== false) {
    const carrier = NextResponse.next();
    applySignupTicketCookie(carrier, {
      provider: "GOOGLE",
      providerAccountId: "google-sub-1",
      email: "resident@example.com",
      firstName: "Juan",
      lastName: "Dela Cruz",
    });
    headers.cookie = `oauth-signup=${carrier.cookies.get("oauth-signup")?.value ?? ""}`;
  }

  return new NextRequest("http://localhost/api/auth/oauth/complete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  rateLimitMock.getClientIdentifier.mockReturnValue("test-client");
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true });
  rateLimitMock.peekRateLimit.mockReturnValue({ success: true });
  prismaMock.user.update.mockResolvedValue({});
  signupMock.createOAuthUser.mockResolvedValue({
    id: "user-1",
    username: "resident",
    userType: "PUBLIC",
    firstName: "Juan",
    lastName: "Dela Cruz",
    isActive: true,
    isVerified: true,
  });
});

describe("POST /api/auth/oauth/complete", () => {
  it("rejects a request with no signup ticket", async () => {
    const res = await POST(buildRequest(VALID_BODY, { ticket: false }));

    expect(res.status).toBe(401);
    expect(signupMock.createOAuthUser).not.toHaveBeenCalled();
  });

  it("requires the privacy notice to be acknowledged", async () => {
    const res = await POST(
      buildRequest({ ...VALID_BODY, privacyNoticeAcknowledged: false }),
    );

    expect(res.status).toBe(400);
    expect(signupMock.createOAuthUser).not.toHaveBeenCalled();
  });

  it("rejects a stale privacy notice version", async () => {
    const res = await POST(
      buildRequest({ ...VALID_BODY, privacyNoticeVersion: "1999-01-01" }),
    );

    expect(res.status).toBe(400);
    expect(signupMock.createOAuthUser).not.toHaveBeenCalled();
  });

  it("rejects a phone number that is not a Philippine mobile", async () => {
    const res = await POST(buildRequest({ ...VALID_BODY, phoneNumber: "12345" }));

    expect(res.status).toBe(400);
    expect(signupMock.createOAuthUser).not.toHaveBeenCalled();
  });

  it("creates the account and returns both a token and a session cookie", async () => {
    const res = await POST(buildRequest(VALID_BODY));

    expect(res.status).toBe(201);
    expect(signupMock.createOAuthUser).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "GOOGLE",
        providerAccountId: "google-sub-1",
        email: "resident@example.com",
        firstName: "Juan",
        phoneNumber: "09171234567",
        barangayResidence: "Cogon",
        idType: null,
      }),
    );

    const json = await res.json();
    expect(json.user).toMatchObject({ id: "user-1", userType: "PUBLIC" });
    // Same dual shape as /api/auth/login so a native client can reuse this endpoint.
    expect(typeof json.token).toBe("string");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("auth-token=");
    // The single-use signup ticket is spent.
    expect(setCookie).toContain("oauth-signup=;");
  });
});
