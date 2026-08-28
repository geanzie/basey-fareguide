import { NextRequest, NextResponse } from "next/server";
import { VehicleType } from "@prisma/client";
import type { FarePolicySnapshotDto, PlannerLocationDto } from "@/lib/contracts";
import { resolveRouteForQuote } from "@/lib/routing";
import { calculateFare, getFareBreakdown } from "@/lib/fare/calculator";
import { getResolvedFareRates } from "@/lib/fare/rateService";
import { resolvePinLabel, type ResolvedPinLabel } from "@/lib/locations/pinLabelResolver";
import { resolvePlannerLocationByName } from "@/lib/locations/plannerLocations";
import { serializePinLabel } from "@/lib/locations/pinSerializer";
import {
  RoutingServiceError,
  type AccessPolicy,
  type CalculatedRouteResponse,
  type DropoffNotice,
  type LocationInput,
  type PassengerType,
  type RouteField,
  type BlockedVehicleAccessVerdict,
} from "@/lib/routing/types";
import { approxMeters } from "@/lib/routing/geo";
import {
  verifyVehicleAccess,
  type CuratedAccess,
} from "@/lib/routing/vehicleAccess";
import { requiresTwoWheelerNotice } from "@/lib/routing/vehicleProfiles";
import { evaluateRouteTerrain } from "@/lib/routing/terrainService";

const VALID_PASSENGER_TYPES = new Set<PassengerType>([
  "REGULAR",
  "STUDENT",
  "SENIOR",
  "PWD",
]);

/**
 * Derived from the Prisma enum rather than hand-listed, so a new vehicle type
 * is accepted here the moment it exists in the schema.
 */
const VALID_VEHICLE_TYPES = new Set<string>(Object.values(VehicleType));

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

type RouteApiErrorCode =
  | "INVALID_ROUTE_INPUT"
  | "NO_ROAD_ROUTE_FOUND"
  | "ROUTING_SERVICE_UNAVAILABLE"
  | "ROUTE_UNVERIFIED"
  | "NO_VEHICLE_ACCESS"
  | "NO_ROUTE_FOR_VEHICLE"
  | "ROUTE_BLOCKED_BY_RESTRICTION";

function jsonError(
  status: number,
  code: RouteApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { code, message, ...(details ? { details } : {}) },
    { status },
  );
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

/**
 * Applies a saved Place's curated ride-access facts.
 *
 * A Place marked WALK_ONLY carries the point a ride can actually reach — a
 * school gate on the main road rather than the pin inside the campus. The trip
 * is quoted to that point and the rider is told about the walk, instead of
 * being handed a fare no driver can complete.
 */
function applyCuratedAccess(
  field: RouteField,
  place: PlannerLocationDto,
  coords: { lat: number; lng: number },
): {
  coords: { lat: number; lng: number };
  curated: CuratedAccess | null;
  notice: DropoffNotice | null;
} {
  const vetted: CuratedAccess = {
    vehicleAccess: "VEHICLE_ACCESSIBLE",
    dropoff: null,
    label: place.name,
  };

  if (place.vehicleAccess === "VEHICLE_ACCESSIBLE") {
    return { coords, curated: vetted, notice: null };
  }

  if (place.vehicleAccess === "WALK_ONLY" && place.dropoffCoordinates) {
    const dropoff = place.dropoffCoordinates;

    return {
      // The drop-off is itself a vetted road point, so the live guard can skip it.
      coords: dropoff,
      curated: vetted,
      notice: {
        field,
        requestedLabel: place.name,
        label: `${place.name} drop-off`,
        lat: dropoff.lat,
        lng: dropoff.lng,
        walkMeters: Math.round(approxMeters(dropoff, coords)),
        note: place.accessNote ?? null,
      },
    };
  }

  // WALK_ONLY with no drop-off recorded yet, or UNVERIFIED: let the live guard decide.
  return { coords, curated: null, notice: null };
}

