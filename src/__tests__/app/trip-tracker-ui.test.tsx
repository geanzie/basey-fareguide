// @vitest-environment jsdom

import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/components/TripTrackerMap", () => ({
  default: () => React.createElement("div", { "data-testid": "trip-tracker-map" }, "map"),
}));

import TripTrackerCalculator from "@/components/TripTrackerCalculator";

function makePosition(
  lat: number,
  lng: number,
  accuracyM: number,
  timestampMs: number,
): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: accuracyM,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: timestampMs,
  } as GeolocationPosition;
}

function makeJsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

describe("TripTrackerCalculator", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let watchSuccess: PositionCallback | null;
  let fareRatesPayload: {
    current: {
      versionId: string | null;
      baseDistanceKm: number;
      baseFare: number;
      perKmRate: number;
      effectiveAt: string | null;
    };
    upcoming: null;
  };
  let segmentResponses: Response[];

  const geolocationMock = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    sessionStorage.clear();

    fareRatesPayload = {
      current: {
        versionId: "fare-live",
        baseDistanceKm: 3,
        baseFare: 15,
        perKmRate: 3,
        effectiveAt: "2026-04-01T00:00:00.000Z",
      },
      upcoming: null,
    };
    segmentResponses = [];

    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/fare-rates")) {
        return Promise.resolve(makeJsonResponse(fareRatesPayload));
      }

      if (url.includes("/api/tracker/segment")) {
        const next = segmentResponses.shift();
        if (!next) {
          throw new Error("No queued tracker segment response");
        }

        return Promise.resolve(next);
      }

      throw new Error(`Unhandled fetch url: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    watchSuccess = null;
    geolocationMock.getCurrentPosition.mockReset();
    geolocationMock.watchPosition.mockReset();
    geolocationMock.clearWatch.mockReset();

    geolocationMock.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success(makePosition(11.2754, 125.0689, 12, 1_700_000_000_000));
    });
    geolocationMock.watchPosition.mockImplementation((success: PositionCallback) => {
      watchSuccess = success;
      return 1;
    });

    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: geolocationMock,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find((item) =>
      item.textContent?.includes(label),
    );
    if (!button) {
      throw new Error(`Button "${label}" not found`);
    }

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("transitions into road-aware tracking after an accepted segment", async () => {
    segmentResponses.push(
      makeJsonResponse({
        accepted: true,
        reason: null,
        distanceKm: 0.8,
        durationMin: 3,
        confidence: "road_aware",
        method: "ors",
        fallbackReason: null,
        polyline: "encoded",
        snappedFrom: null,
        snappedTo: null,
      }),
    );

    await act(async () => {
      root.render(React.createElement(TripTrackerCalculator));
      await Promise.resolve();
    });

    await act(async () => {
      clickButton("Start tracking");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(geolocationMock.watchPosition).toHaveBeenCalledTimes(1);
    expect(watchSuccess).not.toBeNull();

    await act(async () => {
      watchSuccess?.(makePosition(11.2762, 125.0694, 18, 1_700_000_015_000));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tracker/segment",
      expect.objectContaining({ method: "POST" }),
    );
    expect(container.textContent).toContain("Road-aware tracking active");
    expect(container.textContent).toContain("1 road-aware / 0 estimated");
  });

  it("recovers an active tracker session from sessionStorage", async () => {
    const storedPoint = {
      lat: 11.2754,
      lng: 125.0689,
      accuracyM: 12,
      timestampMs: 1_700_000_000_000,
    };

    sessionStorage.setItem(
      "trip-tracker-session",
      JSON.stringify({
        trackerSessionId: "saved-session",
        uiState: "tracking_road_aware",
        isTracking: true,
        startedAtMs: storedPoint.timestampMs,
        endedAtMs: null,
        startPoint: storedPoint,
        endPoint: null,
        currentPosition: storedPoint,
        lastAcceptedRawPoint: storedPoint,
        confirmedCheckpoints: [storedPoint],
        segments: [],
        totalDistanceKm: 0,
        durationMin: 0,
        fare: 15,
        farePolicy: fareRatesPayload.current,
        hasFallbackSegments: false,
        lastSegmentRequestAtMs: null,
        rateLimitedUntilMs: null,
        consecutiveRejectedSamples: 0,
        lastRejectionReason: null,
        gpsError: null,
      }),
    );

    await act(async () => {
      root.render(React.createElement(TripTrackerCalculator));
      await Promise.resolve();
    });

    expect(geolocationMock.watchPosition).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("End trip");
    expect(container.textContent).toContain("Road-aware while the page stays open");
  });

  it("shows estimated tracking when the segment endpoint rate-limits the client", async () => {
    segmentResponses.push(
      new Response(JSON.stringify({ retryAfter: 30 }), {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    await act(async () => {
      root.render(React.createElement(TripTrackerCalculator));
      await Promise.resolve();
    });

    await act(async () => {
      clickButton("Start tracking");
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      watchSuccess?.(makePosition(11.2762, 125.0694, 18, 1_700_000_015_000));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Estimated tracking active");
    expect(container.textContent).toContain("0 road-aware / 1 estimated");
  });

  it("locks the fare policy at trip start even if live rates change later", async () => {
    fareRatesPayload = {
      current: {
        versionId: "fare-at-start",
        baseDistanceKm: 3,
        baseFare: 20,
        perKmRate: 5,
        effectiveAt: "2026-04-03T00:00:00.000Z",
      },
      upcoming: null,
    };
    segmentResponses.push(
      makeJsonResponse({
        accepted: true,
        reason: null,
        distanceKm: 4.2,
        durationMin: 10,
        confidence: "road_aware",
        method: "ors",
        fallbackReason: null,
        polyline: "encoded",
        snappedFrom: null,
        snappedTo: null,
      }),
    );

    await act(async () => {
      root.render(React.createElement(TripTrackerCalculator));
      await Promise.resolve();
    });

    await act(async () => {
      clickButton("Start tracking");
      await Promise.resolve();
      await Promise.resolve();
    });

    fareRatesPayload = {
      current: {
        versionId: "fare-updated",
        baseDistanceKm: 3,
        baseFare: 40,
        perKmRate: 10,
        effectiveAt: "2026-04-03T01:00:00.000Z",
      },
      upcoming: null,
    };

    await act(async () => {
      watchSuccess?.(makePosition(11.2762, 125.0694, 18, 1_700_000_015_000));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("PHP 30.00");
    expect(container.textContent).not.toContain("PHP 60.00");
  });
});
