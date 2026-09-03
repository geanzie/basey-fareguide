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
      document: null,
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
      document: null,
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
        document: null,
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
        document: null,
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
        document: null,
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
      document: null,
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
      document: null,
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
        document: null,
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
        document: null,
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
        document: null,
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
  let documentUploadFails: boolean;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fareRatesPayload = buildFareRatesPayload();
    documentUploadFails = false;
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

      if (url.endsWith("/api/admin/fare-rates") && method === "POST") {
        return Promise.resolve(
          makeJsonResponse({
            success: true,
            fareRateVersion: { id: "fare-created" },
            message: "Fare rate published successfully.",
          }),
        );
      }

      if (url.endsWith("/api/admin/fare-rates/fare-created/document") && method === "POST") {
        return Promise.resolve(
          documentUploadFails
            ? new Response(JSON.stringify({ message: "Supporting document file size must be less than 15MB" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              })
            : makeJsonResponse({ success: true, message: "Supporting document attached successfully." }),
        );
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
  async function renderManager() {
    await act(async () => {
      root.render(React.createElement(AdminFareRatesManager));
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function attachFileToPublishForm(file: File) {
    const fileInput = container.querySelector("#admin-fare-document-file") as HTMLInputElement;
    // jsdom has no DataTransfer, and `files` is read-only on the element.
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    return fileInput;
  }

  function setInputValue(selector: string, value: string) {
    const input = container.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("uploads the supporting document after the fare rate is published", async () => {
    await renderManager();

    setInputValue("#admin-fare-notes", "Fuel price adjustment.");
    setInputValue("#admin-fare-document-title", "Resolution approving the adjusted fare rates");
    setInputValue("#admin-fare-document-reference", "SB Resolution No. 42, Series of 2026");
    attachFileToPublishForm(new File(["%PDF"], "resolution.pdf", { type: "application/pdf" }));

    await act(async () => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The document is a second call against the version the first call created.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/fare-rates",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/fare-rates/fare-created/document",
      expect.objectContaining({ method: "POST" }),
    );

    const documentCall = fetchMock.mock.calls.find(
      ([callUrl]) => callUrl === "/api/admin/fare-rates/fare-created/document",
    );
    const body = (documentCall?.[1] as RequestInit).body as FormData;
    expect(body.get("title")).toBe("Resolution approving the adjusted fare rates");
    expect(body.get("reference")).toBe("SB Resolution No. 42, Series of 2026");
    expect(body.get("document")).toBeInstanceOf(File);

    expect(container.textContent).toContain("Fare rate published successfully.");
  });

  it("still reports the fare rate as published when the document upload fails", async () => {
    documentUploadFails = true;
    await renderManager();

    setInputValue("#admin-fare-notes", "Fuel price adjustment.");
    setInputValue("#admin-fare-document-title", "Resolution approving the adjusted fare rates");
    attachFileToPublishForm(new File(["%PDF"], "huge.pdf", { type: "application/pdf" }));

    await act(async () => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The rate is live; only the paperwork is missing, and it is retryable below.
    expect(container.textContent).toContain("Fare rate published successfully.");
    expect(container.textContent).toContain("Supporting document file size must be less than 15MB");
    expect(container.textContent).toContain("Attach it from the fare rate history below.");
  });

  it("refuses to publish with a document file but no title", async () => {
    await renderManager();

    setInputValue("#admin-fare-notes", "Fuel price adjustment.");
    attachFileToPublishForm(new File(["%PDF"], "resolution.pdf", { type: "application/pdf" }));

    await act(async () => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("A document title is required");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/fare-rates",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("offers an attach action per history row and a replace action once one exists", async () => {
    fareRatesPayload = {
      ...fareRatesPayload,
      history: fareRatesPayload.history.map((version) =>
        version.id === "fare-live"
          ? {
              ...version,
              document: {
                title: "Resolution approving the adjusted fare rates",
                reference: "SB Resolution No. 42, Series of 2026",
                fileName: "resolution-42.pdf",
                mimeType: "application/pdf",
                sizeBytes: 240000,
                uploadedAt: "2026-04-10T00:00:00.000Z",
                uploadedByName: "Admin User (@admin)",
                downloadUrl: "/api/fare-rates/fare-live/document",
              },
            }
          : version,
      ),
    };

    await renderManager();

    const labels = Array.from(container.querySelectorAll("button")).map((button) => button.textContent);
    expect(labels).toContain("Attach document");
    expect(labels).toContain("Replace document");
    expect(labels).toContain("Remove document");
    expect(container.textContent).toContain("No supporting document attached.");
    expect(container.querySelector('a[href="/api/fare-rates/fare-live/document"]')).not.toBeNull();
  });
});
