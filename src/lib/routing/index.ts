import {
  RoutingServiceError,
  type RouteResult,
  type ShortestRoadRouteResult,
  type RoutingFailureReason,
} from "./types";
import type { Coordinates } from "./providers/base";
import { OrsProvider } from "./providers/ors";
import { GoogleRoutesProvider } from "./providers/googleRoutes";
import { GpsProvider } from "./providers/gps";

export type { RouteResult } from "./types";
export type { Coordinates } from "./providers/base";

const gps = new GpsProvider();
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const ROUTE_CACHE_MAX_ENTRIES = 200;
const DEFAULT_ORS_TIMEOUT_MS = 3500;
const DEFAULT_GOOGLE_ROUTES_TIMEOUT_MS = 3500;
const ROUTE_CACHE_PRECISION = 4;

type RouteCacheMode = "fallback" | "shortest-road";

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

function buildRouteCacheKey(
  origin: Coordinates,
  destination: Coordinates,
  mode: RouteCacheMode,
): string {
  return [
    mode,
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

function getConfiguredGoogleRoutesTimeoutMs(): number {
  const rawValue = process.env.ROUTING_GOOGLE_ROUTES_TIMEOUT_MS;
  const parsed = Number.parseInt(rawValue ?? String(DEFAULT_GOOGLE_ROUTES_TIMEOUT_MS), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_GOOGLE_ROUTES_TIMEOUT_MS;
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

function toRoutingServiceError(error: unknown): RoutingServiceError {
  if (error instanceof RoutingServiceError) {
    return error;
  }

  return new RoutingServiceError(
    "ROUTING_SERVICE_UNAVAILABLE",
    error instanceof Error ? error.message : String(error),
    {
      provider: "ors",
      reason: "upstream_error",
    },
  );
}

function buildRouteVerificationFailure(
  errors: RoutingServiceError[],
): RoutingServiceError {
  const verificationErrors = errors.filter(
    (error) => error.code === "NO_ROAD_ROUTE_FOUND" || error.code === "ROUTE_UNVERIFIED",
  );
  const shouldUseNoRouteStatus = verificationErrors.length === errors.length;
  const reason: RoutingFailureReason = shouldUseNoRouteStatus ? "no_route_found" : errors[errors.length - 1]?.reason ?? "upstream_error";
  const detail = errors
    .map((error) => `${error.provider}:${error.code}:${error.message}`)
    .join(" | ");

  return new RoutingServiceError(
    "ROUTE_UNVERIFIED",
    `Route could not be verified by the available road-routing providers. ${detail}`,
    {
      provider: errors[errors.length - 1]?.provider ?? "ors",
      reason,
      status: shouldUseNoRouteStatus ? 422 : 503,
    },
  );
}

function applyFallbackMetadata(route: RouteResult, fallbackReason: string): RouteResult {
  return {
    ...route,
    fallbackReason,
    diagnostics: {
      ...route.diagnostics,
      errorMessage: fallbackReason,
    },
  };
}

async function tryGoogleRoutes(
  origin: Coordinates,
  destination: Coordinates,
  timeoutMs: number,
): Promise<ShortestRoadRouteResult> {
  const googleRoutes = new GoogleRoutesProvider(timeoutMs);
  return googleRoutes.calculateShortest(origin, destination);
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
  const googleTimeoutMs = getConfiguredGoogleRoutesTimeoutMs();
  const cacheKey = buildRouteCacheKey(origin, destination, "fallback");
  const cachedRoute = getCachedRoute(cacheKey);

  if (cachedRoute) {
    console.info("[routing] cache-hit", {
      cacheHit: true,
      orsDurationMs: 0,
      timeoutMs,
      googleTimeoutMs,
      method: cachedRoute.method,
      fallbackReason: cachedRoute.fallbackReason,
    });

    return cachedRoute;
  }

  const orsStartedAt = Date.now();
  const fallbackErrors: RoutingServiceError[] = [];

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
    const typedError = toRoutingServiceError(orsError);
    fallbackErrors.push(typedError);
    const orsDurationMs = Date.now() - orsStartedAt;

    console.warn("[routing] ors-google-fallback", {
      cacheHit: false,
      orsDurationMs,
      timeoutMs,
      googleTimeoutMs,
      method: "google_routes",
      provider: "ors",
      outcome: typedError.code,
      reason: typedError.reason,
      fallbackReason: typedError.message,
    });

    const googleStartedAt = Date.now();

    try {
      const route = await tryGoogleRoutes(origin, destination, googleTimeoutMs);
      const googleDurationMs = Date.now() - googleStartedAt;
      const fallbackReason = `${typedError.provider} fallback: ${typedError.message}`;
      const routeWithFallback = applyFallbackMetadata(route, fallbackReason);

      cacheRoute(cacheKey, routeWithFallback);
      console.info("[routing] google-routes-success", {
        cacheHit: false,
        orsDurationMs,
        googleDurationMs,
        timeoutMs,
        googleTimeoutMs,
        method: route.method,
        fallbackReason,
      });

      return routeWithFallback;
    } catch (googleError) {
      const typedGoogleError = toRoutingServiceError(googleError);
      fallbackErrors.push(typedGoogleError);
      const fallbackReason = buildRouteVerificationFailure(fallbackErrors).message;

      console.warn("[routing] google-gps-fallback", {
        cacheHit: false,
        orsDurationMs,
        googleDurationMs: Date.now() - googleStartedAt,
        timeoutMs,
        googleTimeoutMs,
        method: "gps",
        provider: typedGoogleError.provider,
        outcome: typedGoogleError.code,
        reason: typedGoogleError.reason,
        fallbackReason,
      });

      const gpsResult = await gps.calculate(origin, destination);
      return applyFallbackMetadata(gpsResult, fallbackReason);
    }
  }
}

export async function calculateShortestRoadRoute(
  origin: Coordinates,
  destination: Coordinates,
): Promise<ShortestRoadRouteResult> {
  const timeoutMs = getConfiguredOrsTimeoutMs();
  const googleTimeoutMs = getConfiguredGoogleRoutesTimeoutMs();
  const cacheKey = buildRouteCacheKey(origin, destination, "shortest-road");
  const cachedRoute = getCachedRoute(cacheKey);

  if (cachedRoute) {
    console.info("[routing] shortest-road-cache-hit", {
      cacheHit: true,
      provider: cachedRoute.provider,
      isEstimate: cachedRoute.isEstimate,
      orsDurationMs: 0,
      timeoutMs,
      googleTimeoutMs,
    });

    return cachedRoute as ShortestRoadRouteResult;
  }

  const orsStartedAt = Date.now();
  const verificationErrors: RoutingServiceError[] = [];

  try {
    const ors = new OrsProvider(timeoutMs);
    const route = await ors.calculateShortest(origin, destination);
    const orsDurationMs = Date.now() - orsStartedAt;

    cacheRoute(cacheKey, route);
    console.info("[routing] shortest-road-success", {
      cacheHit: false,
      provider: route.provider,
      isEstimate: route.isEstimate,
      orsDurationMs,
      timeoutMs,
      outcome: "success",
    });

    return route;
  } catch (orsError) {
    const typedError = toRoutingServiceError(orsError);
    verificationErrors.push(typedError);
    const orsDurationMs = Date.now() - orsStartedAt;

    console.warn("[routing] shortest-road-ors-failure", {
      cacheHit: false,
      provider: typedError.provider,
      isEstimate: false,
      orsDurationMs,
      timeoutMs,
      googleTimeoutMs,
      outcome: typedError.code,
      reason: typedError.reason,
      status: typedError.status,
      message: typedError.message,
    });

    const googleStartedAt = Date.now();

    try {
      const route = await tryGoogleRoutes(origin, destination, googleTimeoutMs);
      const googleDurationMs = Date.now() - googleStartedAt;
      const routeWithFallback = applyFallbackMetadata(
        route,
        `${typedError.provider} fallback: ${typedError.message}`,
      );

      cacheRoute(cacheKey, routeWithFallback);
      console.info("[routing] shortest-road-google-success", {
        cacheHit: false,
        provider: route.provider,
        isEstimate: route.isEstimate,
        orsDurationMs,
        googleDurationMs,
        timeoutMs,
        googleTimeoutMs,
        outcome: "success",
      });

      return routeWithFallback as ShortestRoadRouteResult;
    } catch (googleError) {
      const typedGoogleError = toRoutingServiceError(googleError);
      verificationErrors.push(typedGoogleError);
      const routeVerificationError = buildRouteVerificationFailure(verificationErrors);

      console.warn("[routing] shortest-road-route-unverified", {
        cacheHit: false,
        provider: typedGoogleError.provider,
        isEstimate: false,
        orsDurationMs,
        googleDurationMs: Date.now() - googleStartedAt,
        timeoutMs,
        googleTimeoutMs,
        outcome: routeVerificationError.code,
        reason: routeVerificationError.reason,
        status: routeVerificationError.status,
        message: routeVerificationError.message,
      });

      throw routeVerificationError;
    }
  }
}
