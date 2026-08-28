import { OrsProvider } from "./providers/ors";
import { resolveNearestRoad } from "./providers/googleRoads";
import type { Coordinates } from "./providers/base";
import { approxMeters } from "./geo";
import { resolvePinLabel } from "@/lib/locations/pinLabelResolver";
import {
  RoutingServiceError,
  type AccessPolicy,
  type DropoffSuggestion,
  type RouteField,
  type SnappedPoint,
  type VehicleAccessVerdict,
} from "./types";
import type { PlaceVehicleAccess } from "@/lib/contracts";

/**
 * Beyond this distance from the drivable road network, a point is not on a
 * road a habal-habal or tricycle can use. Basey's tricycle-passable alleys are
 * mapped as `highway=residential`/`service`, so a driving snap this far out
 * means the provider gave up and jumped to the nearest through road.
 */
export const VEHICLE_ACCESS_LIMIT_M = 80;

/** Beyond this, there is no usable road at all — not merely a walking tail. */
export const MAX_ROAD_SNAP_M = 200;

/** A foot route longer than this is a detour, not a short walk to a gate. */
const MAX_PLAUSIBLE_WALK_M = 1_500;

const VERDICT_CACHE_TTL_MS = 5 * 60 * 1000;
const VERDICT_CACHE_MAX_ENTRIES = 200;
const VERDICT_CACHE_PRECISION = 4;

const DEFAULT_FOOT_PROBE_TIMEOUT_MS = 3500;

const verdictCache = new Map<
  string,
  { expiresAt: number; value: VehicleAccessVerdict }
>();

/** Curated access facts read off a saved Location row. */
export interface CuratedAccess {
  vehicleAccess: PlaceVehicleAccess;
  dropoff: Coordinates | null;
  /** Name of the saved place, used to label its drop-off. */
  label: string;
}

export interface VerifyVehicleAccessArgs {
  field: RouteField;
  /** What the coordinate stands for. Decides whether a far snap is a problem. */
  policy: AccessPolicy;
  /** The coordinate the rider actually asked for. */
  requested: Coordinates;
  /** Rider-facing name for the requested coordinate. */
  label: string;
  /** Where the road provider snapped the request to. */
  snapped: SnappedPoint | null;
  /** Set when the request came from a saved location. */
  curated: CuratedAccess | null;
}

function getFootProbeTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.ROUTING_ORS_TIMEOUT_MS ?? String(DEFAULT_FOOT_PROBE_TIMEOUT_MS),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_FOOT_PROBE_TIMEOUT_MS;
}

function normalize(value: number): string {
  return value.toFixed(VERDICT_CACHE_PRECISION);
}

function buildVerdictCacheKey(
  requested: Coordinates,
  snapped: Coordinates,
): string {
  return [
    "vehicle-access",
    normalize(requested.lat),
    normalize(requested.lng),
    normalize(snapped.lat),
    normalize(snapped.lng),
  ].join(":");
}

function readVerdictCache(key: string): VehicleAccessVerdict | null {
  const cached = verdictCache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    verdictCache.delete(key);
    return null;
  }

  return cached.value;
}

function writeVerdictCache(key: string, value: VehicleAccessVerdict) {
  verdictCache.delete(key);
  verdictCache.set(key, { expiresAt: Date.now() + VERDICT_CACHE_TTL_MS, value });

  while (verdictCache.size > VERDICT_CACHE_MAX_ENTRIES) {
    const oldestKey = verdictCache.keys().next().value;
    if (!oldestKey) break;
    verdictCache.delete(oldestKey);
  }
}

export function clearVehicleAccessCache() {
  verdictCache.clear();
}

/**
 * The verdict is cached per (requested, snapped) pair, but the field it applies
 * to is not — the same coordinate can be an origin on one request and a
 * destination on the next.
 */
function withField(
  verdict: VehicleAccessVerdict,
  field: RouteField,
): VehicleAccessVerdict {
  return verdict.status === "reachable" ? verdict : { ...verdict, field };
}

/** Names the road point a rider is being sent to when we found it ourselves. */
function describeRoadPoint(point: Coordinates): string {
  const resolved = resolvePinLabel(point.lat, point.lng);
  return resolved.barangayName
    ? `the nearest road in ${resolved.barangayName}`
    : "the nearest road";
}

