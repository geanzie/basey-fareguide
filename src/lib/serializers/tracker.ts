import type {
  TrackerSegmentResponseDto,
  TrackerSnappedPointDto,
} from "@/lib/contracts";
import type { RouteResult, SnappedPoint } from "@/lib/routing/types";

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
    method: route.method,
    fallbackReason: route.fallbackReason,
    polyline: route.polyline,
    snappedFrom: serializeSnappedPoint(route.snappedOrigin),
    snappedTo: serializeSnappedPoint(route.snappedDestination),
  };
}
