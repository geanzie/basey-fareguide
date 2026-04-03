import type { RouteResult, SnappedPoint } from "../types";
import type { Coordinates, RoutingProvider } from "./base";

const ORS_ENDPOINT =
  "https://api.openrouteservice.org/v2/directions/driving-car";

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

/**
 * Returns approximate distance in metres between two lat/lng points.
 * Accurate enough for the snapping threshold check (~10 m minimum, 200 m max).
 */
function approxMeters(a: Coordinates, b: Coordinates): number {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLng =
    (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Minimum displacement (metres) before wasSnapped is reported as true. */
const SNAP_REPORT_THRESHOLD_M = 11;

export class OrsProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(timeoutMs = 3500) {
    const key = process.env.OPENROUTESERVICE_API_KEY;
    if (!key) {
      throw new Error(
        "OrsProvider: OPENROUTESERVICE_API_KEY environment variable is not set."
      );
    }
    this.apiKey = key;
    this.timeoutMs = timeoutMs;
  }

  async calculate(origin: Coordinates, destination: Coordinates): Promise<RouteResult> {
    // ORS expects [lng, lat] order — the opposite of our internal {lat, lng}.
    const body = {
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(ORS_ENDPOINT, {
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
        throw new Error(`ORS request timed out after ${this.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ORS request failed (${response.status}): ${text.slice(0, 200)}`
      );
    }

    const data = await response.json();
    const segment = data?.routes?.[0]?.summary;
    if (!segment) {
      throw new Error("ORS response missing routes[0].summary");
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
      polyline,
      method: "ors",
      fallbackReason: null,
      snappedOrigin,
      snappedDestination,
    };
  }
}
