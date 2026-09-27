import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import LegacyLoginPage from "@/app/login/page";

describe("/login", () => {
  it("sends visitors to /auth", async () => {
    await expect(LegacyLoginPage({})).rejects.toThrow("NEXT_REDIRECT:/auth");
  });

  it("keeps the query string so error and username survive", async () => {
    await expect(
      LegacyLoginPage({ searchParams: Promise.resolve({ error: "oauth_denied", username: "juan" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/auth?error=oauth_denied&username=juan");
  });
});
