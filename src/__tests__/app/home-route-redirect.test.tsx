import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn<(name: string) => { value: string } | undefined>(() => undefined),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  resolveAuthUserFromToken: vi.fn<(token: string | undefined) => Promise<{ userType: string } | null>>(
    async () => null,
  ),
  getResolvedFareRates: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  resolveAuthUserFromToken: mocks.resolveAuthUserFromToken,
}));

vi.mock("@/lib/fare/rateService", () => ({
  getResolvedFareRates: mocks.getResolvedFareRates,
}));

import HomePage from "@/app/page";

const LIVE_RATES = {
  current: {
    versionId: "v-live",
    baseDistanceKm: 3,
    baseFare: 17,
    perKmRate: 2.5,
    effectiveAt: "2026-06-01T00:00:00.000Z",
  },
  upcoming: null,
};

async function renderHome() {
  return renderToStaticMarkup(await HomePage());
}

describe("home route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthUserFromToken.mockResolvedValue(null);
  });

  it("shows signed-out visitors the landing page with the ordinance and the live rate", async () => {
    mocks.getResolvedFareRates.mockResolvedValue(LIVE_RATES);

    const html = await renderHome();

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(html).toContain("Municipal Ordinance No. 105, Series of 2023");
    expect(html).toContain("₱17");
    expect(html).toContain("₱2.50");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("Announcement");
    expect(html).not.toContain("Fees operators pay");
    expect(html).not.toContain("banig-mat.webp')] bg-[length");
  });

  it("sends signed-in users to their role home route", async () => {
    mocks.cookieGet.mockReturnValue({ value: "token" });
    mocks.resolveAuthUserFromToken.mockResolvedValue({ userType: "ENFORCER" });

    await expect(renderHome()).rejects.toThrow("NEXT_REDIRECT:/enforcer");
    expect(mocks.resolveAuthUserFromToken).toHaveBeenCalledWith("token");
    expect(mocks.getResolvedFareRates).not.toHaveBeenCalled();
  });

  it("shows no fare figure when the rate cannot be read", async () => {
    mocks.getResolvedFareRates.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const html = await renderHome();

    expect(html).toContain("could not be loaded");
    expect(html).not.toContain("for the first");
  });
});
