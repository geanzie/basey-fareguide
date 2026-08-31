import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userOAuthAccount: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  RATE_LIMITS: { AUTH_LOGIN: { maxAttempts: 5 } },
}));

const providersMock = vi.hoisted(() => ({
  exchangeCodeForProfile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/rateLimit", () => rateLimitMock);

vi.mock("@/lib/oauth/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth/providers")>();
  return {
    ...actual,
    isProviderConfigured: () => true,
    exchangeCodeForProfile: providersMock.exchangeCodeForProfile,
  };
});

import { GET } from "@/app/api/auth/oauth/[provider]/callback/route";
import {
  applyOAuthStateCookie,
  createOAuthState,
  parseSignupTicket,
  readHandoffTicket,
} from "@/lib/oauth/state";

const params = Promise.resolve({ provider: "google" });

/** Builds a callback request carrying a valid state cookie for the given code. */
function buildRequest(
  overrides: {
    state?: string;
    code?: string | null;
    error?: string;
    /** Set to run the request as if the mobile app had started the sign-in. */
    nativeRedirectUri?: string;
  } = {},
) {
  const { payload } = createOAuthState(
    "GOOGLE",
    "http://localhost/api/auth/oauth/google/callback",
    overrides.nativeRedirectUri,
  );

  // Round-trip the cookie through a response so it is signed exactly as in production.
  const carrier = NextResponse.next();
  applyOAuthStateCookie(carrier, payload);
  const cookieValue = carrier.cookies.get("oauth-state")?.value ?? "";

  const url = new URL("http://localhost/api/auth/oauth/google/callback");
  url.searchParams.set("state", overrides.state ?? payload.state);

  if (overrides.code !== null) {
    url.searchParams.set("code", overrides.code ?? "auth-code");
  }

  if (overrides.error) {
    url.searchParams.set("error", overrides.error);
  }

  const request = new NextRequest(url, {
    headers: { cookie: `oauth-state=${cookieValue}` },
  });

  return request;
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

const verifiedProfile = {
  providerAccountId: "google-sub-1",
  email: "resident@example.com",
  emailVerified: true,
  firstName: "Juan",
  lastName: "Dela Cruz",
};

function locationOf(response: Response): string {
  return response.headers.get("location") ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "test-secret";
  rateLimitMock.getClientIdentifier.mockReturnValue("test-client");
  rateLimitMock.checkRateLimit.mockReturnValue({ success: true });
  prismaMock.user.update.mockResolvedValue({});
  providersMock.exchangeCodeForProfile.mockResolvedValue(verifiedProfile);
});

describe("GET /api/auth/oauth/[provider]/callback", () => {
  it("rejects a state that does not match the cookie", async () => {
    const res = await GET(buildRequest({ state: "tampered-state" }), { params });

    expect(locationOf(res)).toContain("/login?error=oauth_state");
    expect(providersMock.exchangeCodeForProfile).not.toHaveBeenCalled();
  });

  it("reports a cancelled sign-in without exchanging the code", async () => {
    const res = await GET(buildRequest({ error: "access_denied" }), { params });

    expect(locationOf(res)).toContain("/login?error=oauth_denied");
    expect(providersMock.exchangeCodeForProfile).not.toHaveBeenCalled();
  });

  it("refuses to sign in a staff account matched by email", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser({ userType: "ADMIN" }));

    const res = await GET(buildRequest(), { params });

    expect(locationOf(res)).toContain("/login?error=oauth_staff_account");
    expect(res.headers.get("set-cookie") ?? "").not.toContain("auth-token=ey");
    expect(prismaMock.userOAuthAccount.create).not.toHaveBeenCalled();
  });

  it("will not link an existing account when the provider email is unverified", async () => {
    providersMock.exchangeCodeForProfile.mockResolvedValueOnce({
      ...verifiedProfile,
      emailVerified: false,
    });
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser());

    const res = await GET(buildRequest(), { params });

    expect(locationOf(res)).toContain("/login?error=oauth_unverified_email");
    expect(prismaMock.userOAuthAccount.create).not.toHaveBeenCalled();
  });

  it("links a verified email to the existing public account and starts a session", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser());
    prismaMock.userOAuthAccount.create.mockResolvedValueOnce({});

    const res = await GET(buildRequest(), { params });

    expect(prismaMock.userOAuthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          provider: "GOOGLE",
          providerAccountId: "google-sub-1",
        }),
      }),
    );
    expect(locationOf(res)).toContain("/dashboard");
    expect(res.headers.get("set-cookie") ?? "").toContain("auth-token=");
  });

  it("signs in an already-linked identity without touching the user lookup", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce({
      id: "link-1",
      user: buildUser(),
    });
    prismaMock.userOAuthAccount.update.mockResolvedValueOnce({});

    const res = await GET(buildRequest(), { params });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(locationOf(res)).toContain("/dashboard");
    expect(res.headers.get("set-cookie") ?? "").toContain("auth-token=");
  });

  it("hands an unknown email to the signup completion step", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await GET(buildRequest(), { params });

    expect(locationOf(res)).toContain("/register/social");

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("oauth-signup=");
    // The provider redirect is a cross-site navigation, so these cookies cannot be strict.
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).not.toContain("auth-token=ey");
  });

  it("stops when the provider shares no email address", async () => {
    providersMock.exchangeCodeForProfile.mockResolvedValueOnce({
      ...verifiedProfile,
      email: null,
    });

    const res = await GET(buildRequest(), { params });

    expect(locationOf(res)).toContain("/login?error=oauth_no_email");
  });
});

