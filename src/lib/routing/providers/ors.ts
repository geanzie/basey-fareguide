import type { VehicleType } from "@prisma/client";

import {
  RoutingServiceError,
  type ShortestRoadRouteResult,
  type RouteResult,
  type SnappedPoint,
} from "../types";
import type { Coordinates, RouteRequestOptions, RoutingProvider } from "./base";
import { approxMeters } from "../geo";
import { getVehicleRoutingProfile } from "../vehicleProfiles";

const ORS_BASE = "https://api.openrouteservice.org/v2/directions";

/** ORS routing profiles. "foot" is used only to probe walking-only access. */
const ORS_PROFILE = {
  drive: "driving-car",
  foot: "foot-walking",
} as const;

type OrsProfile = keyof typeof ORS_PROFILE;

interface OrsInternalOptions {
  preference?: typeof ORS_SHORTEST_PREFERENCE;
  profile?: OrsProfile;
  vehicleType?: VehicleType | null;
  /** ORS honours polygons. It has no equivalent for points or OSM way ids. */
  excludePolygons?: Array<Array<[number, number]>>;
}

const ORS_SHORTEST_PREFERENCE = "shortest" as const;

/**
 * How far ORS may look for a road when snapping a coordinate.
 *
 * ORS defaults to 350 m and answers anything further with error 2010, "Could
 * not find routable point". Most of Basey's barangay coordinates are polygon
 * centroids sitting well inside their land area — Anglit is 819 m from the
 * nearest mapped road, Manlilinab 3.4 km — so the default made 32 saved places
 * permanently unquotable. Bounded rather than unlimited: with no limit a pin
 * can snap across a river to an unrelated road and price a fare from it.
 */
const DEFAULT_SNAP_RADIUS_M = 5000;

function getConfiguredSnapRadiusM(): number {
  const parsed = Number.parseInt(
    process.env.ROUTING_SNAP_RADIUS_M ?? String(DEFAULT_SNAP_RADIUS_M),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SNAP_RADIUS_M;
}

/** Decode a Google/ORS precision-5 encoded polyline into [lat, lng] pairs. */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

/** Minimum displacement (metres) before wasSnapped is reported as true. */
const SNAP_REPORT_THRESHOLD_M = 11;

function isNoRoadRouteMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("route could not be found") ||
    normalized.includes("no route found") ||
    normalized.includes("no routable point") ||
    normalized.includes("could not find routable point") ||
    normalized.includes("routable point") ||
    normalized.includes("connection between locations not found")
  );
}

function buildOrsError(
  message: string,
  options: { status?: number | null; reason: "configuration_error" | "no_route_found" | "timeout" | "upstream_error" },
): RoutingServiceError {
  if (options.reason === "no_route_found" || isNoRoadRouteMessage(message)) {
    return new RoutingServiceError(
      "NO_ROAD_ROUTE_FOUND",
      "No road route could be found between these points.",
      {
        provider: "ors",
        reason: "no_route_found",
        status: options.status ?? null,
      },
    );
  }

  return new RoutingServiceError("ROUTING_SERVICE_UNAVAILABLE", message, {
    provider: "ors",
    reason: options.reason,
    status: options.status ?? null,
  });
}

