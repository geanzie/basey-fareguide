import { NextRequest, NextResponse } from "next/server";
import { calculateRouteWithFallback } from "@/lib/routing";
import type { TrackerSegmentRequestDto } from "@/lib/contracts";
import { serializeTrackerSegmentResponse } from "@/lib/serializers";
import {
  BASEY_SERVICE_AREA,
  MAX_TRACKER_SNAP_DISTANCE_M,
  PH_BOUNDS,
  TRACKER_RATE_LIMITS,
  evaluateCheckpointCandidate,
  haversineMeters,
  isInBounds,
} from "@/lib/tracker";
import { checkRateLimit, getClientIdentifier } from "@/lib/rateLimit";

function parsePoint(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const point = raw as Record<string, unknown>;
  if (
    typeof point.lat !== "number" ||
    typeof point.lng !== "number" ||
    typeof point.accuracyM !== "number" ||
    typeof point.timestampMs !== "number"
  ) {
    return null;
  }

  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    !Number.isFinite(point.accuracyM) ||
    !Number.isFinite(point.timestampMs)
  ) {
    return null;
  }

  return {
    lat: point.lat,
    lng: point.lng,
    accuracyM: point.accuracyM,
    timestampMs: point.timestampMs,
  };
}

function getTrackerClientId(request: NextRequest, trackerSessionId: string): string {
  return `${getClientIdentifier(request)}:${trackerSessionId}`;
}

function rateLimitHeaders(limit: number, remaining: number, resetTime: number, retryAfter?: number) {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(remaining, 0)),
    "X-RateLimit-Reset": String(Math.ceil(resetTime / 1000)),
  };

  if (retryAfter != null) {
    headers["Retry-After"] = String(retryAfter);
  }

  return headers;
}

export async function POST(request: NextRequest) {
  let body: TrackerSegmentRequestDto;
  try {
    body = (await request.json()) as TrackerSegmentRequestDto;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.trackerSessionId || typeof body.trackerSessionId !== "string") {
    return NextResponse.json({ error: "trackerSessionId is required" }, { status: 400 });
  }

  const from = parsePoint(body.from);
  const to = parsePoint(body.to);

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to must include lat, lng, accuracyM, and timestampMs" },
      { status: 400 },
    );
  }

  if (!isInBounds(from.lat, from.lng, PH_BOUNDS) || !isInBounds(to.lat, to.lng, PH_BOUNDS)) {
    return NextResponse.json(
      { error: "Tracker points must stay inside the Philippines" },
      { status: 400 },
    );
  }

  if (
    !isInBounds(from.lat, from.lng, BASEY_SERVICE_AREA) ||
    !isInBounds(to.lat, to.lng, BASEY_SERVICE_AREA)
  ) {
    return NextResponse.json(
      { error: "Tracker points must stay inside the Basey service area" },
      { status: 400 },
    );
  }

  const trackerClientId = getTrackerClientId(request, body.trackerSessionId);
  const minuteLimit = checkRateLimit(`${trackerClientId}:minute`, TRACKER_RATE_LIMITS.minute);
  if (!minuteLimit.success) {
    return NextResponse.json(
      {
        message: `Too many tracker segment requests. Try again in ${minuteLimit.retryAfter} seconds.`,
        retryAfter: minuteLimit.retryAfter,
      },
      {
        status: 429,
        headers: rateLimitHeaders(
          TRACKER_RATE_LIMITS.minute.maxAttempts,
          minuteLimit.remaining,
          minuteLimit.resetTime,
          minuteLimit.retryAfter,
        ),
      },
    );
  }

  const hourLimit = checkRateLimit(`${trackerClientId}:hour`, TRACKER_RATE_LIMITS.hour);
  if (!hourLimit.success) {
    return NextResponse.json(
      {
        message: `Hourly tracker quota reached. Try again in ${hourLimit.retryAfter} seconds.`,
        retryAfter: hourLimit.retryAfter,
      },
      {
        status: 429,
        headers: rateLimitHeaders(
          TRACKER_RATE_LIMITS.hour.maxAttempts,
          hourLimit.remaining,
          hourLimit.resetTime,
          hourLimit.retryAfter,
        ),
      },
    );
  }

  const candidateDecision = evaluateCheckpointCandidate(from, to);
  if (!candidateDecision.accepted) {
    return NextResponse.json(
      {
        accepted: false,
        reason: candidateDecision.reason,
        distanceKm: 0,
        durationMin: null,
        confidence: "rejected",
        method: "gps",
        fallbackReason: null,
        polyline: null,
        snappedFrom: null,
        snappedTo: null,
      },
      {
        status: 200,
        headers: rateLimitHeaders(
          TRACKER_RATE_LIMITS.minute.maxAttempts,
          minuteLimit.remaining,
          minuteLimit.resetTime,
        ),
      },
    );
  }

  try {
    const route = await calculateRouteWithFallback(from, to);

    if (route.method === "ors") {
      if (route.snappedOrigin) {
        const snapDistanceM = haversineMeters(from, route.snappedOrigin);
        if (snapDistanceM > MAX_TRACKER_SNAP_DISTANCE_M) {
          return NextResponse.json(
            serializeTrackerSegmentResponse(route, {
              accepted: false,
              reason: "origin_snap_too_far",
              confidence: "rejected",
            }),
            {
              status: 200,
              headers: rateLimitHeaders(
                TRACKER_RATE_LIMITS.minute.maxAttempts,
                minuteLimit.remaining,
                minuteLimit.resetTime,
              ),
            },
          );
        }
      }

      if (route.snappedDestination) {
        const snapDistanceM = haversineMeters(to, route.snappedDestination);
        if (snapDistanceM > MAX_TRACKER_SNAP_DISTANCE_M) {
          return NextResponse.json(
            serializeTrackerSegmentResponse(route, {
              accepted: false,
              reason: "destination_snap_too_far",
              confidence: "rejected",
            }),
            {
              status: 200,
              headers: rateLimitHeaders(
                TRACKER_RATE_LIMITS.minute.maxAttempts,
                minuteLimit.remaining,
                minuteLimit.resetTime,
              ),
            },
          );
        }
      }

      return NextResponse.json(
        serializeTrackerSegmentResponse(route, {
          accepted: true,
          reason: null,
          confidence: "road_aware",
        }),
        {
          status: 200,
          headers: rateLimitHeaders(
            TRACKER_RATE_LIMITS.minute.maxAttempts,
            minuteLimit.remaining,
            minuteLimit.resetTime,
          ),
        },
      );
    }

    return NextResponse.json(
      serializeTrackerSegmentResponse(route, {
        accepted: true,
        reason: null,
        confidence: "gps_estimate",
      }),
      {
        status: 200,
        headers: rateLimitHeaders(
          TRACKER_RATE_LIMITS.minute.maxAttempts,
          minuteLimit.remaining,
          minuteLimit.resetTime,
        ),
      },
    );
  } catch (error) {
    console.error("[/api/tracker/segment] failed to process segment", error);
    return NextResponse.json({ error: "Tracking service unavailable" }, { status: 503 });
  }
}
