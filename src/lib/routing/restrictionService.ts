import type { VehicleType } from "@prisma/client";

import { decodePolyline } from "@/lib/routeUtils";
import type { Coordinates } from "./providers/base";

/**
 * Admin corrections to the road network.
 *
 * OpenStreetMap coverage in Basey is the ceiling on every routing engine, and
 * no engine knows a ford floods each rainy season or that a bridge is out. This
 * is how that local knowledge reaches routing — applied per request, so an edit
 * is live immediately with no tile rebuild and no deploy.
 *
 * Not every engine can honour every shape. Valhalla takes polygons and points
 * as request parameters; ORS takes polygons only; Google Routes has no polygon
 * avoidance at all. Where an engine cannot enforce a restriction the route is
 * post-filtered instead, which is the honest fallback: better to reject a route
 * that crosses a closure than to quote it as if the closure were not there.
 */

const RESTRICTION_CACHE_TTL_MS = 120_000;

export interface RoadRestriction {
  id: string;
  name: string;
  kind: string;
  geometryType: "POLYGON" | "POINT" | "OSM_WAY";
  geometry: unknown;
  appliesTo: VehicleType[];
  note: string | null;
  updatedAt: Date;
}

let restrictionCache: {
  value: RoadRestriction[];
  expiresAt: number;
} | null = null;

export function invalidateRestrictionCache() {
  restrictionCache = null;
}

async function loadPrisma() {
  if (!process.env.DATABASE_URL) return null;
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes("p2021") ||
    message.includes("road_restriction_overrides") ||
    message.includes("roadrestrictionoverride")
  );
}

/** Active restrictions, cached. Empty when the table is not migrated yet. */
export async function getActiveRestrictions(now = new Date()): Promise<RoadRestriction[]> {
  if (restrictionCache && restrictionCache.expiresAt > now.getTime()) {
    return restrictionCache.value;
  }

  const prisma = await loadPrisma();

  if (!prisma) return [];

  try {
    const rows = await prisma.roadRestrictionOverride.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
        ],
      },
      select: {
        id: true,
        name: true,
        kind: true,
        geometryType: true,
        geometry: true,
        appliesTo: true,
        note: true,
        updatedAt: true,
      },
    });

    restrictionCache = {
      value: rows as RoadRestriction[],
      expiresAt: now.getTime() + RESTRICTION_CACHE_TTL_MS,
    };

    return restrictionCache.value;
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

/** Restrictions that bind this vehicle. An empty appliesTo means all of them. */
export function restrictionsForVehicle(
  restrictions: RoadRestriction[],
  vehicleType: VehicleType | null,
): RoadRestriction[] {
  return restrictions.filter(
    (restriction) =>
      restriction.appliesTo.length === 0 ||
      (vehicleType != null && restriction.appliesTo.includes(vehicleType)),
  );
}

/**
 * A version token for the active set.
 *
 * Folded into the route cache key so an admin edit invalidates cached routes
 * even before the two-minute service cache expires — a closure that is live in
 * the database but not in a cached quote is exactly the failure this layer
 * exists to prevent.
 */
export function restrictionsVersion(restrictions: RoadRestriction[]): string {
  if (restrictions.length === 0) return "0";

  const newest = Math.max(...restrictions.map((r) => r.updatedAt.getTime()));
  return `${restrictions.length}-${newest}`;
}

type Ring = Array<[number, number]>;

/** GeoJSON Polygon coordinates are [lng, lat]; Valhalla wants {lat, lon}. */
export function toExcludePolygons(restrictions: RoadRestriction[]): Array<Array<[number, number]>> {
  const polygons: Array<Array<[number, number]>> = [];

  for (const restriction of restrictions) {
    if (restriction.geometryType !== "POLYGON") continue;

    const geometry = restriction.geometry as { coordinates?: Ring[] } | null;
    const outerRing = geometry?.coordinates?.[0];

    if (Array.isArray(outerRing) && outerRing.length >= 3) {
      polygons.push(outerRing);
    }
  }

  return polygons;
}

export function toExcludeLocations(restrictions: RoadRestriction[]): Coordinates[] {
  const points: Coordinates[] = [];

  for (const restriction of restrictions) {
    if (restriction.geometryType !== "POINT") continue;

    const geometry = restriction.geometry as { lat?: number; lng?: number } | null;

    if (typeof geometry?.lat === "number" && typeof geometry?.lng === "number") {
      points.push({ lat: geometry.lat, lng: geometry.lng });
    }
  }

  return points;
}

/** Ray-casting point-in-polygon over a [lng, lat] ring. */
function isPointInRing(point: Coordinates, ring: Ring): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const straddles = yi > point.lat !== yj > point.lat;
    if (!straddles) continue;

    const xIntersect = ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (point.lng < xIntersect) inside = !inside;
  }

  return inside;
}

/**
 * Names the restriction a route runs through, or null.
 *
 * The fallback for engines that cannot be told to avoid an area — Google Routes
 * has no polygon avoidance, and ORS cannot take points or way ids. Checking the
 * returned shape is coarser than routing around the closure, but it is honest:
 * the alternative is quoting a fare over a road an admin has marked impassable.
 */
export function findViolatedRestriction(
  polyline: string | null,
  restrictions: RoadRestriction[],
): RoadRestriction | null {
  if (!polyline) return null;

  const polygonRestrictions = restrictions.filter((r) => r.geometryType === "POLYGON");

  if (polygonRestrictions.length === 0) return null;

  const vertices = decodePolyline(polyline);

  for (const restriction of polygonRestrictions) {
    const geometry = restriction.geometry as { coordinates?: Ring[] } | null;
    const outerRing = geometry?.coordinates?.[0];

    if (!Array.isArray(outerRing) || outerRing.length < 3) continue;

    for (const [lat, lng] of vertices) {
      if (isPointInRing({ lat, lng }, outerRing)) {
        return restriction;
      }
    }
  }

  return null;
}
