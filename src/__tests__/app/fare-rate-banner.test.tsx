// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";

import FareRateBanner from "@/components/FareRateBanner";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function findLinkByText(container: HTMLElement, text: string): HTMLAnchorElement | undefined {
  return Array.from(container.querySelectorAll("a")).find((anchor) =>
    anchor.textContent?.includes(text),
  );
}

describe("FareRateBanner", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let documentedVersionIds: string[];

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    // Only "fare-live" has an issuance on file, so the two links in the banner
    // exercise both branches at once: the current rate resolves to its own
    // document, the announced change falls back to the About page list.
    documentedVersionIds = ["fare-live"];

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/fare-rates/documents")) {
        return Promise.resolve(
          makeJsonResponse({
            documents: documentedVersionIds.map((versionId) => ({
              versionId,
              effectiveAt: "2026-04-01T00:00:00.000Z",
              baseFare: 15,
              perKmRate: 3,
              baseDistanceKm: 3,
              notes: "",
              isActive: versionId === "fare-live",
              isUpcoming: versionId === "fare-next",
              document: {
                title: "SB Resolution No. 42",
                reference: "SB Resolution No. 42, Series of 2026",
                fileName: "resolution-42.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
                uploadedAt: "2026-03-20T00:00:00.000Z",
                uploadedByName: "Admin",
                downloadUrl: `/api/fare-rates/${versionId}/document`,
              },
            })),
          }),
        );
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

  it("shows the current and upcoming fare rates from the public endpoint", async () => {
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
          React.createElement(FareRateBanner),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/fare-rates");
    expect(container.textContent).toContain("Fare Rates");
    expect(container.textContent).toContain("Current fare");
    expect(container.textContent).toContain("Upcoming fare");
    expect(container.textContent).toContain("PHP 15.00");
    expect(container.textContent).toContain("PHP 18.00");
    expect(container.textContent).toContain("Per additional km");
    expect(findLinkByText(container, "See the ordinance behind this rate")?.getAttribute("href")).toBe(
      "/fare-documents/fare-live",
    );
  });

  it("emphasizes an upcoming fare hike when rendered as an announcement", async () => {
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
          React.createElement(FareRateBanner, {
            variant: "announcement",
            title: "Fare Rates",
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Announcement");
    expect(container.textContent).toContain("Upcoming fare hike approved");
    expect(container.textContent).toContain("base fare from PHP 15.00 to PHP 18.00");
    expect(container.textContent).toContain("additional kilometer rate from PHP 3.00 to PHP 4.00");
    // "fare-next" has no issuance uploaded yet, so the announcement sends
    // riders to the full list rather than to a "Document not available" page.
    expect(
      findLinkByText(container, "See the issuance that authorized this change")?.getAttribute("href"),
    ).toBe("/profile/about#fare-rate-documents");
  });

  it("falls back to the About page list when the active rate has no issuance on file", async () => {
    documentedVersionIds = [];

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
          React.createElement(FareRateBanner),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(findLinkByText(container, "See the ordinance behind this rate")?.getAttribute("href")).toBe(
      "/profile/about#fare-rate-documents",
    );
  });
});
