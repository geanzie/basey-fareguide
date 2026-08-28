import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GoogleRoadsProvider,
  isRoadsSnapEnabled,
  resolveNearestRoad,
} from "@/lib/routing/providers/googleRoads";

const requested = { lat: 11.282, lng: 125.068 };

/** ~55 m north of `requested`. */
const NEAR_ROAD = { latitude: 11.2825, longitude: 125.068 };
/** ~1.1 km north of `requested`. */
const FAR_ROAD = { latitude: 11.292, longitude: 125.068 };

function roadsResponse(
  snappedPoints: Array<{ location: { latitude: number; longitude: number }; originalIndex: number }>,
) {
  return { ok: true, json: () => Promise.resolve({ snappedPoints }) };
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_ROADS_API_KEY", "roads-test-key");
  vi.stubEnv("ROUTING_ROADS_SNAP_ENABLED", "true");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GoogleRoadsProvider", () => {
  it("keys results by the caller's input index", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        roadsResponse([{ location: NEAR_ROAD, originalIndex: 1 }]),
      ),
    );

    const snapped = await new GoogleRoadsProvider().nearestRoads([
      requested,
      { lat: 11.3, lng: 125.1 },
    ]);

    expect(snapped.has(0)).toBe(false);
    expect(snapped.get(1)).toEqual({ lat: NEAR_ROAD.latitude, lng: NEAR_ROAD.longitude });
  });

  it("omits a point Google found no road for, rather than inventing one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(roadsResponse([])));

    const snapped = await new GoogleRoadsProvider().nearestRoads([requested]);

    expect(snapped.size).toBe(0);
  });

  it("keeps the nearest snap when Google interpolates several along a road", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        roadsResponse([
          { location: FAR_ROAD, originalIndex: 0 },
          { location: NEAR_ROAD, originalIndex: 0 },
        ]),
      ),
    );

    const snapped = await new GoogleRoadsProvider().nearestRoads([requested]);

    expect(snapped.get(0)).toEqual({ lat: NEAR_ROAD.latitude, lng: NEAR_ROAD.longitude });
  });

  it("splits an oversized request into batches of 100", async () => {
    const fetchMock = vi.fn().mockResolvedValue(roadsResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const points = Array.from({ length: 250 }, (_, i) => ({
      lat: 11.28 + i / 10000,
      lng: 125.06,
    }));
    await new GoogleRoadsProvider().nearestRoads(points);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("makes no request at all for an empty input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await new GoogleRoadsProvider().nearestRoads([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the API rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Roads API has not been used in project"),
      }),
    );

    await expect(new GoogleRoadsProvider().nearestRoads([requested])).rejects.toThrow(
      /Roads API request failed \(403\)/,
    );
  });

  it("refuses to construct without a key", () => {
    vi.unstubAllEnvs();

    expect(() => new GoogleRoadsProvider()).toThrow(/GOOGLE_ROADS_API_KEY/);
  });
});

describe("resolveNearestRoad", () => {
  it("stays out of the way entirely while the flag is off", async () => {
    // Off by default until Google's rural coverage has been measured here.
    vi.stubEnv("ROUTING_ROADS_SNAP_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveNearestRoad(requested, 400)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isRoadsSnapEnabled()).toBe(false);
  });

  it("offers a road closer than the one already found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(roadsResponse([{ location: NEAR_ROAD, originalIndex: 0 }])),
    );

    const result = await resolveNearestRoad(requested, 400);

    expect(result?.meters).toBeLessThan(400);
    expect(result?.coordinate).toEqual({ lat: NEAR_ROAD.latitude, lng: NEAR_ROAD.longitude });
  });

  it("declines to make a verdict worse when its road is further away", async () => {
    // The whole safety argument rests on this: a gap in Google's coverage can
    // cost a missed improvement, never a wrongly refused trip.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(roadsResponse([{ location: FAR_ROAD, originalIndex: 0 }])),
    );

    await expect(resolveNearestRoad(requested, 100)).resolves.toBeNull();
  });

  it("fails open when the API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    await expect(resolveNearestRoad(requested, 400)).resolves.toBeNull();
  });

  it("fails open when the API is not enabled on the project", async () => {
    // Exactly the state the project is in today.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Roads API has not been used in project 210454554378"),
      }),
    );

    await expect(resolveNearestRoad(requested, 400)).resolves.toBeNull();
  });

  it("fails open when no key is configured", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ROUTING_ROADS_SNAP_ENABLED", "true");

    await expect(resolveNearestRoad(requested, 400)).resolves.toBeNull();
  });

  it("fails open when Google knows of no road near the point", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(roadsResponse([])));

    await expect(resolveNearestRoad(requested, 400)).resolves.toBeNull();
  });
});
