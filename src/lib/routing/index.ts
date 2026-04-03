import type { RouteResult } from "./types";
import type { Coordinates } from "./providers/base";
import { OrsProvider } from "./providers/ors";
import { GpsProvider } from "./providers/gps";

export type { RouteResult } from "./types";
export type { Coordinates } from "./providers/base";

const gps = new GpsProvider();
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const ROUTE_CACHE_MAX_ENTRIES = 200;
const DEFAULT_ORS_TIMEOUT_MS = 3500;
const ROUTE_CACHE_PRECISION = 4;

const orsRouteCache = new Map<string, { expiresAt: number; value: RouteResult }>();

function cloneRouteResult(route: RouteResult): RouteResult {
  return {
    ...route,
    snappedOrigin: route.snappedOrigin ? { ...route.snappedOrigin } : null,
    snappedDestination: route.snappedDestination ? { ...route.snappedDestination } : null,
  };
}

function normalizeCoordinate(value: number): string {
  return value.toFixed(ROUTE_CACHE_PRECISION);
}

function buildRouteCacheKey(origin: Coordinates, destination: Coordinates): string {
  return [
    normalizeCoordinate(origin.lat),
    normalizeCoordinate(origin.lng),
    normalizeCoordinate(destination.lat),
    normalizeCoordinate(destination.lng),
  ].join(":");
}

function getConfiguredOrsTimeoutMs(): number {
  const rawValue = process.env.ROUTING_ORS_TIMEOUT_MS;
  const parsed = Number.parseInt(rawValue ?? String(DEFAULT_ORS_TIMEOUT_MS), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ORS_TIMEOUT_MS;
  }

  return parsed;
}

function getCachedRoute(cacheKey: string): RouteResult | null {
  const cached = orsRouteCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    orsRouteCache.delete(cacheKey);
    return null;
  }

  return cloneRouteResult(cached.value);
}

function cacheRoute(cacheKey: string, route: RouteResult) {
  if (orsRouteCache.has(cacheKey)) {
    orsRouteCache.delete(cacheKey);
  }

  orsRouteCache.set(cacheKey, {
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
    value: cloneRouteResult(route),
  });

  while (orsRouteCache.size > ROUTE_CACHE_MAX_ENTRIES) {
    const oldestKey = orsRouteCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    orsRouteCache.delete(oldestKey);
  }
}

/**
 * Calculate a route between two coordinates.
 * Tries ORS first; falls back to GPS/Haversine if ORS is unavailable or errors.
 */
export async function calculateRouteWithFallback(
  origin: Coordinates,
  destination: Coordinates
): Promise<RouteResult> {
  const timeoutMs = getConfiguredOrsTimeoutMs();
  const cacheKey = buildRouteCacheKey(origin, destination);
  const cachedRoute = getCachedRoute(cacheKey);

  if (cachedRoute) {
    console.info("[routing] cache-hit", {
      cacheHit: true,
      orsDurationMs: 0,
      timeoutMs,
      method: cachedRoute.method,
      fallbackReason: cachedRoute.fallbackReason,
    });

    return cachedRoute;
  }

  const orsStartedAt = Date.now();

  try {
    const ors = new OrsProvider(timeoutMs);
    const route = await ors.calculate(origin, destination);
    const orsDurationMs = Date.now() - orsStartedAt;

    cacheRoute(cacheKey, route);
    console.info("[routing] ors-success", {
      cacheHit: false,
      orsDurationMs,
      timeoutMs,
      method: route.method,
      fallbackReason: route.fallbackReason,
    });

    return route;
  } catch (orsError) {
    const orsDurationMs = Date.now() - orsStartedAt;
    const fallbackReason =
      orsError instanceof Error ? orsError.message : String(orsError);

    console.warn("[routing] ors-fallback", {
      cacheHit: false,
      orsDurationMs,
      timeoutMs,
      method: "gps",
      fallbackReason,
    });

    const gpsResult = await gps.calculate(origin, destination);
    return {
      ...gpsResult,
      fallbackReason,
    };
  }
}
