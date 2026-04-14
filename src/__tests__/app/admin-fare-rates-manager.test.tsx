// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import AdminFareRatesManager from "@/components/AdminFareRatesManager";
import type { AdminFareRatesResponseDto } from "@/lib/contracts";

function makeJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function buildFareRatesPayload(): AdminFareRatesResponseDto {
  return {
    current: {
      versionId: "fare-live",
      baseDistanceKm: 3,
      baseFare: 18,
      perKmRate: 4,
      effectiveAt: "2026-04-10T00:00:00.000Z",
    },
    upcoming: {
      versionId: "fare-next",
      baseDistanceKm: 3,
      baseFare: 20,
      perKmRate: 5,
      effectiveAt: "2026-04-20T00:00:00.000Z",
    },
    currentVersion: {
      id: "fare-live",
      baseDistanceKm: 3,
      baseFare: 18,
      perKmRate: 4,
      effectiveAt: "2026-04-10T00:00:00.000Z",
      createdAt: "2026-04-10T00:00:00.000Z",
      createdById: "admin-1",
      createdByName: "Admin User (@admin)",
      notes: "Current approved fare.",
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
      baseFare: 20,
      perKmRate: 5,
      effectiveAt: "2026-04-20T00:00:00.000Z",
      createdAt: "2026-04-12T00:00:00.000Z",
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
        baseFare: 20,
        perKmRate: 5,
        effectiveAt: "2026-04-20T00:00:00.000Z",
        createdAt: "2026-04-12T00:00:00.000Z",
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
        baseFare: 18,
        perKmRate: 4,
        effectiveAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-04-10T00:00:00.000Z",
        createdById: "admin-1",
        createdByName: "Admin User (@admin)",
        notes: "Current approved fare.",
        canceledAt: null,
        canceledById: null,
        canceledByName: null,
        cancellationReason: null,
        isActive: true,
        isUpcoming: false,
      },
      {
        id: "fare-previous",
        baseDistanceKm: 3,
        baseFare: 15,
        perKmRate: 3,
        effectiveAt: "2026-04-01T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        createdById: "admin-1",
        createdByName: "Admin User (@admin)",
        notes: "Prior approved fare.",
        canceledAt: null,
        canceledById: null,
        canceledByName: null,
        cancellationReason: null,
        isActive: false,
        isUpcoming: false,
      },
    ],
  }
}

function buildRevertedFareRatesPayload(): AdminFareRatesResponseDto {
  return {
    current: {
      versionId: "fare-previous",
      baseDistanceKm: 3,
      baseFare: 15,
      perKmRate: 3,
      effectiveAt: "2026-04-01T00:00:00.000Z",
    },
    upcoming: {
      versionId: "fare-next",
      baseDistanceKm: 3,
      baseFare: 20,
      perKmRate: 5,
      effectiveAt: "2026-04-20T00:00:00.000Z",
    },
    currentVersion: {
      id: "fare-previous",
      baseDistanceKm: 3,
      baseFare: 15,
      perKmRate: 3,
      effectiveAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      createdById: "admin-1",
      createdByName: "Admin User (@admin)",
      notes: "Prior approved fare.",
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
      baseFare: 20,
      perKmRate: 5,
      effectiveAt: "2026-04-20T00:00:00.000Z",
      createdAt: "2026-04-12T00:00:00.000Z",
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
        baseFare: 20,
        perKmRate: 5,
        effectiveAt: "2026-04-20T00:00:00.000Z",
        createdAt: "2026-04-12T00:00:00.000Z",
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
        baseFare: 18,
        perKmRate: 4,
        effectiveAt: "2026-04-10T00:00:00.000Z",
        createdAt: "2026-04-10T00:00:00.000Z",
        createdById: "admin-1",
        createdByName: "Admin User (@admin)",
        notes: "Current approved fare.",
        canceledAt: "2026-04-14T00:00:00.000Z",
        canceledById: "admin-1",
        canceledByName: "Admin User (@admin)",
        cancellationReason: "Reverted by administrator.",
        isActive: false,
        isUpcoming: false,
      },
      {
        id: "fare-previous",
        baseDistanceKm: 3,
        baseFare: 15,
        perKmRate: 3,
        effectiveAt: "2026-04-01T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        createdById: "admin-1",
        createdByName: "Admin User (@admin)",
        notes: "Prior approved fare.",
        canceledAt: null,
        canceledById: null,
        canceledByName: null,
        cancellationReason: null,
        isActive: true,
        isUpcoming: false,
      },
    ],
  }
}

describe("AdminFareRatesManager", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let confirmMock: (message?: string) => boolean;
  let fareRatesPayload: AdminFareRatesResponseDto;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fareRatesPayload = buildFareRatesPayload();
    confirmMock = vi.fn<(message?: string) => boolean>(() => true);

    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = typeof input === "string" || input instanceof URL ? (init?.method ?? "GET") : input.method;

      if (!url.includes("/api/admin/fare-rates")) {
        throw new Error(`Unhandled fetch url: ${url}`);
      }

      if (url.endsWith("/api/admin/fare-rates") && method === "GET") {
        return Promise.resolve(makeJsonResponse(fareRatesPayload));
      }

      if (url.endsWith("/api/admin/fare-rates/revert") && method === "POST") {
        fareRatesPayload = buildRevertedFareRatesPayload();
        return Promise.resolve(makeJsonResponse({ success: true, message: "Fare rate reverted successfully." }));
      }

      if (url.endsWith("/api/admin/fare-rates/fare-next") && method === "DELETE") {
        fareRatesPayload = {
          ...fareRatesPayload,
          upcoming: null,
          upcomingVersion: null,
          history: fareRatesPayload.history.filter((version) => version.id !== "fare-next"),
        };

        return Promise.resolve(makeJsonResponse({ success: true, message: "Fare rate version deleted permanently." }));
      }

      throw new Error(`Unhandled fetch url/method: ${method} ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", confirmMock);
    window.confirm = confirmMock;
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
    expect(container.textContent).toContain("Revert the Current Fare Rate");
    expect(container.textContent).toContain("PHP 15.00");
    expect(container.textContent).toContain("PHP 18.00");
    expect(container.textContent).toContain("Festival week schedule.");
    expect(container.textContent).toContain("Delete permanently");
    expect(container.textContent).toContain("Cancel the Upcoming Fare Rate");
  });

  it("reverts the current fare and refreshes the manager", async () => {
    await act(async () => {
      root.render(React.createElement(AdminFareRatesManager));
      await Promise.resolve();
      await Promise.resolve();
    });

    const revertButton = container.querySelector("#admin-fare-revert-current") as HTMLButtonElement | null;
    expect(revertButton).not.toBeNull();

    await act(async () => {
      revertButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/fare-rates/revert",
      expect.objectContaining({ method: "POST" }),
    );
    expect(container.textContent).toContain("Fare rate reverted successfully.");
    expect(container.textContent).not.toContain("Revert the Current Fare Rate");
  });

  it("deletes a non-live fare version and refreshes the history", async () => {
    await act(async () => {
      root.render(React.createElement(AdminFareRatesManager));
      await Promise.resolve();
      await Promise.resolve();
    });

    const deleteButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete permanently",
    ) as HTMLButtonElement | undefined;

    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/fare-rates/fare-next",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(container.textContent).toContain("Fare rate version deleted permanently.");
    expect(container.textContent).not.toContain("Festival week schedule.");
  });
});
