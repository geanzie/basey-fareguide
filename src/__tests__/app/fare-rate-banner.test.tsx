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

describe("FareRateBanner", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = vi.fn(() =>
      Promise.resolve(
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
      ),
    );
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
    expect(container.textContent).toContain("Official Fare Rates");
    expect(container.textContent).toContain("Current fare");
    expect(container.textContent).toContain("Upcoming fare");
    expect(container.textContent).toContain("PHP 15.00");
    expect(container.textContent).toContain("PHP 18.00");
    expect(container.textContent).toContain("Per additional km");
  });
});
