import type { VehicleType } from "@prisma/client";

import type { Coordinates } from "./providers/base";
import type { ShortestRoadRouteResult } from "./types";

/**
 * The curated corpus: distances somebody measured between two saved places.
 *
 * This is the top resolution tier for a fare quote. Every routing engine we
 * could run is limited by OSM coverage in Basey, and a distance a driver
 * actually drove beats all of them. Keyed by vehicle type, because the
 * habal-habal shortcut and the tricycle road between the same two barangays are
 * different distances — that is the whole point of this work.
 */

const CURATED_ROUTE_CACHE_TTL_MS = 120_000;
const CURATED_ROUTE_CACHE_MAX_ENTRIES = 400;

/** Cached lookups, including misses — a miss is the common case and worth caching. */
const curatedRouteCache = new Map<
  string,
  { expiresAt: number; value: CuratedRouteRecord | null }
>();

export interface CuratedRouteRecord {
  id: string;
  distanceMeters: number;
  durationSeconds: number | null;
  polyline: string | null;
  /** True when the stored row was for the opposite direction of travel. */
  reversed: boolean;
  needsSurvey: boolean;
  source: string;
}

export interface CuratedRouteLookup {
  originLocationId: string;
  destinationLocationId: string;
  vehicleType: VehicleType | null;
}

function buildCacheKey(lookup: CuratedRouteLookup): string {
  return [
    lookup.originLocationId,
    lookup.destinationLocationId,
    lookup.vehicleType ?? "any",
  ].join(":");
}

/**
 * Drops every cached lookup.
 *
 * Called from the admin write path. A curated distance sets a fare, so an edit
 * has to take effect now rather than up to two minutes from now.
 */
export function invalidateCuratedRouteCache() {
  curatedRouteCache.clear();
}

function readCache(key: string): { hit: true; value: CuratedRouteRecord | null } | { hit: false } {
  const cached = curatedRouteCache.get(key);

  if (!cached) {
    return { hit: false };
  }

  if (cached.expiresAt <= Date.now()) {
    curatedRouteCache.delete(key);
    return { hit: false };
  }

  return { hit: true, value: cached.value };
}

function writeCache(key: string, value: CuratedRouteRecord | null) {
  if (curatedRouteCache.has(key)) {
    curatedRouteCache.delete(key);
  }

  curatedRouteCache.set(key, {
    expiresAt: Date.now() + CURATED_ROUTE_CACHE_TTL_MS,
    value,
  });

  while (curatedRouteCache.size > CURATED_ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = curatedRouteCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    curatedRouteCache.delete(oldestKey);
  }
}

async function loadPrisma() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

/**
 * True when the failure is "this table does not exist yet".
 *
 * The corpus is additive: before its migration runs, a quote must fall through
 * to the routing engines rather than 500. Mirrors the same tolerance in
 * settingsService.
 */
function isCuratedRouteTableMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("curated_route_distances") ||
    message.includes("curatedroutedistance")
  );
}

/**
 * Finds a surveyed distance for this trip, or null.
 *
 * A row stored in the opposite direction only answers when its surveyor marked
 * it bidirectional. Basey has one-ways, so the reverse of a measured route is
 * not automatically the same distance.
 */
export async function findCuratedRoute(
  lookup: CuratedRouteLookup,
): Promise<CuratedRouteRecord | null> {
  // A quote with no vehicle context has no business consuming a distance
  // measured for a specific vehicle.
  if (!lookup.vehicleType) {
    return null;
  }

  const cacheKey = buildCacheKey(lookup);
  const cached = readCache(cacheKey);

  if (cached.hit) {
    return cached.value;
  }

  const prisma = await loadPrisma();

  if (!prisma) {
    return null;
  }

  let record: CuratedRouteRecord | null = null;

  try {
    const rows = await prisma.curatedRouteDistance.findMany({
      where: {
        isActive: true,
        vehicleType: lookup.vehicleType,
        OR: [
          {
            originLocationId: lookup.originLocationId,
            destinationLocationId: lookup.destinationLocationId,
          },
          {
            isBidirectional: true,
            originLocationId: lookup.destinationLocationId,
            destinationLocationId: lookup.originLocationId,
          },
        ],
      },
      select: {
        id: true,
        originLocationId: true,
        distanceMeters: true,
        durationSeconds: true,
        polyline: true,
        needsSurvey: true,
        source: true,
      },
    });

    // At most two rows can match — the forward row and a bidirectional reverse
    // row. Prefer the one measured in the direction actually being travelled.
    const forward = rows.find((row) => row.originLocationId === lookup.originLocationId);
    const chosen = forward ?? rows[0];

    record = chosen
      ? {
          id: chosen.id,
          distanceMeters: chosen.distanceMeters,
          durationSeconds: chosen.durationSeconds,
          polyline: chosen.polyline,
          reversed: chosen.originLocationId !== lookup.originLocationId,
          needsSurvey: chosen.needsSurvey,
          source: chosen.source,
        }
      : null;
  } catch (error) {
    if (isCuratedRouteTableMissingError(error)) {
      return null;
    }

    throw error;
  }

  writeCache(cacheKey, record);
  return record;
}

/**
 * Shapes a curated record as a route result the fare path can price.
 *
 * Origin and destination are reported as their own snapped points. That is not
 * a fiction: the surveyed route begins and ends at these saved places, so the
 * ride-access guard should judge them on the places' own recorded access — the
 * `Location.vehicleAccess` flag it already reads — not on a snap that no
 * provider performed.
 *
 * A reversed row keeps its distance but drops its polyline, because the drawn
 * line would run backwards and Basey's one-ways mean the return path is not
 * necessarily the same road.
 */
export function curatedRouteToResult(
  record: CuratedRouteRecord,
  origin: Coordinates,
  destination: Coordinates,
): ShortestRoadRouteResult {
  const distanceKm = record.distanceMeters / 1000;

  return {
    distanceKm,
    durationMin: record.durationSeconds == null ? null : record.durationSeconds / 60,
    distanceMeters: record.distanceMeters,
    durationSeconds: record.durationSeconds,
    polyline: record.reversed ? null : record.polyline,
    method: "curated",
    provider: "curated",
    isEstimate: false,
    fallbackReason: null,
    snappedOrigin: { ...origin, wasSnapped: false },
    snappedDestination: { ...destination, wasSnapped: false },
    diagnostics: {
      provider: "curated",
      routeFound: true,
      isEstimate: false,
      errorCode: null,
      errorMessage: null,
    },
  };
}
