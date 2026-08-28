import {
  RoutingServiceError,
  type RouteResult,
  type ShortestRoadRouteResult,
  type SnappedPoint,
} from "../types";
import type { Coordinates, RouteRequestOptions, RoutingProvider } from "./base";
import { approxMeters } from "../geo";
import { encodePolyline } from "@/lib/routeUtils";
import { getVehicleRoutingProfile } from "../vehicleProfiles";

const DEFAULT_TIMEOUT_MS = 4000;

/** Matches the threshold the other providers report a snap at. */
const SNAP_REPORT_THRESHOLD_M = 11;

/**
 * Valhalla error codes that mean "there is no route", as opposed to "the
 * service is unwell". A no-route answer is a 422 the rider can act on; an
 * unwell service is a 503 that should fall through to the next provider.
 *
 * 154 exceeds the max distance, 171 no suitable edges near a location,
 * 172 no suitable edges near the origin, 442 no path could be found.
 */
const NO_ROUTE_ERROR_CODES = new Set([154, 170, 171, 172, 442, 443, 444, 445]);

interface ValhallaRouteResponse {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: Array<{ shape?: string }>;
    status?: number;
    status_message?: string;
  };
  error?: string;
  error_code?: number;
}

export function getValhallaBaseUrl(): string | null {
  const url = process.env.ROUTING_VALHALLA_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

/**
 * Whether Valhalla is in the provider chain at all.
 *
 * Requires both the flag and a URL. The container is optional infrastructure:
 * with it absent every quote falls through to the cloud providers exactly as
 * before, which is what makes it safe to deploy the code ahead of the tiles.
 */
export function isValhallaEnabled(): boolean {
  return process.env.ROUTING_VALHALLA_ENABLED === "true" && getValhallaBaseUrl() !== null;
}

function getConfiguredTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.ROUTING_VALHALLA_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function buildValhallaError(
  message: string,
  options: {
    code?: "NO_ROAD_ROUTE_FOUND" | "ROUTING_SERVICE_UNAVAILABLE";
    reason?: "no_route_found" | "timeout" | "upstream_error" | "configuration_error";
    status?: number | null;
  } = {},
): RoutingServiceError {
  return new RoutingServiceError(
    options.code ?? "ROUTING_SERVICE_UNAVAILABLE",
    message,
    {
      provider: "valhalla",
      reason: options.reason ?? "upstream_error",
      status: options.status ?? null,
    },
  );
}

/**
 * Decodes a Valhalla shape.
 *
 * Valhalla encodes at SIX decimal places; every other polyline in this codebase
 * is the Google/ORS five. Decoding one as the other misplaces the route by a
 * factor of ten — the line lands in the Pacific — and it looks like a routing
 * bug rather than an encoding one. Hence a separate decoder, and a re-encode to
 * precision 5 before the shape leaves this file.
 */
export function decodePolyline6(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let byte: number;
    let shift = 0;
    let result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e6, lng / 1e6]);
  }

  return points;
}

function toSnappedPoint(
  requested: Coordinates,
  vertex: [number, number] | undefined,
): SnappedPoint | null {
  if (!vertex) {
    return null;
  }

  const [lat, lng] = vertex;
  return {
    lat,
    lng,
    wasSnapped: approxMeters(requested, { lat, lng }) > SNAP_REPORT_THRESHOLD_M,
  };
}

export class ValhallaProvider implements RoutingProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(timeoutMs = getConfiguredTimeoutMs()) {
    const baseUrl = getValhallaBaseUrl();

