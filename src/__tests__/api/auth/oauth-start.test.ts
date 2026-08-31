import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  logRateLimitHit: vi.fn(),
  RATE_LIMITS: { OAUTH_REDIRECT: { maxAttempts: 10 } },
}));

vi.mock("@/lib/rateLimit", () => rateLimitMock);

vi.mock("@/lib/oauth/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth/providers")>();
  return { ...actual, isProviderConfigured: () => true };
});

import { GET } from "@/app/api/auth/oauth/[provider]/start/route";
import { peekNativeRedirect } from "@/lib/oauth/state";

const params = Promise.resolve({ provider: "google" });

function buildRequest(redirect?: string) {
  const url = new URL("http://localhost/api/auth/oauth/google/start");

  if (redirect !== undefined) {
    url.searchParams.set("redirect", redirect);
  }

  return new NextRequest(url);
}

/**
 * Re-reads the state cookie the response set, the way the callback leg does,
 * so the assertion covers what actually survives the round trip.
 */
function nativeRedirectFromResponse(response: Response): string | null {
  const cookie = response.headers.get("set-cookie") ?? "";
  const value = /oauth-state=([^;]+)/.exec(cookie)?.[1] ?? "";

  const carrier = new NextRequest(new URL("http://localhost/callback"), {
    headers: { cookie: `oauth-state=${value}` },
  });

  return peekNativeRedirect(carrier);
}

describe("GET /api/auth/oauth/[provider]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    rateLimitMock.checkRateLimit.mockReturnValue({ success: true });
    rateLimitMock.getClientIdentifier.mockReturnValue("1.2.3.4");
  });

  it("refuses a redirect target it will not honour", async () => {
    const response = await GET(buildRequest("https://evil.example/steal"), { params });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "oauth_bad_redirect" });
  });

  it("refuses Expo Go's scheme on a production server", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(buildRequest("exp://192.168.1.5:8081/--/oauth"), { params });

    expect(response.status).toBe(400);
  });

  it("honours an Expo origin the operator opted into", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OAUTH_DEV_REDIRECT_ORIGINS", "exp://192.168.1.5:8081");

    const response = await GET(buildRequest("exp://192.168.1.5:8081/--/oauth"), { params });

    expect(response.status).toBe(307);
    expect(nativeRedirectFromResponse(response)).toBe("exp://192.168.1.5:8081/--/oauth");
  });

  it("redirects to the provider and remembers the app's deep link", async () => {
    const response = await GET(buildRequest("baseyfare://oauth"), { params });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(nativeRedirectFromResponse(response)).toBe("baseyfare://oauth");
  });

  it("starts the web flow when no redirect was asked for", async () => {
    const response = await GET(buildRequest(), { params });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(nativeRedirectFromResponse(response)).toBeNull();
  });

  it("sends a rate-limited native caller back on its deep link", async () => {
    rateLimitMock.checkRateLimit.mockReturnValue({ success: false, retryAfter: 60 });

    const response = await GET(buildRequest("baseyfare://oauth"), { params });

    expect(response.headers.get("location")).toBe("baseyfare://oauth?error=oauth_rate_limited");
  });
});