/**
 * Decides whether a requested point sits on the road network a habal-habal or
 * tricycle can use.
 *
 * The check fails closed on purpose. Road snapping is best-effort in both
 * providers, and a missing snapped point used to skip the guard entirely; here
 * it is treated as unreachable, because quoting a fare to a point we could not
 * verify is the failure this guard exists to prevent.
 */
export async function verifyVehicleAccess(
  args: VerifyVehicleAccessArgs,
): Promise<VehicleAccessVerdict> {
  const { field, policy, requested, label, snapped, curated } = args;

  // A vetted place is trusted outright — no probe, no per-request API call.
  if (curated?.vehicleAccess === "VEHICLE_ACCESSIBLE") {
    return { status: "reachable" };
  }

  if (curated?.vehicleAccess === "WALK_ONLY" && curated.dropoff) {
    return {
      status: "walk_only",
      field,
      snapMeters: Math.round(approxMeters(requested, curated.dropoff)),
      dropoff: {
        lat: curated.dropoff.lat,
        lng: curated.dropoff.lng,
        label: `${curated.label} drop-off`,
        walkMeters: Math.round(approxMeters(curated.dropoff, requested)),
        source: "curated",
      },
    };
  }

  if (!snapped) {
    return { status: "no_road", field, snapMeters: Number.POSITIVE_INFINITY };
  }

  let snapMeters = Math.round(approxMeters(requested, snapped));
  let nearestRoad: Coordinates = snapped;

  if (snapMeters <= VEHICLE_ACCESS_LIMIT_M) {
    return { status: "reachable" };
  }

  // The routing providers snap within 5 km, because Basey's barangay
  // coordinates are polygon centroids. At that radius a snap can jump to an
  // unrelated through road and make a place look detached when a usable road
  // runs past it. Roads answers the narrower question, and is only ever taken
  // when its answer is closer — so a gap in Google's rural coverage can cost a
  // missed improvement, never a wrongly refused trip.
  const roadsSnap = await resolveNearestRoad(requested, snapMeters);

  if (roadsSnap) {
    snapMeters = roadsSnap.meters;
    nearestRoad = roadsSnap.coordinate;

    if (snapMeters <= VEHICLE_ACCESS_LIMIT_M) {
      return { status: "reachable" };
    }
  }

  if (snapMeters > MAX_ROAD_SNAP_M && policy === "doorstep") {
    return { status: "no_road", field, snapMeters };
  }

  const roadPoint: DropoffSuggestion = {
    lat: nearestRoad.lat,
    lng: nearestRoad.lng,
    label: describeRoadPoint(nearestRoad),
    walkMeters: snapMeters,
    source: "road_snap",
  };

  // An area point is a centroid, not a doorstep. The caller reports the walk
  // rather than refusing the trip, so the extra foot probe would buy nothing —
  // and at 36 barangays it would double the provider calls on ordinary quotes.
  if (policy === "area") {
    return { status: "walk_only", field, snapMeters, dropoff: roadPoint };
  }

  const cacheKey = buildVerdictCacheKey(requested, nearestRoad);
  const cached = readVerdictCache(cacheKey);
  if (cached) {
    return withField(cached, field);
  }

  let verdict: VehicleAccessVerdict;

  try {
    const foot = await new OrsProvider(getFootProbeTimeoutMs()).calculateWalking(
      { lat: nearestRoad.lat, lng: nearestRoad.lng },
      requested,
    );
    const walkMeters = Math.round(foot.distanceMeters);

    verdict = {
      status: "walk_only",
      field,
      snapMeters,
      dropoff:
        walkMeters > 0 && walkMeters <= MAX_PLAUSIBLE_WALK_M
          ? { ...roadPoint, walkMeters, source: "foot_probe" }
          : roadPoint,
    };
  } catch (error) {
    // No footpath either: the point is detached from every network, so send the
    // rider the "move the pin" message rather than offering a walk.
    if (
      error instanceof RoutingServiceError &&
      error.code === "NO_ROAD_ROUTE_FOUND"
    ) {
      verdict = { status: "no_road", field, snapMeters };
    } else {
      // The probe only sharpens the wording. A timeout or a missing API key
      // must never turn a blocked trip into a quoted one.
      console.warn("[vehicleAccess] foot probe unavailable", {
        field,
        label,
        snapMeters,
        message: error instanceof Error ? error.message : String(error),
      });
      verdict = { status: "walk_only", field, snapMeters, dropoff: roadPoint };
    }
  }

  writeVerdictCache(cacheKey, verdict);
  return verdict;
}
