// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";

import PublicUserDashboard from "@/components/PublicUserDashboard";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public dashboard announcements", () => {
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
    vi.unstubAllGlobals();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows traffic announcements near the top without removing the fare notice", async () => {
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
                  title: "Weekend reroute",
                  body: "Temporary reroute this weekend.",
                  category: "TRAFFIC_ADVISORY",
                  categoryLabel: "Traffic Advisory",
                  startsAt: "2026-04-03T00:00:00.000Z",
                  endsAt: null,
                },
              ],
            }),
          );
        }

        if (url.includes("/api/incidents")) {
          return Promise.resolve(makeJsonResponse({ incidents: [] }));
        }

        if (url.includes("/api/fare-calculations")) {
          return Promise.resolve(makeJsonResponse({ calculations: [] }));
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
          React.createElement(PublicUserDashboard),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Traffic Announcements");
    expect(container.textContent).toContain("Weekend reroute");
    expect(container.textContent).toContain("Fare Notice");
  });
});
