import { RoutingServiceError } from "../types";
import { approxMeters } from "../geo";
import type { Coordinates } from "./base";

const GOOGLE_ROADS_ENDPOINT = "https://roads.googleapis.com/v1/nearestRoads";

/** Google caps a nearestRoads request at 100 points. */
const MAX_POINTS_PER_REQUEST = 100;

const DEFAULT_TIMEOUT_MS = 3500;

interface GoogleNearestRoadsResponse {
  snappedPoints?: Array<{
    location?: { latitude?: number; longitude?: number };
    originalIndex?: number;
    placeId?: string;
  }>;
  error?: { message?: string; status?: string };
}

function getConfiguredTimeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.ROUTING_GOOGLE_ROADS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * Whether the Roads snap is consulted at all.
 *
 * Off by default. Google's road graph in rural Samar has not been compared
 * against what a tricycle can really use here, and the plan for this work says
 * to measure that before leaning on it. Flip it on once that comparison is
 * done — nothing else has to change, because the snap can only ever improve a
 * verdict (see resolveNearestRoad).
 */
export function isRoadsSnapEnabled(): boolean {
  return process.env.ROUTING_ROADS_SNAP_ENABLED === "true";
}

function buildRoadsError(message: string, status?: number): RoutingServiceError {
  return new RoutingServiceError("ROUTING_SERVICE_UNAVAILABLE", message, {
    provider: "google_routes",
    reason: "upstream_error",
    status: status ?? null,
  });
}

/**
 * Google's Roads API: the nearest point on the road network to each input.
 *
 * Distinct from the snapping the routing providers already do. ORS is asked to
 * snap within 5 km (ors.ts) because Basey's barangay coordinates are polygon
 * centroids, and at that radius a "snap" can land on an unrelated road across a
 * river. Roads answers a narrower question — is there a road *here* — and
 * simply omits a point when there is not.
 */
export class GoogleRoadsProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(timeoutMs = getConfiguredTimeoutMs()) {
    const apiKey =
      process.env.GOOGLE_ROADS_API_KEY ||
      process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_MAPS_SERVER_API_KEY;

    if (!apiKey) {
      throw buildRoadsError(
        "GoogleRoadsProvider: GOOGLE_ROADS_API_KEY, GOOGLE_ROUTES_API_KEY or GOOGLE_MAPS_SERVER_API_KEY is not set.",
      );
    }

    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Nearest road for each point, keyed by its index in the input.
   *
   * A point with no road nearby is absent from the map rather than present
   * with a null — Google omits it, and flattening that into a sentinel would
   * lose the distinction between "no road" and "not asked".
   */
  async nearestRoads(points: Coordinates[]): Promise<Map<number, Coordinates>> {
    const results = new Map<number, Coordinates>();

    if (points.length === 0) {
      return results;
    }

    for (let offset = 0; offset < points.length; offset += MAX_POINTS_PER_REQUEST) {
      const batch = points.slice(offset, offset + MAX_POINTS_PER_REQUEST);
      const snapped = await this.requestBatch(batch);

      for (const [batchIndex, coordinate] of snapped) {
        results.set(offset + batchIndex, coordinate);
      }
    }

    return results;
  }

  private async requestBatch(points: Coordinates[]): Promise<Map<number, Coordinates>> {
    const query = points.map((point) => `${point.lat},${point.lng}`).join("|");
    const url = `${GOOGLE_ROADS_ENDPOINT}?points=${encodeURIComponent(query)}&key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw buildRoadsError(`Roads API request timed out after ${this.timeoutMs}ms`);
      }

      throw buildRoadsError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw buildRoadsError(
        `Roads API request failed (${response.status}): ${text.slice(0, 200)}`,
        response.status,
      );
    }

    const data = (await response.json()) as GoogleNearestRoadsResponse;

    if (data.error) {
      throw buildRoadsError(`Roads API error: ${data.error.message ?? "unknown"}`);
    }

    const closest = new Map<number, { coordinate: Coordinates; meters: number }>();

    // Roads can return several snapped points for one input — it interpolates
    // along the matched road. Keep the nearest per input index.
    for (const snappedPoint of data.snappedPoints ?? []) {
      const index = snappedPoint.originalIndex;
      const lat = snappedPoint.location?.latitude;
      const lng = snappedPoint.location?.longitude;

      if (index == null || typeof lat !== "number" || typeof lng !== "number") {
        continue;
      }

      const requested = points[index];
      if (!requested) {
        continue;
      }

      const coordinate = { lat, lng };
      const meters = approxMeters(requested, coordinate);
      const current = closest.get(index);

      if (!current || meters < current.meters) {
        closest.set(index, { coordinate, meters });
      }
    }

    return new Map([...closest].map(([index, entry]) => [index, entry.coordinate]));
  }
}

/**
 * Asks Roads for a road nearer than the one the routing provider snapped to.
 *
 * Deliberately monotone: it returns a point only when that point is strictly
 * closer than what we already had. Google's road graph may well omit the
 * tricycle-passable alleys this system cares about, but a gap in it can then
 * only mean "no improvement found" — never a place wrongly refused. That is
 * what makes it safe to consult before the coverage comparison has been run.
 *
 * Fails open. A missing key, a disabled API or a timeout returns null and the
 * caller keeps the verdict it already had.
 */
export async function resolveNearestRoad(
  requested: Coordinates,
  currentBestMeters: number,
): Promise<{ coordinate: Coordinates; meters: number } | null> {
  if (!isRoadsSnapEnabled()) {
    return null;
  }

  try {
    const snapped = await new GoogleRoadsProvider().nearestRoads([requested]);
    const coordinate = snapped.get(0);

    if (!coordinate) {
      return null;
    }

    const meters = Math.round(approxMeters(requested, coordinate));
    return meters < currentBestMeters ? { coordinate, meters } : null;
  } catch (error) {
    console.warn("[vehicleAccess] Roads snap unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
