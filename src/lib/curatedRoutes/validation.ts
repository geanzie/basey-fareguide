import { CuratedRouteSource, VehicleType } from "@prisma/client";

import { haversineKm } from "@/lib/routing/geo";
import type { Coordinates } from "@/lib/routing/providers/base";

/**
 * Validation shared by the create and update handlers.
 *
 * A curated distance is priced straight into a fare, so the guards here are
 * deliberately strict: a typo storing kilometres in a metres column would
 * undercharge every trip on that pair until somebody noticed.
 */

/** Far larger than any trip Ordinance 105 covers within Basey. */
export const MAX_CURATED_DISTANCE_METERS = 200_000;

/** Under 10 m is a data-entry slip, not a trip. */
export const MIN_CURATED_DISTANCE_METERS = 10;

export const VALID_VEHICLE_TYPES = new Set<string>(Object.values(VehicleType));
export const VALID_CURATED_SOURCES = new Set<string>(Object.values(CuratedRouteSource));

export interface CuratedRouteValidationError {
  field: string;
  message: string;
}

type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: CuratedRouteValidationError };

export function validateDistanceMeters(value: unknown): Validated<number> {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      error: { field: "distanceMeters", message: "distanceMeters must be a number" },
    };
  }

  if (!Number.isInteger(value)) {
    return {
      ok: false,
      error: {
        field: "distanceMeters",
        message: "distanceMeters must be a whole number of metres",
      },
    };
  }

  if (value < MIN_CURATED_DISTANCE_METERS || value > MAX_CURATED_DISTANCE_METERS) {
    return {
      ok: false,
      error: {
        field: "distanceMeters",
        message: `distanceMeters must be between ${MIN_CURATED_DISTANCE_METERS} and ${MAX_CURATED_DISTANCE_METERS}`,
      },
    };
  }

  return { ok: true, value };
}

export function validateDurationSeconds(value: unknown): Validated<number | null> {
  if (value == null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return {
      ok: false,
      error: {
        field: "durationSeconds",
        message:
          "durationSeconds must be a non-negative whole number of seconds, or null",
      },
    };
  }

  return { ok: true, value };
}


/**
 * Rejects a distance shorter than the straight line between its own endpoints.
 *
 * This is geometry, not a heuristic: a road cannot be shorter than the
 * great-circle path it spans, so anything below that floor is definitively
 * wrong and no survey is needed to say so.
 *
 * It matters because a routing engine asked about two remote points will
 * sometimes snap BOTH onto the same nearby road and return the gap between the
 * snap points rather than a route. The result looks like an ordinary short
 * distance. Seeded in bulk it produced 152 such rows here — Canca-Iyas to
 * Balo-Og stored as 0.55 km against a 3.56 km straight line — and because
 * curated rows outrank every engine, each one is an authoritative undercharge.
 */
export function validateAgainstStraightLine(
  distanceMeters: number,
  origin: Coordinates,
  destination: Coordinates,
): { ok: true; straightLineMeters: number } | { ok: false; message: string } {
  const straightLineMeters = haversineKm(origin, destination) * 1000;

  if (distanceMeters < straightLineMeters) {
    return {
      ok: false,
      message:
        `distanceMeters (${Math.round(distanceMeters)} m) is shorter than the straight-line ` +
        `distance between these places (${Math.round(straightLineMeters)} m), which is not ` +
        `possible. The routing engine most likely snapped both endpoints onto the same road.`,
    };
  }

  return { ok: true, straightLineMeters };
}

/** Parses a Location's "lat,lng" column. */
export function parseStoredCoordinates(raw: string | null | undefined): Coordinates | null {
  if (!raw) return null;

  const [lat, lng] = raw.split(",").map((part) => Number.parseFloat(part.trim()));
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
