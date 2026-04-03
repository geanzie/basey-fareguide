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

describe("TripTrackerCalculator", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let watchSuccess: PositionCallback | null;

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

    fetchMock = vi.fn();
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
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await act(async () => {
      root.render(React.createElement(TripTrackerCalculator));
    });

    await act(async () => {
      clickButton("Start tracking");
    });

    expect(geolocationMock.watchPosition).toHaveBeenCalledTimes(1);
    expect(watchSuccess).not.toBeNull();

    await act(async () => {
      watchSuccess?.(makePosition(11.2762, 125.0694, 18, 1_700_000_015_000));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
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
    });

    expect(geolocationMock.watchPosition).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("End trip");
    expect(container.textContent).toContain("Road-aware while the page stays open");
  });

  it("shows estimated tracking when the segment endpoint rate-limits the client", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ retryAfter: 30 }), {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    await act(async () => {
      root.render(React.createElement(TripTrackerCalculator));
    });

    await act(async () => {
      clickButton("Start tracking");
    });

    await act(async () => {
      watchSuccess?.(makePosition(11.2762, 125.0694, 18, 1_700_000_015_000));
    });

    expect(container.textContent).toContain("Estimated tracking active");
    expect(container.textContent).toContain("0 road-aware / 1 estimated");
    expect(container.textContent).not.toContain("Most accurate results");
  });
});
