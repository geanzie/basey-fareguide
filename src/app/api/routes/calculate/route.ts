import { NextRequest, NextResponse } from "next/server";
import type { FarePolicySnapshotDto } from "@/lib/contracts";
import { calculateShortestRoadRoute } from "@/lib/routing";
import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";
import { getResolvedFareRates } from "@/lib/fare/rateService";
import { resolvePinLabel, type ResolvedPinLabel } from "@/lib/locations/pinLabelResolver";
import { resolvePlannerLocationByName } from "@/lib/locations/plannerLocations";
import { serializePinLabel } from "@/lib/locations/pinSerializer";
import {
  RoutingServiceError,
  type CalculatedRouteResponse,
  type LocationInput,
  type PassengerType,
} from "@/lib/routing/types";

const VALID_PASSENGER_TYPES = new Set<PassengerType>([
  "REGULAR",
  "STUDENT",
  "SENIOR",
  "PWD",
]);

/** Philippine national bounding box — hard outer guard. */
const PH_BOUNDS = { latMin: 4, latMax: 22, lngMin: 114, lngMax: 128 } as const;

/** Basey service-area bounding box — operational guard. */
const SERVICE_AREA = {
  latMin: 11.1,
  latMax: 11.5,
  lngMin: 124.8,
  lngMax: 125.3,
} as const;

function isInBounds(
  lat: number,
  lng: number,
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number },
): boolean {
  return (
    lat >= bounds.latMin &&
    lat <= bounds.latMax &&
    lng >= bounds.lngMin &&
    lng <= bounds.lngMax
  );
}

/**
 * Returns the approximate distance in metres between two coordinate pairs.
 * Accurate enough for the snap-distance guard (< 1% error within Samar).
 */
function approxMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLng =
    (a.lng - b.lng) * 111_000 * Math.cos(a.lat * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

const MAX_SNAP_DISTANCE_M = 200;

type RouteApiErrorCode =
  | "INVALID_ROUTE_INPUT"
  | "NO_ROAD_ROUTE_FOUND"
  | "ROUTING_SERVICE_UNAVAILABLE"
  | "ROUTE_UNVERIFIED";

function jsonError(status: number, code: RouteApiErrorCode, error: string) {
  return NextResponse.json({ code, error }, { status });
}

/**
 * Returns true when two coordinate pairs refer to the same point
 * within 4 decimal places (~11 m) — triggers same-point handling.
 */
function isSamePoint(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
}

function parseLocationInput(raw: unknown): LocationInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type === "preset") {
    if (typeof obj.name !== "string" || !obj.name.trim()) return null;
    return { type: "preset", name: obj.name.trim() };
  }
  if (obj.type === "pin") {
    if (typeof obj.lat !== "number" || typeof obj.lng !== "number") return null;
    if (!Number.isFinite(obj.lat) || !Number.isFinite(obj.lng)) return null;
    return { type: "pin", lat: obj.lat, lng: obj.lng };
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    origin: rawOrigin,
    destination: rawDest,
    passengerType: rawPassengerType,
  } = body as Record<string, unknown>;

  // --- Parse LocationInput objects ---
  const originInput = parseLocationInput(rawOrigin);
  if (!originInput) {
    return jsonError(
      400,
      "INVALID_ROUTE_INPUT",
      'Invalid field: origin. Must be { type: "preset", name: string } or { type: "pin", lat: number, lng: number }',
    );
  }

  const destInput = parseLocationInput(rawDest);
  if (!destInput) {
    return jsonError(
      400,
      "INVALID_ROUTE_INPUT",
      'Invalid field: destination. Must be { type: "preset", name: string } or { type: "pin", lat: number, lng: number }',
    );
  }

  // --- passengerType: default REGULAR, uppercase, validate ---
  const passengerTypeUpper: string =
    rawPassengerType == null
      ? "REGULAR"
      : String(rawPassengerType).trim().toUpperCase();

  if (!VALID_PASSENGER_TYPES.has(passengerTypeUpper as PassengerType)) {
    return jsonError(
      400,
      "INVALID_ROUTE_INPUT",
      `Invalid passengerType "${passengerTypeUpper}". Must be one of: REGULAR, STUDENT, SENIOR, PWD`,
    );
  }
  const passengerType = passengerTypeUpper as PassengerType;

  // --- Resolve origin to coordinates ---
  let originCoords: { lat: number; lng: number };
  let originLabel: string;
  let originResolved: ResolvedPinLabel | null = null;

  if (originInput.type === "preset") {
    const resolved = await resolvePlannerLocationByName(originInput.name);
    if (!resolved) {
      return jsonError(400, "INVALID_ROUTE_INPUT", `Unknown location: "${originInput.name}"`);
    }
    originCoords = resolved.coordinates;
    originLabel = resolved.name;
  } else {
    const { lat, lng } = originInput;
    if (!isInBounds(lat, lng, PH_BOUNDS)) {
      console.info("[/api/routes/calculate] validation-failure", {
        code: "INVALID_ROUTE_INPUT",
        reason: "outside_philippines",
        field: "origin",
        lat,
        lng,
      });
      return jsonError(400, "INVALID_ROUTE_INPUT", "Origin pin is outside the Philippines");
    }
    if (!isInBounds(lat, lng, SERVICE_AREA)) {
      console.info("[/api/routes/calculate] validation-failure", {
        code: "INVALID_ROUTE_INPUT",
        reason: "outside_service_area",
        field: "origin",
        lat,
        lng,
      });
      return jsonError(400, "INVALID_ROUTE_INPUT", "Origin pin is outside the Basey service area");
    }
    originCoords = { lat, lng };
    originResolved = resolvePinLabel(lat, lng);
    originLabel = originResolved.displayLabel;
  }

  // --- Resolve destination to coordinates ---
  let destCoords: { lat: number; lng: number };
  let destLabel: string;
  let destinationResolved: ResolvedPinLabel | null = null;

  if (destInput.type === "preset") {
    const resolved = await resolvePlannerLocationByName(destInput.name);
    if (!resolved) {
      return jsonError(400, "INVALID_ROUTE_INPUT", `Unknown location: "${destInput.name}"`);
    }
    destCoords = resolved.coordinates;
    destLabel = resolved.name;
  } else {
    const { lat, lng } = destInput;
    if (!isInBounds(lat, lng, PH_BOUNDS)) {
      console.info("[/api/routes/calculate] validation-failure", {
        code: "INVALID_ROUTE_INPUT",
        reason: "outside_philippines",
        field: "destination",
        lat,
        lng,
      });
      return jsonError(400, "INVALID_ROUTE_INPUT", "Destination pin is outside the Philippines");
    }
    if (!isInBounds(lat, lng, SERVICE_AREA)) {
      console.info("[/api/routes/calculate] validation-failure", {
        code: "INVALID_ROUTE_INPUT",
        reason: "outside_service_area",
        field: "destination",
        lat,
        lng,
      });
      return jsonError(400, "INVALID_ROUTE_INPUT", "Destination pin is outside the Basey service area");
    }
    destCoords = { lat, lng };
    destinationResolved = resolvePinLabel(lat, lng);
    destLabel = destinationResolved.displayLabel;
  }

  // --- inputMode: pin if either side is a pin, otherwise preset ---
  const inputMode: "preset" | "pin" =
    originInput.type === "pin" || destInput.type === "pin" ? "pin" : "preset";

  let activeFarePolicy: FarePolicySnapshotDto;
  try {
    const resolvedFareRates = await getResolvedFareRates();
    activeFarePolicy = resolvedFareRates.current;
  } catch (error) {
    console.error("[/api/routes/calculate] Fare policy resolution failed:", error);
    return jsonError(503, "ROUTING_SERVICE_UNAVAILABLE", "Fare policy is unavailable right now");
  }

  // --- Same-point guard: successful zero-fare result with no road segment ---
  if (isSamePoint(originCoords, destCoords)) {
    console.info("[/api/routes/calculate] same-point-result", {
      outcome: "same_point",
      origin: originLabel,
      destination: destLabel,
    });

    const samePointResponse: CalculatedRouteResponse = {
      origin: originLabel,
      destination: destLabel,
      originResolved,
      destinationResolved,
      distanceKm: 0,
      durationMin: 0,
      fare: 0,
      passengerType,
      fareBreakdown: {
        baseFare: 0,
        additionalKm: 0,
        additionalFare: 0,
        discount: 0,
        total: 0,
      },
      farePolicy: activeFarePolicy,
      method: null,
      provider: null,
      isEstimate: false,
      fallbackReason: null,
      polyline: null,
      snappedOrigin: null,
      snappedDestination: null,
      inputMode,
    };

    return NextResponse.json(samePointResponse);
  }

  // --- Route calculation (ORS shortest road route only) ---
  let route;
  try {
    route = await calculateShortestRoadRoute(originCoords, destCoords);
  } catch (err) {
    if (err instanceof RoutingServiceError) {
      const status =
        err.code === "NO_ROAD_ROUTE_FOUND"
          ? 422
          : err.code === "ROUTE_UNVERIFIED"
            ? err.status ?? 503
            : err.status ?? 503;
      const errorMessage =
        err.code === "NO_ROAD_ROUTE_FOUND"
          ? "No road route could be found between these points."
          : err.code === "ROUTE_UNVERIFIED"
            ? "Route could not be verified right now. Official fare is unavailable."
          : "Routing service unavailable right now.";

      console.warn("[/api/routes/calculate] routing-failure", {
        code: err.code,
        provider: err.provider,
        reason: err.reason,
        status,
        message: err.message,
      });

      return jsonError(status, err.code as RouteApiErrorCode, errorMessage);
    }

    console.error("[/api/routes/calculate] Routing failed:", err);
    return jsonError(503, "ROUTING_SERVICE_UNAVAILABLE", "Routing service unavailable right now.");
  }

  // --- Snap-distance guard for pin inputs ---
  if (originInput.type === "pin" && route.snappedOrigin) {
    const snapDist = approxMeters(originCoords, route.snappedOrigin);
    if (snapDist > MAX_SNAP_DISTANCE_M) {
      console.info("[/api/routes/calculate] routing-failure", {
        code: "NO_ROAD_ROUTE_FOUND",
        reason: "origin_snap_too_far",
        snapDist,
        originCoords,
      });
      return jsonError(
        422,
        "NO_ROAD_ROUTE_FOUND",
        "Origin pin is too far from any road. Please move the pin closer to a road.",
      );
    }
  }
  if (destInput.type === "pin" && route.snappedDestination) {
    const snapDist = approxMeters(destCoords, route.snappedDestination);
    if (snapDist > MAX_SNAP_DISTANCE_M) {
      console.info("[/api/routes/calculate] routing-failure", {
        code: "NO_ROAD_ROUTE_FOUND",
        reason: "destination_snap_too_far",
        snapDist,
        destCoords,
      });
      return jsonError(
        422,
        "NO_ROAD_ROUTE_FOUND",
        "Destination pin is too far from any road. Please move the pin closer to a road.",
      );
    }
  }

  // --- Fare calculation ---
  const fare = calculateFare(route.distanceKm, passengerType, activeFarePolicy);
  const fareBreakdown = getFareBreakdown(route.distanceKm, passengerType, activeFarePolicy);

  const response: CalculatedRouteResponse = {
    origin: originLabel,
    destination: destLabel,
    originResolved,
    destinationResolved,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    fare,
    passengerType,
    fareBreakdown,
    farePolicy: activeFarePolicy,
    method: route.method,
    provider: route.provider,
    isEstimate: route.isEstimate,
    fallbackReason: route.fallbackReason,
    polyline: route.polyline,
    snappedOrigin: route.snappedOrigin,
    snappedDestination: route.snappedDestination,
    inputMode,
  };

  return NextResponse.json(response);
}