export class OrsProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 3500) {
    const key = process.env.OPENROUTESERVICE_API_KEY;
    if (!key) {
      throw buildOrsError(
        "OrsProvider: OPENROUTESERVICE_API_KEY environment variable is not set.",
        { reason: "configuration_error" },
      );
    }
    this.apiKey = key;
    this.timeoutMs = timeoutMs;
  }

  async calculate(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<RouteResult> {
    return this.calculateInternal(origin, destination, {
      vehicleType: options?.vehicleType ?? null,
      excludePolygons: options?.excludePolygons,
    });
  }

  async calculateShortest(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteRequestOptions,
  ): Promise<ShortestRoadRouteResult> {
    return this.calculateInternal(origin, destination, {
      preference: ORS_SHORTEST_PREFERENCE,
      vehicleType: options?.vehicleType ?? null,
      excludePolygons: options?.excludePolygons,
    });
  }

  /**
   * Walking route between two points. Used only to tell "the last stretch is a
   * footpath or stairs" apart from "there is no road anywhere near here" — the
   * result never becomes a fare, so it is not cached alongside road routes.
   */
  async calculateWalking(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    return this.calculateInternal(origin, destination, { profile: "foot" });
  }

  private async calculateInternal(
    origin: Coordinates,
    destination: Coordinates,
    options: OrsInternalOptions & { preference: typeof ORS_SHORTEST_PREFERENCE },
  ): Promise<ShortestRoadRouteResult>;

  private async calculateInternal(
    origin: Coordinates,
    destination: Coordinates,
    options: OrsInternalOptions,
  ): Promise<RouteResult>;

  private async calculateInternal(
    origin: Coordinates,
    destination: Coordinates,
    options: OrsInternalOptions,
  ): Promise<RouteResult> {
    const { preference, profile = "drive", vehicleType = null } = options;
    // ORS has no motorised two-wheeler profile, so habal-habal and tricycle
    // both come back as car routes. The profile table says so explicitly and
    // carries the reason to report.
    const vehicleProfile = getVehicleRoutingProfile(vehicleType);
    const avoidFeatures = profile === "drive" ? vehicleProfile.orsAvoidFeatures : [];
    const orsFallbackReason = profile === "drive" ? vehicleProfile.orsFallbackReason : null;
    // ORS expects [lng, lat] order — the opposite of our internal {lat, lng}.
    const snapRadiusM = getConfiguredSnapRadiusM();
    const body: {
      coordinates: [number, number][];
      radiuses: [number, number];
      preference?: typeof ORS_SHORTEST_PREFERENCE;
      options?: {
        avoid_features?: string[];
        avoid_polygons?: { type: "MultiPolygon"; coordinates: number[][][][] };
      };
    } = {
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
      radiuses: [snapRadiusM, snapRadiusM],
    };

    if (preference) {
      body.preference = preference;
    }

    const excludePolygons = profile === "drive" ? options.excludePolygons ?? [] : [];

    if (avoidFeatures.length > 0 || excludePolygons.length > 0) {
      body.options = {
        ...(avoidFeatures.length > 0 ? { avoid_features: [...avoidFeatures] } : {}),
        ...(excludePolygons.length > 0
          ? {
              avoid_polygons: {
                type: "MultiPolygon" as const,
                coordinates: excludePolygons.map((ring) => [ring]),
              },
            }
          : {}),
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(`${ORS_BASE}/${ORS_PROFILE[profile]}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw buildOrsError(
          `ORS request timed out after ${this.timeoutMs}ms`,
          { reason: "timeout" },
        );
      }

      if (error instanceof RoutingServiceError) {
        throw error;
      }

      throw buildOrsError(
        error instanceof Error ? error.message : String(error),
        { reason: "upstream_error" },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw buildOrsError(
        `ORS request failed (${response.status}): ${text.slice(0, 200)}`,
        {
          status: response.status,
          reason:
            response.status === 404 || response.status === 422 || isNoRoadRouteMessage(text)
              ? "no_route_found"
              : "upstream_error",
        },
      );
    }

    const data = await response.json();
    const segment = data?.routes?.[0]?.summary;
    if (!segment) {
      const missingSummaryMessage =
        typeof data?.error?.message === "string"
          ? data.error.message
          : typeof data?.error === "string"
            ? data.error
            : "ORS response missing routes[0].summary";

      throw buildOrsError(missingSummaryMessage, {
        reason: isNoRoadRouteMessage(missingSummaryMessage)
          ? "no_route_found"
          : "upstream_error",
      });
    }

    // ORS returns distance in metres and duration in seconds.
    const distanceKm = segment.distance / 1000;
    const durationMin = segment.duration / 60;

    // The encoded polyline is at routes[0].geometry.
    const polyline: string | null =
      data.routes[0].geometry ?? null;

    // Extract road-snapped origin and destination from way_points + decoded polyline.
    // way_points = [firstIndex, lastIndex] into the decoded coordinates array.
    let snappedOrigin: SnappedPoint | null = null;
    let snappedDestination: SnappedPoint | null = null;

    if (polyline) {
      const wayPoints: number[] | undefined = data.routes[0].way_points;
      try {
        const coords = decodePolyline(polyline);
        if (wayPoints && wayPoints.length >= 2) {
          const [oriIdx, dstIdx] = [wayPoints[0], wayPoints[wayPoints.length - 1]];
          const snappedOriLat = coords[oriIdx]?.[0];
          const snappedOriLng = coords[oriIdx]?.[1];
          const snappedDstLat = coords[dstIdx]?.[0];
          const snappedDstLng = coords[dstIdx]?.[1];

          if (snappedOriLat != null && snappedOriLng != null) {
            const snapDist = approxMeters(origin, { lat: snappedOriLat, lng: snappedOriLng });
            snappedOrigin = {
              lat: snappedOriLat,
              lng: snappedOriLng,
              wasSnapped: snapDist > SNAP_REPORT_THRESHOLD_M,
            };
          }
          if (snappedDstLat != null && snappedDstLng != null) {
            const snapDist = approxMeters(destination, { lat: snappedDstLat, lng: snappedDstLng });
            snappedDestination = {
              lat: snappedDstLat,
              lng: snappedDstLng,
              wasSnapped: snapDist > SNAP_REPORT_THRESHOLD_M,
            };
          }
        }
      } catch {
        // Non-fatal: snapped coords are best-effort
      }
    }

    return {
      distanceKm,
      durationMin,
      distanceMeters: segment.distance,
      durationSeconds: segment.duration,
      polyline,
      method: "ors",
      provider: "ors",
      isEstimate: false,
      fallbackReason: orsFallbackReason,
      snappedOrigin,
      snappedDestination,
      diagnostics: {
        provider: "ors",
        routeFound: true,
        isEstimate: false,
        errorCode: null,
        errorMessage: null,
      },
    };
  }
}
