// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn<() => {
    user:
      | {
          id: string;
          username: string;
          firstName: string;
          lastName: string;
          userType: string;
        }
      | null;
    status: string;
  }>(() => ({ user: null, status: "unauthenticated" })),
}));

const PUBLIC_USER = {
  id: "public-1",
  username: "rider",
  firstName: "Rider",
  lastName: "One",
  userType: "PUBLIC",
};

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: authMock.useAuth,
}));

import AboutPage from "@/app/profile/about/page";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("profile about page announcements", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    authMock.useAuth.mockReturnValue({ user: PUBLIC_USER, status: "authenticated" });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    routerMock.replace.mockReset();
    authMock.useAuth.mockReset();
    authMock.useAuth.mockReturnValue({ user: null, status: "unauthenticated" });
    vi.unstubAllGlobals();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  async function renderAboutPage() {
    await act(async () => {
      root.render(
        React.createElement(
          SWRConfig,
          {
            value: {
              provider: () => new Map(),
              dedupingInterval: 0,
              fetcher: (url: string) => fetch(url).then((response) => response.json()),
            },
          },
          React.createElement(AboutPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("shows traffic announcements above the fare announcement for signed-in users", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/announcements")) {
          return Promise.resolve(
            makeJsonResponse({
              announcements: [
                {
                  id: "announcement-1",
                  title: "Road closure",
                  body: "Main road is closed today.",
                  category: "ROAD_CLOSURE",
                  categoryLabel: "Road Closure",
                  startsAt: "2026-04-03T00:00:00.000Z",
                  endsAt: null,
                },
              ],
            }),
          );
        }

        if (url.includes("/api/fare-rates/documents")) {
          return Promise.resolve(makeJsonResponse({ documents: [] }));
        }

        if (url.includes("/api/fare-rates")) {
          return Promise.resolve(
            makeJsonResponse({
              current: {
                versionId: "fare-live",
                baseDistanceKm: 3,
                baseFare: 15,
                perKmRate: 3,
                effectiveAt: "2026-04-01T00:00:00.000Z",
              },
              upcoming: {
                versionId: "fare-next",
                baseDistanceKm: 3,
                baseFare: 17,
                perKmRate: 3,
                effectiveAt: "2026-04-13T00:00:00.000Z",
              },
            }),
          );
        }

        throw new Error(`Unhandled fetch url: ${url}`);
      }),
    );

    await renderAboutPage();

    expect(container.textContent).toContain("About Basey FareCheck");
    expect(container.textContent).toContain("Public Announcements");
    expect(container.textContent).toContain("Traffic Announcements");
    expect(container.textContent).toContain("Road closure");
    expect(container.textContent).toContain("Fare Announcement");
    expect(container.textContent).toContain("Official Documents");
    expect(container.textContent).toContain(
      "No fare rate updates have been issued since Municipal Ordinance No. 105.",
    );
    expect(container.querySelector(".bg-brand")).not.toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("keeps the ordinance card reachable for every authenticated role", async () => {
    authMock.useAuth.mockReturnValue({
      user: { ...PUBLIC_USER, userType: "ENFORCER" },
      status: "authenticated",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/announcements")) {
          return Promise.resolve(makeJsonResponse({ announcements: [] }));
        }

        if (url.includes("/api/fare-rates/documents")) {
          return Promise.resolve(makeJsonResponse({ documents: [] }));
        }

        if (url.includes("/api/fare-rates")) {
          return Promise.resolve(
            makeJsonResponse({
              current: {
                versionId: "fare-live",
                baseDistanceKm: 3,
                baseFare: 15,
                perKmRate: 3,
                effectiveAt: "2026-04-01T00:00:00.000Z",
              },
              upcoming: null,
            }),
          );
        }

        throw new Error(`Unhandled fetch url: ${url}`);
      }),
    );

    await renderAboutPage();

    expect(container.textContent).not.toContain("Access Denied");
    expect(container.textContent).toContain("Original Ordinance");
    expect(container.querySelector('a[href="/ordinance"]')).not.toBeNull();
  });

  it("lists the municipal issuance behind each documented fare change", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/announcements")) {
          return Promise.resolve(makeJsonResponse({ announcements: [] }));
        }

        if (url.includes("/api/fare-rates/documents")) {
          return Promise.resolve(
            makeJsonResponse({
              documents: [
                {
                  versionId: "fare-live",
                  effectiveAt: "2026-04-01T00:00:00.000Z",
                  baseFare: 16,
                  perKmRate: 3.5,
                  baseDistanceKm: 3,
                  notes: "Fuel price adjustment.",
                  isActive: true,
                  isUpcoming: false,
                  document: {
                    title: "Resolution approving the adjusted fare rates",
                    reference: "SB Resolution No. 42, Series of 2026",
                    fileName: "resolution-42.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 240000,
                    uploadedAt: "2026-04-01T00:00:00.000Z",
                    uploadedByName: "Admin User (@admin)",
                    downloadUrl: "/api/fare-rates/fare-live/document",
                  },
                },
              ],
            }),
          );
        }

        if (url.includes("/api/fare-rates")) {
          return Promise.resolve(
            makeJsonResponse({
              current: {
                versionId: "fare-live",
                baseDistanceKm: 3,
                baseFare: 16,
                perKmRate: 3.5,
                effectiveAt: "2026-04-01T00:00:00.000Z",
              },
              upcoming: null,
            }),
          );
        }

        throw new Error(`Unhandled fetch url: ${url}`);
      }),
    );

    await renderAboutPage();

    expect(container.textContent).toContain("Resolution approving the adjusted fare rates");
    expect(container.textContent).toContain("SB Resolution No. 42, Series of 2026");
    expect(container.textContent).toContain("Fuel price adjustment.");
    // A PDF gets the in-app reader; every document gets the raw link.
    expect(container.querySelector('a[href="/fare-documents/fare-live"]')).not.toBeNull();
    expect(
      container.querySelector('a[href="/api/fare-rates/fare-live/document"]'),
    ).not.toBeNull();
    // The original ordinance stays anchored below the newer issuances.
    expect(container.querySelector('a[href="/ordinance"]')).not.toBeNull();
  });

  it("sends signed-out visitors to the login page", async () => {
    authMock.useAuth.mockReturnValue({ user: null, status: "unauthenticated" });

    await renderAboutPage();

    expect(container.textContent).not.toContain("Public Announcements");
    expect(routerMock.replace).toHaveBeenCalledWith("/login");
  });
});
