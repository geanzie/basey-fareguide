import { createHash } from "node:crypto";

import { decodePolyline } from "@/lib/routeUtils";
import { approxMeters } from "./geo";

/**
 * Elevation profile of a route, and what it implies for a vehicle.
 *
 * Terrain gates whether a route is VALID for a vehicle. It never touches the
 * fare: Ordinance 105 prices distance, and letting grade nudge the number would
 * be a terrain surcharge. Everything here is read, compared, and discarded.
 *
 * WHAT THE DATA CAN ACTUALLY SUPPORT
 * ----------------------------------
 * Measured over Basey on 2026-08-28, Google serves a DEM of about 153 m
 * resolution along roads and 611 m inland — not the ~30 m the 12%/25%
 * thresholds were reasoned about. A tricycle-defeating pitch is typically
 * 50-200 m of road, so it is averaged away entirely at that resolution. The
 * grade this module reports is therefore a terrain-scale slope, not the road's
 * true gradient, and the smoothing window is derived from the reported
 * resolution rather than chosen: computing a gradient finer than the DEM only
 * measures Google's interpolation.
 */

const ELEVATION_ENDPOINT = "https://maps.googleapis.com/maps/api/elevation/json";

/** The Elevation API's per-request ceiling for a sampled path. */
const MAX_SAMPLES = 512;

/** Requesting finer than this buys nothing against a 153 m DEM. */
const TARGET_SAMPLE_SPACING_M = 75;

/** Never average grade over less than this, whatever the DEM claims. */
const MIN_SMOOTHING_WINDOW_M = 120;

const DEFAULT_TIMEOUT_MS = 4000;

export interface TerrainProfile {
  sampleCount: number;
  sampleSpacingM: number;
  /** What Google reported for the underlying DEM, in metres. */
  demResolutionM: number;
  /** Distance the grade was averaged over. Derived from demResolutionM. */
  smoothingWindowM: number;
  elevationGainM: number;
  elevationLossM: number;
  /** Steepest sustained UPWARD grade, in percent. Descents are not a climb. */
  maxGradePercent: number;
  samples: number[];
}

export interface GradeVerdict {
  /** False when no elevation data was available; never treat that as a pass. */
  checked: boolean;
  maxGradePercent: number | null;
  thresholdPercent: number | null;
  /** True only when a threshold was set AND the measured grade exceeded it. */
  exceedsThreshold: boolean;
  demResolutionM: number | null;
}

interface ElevationApiResponse {
  status?: string;
  error_message?: string;
  results?: Array<{
    elevation?: number;
    resolution?: number;
    location?: { lat?: number; lng?: number };
  }>;
}

export function hashPolyline(polyline: string): string {
  return createHash("sha256").update(polyline).digest("hex");
}

function getApiKey(): string | null {
  return (
    process.env.GOOGLE_ELEVATION_API_KEY ||
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    null
  );
}

function getConfiguredTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.ROUTING_ELEVATION_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function isTerrainProfilingEnabled(): boolean {
  return process.env.ROUTING_TERRAIN_ENABLED === "true" && getApiKey() !== null;
}

/** How many samples to ask for along a route of this length. */
export function sampleCountFor(distanceMeters: number): number {
  const wanted = Math.ceil(distanceMeters / TARGET_SAMPLE_SPACING_M) + 1;
  return Math.min(MAX_SAMPLES, Math.max(2, wanted));
}

/**
 * Turns a sampled elevation series into a profile.
 *
 * Grade is measured over a rolling window rather than between neighbouring
 * samples. Two reasons, and the second is the one that bites: a coarse DEM
 * produces spurious spikes between adjacent samples, and sampling finer than
 * the DEM means adjacent samples are interpolated from the same cell, so their
 * difference is an artifact rather than a measurement.
 */