describe("GET /api/auth/oauth/[provider]/callback (native)", () => {
  const NATIVE = "baseyfare://oauth";

  function nativeRequest(overrides: Parameters<typeof buildRequest>[0] = {}) {
    return buildRequest({ ...overrides, nativeRedirectUri: NATIVE });
  }

  it("hands a linked identity a handoff ticket instead of a session cookie", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce({
      id: "link-1",
      user: buildUser(),
    });
    prismaMock.userOAuthAccount.update.mockResolvedValueOnce({});

    const res = await GET(nativeRequest(), { params });
    const location = locationOf(res);

    expect(location.startsWith(`${NATIVE}?ticket=`)).toBe(true);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("auth-token=ey");

    const ticket = new URL(location).searchParams.get("ticket") ?? "";
    expect(readHandoffTicket(ticket)).toMatchObject({ typ: "oauth_handoff", userId: "user-1" });

    // No session is issued at callback time, so a handoff the app never
    // completes leaves no login recorded against the account.
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("sends an unknown email the signup ticket in the deep link, not a cookie", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await GET(nativeRequest(), { params });
    const location = locationOf(res);

    expect(location.startsWith(`${NATIVE}?signup=`)).toBe(true);
    expect(res.headers.get("set-cookie") ?? "").not.toContain("oauth-signup=ey");

    const signup = new URL(location).searchParams.get("signup") ?? "";
    expect(parseSignupTicket(signup)).toMatchObject({
      typ: "oauth_signup",
      provider: "GOOGLE",
      providerAccountId: "google-sub-1",
      email: "resident@example.com",
    });
  });

  it("deep-links refusals back to the app rather than the web login page", async () => {
    prismaMock.userOAuthAccount.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(buildUser({ userType: "ADMIN" }));

    const res = await GET(nativeRequest(), { params });

    expect(locationOf(res)).toBe(`${NATIVE}?error=oauth_staff_account`);
  });

  it("deep-links a failed state check, which is read before the state is trusted", async () => {
    const res = await GET(nativeRequest({ state: "tampered-state" }), { params });

    expect(locationOf(res)).toBe(`${NATIVE}?error=oauth_state`);
    expect(providersMock.exchangeCodeForProfile).not.toHaveBeenCalled();
  });
});
