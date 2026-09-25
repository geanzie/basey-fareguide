// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";

import { RiderDashboardBody } from "@/components/rider-operations/RiderControlCenter";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const emptyOperations = {
  generatedAt: "2026-04-05T00:00:00.000Z",
  range: "30d",
  since: "2026-03-06T00:00:00.000Z",
  pulse: { tripCount: 0, spent: 0, saved: 0, distanceKm: 0, openReportCount: 0 },
  trips: [],
  reports: [],
  previousPeriodTrips: 0,
  previousPeriodSpent: 0,
  previousPeriodSaved: 0,
  community: {
    reportCount: 0,
    previousPeriodCount: 0,
    outcomes: [],
    closedCount: 0,
    medianCloseHours: null,
    closeBuckets: [],
    openOverAWeek: 0,
  },
  truncated: false,
};

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

        if (url.includes("/api/public/operations")) {
          return Promise.resolve(makeJsonResponse(emptyOperations));
        }

        if (url.includes("/api/dashboard/activity")) {
          return Promise.resolve(makeJsonResponse({ activity: [] }));
        }

        if (url.includes("/api/fare-rates/documents")) {
          return Promise.resolve(
            makeJsonResponse({
              documents: [
                {
                  versionId: "fare-live",
                  effectiveAt: "2026-04-01T00:00:00.000Z",
                  baseFare: 15,
                  perKmRate: 3,
                  baseDistanceKm: 3,
                  notes: "",
                  isActive: true,
                  isUpcoming: false,
                  document: {
                    title: "SB Resolution No. 42",
                    reference: "SB Resolution No. 42, Series of 2026",
                    fileName: "resolution-42.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 1024,
                    uploadedAt: "2026-03-20T00:00:00.000Z",
                    uploadedByName: "Admin",
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
          React.createElement(RiderDashboardBody, { range: "30d", tab: "overview" }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Traffic Announcements");
    expect(container.textContent).toContain("Weekend reroute");
    expect(container.textContent).toContain("Fare Notice");
    // The notice must carry riders to the issuance that authorized the rate,
    // otherwise a fare adjustment is announced with no way to check it.
    const documentLink = Array.from(container.querySelectorAll("a")).find((anchor) =>
      anchor.textContent?.includes("See the ordinance behind this rate"),
    );
    expect(documentLink?.getAttribute("href")).toBe("/fare-documents/fare-live");
    expect(container.textContent).toContain("Recent fare calculations");
    expect(container.textContent).toContain("Recent incident reports");

    // Only destinations the bottom nav cannot reach in one tap survive as
    // cards. "Calculate Fare" went because /calculator is a primary tab, and
    // "View History" because the stat tiles link there already filtered — see
    // docs/adr/0004-dashboard-cards-are-not-a-second-navigation.md.
    const actionLabels = ["Report Incident", "Manage Discount Card"];
    const actionLinks = Array.from(container.querySelectorAll("a")).filter((anchor) =>
      actionLabels.some((label) => anchor.textContent?.includes(label)),
    );

    expect(actionLinks).toHaveLength(2);
    expect(actionLinks.every((anchor) => (anchor.textContent || "").trim().length > 0)).toBe(true);

    expect(container.textContent).not.toContain("Calculate Fare");
    expect(container.textContent).not.toContain("View History");

    // the tiles are what carry /history now, and they arrive pre-filtered
    const historyLinks = Array.from(container.querySelectorAll('a[href^="/history"]')).map(
      (anchor) => anchor.getAttribute("href"),
    );
    expect(historyLinks).toEqual(["/history?filter=routes", "/history?filter=reports"]);
  });
});
