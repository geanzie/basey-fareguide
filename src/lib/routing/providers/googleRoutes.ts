import {
  RoutingServiceError,
  type RouteResult,
  type RouteDiagnostics,
  type ShortestRoadRouteResult,
  type SnappedPoint,
} from "../types";
import type { Coordinates, RoutingProvider } from "./base";

const GOOGLE_ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const DEFAULT_LANGUAGE_CODE = "en-US";

type GoogleRoutingPreference = "TRAFFIC_UNAWARE";

interface GoogleComputeRoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
    legs?: Array<{
      startLocation?: {
        latLng?: {
          latitude?: number;
          longitude?: number;
        };
      };
      endLocation?: {
        latLng?: {
          latitude?: number;
          longitude?: number;
        };
      };
    }>;
  }>;
  error?: {
    message?: string;
  };
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
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

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

function approxMeters(a: Coordinates, b: Coordinates): number {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function parseDurationSeconds(rawDuration: string | undefined): number | null {
  if (!rawDuration) {
    return null;
  }

  const normalized = rawDuration.trim();
  if (!normalized.endsWith("s")) {
    return null;
  }

  const numeric = Number.parseFloat(normalized.slice(0, -1));
  return Number.isFinite(numeric) ? numeric : null;
}

function isNoRoadRouteMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("no route") ||
    normalized.includes("could not route") ||
    normalized.includes("not found") ||
    normalized.includes("zero results") ||
    normalized.includes("unreachable")
  );
}

function buildGoogleRoutesError(
  message: string,
  options: { status?: number | null; reason: "configuration_error" | "no_route_found" | "timeout" | "upstream_error" },
): RoutingServiceError {
  if (options.reason === "no_route_found" || isNoRoadRouteMessage(message)) {
    return new RoutingServiceError(
      "NO_ROAD_ROUTE_FOUND",
      "No verified road route could be found between these points.",
      {
        provider: "google_routes",
        reason: "no_route_found",
        status: options.status ?? null,
      },
    );
  }

  return new RoutingServiceError("ROUTING_SERVICE_UNAVAILABLE", message, {
    provider: "google_routes",
    reason: options.reason,
    status: options.status ?? null,
  });
}

function toSnappedPoint(raw: { latitude?: number; longitude?: number } | undefined, original: Coordinates): SnappedPoint | null {
  if (raw?.latitude == null || raw.longitude == null) {
    return null;
  }

  const lat = raw.latitude;
  const lng = raw.longitude;
  const distanceM = approxMeters(original, { lat, lng });

  return {
    lat,
    lng,
    wasSnapped: distanceM > 11,
  };
}

function buildDiagnostics(
  errorCode: RouteDiagnostics["errorCode"],
  errorMessage: string | null,
): RouteDiagnostics {
  return {
    provider: "google_routes",
    routeFound: errorCode == null,
    isEstimate: false,
    errorCode,
    errorMessage,
  };
}

export class GoogleRoutesProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 3500) {
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_SERVER_API_KEY;
    if (!apiKey) {
      throw buildGoogleRoutesError(
        "GoogleRoutesProvider: GOOGLE_ROUTES_API_KEY or GOOGLE_MAPS_SERVER_API_KEY environment variable is not set.",
        { reason: "configuration_error" },
      );
    }

    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async calculate(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    return this.calculateInternal(origin, destination);
  }

  async calculateShortest(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<ShortestRoadRouteResult> {
    return this.calculateInternal(origin, destination);
  }

  private async calculateInternal(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<ShortestRoadRouteResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const body = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.lat,
            longitude: destination.lng,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE" satisfies GoogleRoutingPreference,
      computeAlternativeRoutes: false,
      languageCode: DEFAULT_LANGUAGE_CODE,
      units: "METRIC",
      polylineEncoding: "ENCODED_POLYLINE",
      polylineQuality: "OVERVIEW",
    };

    let response: Response;

    try {
      response = await fetch(GOOGLE_ROUTES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": [
            "routes.distanceMeters",
            "routes.duration",
            "routes.polyline.encodedPolyline",
            "routes.legs.startLocation",
            "routes.legs.endLocation",
          ].join(","),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw buildGoogleRoutesError(
          `Google Routes request timed out after ${this.timeoutMs}ms`,
          { reason: "timeout" },
        );
      }

      if (error instanceof RoutingServiceError) {
        throw error;
      }

      throw buildGoogleRoutesError(
        error instanceof Error ? error.message : String(error),
        { reason: "upstream_error" },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw buildGoogleRoutesError(
        `Google Routes request failed (${response.status}): ${text.slice(0, 200)}`,
        {
          status: response.status,
          reason:
            response.status === 404 || response.status === 422 || isNoRoadRouteMessage(text)
              ? "no_route_found"
              : "upstream_error",
        },
      );
    }

    const data = (await response.json()) as GoogleComputeRoutesResponse;
    const route = data.routes?.[0];
    if (!route) {
      const message =
        typeof data.error?.message === "string"
          ? data.error.message
          : "Google Routes response missing routes[0]";

      throw buildGoogleRoutesError(message, {
        reason: isNoRoadRouteMessage(message) ? "no_route_found" : "upstream_error",
      });
    }

    const distanceMeters = route.distanceMeters;
    const durationSeconds = parseDurationSeconds(route.duration);
    const polyline = route.polyline?.encodedPolyline ?? null;

    if (typeof distanceMeters !== "number" || !Number.isFinite(distanceMeters)) {
      throw buildGoogleRoutesError("Google Routes response missing distanceMeters", {
        reason: "upstream_error",
      });
    }

    const normalizedDistanceMeters: number = distanceMeters;

    const legs = route.legs ?? [];
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];
    let snappedOrigin = toSnappedPoint(firstLeg?.startLocation?.latLng, origin);
    let snappedDestination = toSnappedPoint(lastLeg?.endLocation?.latLng, destination);

    if (polyline && (!snappedOrigin || !snappedDestination)) {
      try {
        const decoded = decodePolyline(polyline);
        const [firstPoint] = decoded;
        const lastPoint = decoded[decoded.length - 1];

        if (!snappedOrigin && firstPoint) {
          snappedOrigin = {
            lat: firstPoint[0],
            lng: firstPoint[1],
            wasSnapped: approxMeters(origin, { lat: firstPoint[0], lng: firstPoint[1] }) > 11,
          };
        }

        if (!snappedDestination && lastPoint) {
          snappedDestination = {
            lat: lastPoint[0],
            lng: lastPoint[1],
            wasSnapped: approxMeters(destination, { lat: lastPoint[0], lng: lastPoint[1] }) > 11,
          };
        }
      } catch {
        // Best effort only.
      }
    }

    return {
      distanceKm: normalizedDistanceMeters / 1000,
      durationMin: durationSeconds == null ? null : durationSeconds / 60,
      distanceMeters: normalizedDistanceMeters,
      durationSeconds,
      polyline,
      method: "google_routes",
      provider: "google_routes",
      isEstimate: false,
      fallbackReason: null,
      snappedOrigin,
      snappedDestination,
      diagnostics: buildDiagnostics(null, null),
    };
  }
}