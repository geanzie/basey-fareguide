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

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: authMock.useAuth,
}));

import HomePage from "@/app/page";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public home page announcements", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  it("shows traffic announcements above the fare announcement for logged-out users", async () => {
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
          React.createElement(HomePage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Public Announcements");
    expect(container.textContent).toContain("Traffic Announcements");
    expect(container.textContent).toContain("Road closure");
    expect(container.textContent).toContain("Fare Announcement");
    expect(container.querySelector(".app-page-bg")).not.toBeNull();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to their role home route instead of rendering the landing page", async () => {
    authMock.useAuth.mockReturnValue({
      user: {
        id: "admin-1",
        username: "admin",
        firstName: "Admin",
        lastName: "User",
        userType: "ADMIN",
      },
      status: "authenticated",
    });

    await act(async () => {
      root.render(
        React.createElement(
          SWRConfig,
          {
            value: {
              provider: () => new Map(),
            },
          },
          React.createElement(HomePage),
        ),
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Opening dashboard");
    expect(container.textContent).not.toContain("Public Announcements");
    expect(routerMock.replace).toHaveBeenCalledWith("/admin");
  });
});
