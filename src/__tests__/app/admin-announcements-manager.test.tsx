// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import AdminAnnouncementsManager from "@/components/AdminAnnouncementsManager";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AdminAnnouncementsManager", () => {
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

  it("renders active, scheduled, and historical announcement sections", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        makeJsonResponse({
          active: [
            {
              id: "active-1",
              title: "Road closure",
              body: "Main road is closed.",
              category: "ROAD_CLOSURE",
              categoryLabel: "Road Closure",
              startsAt: "2026-04-03T00:00:00.000Z",
              endsAt: null,
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
              status: "active",
              createdById: "admin-1",
              createdByName: "Admin User (@admin)",
              updatedById: "admin-1",
              updatedByName: "Admin User (@admin)",
              archivedAt: null,
              archivedById: null,
              archivedByName: null,
            },
          ],
          scheduled: [
            {
              id: "scheduled-1",
              title: "Weekend reroute",
              body: "Alternate route this weekend.",
              category: "TRAFFIC_ADVISORY",
              categoryLabel: "Traffic Advisory",
              startsAt: "2026-04-05T00:00:00.000Z",
              endsAt: null,
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
              status: "scheduled",
              createdById: "admin-1",
              createdByName: "Admin User (@admin)",
              updatedById: "admin-1",
              updatedByName: "Admin User (@admin)",
              archivedAt: null,
              archivedById: null,
              archivedByName: null,
            },
          ],
          history: [
            {
              id: "archived-1",
              title: "Old notice",
              body: "This one has ended.",
              category: "ROAD_WORK",
              categoryLabel: "Road Work",
              startsAt: "2026-03-30T00:00:00.000Z",
              endsAt: "2026-04-01T00:00:00.000Z",
              createdAt: "2026-03-30T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
              status: "archived",
              createdById: "admin-1",
              createdByName: "Admin User (@admin)",
              updatedById: "admin-1",
              updatedByName: "Admin User (@admin)",
              archivedAt: "2026-04-01T00:00:00.000Z",
              archivedById: "admin-1",
              archivedByName: "Admin User (@admin)",
            },
          ],
          warning: null,
        }),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(React.createElement(AdminAnnouncementsManager));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Publish a Traffic Announcement");
    expect(container.textContent).toContain("Active Announcements");
    expect(container.textContent).toContain("Scheduled Announcements");
    expect(container.textContent).toContain("Announcement History");
    expect(container.textContent).toContain("Road closure");
    expect(container.textContent).toContain("Weekend reroute");
    expect(container.textContent).toContain("Old notice");
  });

  it("shows the migration warning state and disables the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          makeJsonResponse({
            active: [],
            scheduled: [],
            history: [],
            warning: "Traffic announcement management is waiting on database migrations.",
          }),
        ),
      ),
    );

    await act(async () => {
      root.render(React.createElement(AdminAnnouncementsManager));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("database migrations");
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    expect(submitButton?.disabled).toBe(true);
  });
});
