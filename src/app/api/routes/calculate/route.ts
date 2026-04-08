import { NextRequest, NextResponse } from "next/server";
import type { FarePolicySnapshotDto } from "@/lib/contracts";
import { calculateRouteWithFallback } from "@/lib/routing";
import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";
import { getResolvedFareRates } from "@/lib/fare/rateService";
import { resolvePinLabel, type ResolvedPinLabel } from "@/lib/locations/pinLabelResolver";
import { resolvePlannerLocationByName } from "@/lib/locations/plannerLocations";
import { serializePinLabel } from "@/lib/locations/pinSerializer";
import type { PassengerType, LocationInput } from "@/lib/routing/types";

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

/**
 * Returns true when two coordinate pairs refer to the same point
 * within 4 decimal places (~11 m) — triggers minimum-fare path.
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
    return NextResponse.json(
      {
        error:
          'Invalid field: origin. Must be { type: "preset", name: string } or { type: "pin", lat: number, lng: number }',
      },
      { status: 400 },
    );
  }

  const destInput = parseLocationInput(rawDest);
  if (!destInput) {
    return NextResponse.json(
      {
        error:
          'Invalid field: destination. Must be { type: "preset", name: string } or { type: "pin", lat: number, lng: number }',
      },
      { status: 400 },
    );
  }

  // --- passengerType: default REGULAR, uppercase, validate ---
  const passengerTypeUpper: string =
    rawPassengerType == null
      ? "REGULAR"
      : String(rawPassengerType).trim().toUpperCase();

  if (!VALID_PASSENGER_TYPES.has(passengerTypeUpper as PassengerType)) {
    return NextResponse.json(
      {
        error: `Invalid passengerType "${passengerTypeUpper}". Must be one of: REGULAR, STUDENT, SENIOR, PWD`,
      },
      { status: 400 },
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
      return NextResponse.json(
        { error: `Unknown location: "${originInput.name}"` },
        { status: 400 },
      );
    }
    originCoords = resolved.coordinates;
    originLabel = resolved.name;
  } else {
    const { lat, lng } = originInput;
    if (!isInBounds(lat, lng, PH_BOUNDS)) {
      console.info("[calculate] Origin pin rejected: outside Philippines", { lat, lng });
      return NextResponse.json(
        { error: "Origin pin is outside the Philippines" },
        { status: 400 },
      );
    }
    if (!isInBounds(lat, lng, SERVICE_AREA)) {
      console.info("[calculate] Origin pin rejected: outside Basey service area", { lat, lng });
      return NextResponse.json(
        { error: "Origin pin is outside the Basey service area" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: `Unknown location: "${destInput.name}"` },
        { status: 400 },
      );
    }
    destCoords = resolved.coordinates;
    destLabel = resolved.name;
  } else {
    const { lat, lng } = destInput;
    if (!isInBounds(lat, lng, PH_BOUNDS)) {
      console.info("[calculate] Destination pin rejected: outside Philippines", { lat, lng });
      return NextResponse.json(
        { error: "Destination pin is outside the Philippines" },
        { status: 400 },
      );
    }
    if (!isInBounds(lat, lng, SERVICE_AREA)) {
      console.info("[calculate] Destination pin rejected: outside Basey service area", { lat, lng });
      return NextResponse.json(
        { error: "Destination pin is outside the Basey service area" },
        { status: 400 },
      );
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
    return NextResponse.json(
      { error: "Fare policy is unavailable right now" },
      { status: 503 },
    );
  }

  // --- Same-point guard: return minimum fare, not an error ---
  if (isSamePoint(originCoords, destCoords)) {
    console.info("[calculate] Same-point guard triggered → minimum fare", { origin: originLabel, destination: destLabel });
    const fare = calculateFare(0, passengerType, activeFarePolicy);
    const fareBreakdown = getFareBreakdown(0, passengerType, activeFarePolicy);
    return NextResponse.json({
      origin: originLabel,
      destination: destLabel,
      originResolved,
      destinationResolved,
      distanceKm: 0,
      durationMin: 0,
      fare,
      passengerType,
      fareBreakdown,
      farePolicy: activeFarePolicy,
      method: null,
      fallbackReason: null,
      polyline: null,
      snappedOrigin: null,
      snappedDestination: null,
      inputMode,
    });
  }

  // --- Route calculation (ORS → GPS fallback) ---
  let route;
  try {
    route = await calculateRouteWithFallback(originCoords, destCoords);
  } catch (err) {
    console.error("[/api/routes/calculate] Routing failed:", err);
    return NextResponse.json(
      { error: "Routing service unavailable" },
      { status: 503 },
    );
  }

  // --- Snap-distance guard for pin inputs (ORS only; GPS returns null snapped coords) ---
  if (originInput.type === "pin" && route.snappedOrigin) {
    const snapDist = approxMeters(originCoords, route.snappedOrigin);
    if (snapDist > MAX_SNAP_DISTANCE_M) {
      console.info("[calculate] Origin pin too far from road", { snapDist, originCoords });
      return NextResponse.json(
        { error: "Origin pin is too far from any road. Please move the pin closer to a road." },
        { status: 400 },
      );
    }
  }
  if (destInput.type === "pin" && route.snappedDestination) {
    const snapDist = approxMeters(destCoords, route.snappedDestination);
    if (snapDist > MAX_SNAP_DISTANCE_M) {
      console.info("[calculate] Destination pin too far from road", { snapDist, destCoords });
      return NextResponse.json(
        { error: "Destination pin is too far from any road. Please move the pin closer to a road." },
        { status: 400 },
      );
    }
  }

  // --- Fare calculation ---
  const fare = calculateFare(route.distanceKm, passengerType, activeFarePolicy);
  const fareBreakdown = getFareBreakdown(route.distanceKm, passengerType, activeFarePolicy);

  return NextResponse.json({
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
    fallbackReason: route.fallbackReason,
    polyline: route.polyline,
    snappedOrigin: route.snappedOrigin,
    snappedDestination: route.snappedDestination,
    inputMode,
  });
}
