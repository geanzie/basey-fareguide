import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildNativeRedirect, resolveNativeRedirect } from "@/lib/oauth/state";

/** The allowlist deliberately narrows in production, so these flip NODE_ENV. */
function setNodeEnv(value: string) {
  vi.stubEnv("NODE_ENV", value);
}

beforeEach(() => {
  setNodeEnv("test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveNativeRedirect", () => {
  it("accepts the mobile app's own scheme", () => {
    expect(resolveNativeRedirect("baseyfare://oauth")).toBe("baseyfare://oauth");
  });

  it("returns null when no redirect was requested", () => {
    expect(resolveNativeRedirect(null)).toBeNull();
    expect(resolveNativeRedirect("")).toBeNull();
    expect(resolveNativeRedirect(undefined)).toBeNull();
  });

  it("rejects arbitrary hosts, which would make /start an open redirect", () => {
    expect(resolveNativeRedirect("https://evil.example/steal")).toBeNull();
    expect(resolveNativeRedirect("http://localhost:3000/login")).toBeNull();
  });

  it("rejects javascript: and other executable schemes", () => {
    expect(resolveNativeRedirect("javascript:alert(1)")).toBeNull();
    expect(resolveNativeRedirect("data:text/html,<script>")).toBeNull();
  });

  it("rejects a bare path, which is not a resolvable deep link", () => {
    expect(resolveNativeRedirect("/oauth")).toBeNull();
    expect(resolveNativeRedirect("oauth")).toBeNull();
  });

  it("rejects a scheme that merely starts with the allowed one", () => {
    expect(resolveNativeRedirect("baseyfare-evil://oauth")).toBeNull();
  });

  it("accepts Expo Go's schemes off production only", () => {
    expect(resolveNativeRedirect("exp://192.168.1.5:8081/--/oauth")).toBe(
      "exp://192.168.1.5:8081/--/oauth",
    );
    expect(resolveNativeRedirect("exp+basey-farecheck://oauth")).toBe(
      "exp+basey-farecheck://oauth",
    );

    setNodeEnv("production");

    // On the deployed server anyone with an Expo dev server could otherwise
    // collect handoff tickets.
    expect(resolveNativeRedirect("exp://192.168.1.5:8081/--/oauth")).toBeNull();
    expect(resolveNativeRedirect("exp+basey-farecheck://oauth")).toBeNull();
    expect(resolveNativeRedirect("baseyfare://oauth")).toBe("baseyfare://oauth");
  });
});

describe("buildNativeRedirect", () => {
  it("appends the parameter to a bare deep link", () => {
    expect(buildNativeRedirect("baseyfare://oauth", { ticket: "abc" })).toBe(
      "baseyfare://oauth?ticket=abc",
    );
  });

  it("preserves query parameters Expo Go already puts on the redirect", () => {
    const result = buildNativeRedirect("exp://192.168.1.5:8081/--/oauth?foo=1", {
      error: "oauth_denied",
    });

    expect(result).toBe("exp://192.168.1.5:8081/--/oauth?foo=1&error=oauth_denied");
  });
});
