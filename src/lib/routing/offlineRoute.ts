import type { FarePolicySnapshotDto } from "@/lib/contracts";
import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";
import { resolveFarePolicySnapshot } from "@/lib/fare/policy";
import { resolvePinLabel } from "@/lib/locations/pinLabelResolver";
import { encodePolyline } from "@/lib/routeUtils";

import { estimatedRoadKm } from "./geo";
import { routeOffline } from "./offlineGraph";
import type { Coordinates } from "./providers/base";
import type { CalculatedRouteResponse, PassengerType } from "./types";

/** Straight-line × road-factor heuristic (pin off-network or graph missing). */
export const OFFLINE_FALLBACK_REASON = "offline_estimate";
/** On-device road-graph route — road-accurate distance + polyline. */
export const OFFLINE_GRAPH_REASON = "offline_graph";
/** Exact replay of a route previously computed online (most accurate offline). */
export const OFFLINE_CACHE_REASON = "offline_cache";

export interface OfflineRouteInput {
  origin: Coordinates;
  destination: Coordinates;
  passengerType: PassengerType;
  /** Last-known fare policy snapshot; falls back to legacy default when absent. */
  farePolicy?: FarePolicySnapshotDto | null;
}

/**
 * Compute a route estimate entirely client-side when the routing API is
 * unreachable (offline). Distance is straight-line × road factor — no road
 * polyline — so the result is always flagged isEstimate and must be labelled
 * as an estimate in the UI.
 */
function buildResponse(
  input: OfflineRouteInput,
  opts: {
    distanceKm: number;
    durationMin: number | null;
    polyline: string | null;
    fallbackReason: string;
  },
): CalculatedRouteResponse {
  const { origin, destination, passengerType } = input;
  const farePolicy = resolveFarePolicySnapshot(input.farePolicy);

  const fare = calculateFare(opts.distanceKm, passengerType, farePolicy);
  const fareBreakdown = getFareBreakdown(opts.distanceKm, passengerType, farePolicy);

  const originResolved = resolvePinLabel(origin.lat, origin.lng);
  const destinationResolved = resolvePinLabel(destination.lat, destination.lng);

  return {
    origin: originResolved.displayLabel,
    destination: destinationResolved.displayLabel,
    originResolved,
    destinationResolved,
    distanceKm: opts.distanceKm,
    durationMin: opts.durationMin,
    fare,
    passengerType,
    fareBreakdown,
    farePolicy,
    method: null,
    provider: null,
    isEstimate: true,
    fallbackReason: opts.fallbackReason,
    polyline: opts.polyline,
    snappedOrigin: null,
    snappedDestination: null,
    inputMode: "pin",
  };
}

export function buildOfflineRouteEstimate(
  input: OfflineRouteInput,
): CalculatedRouteResponse {
  return buildResponse(input, {
    distanceKm: estimatedRoadKm(input.origin, input.destination),
    durationMin: null,
    polyline: null,
    fallbackReason: OFFLINE_FALLBACK_REASON,
  });
}

/** Rebuild a response from a previously cached online route (exact replay). */
export function buildOfflineRouteFromCache(
  input: OfflineRouteInput,
  cached: { distanceKm: number; durationMin: number | null; polyline: string | null },
): CalculatedRouteResponse {
  return buildResponse(input, {
    distanceKm: cached.distanceKm,
    durationMin: cached.durationMin,
    polyline: cached.polyline,
    fallbackReason: OFFLINE_CACHE_REASON,
  });
}

/**
 * Resolve an offline route with road accuracy when possible: try the on-device
 * road graph first (real distance + polyline), and fall back to the
 * straight-line heuristic when the pin is off-network or the graph is missing.
 */
export async function resolveOfflineRoute(
  input: OfflineRouteInput,
): Promise<CalculatedRouteResponse> {
  try {
    const graph = await routeOffline(input.origin, input.destination);
    if (graph) {
      return buildResponse(input, {
        distanceKm: graph.distanceKm,
        durationMin: graph.durationMin,
        polyline: encodePolyline(graph.coords),
        fallbackReason: OFFLINE_GRAPH_REASON,
      });
    }
  } catch {
    // Fall through to the heuristic.
  }
  return buildOfflineRouteEstimate(input);
}
