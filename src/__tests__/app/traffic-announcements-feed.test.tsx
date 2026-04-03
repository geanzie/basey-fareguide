// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";

import TrafficAnnouncementsFeed from "@/components/TrafficAnnouncementsFeed";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TrafficAnnouncementsFeed", () => {
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

  it("renders active announcements from the public endpoint", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        makeJsonResponse({
          announcements: [
            {
              id: "announcement-1",
              title: "Road closure",
              body: "Main road is closed today.",
              category: "ROAD_CLOSURE",
              categoryLabel: "Road Closure",
              startsAt: "2026-04-03T00:00:00.000Z",
              endsAt: "2026-04-03T08:00:00.000Z",
            },
          ],
        }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

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
          React.createElement(TrafficAnnouncementsFeed),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/announcements");
    expect(container.textContent).toContain("Traffic Announcements");
    expect(container.textContent).toContain("Road closure");
    expect(container.textContent).toContain("Road Closure");
  });

  it("renders nothing when there are no active announcements", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          makeJsonResponse({
            announcements: [],
          }),
        ),
      ),
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
          React.createElement(TrafficAnnouncementsFeed),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent?.trim()).toBe("");
  });
});
