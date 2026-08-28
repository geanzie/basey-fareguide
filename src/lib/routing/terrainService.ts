import type { VehicleType } from "@prisma/client";

import { getVehicleRoutingProfile } from "./vehicleProfiles";
import {
  fetchTerrainProfile,
  gradeVerdictFor,
  hashPolyline,
  isTerrainProfilingEnabled,
  type GradeVerdict,
  type TerrainProfile,
} from "./terrain";

/**
 * Ties the elevation profile to the database: the per-vehicle grade limits an
 * admin can tune, and the permanent cache of profiles already measured.
 *
 * Everything here fails open. Terrain is diagnostic during the shadow period
 * and a validity gate afterwards, but in neither case may losing it cost a
 * rider their quote.
 */

const PROFILE_CACHE_TTL_MS = 120_000;

interface VehicleGradeSettings {
  maxUpwardGradePercent: number;
  minGradedSegmentMeters: number;
  /** While false the verdict is computed and logged but never enforced. */
  enforceGradeGate: boolean;
}

let vehicleSettingsCache: {
  value: Map<string, VehicleGradeSettings>;
  expiresAt: number;
} | null = null;

export function invalidateVehicleRoutingProfileCache() {
  vehicleSettingsCache = null;
}

async function loadPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("vehicle_routing_profiles") ||
    message.includes("route_terrain_profiles") ||
    message.includes("vehicleroutingprofile") ||
    message.includes("routeterrainprofile")
  );
}

/**
 * Grade settings for a vehicle.
 *
 * Falls back to the seed values in vehicleProfiles.ts when no row exists, with
 * enforcement OFF — a threshold nobody has confirmed must not refuse fares.
 */
export async function getVehicleGradeSettings(
  vehicleType: VehicleType | null,
): Promise<VehicleGradeSettings | null> {
  if (!vehicleType) {
    return null;
  }

  const fallback: VehicleGradeSettings = {
    maxUpwardGradePercent: getVehicleRoutingProfile(vehicleType).maxUpwardGradePercent,
    minGradedSegmentMeters: 25,
    enforceGradeGate: false,
  };

  const now = Date.now();

  if (!vehicleSettingsCache || vehicleSettingsCache.expiresAt <= now) {
    const prisma = await loadPrisma();

    if (!prisma) {
      return fallback;
    }

    try {
      const rows = await prisma.vehicleRoutingProfile.findMany();
      vehicleSettingsCache = {
        expiresAt: now + PROFILE_CACHE_TTL_MS,
        value: new Map(
          rows.map((row) => [
            row.vehicleType,
            {
              maxUpwardGradePercent: row.maxUpwardGradePercent,
              minGradedSegmentMeters: row.minGradedSegmentMeters,
              enforceGradeGate: row.enforceGradeGate,
            },
          ]),
        ),
      };
    } catch (error) {
      if (isMissingTableError(error)) {
        return fallback;
      }

      throw error;
    }
  }

  return vehicleSettingsCache.value.get(vehicleType) ?? fallback;
}

async function readCachedProfile(polylineHash: string): Promise<TerrainProfile | null> {
  const prisma = await loadPrisma();

  if (!prisma) return null;

  try {
    const row = await prisma.routeTerrainProfile.findUnique({ where: { polylineHash } });

    if (!row) return null;

    return {
      sampleCount: row.sampleCount,
      sampleSpacingM: Number(row.sampleSpacingM),
      demResolutionM: Number(row.demResolutionM),
      smoothingWindowM: Number(row.smoothingWindowM),
      elevationGainM: Number(row.elevationGainM),
      elevationLossM: Number(row.elevationLossM),
      maxGradePercent: Number(row.maxGradePercent),
      samples: Array.isArray(row.samples) ? (row.samples as number[]) : [],
    };
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function persistProfile(polylineHash: string, profile: TerrainProfile) {
  const prisma = await loadPrisma();

  if (!prisma) return;

  try {
    await prisma.routeTerrainProfile.create({
      data: {
        polylineHash,
        sampleCount: profile.sampleCount,
        sampleSpacingM: profile.sampleSpacingM,
        demResolutionM: profile.demResolutionM,
        smoothingWindowM: profile.smoothingWindowM,
        elevationGainM: profile.elevationGainM,
        elevationLossM: profile.elevationLossM,
        maxGradePercent: profile.maxGradePercent,
        samples: profile.samples,
        source: "google_elevation",
      },
    });
  } catch (error) {
    // A duplicate hash means a concurrent request already stored it, which is
    // fine. Anything else is not worth failing a quote over either.
    if (!isMissingTableError(error)) {
      console.warn("[terrain] could not persist profile", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export interface RouteTerrainResult {
  verdict: GradeVerdict;
  /** True when the gate is armed for this vehicle AND the grade exceeded it. */
  shouldBlock: boolean;
  profile: TerrainProfile | null;
}

/**
 * Measures a route's terrain and says what the gate would decide.
 *
 * `shouldBlock` is only ever true when an admin has explicitly armed the gate
 * for that vehicle type. Until then this reports and logs, which is the whole
 * point of the shadow period: the seeded thresholds were reasoned about a ~30 m
 * DEM, and Google serves ~153 m over Basey, so they need calibrating against
 * real trips before they are allowed to refuse one.
 */
export async function evaluateRouteTerrain(
  polyline: string | null,
  vehicleType: VehicleType | null,
): Promise<RouteTerrainResult> {
  const unchecked: RouteTerrainResult = {
    verdict: gradeVerdictFor(null, null),
    shouldBlock: false,
    profile: null,
  };

  if (!polyline || !isTerrainProfilingEnabled()) {
    return unchecked;
  }

  const settings = await getVehicleGradeSettings(vehicleType);

  if (!settings) {
    return unchecked;
  }

  const polylineHash = hashPolyline(polyline);

  let profile: TerrainProfile | null = null;

  try {
    profile = await readCachedProfile(polylineHash);
  } catch (error) {
    console.warn("[terrain] cache read failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!profile) {
    profile = await fetchTerrainProfile(polyline, {
      minSegmentMeters: settings.minGradedSegmentMeters,
    });

    if (profile) {
      await persistProfile(polylineHash, profile);
    }
  }

  const verdict = gradeVerdictFor(profile, settings.maxUpwardGradePercent);
  const shouldBlock = settings.enforceGradeGate && verdict.exceedsThreshold;

  if (verdict.checked && verdict.exceedsThreshold) {
    // Logged whether or not it is enforced: during the shadow period these
    // lines ARE the calibration evidence.
    console.info("[terrain] grade-over-threshold", {
      vehicleType,
      maxGradePercent: verdict.maxGradePercent,
      thresholdPercent: verdict.thresholdPercent,
      demResolutionM: verdict.demResolutionM,
      enforced: shouldBlock,
    });
  }

  return { verdict, shouldBlock, profile };
}
