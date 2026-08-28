import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodePolyline } from "@/lib/routeUtils";
import {
  buildProfile,
  fetchTerrainProfile,
  gradeVerdictFor,
  hashPolyline,
  isTerrainProfilingEnabled,
  sampleCountFor,
} from "@/lib/routing/terrain";

/** Builds samples spaced `spacingM` apart heading north, with given elevations. */
function samplesFrom(elevations: number[], spacingM: number, resolution = 30) {
  const startLat = 11.28;
  const lng = 125.06;
  return elevations.map((elevation, i) => ({
    elevation,
    lat: startLat + (i * spacingM) / 111_000,
    lng,
    resolution,
  }));
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("buildProfile", () => {
  it("measures a steady climb as its true grade", () => {
    // 10 m of rise per 100 m of run is 10%.
    const profile = buildProfile(samplesFrom([0, 10, 20, 30, 40], 100), {
      minSegmentMeters: 25,
    });

    expect(profile.maxGradePercent).toBeCloseTo(10, 0);
    expect(profile.elevationGainM).toBeCloseTo(40, 0);
    expect(profile.elevationLossM).toBeCloseTo(0, 0);
  });

  it("ignores a descent, which is braking rather than a climb a vehicle can fail", () => {
    const profile = buildProfile(samplesFrom([100, 60, 20, 0], 100), {
      minSegmentMeters: 25,
    });

    expect(profile.maxGradePercent).toBe(0);
    expect(profile.elevationLossM).toBeCloseTo(100, 0);
  });

  it("smooths away a single-sample spike that a naive derivative would report", () => {
    // A lone +18 m blip between neighbours 30 m apart reads as 60% raw. Over a
    // realistic window it is what it is: noise on a flat road.
    const spiky = samplesFrom([0, 0, 18, 0, 0, 0, 0, 0], 30);
    const profile = buildProfile(spiky, { minSegmentMeters: 25 });

    expect(profile.maxGradePercent).toBeLessThan(20);
  });

  it("widens the averaging window to match a coarse DEM", () => {
    // Computing a gradient finer than the elevation data only measures
    // Google's interpolation, so the window follows the reported resolution.
    const coarse = buildProfile(samplesFrom([0, 5, 10, 15, 20, 25], 50, 600), {
      minSegmentMeters: 25,
    });

    expect(coarse.demResolutionM).toBe(600);
    expect(coarse.smoothingWindowM).toBe(600);
  });

  it("keeps a 120 m floor on the window when the DEM claims to be fine", () => {
    const fine = buildProfile(samplesFrom([0, 5, 10, 15], 50, 10), {
      minSegmentMeters: 25,
    });

    expect(fine.smoothingWindowM).toBe(120);
  });

  it("skips a run shorter than the minimum graded segment", () => {
    // Two samples 5 m apart with a 3 m step is a kerb in the geometry, not a hill.
    const profile = buildProfile(samplesFrom([0, 3], 5, 10), { minSegmentMeters: 25 });

    expect(profile.maxGradePercent).toBe(0);
  });
});

describe("sampleCountFor", () => {
  it("asks for roughly one sample per 75 m", () => {
    expect(sampleCountFor(750)).toBe(11);
  });

  it("never exceeds the API's per-request ceiling", () => {
    expect(sampleCountFor(500_000)).toBe(512);
  });

  it("always asks for at least two", () => {
    expect(sampleCountFor(0)).toBe(2);
  });
});

describe("gradeVerdictFor", () => {
  const profile = buildProfile(samplesFrom([0, 15, 30], 100), { minSegmentMeters: 25 });

  it("flags a climb above the vehicle's limit", () => {
    const verdict = gradeVerdictFor(profile, 12);

    expect(verdict.checked).toBe(true);
    expect(verdict.exceedsThreshold).toBe(true);
  });

  it("passes a climb within the limit", () => {
    expect(gradeVerdictFor(profile, 25).exceedsThreshold).toBe(false);
  });

  it("reports a missing profile as unchecked, never as a pass", () => {
    // "We could not tell" and "this route is fine" must not look the same.
    const verdict = gradeVerdictFor(null, 12);

    expect(verdict.checked).toBe(false);
    expect(verdict.exceedsThreshold).toBe(false);
    expect(verdict.maxGradePercent).toBeNull();
  });

  it("never exceeds a threshold that is not configured", () => {
    expect(gradeVerdictFor(profile, null).exceedsThreshold).toBe(false);
  });
});

describe("fetchTerrainProfile", () => {
  const polyline = encodePolyline([
    [11.28, 125.06],
    [11.29, 125.06],
    [11.3, 125.06],
  ]);

  it("fails open when no key is configured", async () => {
    await expect(
      fetchTerrainProfile(polyline, { minSegmentMeters: 25 }),
    ).resolves.toBeNull();
  });

  it("fails open when the API denies the request", async () => {
    vi.stubEnv("GOOGLE_ELEVATION_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "REQUEST_DENIED", error_message: "nope" }),
      }),
    );

    await expect(
      fetchTerrainProfile(polyline, { minSegmentMeters: 25 }),
    ).resolves.toBeNull();
  });

  it("fails open when the request throws", async () => {
    vi.stubEnv("GOOGLE_ELEVATION_API_KEY", "key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    await expect(
      fetchTerrainProfile(polyline, { minSegmentMeters: 25 }),
    ).resolves.toBeNull();
  });

  it("builds a profile from a good response", async () => {
    vi.stubEnv("GOOGLE_ELEVATION_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              { elevation: 0, resolution: 153, location: { lat: 11.28, lng: 125.06 } },
              { elevation: 20, resolution: 153, location: { lat: 11.2818, lng: 125.06 } },
              { elevation: 40, resolution: 153, location: { lat: 11.2836, lng: 125.06 } },
            ],
          }),
      }),
    );

    const profile = await fetchTerrainProfile(polyline, { minSegmentMeters: 25 });

    expect(profile).not.toBeNull();
    expect(profile?.demResolutionM).toBe(153);
    expect(profile?.elevationGainM).toBe(40);
  });
});

describe("hashPolyline", () => {
  it("is stable, so a route measured once is never measured again", () => {
    expect(hashPolyline("abc")).toBe(hashPolyline("abc"));
    expect(hashPolyline("abc")).not.toBe(hashPolyline("abd"));
  });
});

describe("isTerrainProfilingEnabled", () => {
  it("needs both the flag and a key", () => {
    vi.stubEnv("ROUTING_TERRAIN_ENABLED", "true");
    vi.stubEnv("GOOGLE_ELEVATION_API_KEY", "key");
    expect(isTerrainProfilingEnabled()).toBe(true);

    vi.stubEnv("ROUTING_TERRAIN_ENABLED", "false");
    expect(isTerrainProfilingEnabled()).toBe(false);
  });
});
