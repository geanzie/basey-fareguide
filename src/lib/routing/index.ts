import {
  RoutingServiceError,
  type RouteResult,
  type ShortestRoadRouteResult,
  type RoutingFailureReason,
} from "./types";
import type { VehicleType } from "@prisma/client";

import type { Coordinates, RouteRequestOptions, RoutingProvider } from "./providers/base";
import { OrsProvider } from "./providers/ors";
import { GoogleRoutesProvider } from "./providers/googleRoutes";
import { GpsProvider } from "./providers/gps";
import { ValhallaProvider, isValhallaEnabled } from "./providers/valhalla";
import {
  getResolvedRoutingSettings,
  type RoutingPrimaryProvider,
} from "./settingsService";
import { clearVehicleAccessCache } from "./vehicleAccess";
import { vehicleCacheSegment } from "./vehicleProfiles";
import { curatedRouteToResult, findCuratedRoute } from "./curatedRoutes";
import {
  findViolatedRestriction,
  getActiveRestrictions,
  restrictionsForVehicle,
  restrictionsVersion,
  toExcludeLocations,
  toExcludePolygons,
} from "./restrictionService";

export type { RouteResult } from "./types";
export type { Coordinates, RouteRequestOptions } from "./providers/base";
export {
  findCuratedRoute,
  invalidateCuratedRouteCache,
  curatedRouteToResult,
} from "./curatedRoutes";
export {
  getActiveRestrictions,
  invalidateRestrictionCache,
  restrictionsForVehicle,
} from "./restrictionService";

const gps = new GpsProvider();
const ROUTE_CACHE_TTL_MS = 5 * 60 * 1000;
const ROUTE_CACHE_MAX_ENTRIES = 400;
const DEFAULT_ORS_TIMEOUT_MS = 3500;
const DEFAULT_GOOGLE_ROUTES_TIMEOUT_MS = 3500;
const ROUTE_CACHE_PRECISION = 4;

type RouteCacheMode = "fallback" | "shortest-road";

/** An engine that can be asked for a road route. Not "curated", which is a DB tier. */
export type RoutingEngine = "valhalla" | "ors" | "google_routes";

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
  primaryProvider: RoutingPrimaryProvider,
  options?: RouteRequestOptions,
  restrictionVersion = "0",
): string {
  return [
    mode,
    // An admin closing a road must not keep being quoted around a stale cache
    // entry that predates the closure.
    restrictionVersion,
    // Two vehicle types over the same coordinates are different routes. Without
    // this segment a tricycle quote is served to the next habal-habal asking
    // for the same trip, for the life of the entry.
    vehicleCacheSegment(options?.vehicleType),
    primaryProvider,
    normalizeCoordinate(origin.lat),
    normalizeCoordinate(origin.lng),
    normalizeCoordinate(destination.lat),
    normalizeCoordinate(destination.lng),
  ].join(":");
}