    if (!baseUrl) {
      throw buildValhallaError(
        "ValhallaProvider: ROUTING_VALHALLA_URL environment variable is not set.",
        { reason: "configuration_error" },
      );
    }

    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async calculate(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<RouteResult> {
    return this.calculateInternal(origin, destination, options);
  }

  async calculateShortest(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<ShortestRoadRouteResult> {
    return this.calculateInternal(origin, destination, options);
  }

  private async calculateInternal(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<ShortestRoadRouteResult> {
    const vehicleType = options?.vehicleType ?? null;
    const profile = getVehicleRoutingProfile(vehicleType);

    // Always the fare-quote shape. Ordinance 105 prices distance, so any cost
    // preference that prefers a longer road would raise the fare for terrain.
    // See vehicleProfiles.ts.
    const body = {
      locations: [
        { lat: origin.lat, lon: origin.lng },
        { lat: destination.lat, lon: destination.lng },
      ],
      costing: profile.valhallaCosting,
      costing_options: { [profile.valhallaCosting]: profile.valhallaFareOptions },
      units: "kilometers",
      // Turn-by-turn narrative is generated work we never read.
      directions_type: "none",
      // Admin restrictions are request parameters, which is the whole reason
      // this engine was chosen: a closure goes live with no tile rebuild.
      ...(options?.excludePolygons?.length
        ? {
            exclude_polygons: options.excludePolygons.map((ring) =>
              ring.map(([lng, lat]) => [lng, lat]),
            ),
          }
        : {}),
      ...(options?.excludeLocations?.length
        ? {
            exclude_locations: options.excludeLocations.map((point) => ({
              lat: point.lat,
              lon: point.lng,
            })),
          }
        : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw buildValhallaError(
          `Valhalla request timed out after ${this.timeoutMs}ms`,
          { reason: "timeout" },
        );
      }

      throw buildValhallaError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeoutId);
    }

    let data: ValhallaRouteResponse;

    try {
      data = (await response.json()) as ValhallaRouteResponse;
    } catch {
      throw buildValhallaError(
        `Valhalla returned an unreadable response (${response.status})`,
        { status: response.status },
      );
    }

    if (!response.ok || data.error) {
      const isNoRoute =
        data.error_code != null && NO_ROUTE_ERROR_CODES.has(data.error_code);

      throw buildValhallaError(
        `Valhalla request failed (${response.status}${
          data.error_code != null ? `, error_code ${data.error_code}` : ""
        }): ${data.error ?? "unknown error"}`,
        {
          code: isNoRoute ? "NO_ROAD_ROUTE_FOUND" : "ROUTING_SERVICE_UNAVAILABLE",
          reason: isNoRoute ? "no_route_found" : "upstream_error",
          status: isNoRoute ? 422 : response.status,
        },
      );
    }

    const summary = data.trip?.summary;

    if (!summary || typeof summary.length !== "number") {
      throw buildValhallaError("Valhalla response missing trip.summary.length", {
        reason: "no_route_found",
        code: "NO_ROAD_ROUTE_FOUND",
      });
    }

    const distanceKm = summary.length;
    const durationSeconds = typeof summary.time === "number" ? summary.time : null;

    // One shape per leg; a two-location request has one leg, but concatenating
    // keeps this correct if waypoints are ever added.
    const vertices = (data.trip?.legs ?? []).flatMap((leg) =>
      leg.shape ? decodePolyline6(leg.shape) : [],
    );

    return {
      distanceKm,
      durationMin: durationSeconds == null ? null : durationSeconds / 60,
      distanceMeters: Math.round(distanceKm * 1000),
      durationSeconds,
      // Re-encoded to precision 5 so it flows through the same draw and
      // fit-bounds pipeline as every other provider's polyline.
      polyline: vertices.length > 0 ? encodePolyline(vertices) : null,
      method: "valhalla",
      provider: "valhalla",
      isEstimate: false,
      fallbackReason: null,
      snappedOrigin: toSnappedPoint(origin, vertices[0]),
      snappedDestination: toSnappedPoint(destination, vertices[vertices.length - 1]),
      diagnostics: {
        provider: "valhalla",
        routeFound: true,
        isEstimate: false,
        errorCode: null,
        errorMessage: null,
      },
    };
  }
}
