import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/oauth/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/oauth/providers")>();
  return {
    ...actual,
    listConfiguredProviders: () => [
      { provider: "GOOGLE", slug: "google", label: "Google" },
    ],
  };
});

import { GET } from "@/app/api/auth/oauth/providers/route";

function buildRequest(redirect?: string) {
  const url = new URL("http://localhost/api/auth/oauth/providers");

  if (redirect !== undefined) {
    url.searchParams.set("redirect", redirect);
  }

  return new NextRequest(url);
}

describe("GET /api/auth/oauth/providers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the configured providers", async () => {
    const body = await (await GET(buildRequest())).json();

    expect(body.providers).toEqual([{ slug: "google", label: "Google" }]);
  });

  it("says nothing about redirects when the caller did not ask", async () => {
    const body = await (await GET(buildRequest())).json();

    expect(body).not.toHaveProperty("redirectSupported");
  });

  it("confirms a deep link /start would honour", async () => {
    const body = await (await GET(buildRequest("baseyfare://oauth"))).json();

    expect(body.redirectSupported).toBe(true);
  });

  it("warns about a deep link /start would refuse", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const body = await (await GET(buildRequest("exp://192.168.1.5:8081/--/oauth"))).json();

    expect(body.redirectSupported).toBe(false);
  });
});
