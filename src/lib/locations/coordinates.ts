/**
 * SINGLE AUTHORITATIVE SOURCE for location coordinates used in routing and fare calculation.
 *
 * baseyCenter.ts is DISPLAY-ONLY (map centering / marker render).
 * Do NOT add coordinate lookups there.
 *
 * At module load this file:
 *  1. Iterates all barangay + landmark + sitio entries in basey-locations.json.
 *  2. Builds two lookup maps:
 *     - displayMap  — keyed by exact original name (preserves case)
 *     - normalizedMap — keyed by trim + collapse-whitespace + lowercase name
 *  3. Throws immediately if two entries produce the same normalized key
 *     (duplicate-name protection).
 */

import locationsData from "@/data/basey-locations.json";

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

interface LocationEntry {
  name: string;
  coordinates: LocationCoordinates;
}

interface LocationsJson {
  locations: {
    barangay: LocationEntry[];
    landmark: LocationEntry[];
    sitio: LocationEntry[];
  };
}

function normalizeKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildMaps(): {
  displayMap: Map<string, LocationCoordinates>;
  normalizedMap: Map<string, LocationCoordinates>;
} {
  const displayMap = new Map<string, LocationCoordinates>();
  const normalizedMap = new Map<string, LocationCoordinates>();
  const data = locationsData as LocationsJson;

  const allEntries: LocationEntry[] = [
    ...data.locations.barangay,
    ...data.locations.landmark,
    ...data.locations.sitio,
  ];

  for (const entry of allEntries) {
    const key = normalizeKey(entry.name);
    if (normalizedMap.has(key)) {
      throw new Error(
        `Duplicate location key after normalization: "${key}" (from name: "${entry.name}")`
      );
    }
    const coords: LocationCoordinates = {
      lat: entry.coordinates.lat,
      lng: entry.coordinates.lng,
    };
    displayMap.set(entry.name, coords);
    normalizedMap.set(key, coords);
  }

  return { displayMap, normalizedMap };
}

// Build at module load — any duplicate throws before the first request is served.
const { displayMap, normalizedMap } = buildMaps();

/**
 * Resolve a location name to coordinates.
 * Tries exact match first, then normalized (case-insensitive, whitespace-collapsed) match.
 * Returns null if the name is not found.
 */
export function resolveCoordinates(name: string): LocationCoordinates | null {
  return displayMap.get(name) ?? normalizedMap.get(normalizeKey(name)) ?? null;
}

/**
 * Return all known location names (exact original casing).
 */
export function getLocationNames(): string[] {
  return Array.from(displayMap.keys());
}
