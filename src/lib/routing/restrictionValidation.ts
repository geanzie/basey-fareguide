import {
  RoadRestrictionGeometry,
  RoadRestrictionKind,
  VehicleType,
} from "@prisma/client";

/**
 * Validation for admin road restrictions.
 *
 * A malformed geometry here does not error loudly — it silently stops
 * restricting anything, which is the worst failure mode this layer could have.
 * So the shape is checked on the way in rather than trusted at route time.
 */

export const VALID_RESTRICTION_KINDS = new Set<string>(Object.values(RoadRestrictionKind));
export const VALID_GEOMETRY_TYPES = new Set<string>(Object.values(RoadRestrictionGeometry));
export const VALID_VEHICLE_TYPES = new Set<string>(Object.values(VehicleType));

export type GeometryCheck = { ok: true } | { ok: false; message: string };

function isFiniteLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function validateGeometry(geometryType: string, geometry: unknown): GeometryCheck {
  if (geometry == null || typeof geometry !== "object") {
    return { ok: false, message: "geometry must be an object" };
  }

  if (geometryType === "POLYGON") {
    const value = geometry as { type?: unknown; coordinates?: unknown };

    if (value.type !== "Polygon") {
      return { ok: false, message: 'geometry.type must be "Polygon"' };
    }

    const rings = value.coordinates;
    if (!Array.isArray(rings) || rings.length === 0) {
      return { ok: false, message: "geometry.coordinates must be a non-empty array of rings" };
    }

    const outer = rings[0];
    if (!Array.isArray(outer) || outer.length < 4) {
      // GeoJSON requires a closed ring, so the minimum is 4 positions.
      return {
        ok: false,
        message: "the outer ring needs at least 4 positions and must be closed",
      };
    }

    for (const position of outer) {
      if (!Array.isArray(position) || position.length < 2) {
        return { ok: false, message: "each position must be [lng, lat]" };
      }
      if (!isFiniteLatLng(position[1], position[0])) {
        return { ok: false, message: "a ring position is not a valid [lng, lat]" };
      }
    }

    const [firstLng, firstLat] = outer[0] as [number, number];
    const [lastLng, lastLat] = outer[outer.length - 1] as [number, number];

    if (firstLng !== lastLng || firstLat !== lastLat) {
      return { ok: false, message: "the outer ring must be closed (first position repeated last)" };
    }

    return { ok: true };
  }

  if (geometryType === "POINT") {
    const value = geometry as { lat?: unknown; lng?: unknown };

    if (!isFiniteLatLng(value.lat, value.lng)) {
      return { ok: false, message: "geometry must be { lat, lng }" };
    }

    return { ok: true };
  }

  if (geometryType === "OSM_WAY") {
    const value = geometry as { wayIds?: unknown };

    if (
      !Array.isArray(value.wayIds) ||
      value.wayIds.length === 0 ||
      !value.wayIds.every((id) => Number.isInteger(id))
    ) {
      return { ok: false, message: "geometry must be { wayIds: [integer, ...] }" };
    }

    return { ok: true };
  }

  return { ok: false, message: `unsupported geometryType "${geometryType}"` };
}

export function parseEffectiveWindow(
  from: unknown,
  to: unknown,
): { ok: true; from: Date | null; to: Date | null } | { ok: false; message: string } {
  const parse = (value: unknown, field: string) => {
    if (value == null || value === "") return { ok: true as const, date: null };
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return { ok: false as const, message: `${field} must be a valid date` };
    }
    return { ok: true as const, date };
  };

  const parsedFrom = parse(from, "effectiveFrom");
  if (!parsedFrom.ok) return { ok: false, message: parsedFrom.message };

  const parsedTo = parse(to, "effectiveTo");
  if (!parsedTo.ok) return { ok: false, message: parsedTo.message };

  if (parsedFrom.date && parsedTo.date && parsedFrom.date > parsedTo.date) {
    return { ok: false, message: "effectiveFrom must not be after effectiveTo" };
  }

  return { ok: true, from: parsedFrom.date, to: parsedTo.date };
}
