import type { Feature, FeatureCollection, LineString, Point, Position } from "geojson";

import { haversineKm } from "./geo";
import type { Coordinates } from "./providers/base";

const ROADS_URL = "/data/basey-roads.geojson";
/** Reject snaps further than this from the network (mirrors MAX_SNAP_DISTANCE_M). */
const MAX_SNAP_M = 200;
/** Single average road speed for offline duration estimates. */
const AVG_SPEED_KMH = 30;

export interface OfflineGraphRoute {
  distanceKm: number;
  /** Route geometry as [lat, lng] pairs. */
  coords: [number, number][];
  durationMin: number;
}

interface Router {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pf: { findPath: (a: Feature<Point>, b: Feature<Point>) => { path: Position[] } | undefined };
  vertices: Position[];
}

let routerPromise: Promise<Router | null> | null = null;

/** Lazy-build the PathFinder + vertex index once, then reuse. */
async function getRouter(): Promise<Router | null> {
  if (!routerPromise) {
    routerPromise = (async () => {
      try {
        const [{ default: PathFinder }, res] = await Promise.all([
          import("geojson-path-finder"),
          fetch(ROADS_URL),
        ]);
        if (!res.ok) return null;
        const geojson = (await res.json()) as FeatureCollection<LineString>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pf = new PathFinder(geojson as any) as any;
        const vertices = Object.values(pf.graph.sourceCoordinates) as Position[];
        if (vertices.length === 0) return null;
        return { pf, vertices };
      } catch {
        return null;
      }
    })();
  }
  return routerPromise;
}

function nearestVertex(
  vertices: Position[],
  lat: number,
  lng: number,
): { coord: Position; km: number } | null {
  let best: Position | null = null;
  let bestKm = Infinity;
  for (const v of vertices) {
    const km = haversineKm({ lat, lng }, { lat: v[1], lng: v[0] });
    if (km < bestKm) {
      bestKm = km;
      best = v;
    }
  }
  return best ? { coord: best, km: bestKm } : null;
}

function asPoint(coord: Position): Feature<Point> {
  return { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: coord } };
}

/**
 * Route between two coordinates using the bundled Basey road graph, entirely
 * on-device. Returns null when the graph is unavailable, a pin is off-network
 * (> MAX_SNAP_M from any road), or no path exists — caller then falls back to
 * the straight-line heuristic.
 */
export async function routeOffline(
  origin: Coordinates,
  destination: Coordinates,
): Promise<OfflineGraphRoute | null> {
  const router = await getRouter();
  if (!router) return null;

  const o = nearestVertex(router.vertices, origin.lat, origin.lng);
  const d = nearestVertex(router.vertices, destination.lat, destination.lng);
  if (!o || !d) return null;
  if (o.km * 1000 > MAX_SNAP_M || d.km * 1000 > MAX_SNAP_M) return null;

  const result = router.pf.findPath(asPoint(o.coord), asPoint(d.coord));
  if (!result || result.path.length < 2) return null;

  // [lng,lat] -> [lat,lng]
  const coords = result.path.map((p) => [p[1], p[0]] as [number, number]);

  let distanceKm = 0;
  for (let i = 1; i < coords.length; i++) {
    distanceKm += haversineKm(
      { lat: coords[i - 1][0], lng: coords[i - 1][1] },
      { lat: coords[i][0], lng: coords[i][1] },
    );
  }

  return {
    distanceKm,
    coords,
    durationMin: (distanceKm / AVG_SPEED_KMH) * 60,
  };
}