/**
 * Decides whether a coordinate is a doorstep or an area centroid.
 *
 * Barangay and sitio coordinates are polygon centroids — 36 of Basey's 51
 * barangays sit over 80 m from any road for that reason alone. Holding them to
 * a doorstep-reachability test refuses fares that Ordinance 105 plainly covers.
 */
function accessPolicyFor(
  input: LocationInput,
  place: PlannerLocationDto | null,
): AccessPolicy {
  if (input.type === "pin") return "doorstep";
  return place && (place.category === "barangay" || place.category === "sitio")
    ? "area"
    : "doorstep";
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

/**
 * Validates coordinates resolved from a preset Place name.
 *
 * Pin inputs are bounds-checked before use; preset inputs used to skip this
 * entirely and trust the Location row. A single bad row (coordinate typo, a
 * validation that resolved to the wrong municipality) would then produce a fare
 * from a coordinate the pin path would have refused, so presets are held to the
 * same guard.
 */
function validateResolvedCoordinates(
  coords: { lat: number; lng: number },
  field: "origin" | "destination",
  name: string,
): NextResponse | null {
  if (!isInBounds(coords.lat, coords.lng, PH_BOUNDS)) {
    console.warn("[/api/routes/calculate] validation-failure", {
      code: "INVALID_ROUTE_INPUT",
      reason: "preset_outside_philippines",
      field,
      name,
      ...coords,
    });
    return jsonError(
      400,
      "INVALID_ROUTE_INPUT",
      `Location "${name}" has coordinates outside the Philippines`,
    );
  }
  if (!isInBounds(coords.lat, coords.lng, SERVICE_AREA)) {
    console.warn("[/api/routes/calculate] validation-failure", {
      code: "INVALID_ROUTE_INPUT",
      reason: "preset_outside_service_area",
      field,
      name,
      ...coords,
    });
    return jsonError(
      400,
      "INVALID_ROUTE_INPUT",
      `Location "${name}" is outside the Basey service area`,
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const {
    origin: rawOrigin,
    destination: rawDest,
    passengerType: rawPassengerType,
    vehicleType: rawVehicleType,
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

  // --- vehicleType: optional. Absent means "no vehicle context", which routes
  // as a car — exactly what every quote did before this parameter existed. ---
  let vehicleType: VehicleType | null = null;

  if (rawVehicleType != null && String(rawVehicleType).trim() !== "") {
    const vehicleTypeUpper = String(rawVehicleType).trim().toUpperCase();

    if (!VALID_VEHICLE_TYPES.has(vehicleTypeUpper)) {
      return jsonError(
        400,
        "INVALID_ROUTE_INPUT",
        `Invalid vehicleType "${vehicleTypeUpper}". Must be one of: ${[...VALID_VEHICLE_TYPES].join(", ")}`,
      );
    }

    vehicleType = vehicleTypeUpper as VehicleType;
  }

  // --- Resolve origin to coordinates ---
  // Fire both preset lookups in parallel to eliminate sequential waterfall.
  const [originPresetResult, destPresetResult] = await Promise.all([
    originInput.type === 'preset' ? resolvePlannerLocationByName(originInput.name) : Promise.resolve(null),
    destInput.type === 'preset' ? resolvePlannerLocationByName(destInput.name) : Promise.resolve(null),
  ]);

  let originCoords: { lat: number; lng: number };
  let originLabel: string;
  let originResolved: ResolvedPinLabel | null = null;

  if (originInput.type === "preset") {
    const resolved = originPresetResult;
    if (!resolved) {
      return jsonError(400, "INVALID_ROUTE_INPUT", `Unknown location: "${originInput.name}"`);
    }
    const outOfBounds = validateResolvedCoordinates(
      resolved.coordinates,
      "origin",
      resolved.name,
    );
    if (outOfBounds) return outOfBounds;
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
    const resolved = destPresetResult;
    if (!resolved) {
      return jsonError(400, "INVALID_ROUTE_INPUT", `Unknown location: "${destInput.name}"`);
    }
    const outOfBounds = validateResolvedCoordinates(
      resolved.coordinates,
      "destination",
      resolved.name,
    );
    if (outOfBounds) return outOfBounds;
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

  // --- Curated ride access for saved places ---
  const dropoffNotices: DropoffNotice[] = [];
  let originCurated: CuratedAccess | null = null;
  let destCurated: CuratedAccess | null = null;

  if (originPresetResult) {
    const applied = applyCuratedAccess("origin", originPresetResult, originCoords);
    originCoords = applied.coords;
    originCurated = applied.curated;
    if (applied.notice) dropoffNotices.push(applied.notice);
  }

  if (destPresetResult) {
    const applied = applyCuratedAccess("destination", destPresetResult, destCoords);
    destCoords = applied.coords;
    destCurated = applied.curated;
    if (applied.notice) dropoffNotices.push(applied.notice);
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
      vehicleType,
      // No provider was consulted, so no provider notice applies.
      twoWheelerNotice: false,
      // No route means no terrain to read.
      routeValidity: null,
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
      dropoffNotices,
    };

    return NextResponse.json(samePointResponse);
  }

  // --- Route calculation (ORS shortest road route only) ---
  let route;
  try {
    // Tier 1 is the curated corpus, which only applies when both ends resolved
    // to saved places. Both lookups already ran in parallel above.
    route = await resolveRouteForQuote({
      origin: originCoords,
      destination: destCoords,
      originLocationId: originPresetResult?.id ?? null,
      destinationLocationId: destPresetResult?.id ?? null,
      vehicleType,
    });
  } catch (err) {
    if (err instanceof RoutingServiceError) {
      const status =
        err.code === "NO_ROAD_ROUTE_FOUND"
          ? 422
          : err.code === "ROUTE_BLOCKED_BY_RESTRICTION"
            ? 422
            : err.code === "ROUTE_UNVERIFIED"
              ? err.status ?? 503
              : err.status ?? 503;
      const errorMessage =
        err.code === "NO_ROAD_ROUTE_FOUND"
          ? "No road route could be found between these points."
          : // A closure is a fact about the road, so the admin's own wording
            // reaches the rider rather than a generic failure.
            err.code === "ROUTE_BLOCKED_BY_RESTRICTION"
            ? err.message
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

  // --- Ride-access guard ---
  // Runs for pins and saved places alike, at both ends of the trip. It used to
  // run for pins only, so a saved place whose coordinate sat off the drivable
  // network — a school reachable only up a flight of stairs — was quoted a fare
  // no habal-habal or tricycle could complete.
  const originPolicy = accessPolicyFor(originInput, originPresetResult);
  const destPolicy = accessPolicyFor(destInput, destPresetResult);

  const [originAccess, destAccess] = await Promise.all([
    verifyVehicleAccess({
      field: "origin",
      policy: originPolicy,
      requested: originCoords,
      label: originLabel,
      snapped: route.snappedOrigin,
      curated: originCurated,
    }),
    verifyVehicleAccess({
      field: "destination",
      policy: destPolicy,
      requested: destCoords,
      label: destLabel,
      snapped: route.snappedDestination,
      curated: destCurated,
    }),
  ]);

  // An area centroid that snapped far out is reported, not refused: the ride
  // stops where the road into the barangay ends, and the rider is told so.
  for (const verdict of [originAccess, destAccess]) {
    if (verdict.status === "reachable") continue;
    const policy = verdict.field === "origin" ? originPolicy : destPolicy;
    if (policy !== "area") continue;

    const label = verdict.field === "origin" ? originLabel : destLabel;
    const point =
      verdict.status === "walk_only"
        ? verdict.dropoff
        : verdict.field === "origin"
          ? route.snappedOrigin
          : route.snappedDestination;
    if (!point) continue;

    dropoffNotices.push({
      field: verdict.field,
      requestedLabel: label,
      label: `the road into ${label}`,
      lat: point.lat,
      lng: point.lng,
      walkMeters: verdict.snapMeters,
      note: null,
    });
  }

  // Destination first: it is the end the rider just chose.
  const blocked: BlockedVehicleAccessVerdict | undefined = [
    destAccess,
    originAccess,
  ].find(
    (verdict): verdict is BlockedVehicleAccessVerdict =>
      verdict.status !== "reachable" &&
      (verdict.field === "origin" ? originPolicy : destPolicy) === "doorstep",
  );

  if (blocked) {
    const blockedLabel = blocked.field === "origin" ? originLabel : destLabel;

    if (blocked.status === "no_road") {
      console.info("[/api/routes/calculate] routing-failure", {
        code: "NO_ROAD_ROUTE_FOUND",
        reason:
          blocked.field === "origin"
            ? "origin_snap_too_far"
            : "destination_snap_too_far",
        field: blocked.field,
        snapMeters: blocked.snapMeters,
      });

      // A rider cannot "move the pin" on a saved place, so the advice differs by
      // how the location was given. Both keep the "too far from any road"
      // wording, which classifyPlannerError in lib/planner/routePlanner.ts
      // substring-matches.
      const blockedInput = blocked.field === "origin" ? originInput : destInput;
      const end = blocked.field === "origin" ? "Origin" : "Destination";

      return jsonError(
        422,
        "NO_ROAD_ROUTE_FOUND",
        blockedInput.type === "pin"
          ? `${end} pin is too far from any road. Please move the pin closer to a road.`
          : `${blockedLabel} is too far from any road for a habal-habal or tricycle. Pick a nearby place instead.`,
      );
    }

    console.info("[/api/routes/calculate] routing-failure", {
      code: "NO_VEHICLE_ACCESS",
      reason: "no_vehicle_access",
      field: blocked.field,
      snapMeters: blocked.snapMeters,
      walkMeters: blocked.dropoff.walkMeters,
      dropoffSource: blocked.dropoff.source,
    });

    return jsonError(
      422,
      "NO_VEHICLE_ACCESS",
      `Habal-habal and tricycles can only reach ${blocked.dropoff.label}. The last ${blocked.dropoff.walkMeters} m to ${blockedLabel} is on foot.`,
      { field: blocked.field, dropoff: blocked.dropoff },
    );
  }

  // --- Terrain check ---
  // Runs on whichever tier produced the route, because it works from the
  // polyline. It NEVER feeds the fare: Ordinance 105 prices distance, and
  // letting grade move the number would be a terrain surcharge. It decides
  // validity only, and only once an admin has armed the gate for this vehicle.
  const terrain = await evaluateRouteTerrain(route.polyline, vehicleType);

  if (terrain.shouldBlock) {
    console.info("[/api/routes/calculate] no-route-for-vehicle", {
      vehicleType,
      maxGradePercent: terrain.verdict.maxGradePercent,
      thresholdPercent: terrain.verdict.thresholdPercent,
      demResolutionM: terrain.verdict.demResolutionM,
    });

    return jsonError(
      422,
      "NO_ROUTE_FOR_VEHICLE",
      `No ${vehicleType?.toLowerCase().replace(/_/g, "-") ?? "vehicle"}-passable route: the only road climbs ${terrain.verdict.maxGradePercent?.toFixed(0)}%, above the ${terrain.verdict.thresholdPercent}% limit for this vehicle.`,
    );
  }

  // --- Fare calculation ---
  const fare = calculateFare(route.distanceKm, passengerType, activeFarePolicy);
  const fareBreakdown = getFareBreakdown(route.distanceKm, passengerType, activeFarePolicy);

  const response: CalculatedRouteResponse = {
    origin: originLabel,
    destination: destLabel,
    vehicleType,
    twoWheelerNotice: requiresTwoWheelerNotice(vehicleType, route.provider),
    routeValidity: {
      ...terrain.verdict,
      enforced: terrain.shouldBlock,
    },
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
    dropoffNotices,
  };

  return NextResponse.json(response);
}