export function buildProfile(
  samples: Array<{ elevation: number; lat: number; lng: number; resolution: number }>,
  options: { minSegmentMeters: number },
): TerrainProfile {
  const elevations = samples.map((s) => s.elevation);
  const demResolutionM = Math.max(...samples.map((s) => s.resolution || 0), 0);

  const stepMeters: number[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    stepMeters.push(
      approxMeters(
        { lat: samples[i - 1].lat, lng: samples[i - 1].lng },
        { lat: samples[i].lat, lng: samples[i].lng },
      ),
    );
  }

  const totalMeters = stepMeters.reduce((sum, m) => sum + m, 0);
  const sampleSpacingM = stepMeters.length > 0 ? totalMeters / stepMeters.length : 0;

  let elevationGainM = 0;
  let elevationLossM = 0;
  for (let i = 1; i < elevations.length; i += 1) {
    const delta = elevations[i] - elevations[i - 1];
    if (delta > 0) elevationGainM += delta;
    else elevationLossM -= delta;
  }

  const smoothingWindowM = Math.max(MIN_SMOOTHING_WINDOW_M, demResolutionM);
  const windowSamples =
    sampleSpacingM > 0 ? Math.max(1, Math.round(smoothingWindowM / sampleSpacingM)) : 1;

  let maxGradePercent = 0;
  for (let i = windowSamples; i < elevations.length; i += 1) {
    let run = 0;
    for (let j = i - windowSamples + 1; j <= i; j += 1) {
      run += stepMeters[j - 1] ?? 0;
    }

    // A short run is a spike in a coarse DEM, not a hill.
    if (run < options.minSegmentMeters) continue;

    const rise = elevations[i] - elevations[i - windowSamples];
    const grade = (rise / run) * 100;

    // Only climbs matter. A tricycle coming down a 20% slope is braking, not
    // failing to make it.
    if (grade > maxGradePercent) maxGradePercent = grade;
  }

  return {
    sampleCount: samples.length,
    sampleSpacingM,
    demResolutionM,
    smoothingWindowM,
    elevationGainM,
    elevationLossM,
    maxGradePercent,
    samples: elevations,
  };
}

/**
 * Fetches the elevation profile along an encoded polyline.
 *
 * Fails open — returns null on a missing key, a disabled API, a timeout, or an
 * unusable response. A terrain reading is diagnostic; losing it must never cost
 * a rider their quote.
 */
export async function fetchTerrainProfile(
  polyline: string,
  options: { minSegmentMeters: number },
): Promise<TerrainProfile | null> {
  const apiKey = getApiKey();

  if (!apiKey || !polyline) {
    return null;
  }

  const vertices = decodePolyline(polyline);

  if (vertices.length < 2) {
    return null;
  }

  let routeMeters = 0;
  for (let i = 1; i < vertices.length; i += 1) {
    routeMeters += approxMeters(
      { lat: vertices[i - 1][0], lng: vertices[i - 1][1] },
      { lat: vertices[i][0], lng: vertices[i][1] },
    );
  }

  const samples = sampleCountFor(routeMeters);
  const url = `${ELEVATION_ENDPOINT}?path=enc:${encodeURIComponent(polyline)}&samples=${samples}&key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getConfiguredTimeoutMs());

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      console.warn("[terrain] elevation request failed", { status: response.status });
      return null;
    }

    const data = (await response.json()) as ElevationApiResponse;

    if (data.status !== "OK" || !data.results?.length) {
      console.warn("[terrain] elevation unavailable", {
        status: data.status,
        message: data.error_message,
      });
      return null;
    }

    const points = data.results
      .map((result) => ({
        elevation: typeof result.elevation === "number" ? result.elevation : Number.NaN,
        lat: result.location?.lat ?? Number.NaN,
        lng: result.location?.lng ?? Number.NaN,
        resolution: typeof result.resolution === "number" ? result.resolution : 0,
      }))
      .filter(
        (point) =>
          Number.isFinite(point.elevation) &&
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng),
      );

    if (points.length < 2) {
      return null;
    }

    return buildProfile(points, options);
  } catch (error) {
    console.warn("[terrain] elevation lookup threw", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compares a profile against a vehicle's limit.
 *
 * A missing profile is reported as unchecked, never as a pass — the caller must
 * be able to tell "this route is fine" from "we could not tell".
 */
export function gradeVerdictFor(
  profile: TerrainProfile | null,
  thresholdPercent: number | null,
): GradeVerdict {
  if (!profile) {
    return {
      checked: false,
      maxGradePercent: null,
      thresholdPercent,
      exceedsThreshold: false,
      demResolutionM: null,
    };
  }

  return {
    checked: true,
    maxGradePercent: profile.maxGradePercent,
    thresholdPercent,
    exceedsThreshold:
      thresholdPercent != null && profile.maxGradePercent > thresholdPercent,
    demResolutionM: profile.demResolutionM,
  };
}
