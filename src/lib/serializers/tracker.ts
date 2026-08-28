import type {
  TrackerSegmentResponseDto,
  TrackerSnappedPointDto,
} from "@/lib/contracts";
import type { RouteMethod, RouteResult, SnappedPoint } from "@/lib/routing/types";

function serializeSnappedPoint(point: SnappedPoint | null): TrackerSnappedPointDto | null {
  if (!point) {
    return null;
  }

  return {
    lat: point.lat,
    lng: point.lng,
    wasSnapped: point.wasSnapped,
  };
}

/**
 * Narrows a route source to the ones a tracker segment can actually hold.
 *
 * The tracker measures a GPS trail through calculateRouteWithFallback, so every
 * engine is fair game. A curated distance is not: it is a fare-quote tier keyed
 * on a pair of saved places, and the tracker has no such pair. That is an
 * invariant, not a case to handle — enforced rather than assumed, so the DTO
 * stays honest about the values it can really carry.
 */
function toTrackerMethod(method: RouteMethod): TrackerSegmentResponseDto["method"] {
  if (method === "curated") {
    throw new Error(
      "serializeTrackerSegmentResponse received a curated route; the tracker cannot produce one",
    );
  }

  return method;
}

export function serializeTrackerSegmentResponse(
  route: RouteResult,
  options: {
    accepted: boolean;
    reason: string | null;
    confidence: TrackerSegmentResponseDto["confidence"];
  },
): TrackerSegmentResponseDto {
  return {
    accepted: options.accepted,
    reason: options.reason,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    confidence: options.confidence,
    method: toTrackerMethod(route.method),
    fallbackReason: route.fallbackReason,
    polyline: route.polyline,
    snappedFrom: serializeSnappedPoint(route.snappedOrigin),
    snappedTo: serializeSnappedPoint(route.snappedDestination),
  };
}