export function clearRoutingCache() {
  orsRouteCache.clear();
  clearVehicleAccessCache();
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
    (error) =>
      error.code === "NO_ROAD_ROUTE_FOUND" ||
      error.code === "ROUTE_UNVERIFIED" ||
      error.code === "NO_ROUTE_FOR_VEHICLE",
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


/**
 * The engines to try, in order.
 *
 * Valhalla only appears when an admin has selected it AND the container is
 * configured, so choosing it before the tiles exist degrades to the cloud
 * providers rather than failing. The cloud pair always backs it up: a
 * self-hosted engine that is down must not take fare quoting down with it.
 */
export function getProviderOrder(
  primaryProvider: RoutingPrimaryProvider,
): RoutingEngine[] {
  if (primaryProvider === "valhalla") {
    return isValhallaEnabled()
      ? ["valhalla", "ors", "google_routes"]
      : ["ors", "google_routes"];
  }

  return primaryProvider === "google_routes"
    ? ["google_routes", "ors"]
    : ["ors", "google_routes"];
}

interface ProviderCallOptions {
  orsTimeoutMs: number;
  googleRoutesTimeoutMs: number;
  routeOptions?: RouteRequestOptions;
}

function instantiateProvider(
  engine: RoutingEngine,
  options: ProviderCallOptions,
): RoutingProvider {
  if (engine === "valhalla") return new ValhallaProvider();
  if (engine === "google_routes") return new GoogleRoutesProvider(options.googleRoutesTimeoutMs);
  return new OrsProvider(options.orsTimeoutMs);
}

async function calculateRouteWithProvider(
  engine: RoutingEngine,
  origin: Coordinates,
  destination: Coordinates,
  options: ProviderCallOptions,
): Promise<RouteResult> {
  return instantiateProvider(engine, options).calculate(
    origin,
    destination,
    options.routeOptions,
  );
}

async function calculateShortestRouteWithProvider(
  engine: RoutingEngine,
  origin: Coordinates,
  destination: Coordinates,
  options: ProviderCallOptions,
): Promise<ShortestRoadRouteResult> {
  const provider = instantiateProvider(engine, options);

  if (!provider.calculateShortest) {
    throw new RoutingServiceError(
      "ROUTING_SERVICE_UNAVAILABLE",
      `${engine} cannot produce a shortest road route`,
      { reason: "configuration_error" },
    );
  }

  return provider.calculateShortest(origin, destination, options.routeOptions);
}

/**
 * Walks the provider chain until one answers.
 *
 * Replaces the hand-nested try/catch pyramids this file used to carry, which
 * could only ever express exactly two providers. Every failure is collected so
 * the caller can report why the whole chain gave up, and each provider after
 * the first stamps a fallbackReason naming what it stood in for.
 */
async function runProviderChain<T extends RouteResult>(
  engines: RoutingEngine[],
  attempt: (engine: RoutingEngine) => Promise<T>,
  logContext: { mode: RouteCacheMode; primaryProvider: RoutingPrimaryProvider },
): Promise<{ route: T; errors: RoutingServiceError[] } | { route: null; errors: RoutingServiceError[] }> {
  const errors: RoutingServiceError[] = [];

  for (const engine of engines) {
    const startedAt = Date.now();

    try {
      const route = await attempt(engine);
      const durationMs = Date.now() - startedAt;

      // The first engine answering is the ordinary case; anything later is a
      // fallback and says so on the result.
      const isFallback = errors.length > 0;
      const fallbackReason = isFallback
        ? `${errors[errors.length - 1].provider} fallback: ${errors[errors.length - 1].message}`
        : null;

      console.info("[routing] provider-success", {
        ...logContext,
        engine,
        durationMs,
        attempt: errors.length + 1,
        fallbackReason,
      });

      return {
        route: fallbackReason ? (applyFallbackMetadata(route, fallbackReason) as T) : route,
        errors,
      };
    } catch (error) {
      const typedError = toRoutingServiceError(error);
      errors.push(typedError);

      console.warn("[routing] provider-failure", {
        ...logContext,
        engine,
        durationMs: Date.now() - startedAt,
        outcome: typedError.code,
        reason: typedError.reason,
        message: typedError.message,
      });
    }
  }

  return { route: null, errors };
}


/**
 * Calculate a route between two coordinates.
 * Tries ORS first; falls back to GPS/Haversine if ORS is unavailable or errors.
 */
/**
 * Calculate a route between two coordinates.
 *
 * Walks the configured engine chain and, if every one of them fails, falls back
 * to a straight-line GPS estimate. Used by the trip tracker, where an estimate
 * beats no answer — never by the fare path, which must not price a guess.
 */
export async function calculateRouteWithFallback(
  origin: Coordinates,
  destination: Coordinates,
  routeOptions?: RouteRequestOptions,
): Promise<RouteResult> {
  const timeoutMs = getConfiguredOrsTimeoutMs();
  const googleTimeoutMs = getConfiguredGoogleRoutesTimeoutMs();
  const routingSettings = await getResolvedRoutingSettings();
  const engines = getProviderOrder(routingSettings.primaryProvider);
  const restrictionVersion = restrictionsVersion(await getActiveRestrictions());
  const cacheKey = buildRouteCacheKey(
    origin,
    destination,
    "fallback",
    routingSettings.primaryProvider,
    routeOptions,
    restrictionVersion,
  );
  const cachedRoute = getCachedRoute(cacheKey);

  if (cachedRoute) {
    console.info("[routing] cache-hit", {
      mode: "fallback",
      primaryProvider: routingSettings.primaryProvider,
      method: cachedRoute.method,
      fallbackReason: cachedRoute.fallbackReason,
    });

    return cachedRoute;
  }

  const providerOptions: ProviderCallOptions = {
    orsTimeoutMs: timeoutMs,
    googleRoutesTimeoutMs: googleTimeoutMs,
    routeOptions,
  };

  const { route, errors } = await runProviderChain(
    engines,
    (engine) => calculateRouteWithProvider(engine, origin, destination, providerOptions),
    { mode: "fallback", primaryProvider: routingSettings.primaryProvider },
  );

  if (route) {
    cacheRoute(cacheKey, route);
    return route;
  }

  const fallbackReason = buildRouteVerificationFailure(errors).message;

  console.warn("[routing] route-gps-fallback", {
    primaryProvider: routingSettings.primaryProvider,
    engines,
    method: "gps",
    fallbackReason,
  });

  // Deliberately not cached: a straight-line estimate should not outlive the
  // outage that produced it.
  const gpsResult = await gps.calculate(origin, destination);
  return applyFallbackMetadata(gpsResult, fallbackReason);
}

/**
 * Calculate a verified road route, or throw.
 *
 * The fare path. There is no GPS tier here on purpose: a fare derived from a
 * haversine estimate is not defensible under Ordinance 105, so when every
 * engine fails this reports that the route is unverified rather than pricing a
 * guess.
 */
export async function calculateShortestRoadRoute(
  origin: Coordinates,
  destination: Coordinates,
  routeOptions?: RouteRequestOptions,
): Promise<ShortestRoadRouteResult> {
  const timeoutMs = getConfiguredOrsTimeoutMs();
  const googleTimeoutMs = getConfiguredGoogleRoutesTimeoutMs();
  const routingSettings = await getResolvedRoutingSettings();
  const engines = getProviderOrder(routingSettings.primaryProvider);
  const restrictionVersion = restrictionsVersion(await getActiveRestrictions());
  const cacheKey = buildRouteCacheKey(
    origin,
    destination,
    "shortest-road",
    routingSettings.primaryProvider,
    routeOptions,
    restrictionVersion,
  );
  const cachedRoute = getCachedRoute(cacheKey);

  if (cachedRoute) {
    console.info("[routing] shortest-road-cache-hit", {
      mode: "shortest-road",
      primaryProvider: routingSettings.primaryProvider,
      provider: cachedRoute.provider,
    });

    return cachedRoute as ShortestRoadRouteResult;
  }

  const providerOptions: ProviderCallOptions = {
    orsTimeoutMs: timeoutMs,
    googleRoutesTimeoutMs: googleTimeoutMs,
    routeOptions,
  };

  const { route, errors } = await runProviderChain(
    engines,
    (engine) => calculateShortestRouteWithProvider(engine, origin, destination, providerOptions),
    { mode: "shortest-road", primaryProvider: routingSettings.primaryProvider },
  );

  if (route) {
    cacheRoute(cacheKey, route);
    return route;
  }

  const routeVerificationError = buildRouteVerificationFailure(errors);

  console.warn("[routing] shortest-road-route-unverified", {
    primaryProvider: routingSettings.primaryProvider,
    engines,
    outcome: routeVerificationError.code,
    reason: routeVerificationError.reason,
    status: routeVerificationError.status,
    message: routeVerificationError.message,
  });

  throw routeVerificationError;
}

export async function resolveRouteForQuote(args: {
  origin: Coordinates;
  destination: Coordinates;
  /** Set only when the rider picked a saved place rather than dropping a pin. */
  originLocationId: string | null;
  destinationLocationId: string | null;
  vehicleType: VehicleType | null;
}): Promise<ShortestRoadRouteResult> {
  const { origin, destination, originLocationId, destinationLocationId, vehicleType } = args;

  // A dropped pin cannot match a corpus row, so pin trips skip straight to the
  // engines rather than paying for a lookup that cannot hit.
  if (originLocationId && destinationLocationId) {
    const curated = await findCuratedRoute({
      originLocationId,
      destinationLocationId,
      vehicleType,
    });

    if (curated) {
      console.info("[routing] curated-route-hit", {
        curatedRouteId: curated.id,
        vehicleType,
        reversed: curated.reversed,
        needsSurvey: curated.needsSurvey,
        source: curated.source,
        distanceMeters: curated.distanceMeters,
      });

      return curatedRouteToResult(curated, origin, destination);
    }
  }

  const restrictions = restrictionsForVehicle(await getActiveRestrictions(), vehicleType);

  const route = await calculateShortestRoadRoute(origin, destination, {
    vehicleType,
    excludePolygons: toExcludePolygons(restrictions),
    excludeLocations: toExcludeLocations(restrictions),
  });

  // Google Routes has no polygon avoidance and ORS cannot take points or way
  // ids, so a route from those tiers may run straight through a closure the
  // engine was never told about. Checking the returned shape is coarser than
  // routing around it, but quoting a fare over a road an admin marked
  // impassable is not an option.
  const violated = findViolatedRestriction(route.polyline, restrictions);

  if (violated) {
    console.warn("[routing] route-crosses-restriction", {
      restrictionId: violated.id,
      restrictionName: violated.name,
      kind: violated.kind,
      provider: route.provider,
      vehicleType,
    });

    throw new RoutingServiceError(
      "ROUTE_BLOCKED_BY_RESTRICTION",
      violated.note?.trim()
        ? `${violated.name}: ${violated.note.trim()}`
        : `This route runs through ${violated.name}, which is currently closed.`,
      { provider: route.provider === "curated" ? "ors" : route.provider, reason: "restricted", status: 422 },
    );
  }

  return route;
}
