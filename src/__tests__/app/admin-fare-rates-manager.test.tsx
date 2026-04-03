// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import AdminFareRatesManager from "@/components/AdminFareRatesManager";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminFareRatesManager", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.includes("/api/admin/fare-rates")) {
        throw new Error(`Unhandled fetch url: ${url}`);
      }

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
            baseFare: 18,
            perKmRate: 4,
            effectiveAt: "2026-04-10T00:00:00.000Z",
          },
          currentVersion: {
            id: "fare-live",
            baseDistanceKm: 3,
            baseFare: 15,
            perKmRate: 3,
            effectiveAt: "2026-04-01T00:00:00.000Z",
            createdAt: "2026-04-01T00:00:00.000Z",
            createdById: "admin-1",
            createdByName: "Admin User (@admin)",
            notes: "Baseline fare version.",
            canceledAt: null,
            canceledById: null,
            canceledByName: null,
            cancellationReason: null,
            isActive: true,
            isUpcoming: false,
          },
          upcomingVersion: {
            id: "fare-next",
            baseDistanceKm: 3,
            baseFare: 18,
            perKmRate: 4,
            effectiveAt: "2026-04-10T00:00:00.000Z",
            createdAt: "2026-04-03T00:00:00.000Z",
            createdById: "admin-1",
            createdByName: "Admin User (@admin)",
            notes: "Festival week schedule.",
            canceledAt: null,
            canceledById: null,
            canceledByName: null,
            cancellationReason: null,
            isActive: false,
            isUpcoming: true,
          },
          history: [
            {
              id: "fare-next",
              baseDistanceKm: 3,
              baseFare: 18,
              perKmRate: 4,
              effectiveAt: "2026-04-10T00:00:00.000Z",
              createdAt: "2026-04-03T00:00:00.000Z",
              createdById: "admin-1",
              createdByName: "Admin User (@admin)",
              notes: "Festival week schedule.",
              canceledAt: null,
              canceledById: null,
              canceledByName: null,
              cancellationReason: null,
              isActive: false,
              isUpcoming: true,
            },
            {
              id: "fare-live",
              baseDistanceKm: 3,
              baseFare: 15,
              perKmRate: 3,
              effectiveAt: "2026-04-01T00:00:00.000Z",
              createdAt: "2026-04-01T00:00:00.000Z",
              createdById: "admin-1",
              createdByName: "Admin User (@admin)",
              notes: "Baseline fare version.",
              canceledAt: null,
              canceledById: null,
              canceledByName: null,
              cancellationReason: null,
              isActive: true,
              isUpcoming: false,
            },
          ],
        }),
      );
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders current, upcoming, and historical fare versions", async () => {
    await act(async () => {
      root.render(React.createElement(AdminFareRatesManager));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Publish or Schedule a Fare Change");
    expect(container.textContent).toContain("Current fare");
    expect(container.textContent).toContain("Upcoming fare");
    expect(container.textContent).toContain("Fare Rate History");
    expect(container.textContent).toContain("PHP 15.00");
    expect(container.textContent).toContain("PHP 18.00");
    expect(container.textContent).toContain("Festival week schedule.");
    expect(container.textContent).toContain("Cancel the Upcoming Fare Rate");
  });
});
