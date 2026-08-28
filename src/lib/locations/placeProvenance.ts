/**
 * Provenance for Place coordinates.
 *
 * The Location table does not record *how* a coordinate was produced, but the
 * seed dataset does. This module reads that dataset once and exposes the point
 * source (and a precision warning) keyed by normalized name, so the Place DTO
 * can carry honest provenance instead of a hardcoded `verified: true`.
 *
 * Rows created through the admin UI are not in the dataset and report "unknown".
 *
 * TODO: promote `pointSource` to a real Location column so runtime-created rows
 * can record it too. Deriving it here is a stopgap that avoids a migration.
 */

import locationsData from "@/data/basey-locations.json";
import type { PlacePointSource } from "@/lib/contracts";

/**
 * Coordinates with fewer than this many decimal places are too coarse to quote
 * a fare from — 3dp is roughly ±110 m, 2dp roughly ±1.1 km.
 */
const MIN_TRUSTWORTHY_DECIMALS = 4;

interface DatasetEntry {
  name: string;
  coordinates: { lat: number; lng: number };
  source?: string;
  /** Explicit override; set on entries whose point was deliberately chosen. */
  pointSource?: string;
}

interface LocationsJson {
  locations: {
    barangay: DatasetEntry[];
    landmark: DatasetEntry[];
    sitio: DatasetEntry[];
  };
}

export interface PlaceProvenance {
  pointSource: PlacePointSource;
  needsResurvey: boolean;
}

const VALID_POINT_SOURCES = new Set<PlacePointSource>([
  "barangay_hall",
  "polygon_centroid",
  "field_gps",
  "osm",
  "manual",
  "unknown",
]);

/** Dataset `source` values map onto the rule that produced the point. */
function pointSourceFromDatasetSource(source: string | undefined): PlacePointSource {
  switch (source) {
    case "geojson":
      return "polygon_centroid";
    case "osm":
      return "osm";
    case "manual":
      return "manual";
    default:
      return "unknown";
  }
}

function decimalPlaces(value: number): number {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function isTooCoarse(coordinates: { lat: number; lng: number }): boolean {
  return (
    Math.min(decimalPlaces(coordinates.lat), decimalPlaces(coordinates.lng)) <
    MIN_TRUSTWORTHY_DECIMALS
  );
}

export function normalizeProvenanceKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildMap(): Map<string, PlaceProvenance> {
  const { locations } = locationsData as unknown as LocationsJson;
  const map = new Map<string, PlaceProvenance>();

  for (const entry of [...locations.barangay, ...locations.landmark, ...locations.sitio]) {
    const explicit = entry.pointSource as PlacePointSource | undefined;
    map.set(normalizeProvenanceKey(entry.name), {
      pointSource:
        explicit && VALID_POINT_SOURCES.has(explicit)
          ? explicit
          : pointSourceFromDatasetSource(entry.source),
      needsResurvey: isTooCoarse(entry.coordinates),
    });
  }

  return map;
}

const provenanceByName = buildMap();

const UNKNOWN_PROVENANCE: PlaceProvenance = {
  pointSource: "unknown",
  needsResurvey: false,
};

export function getPlaceProvenance(name: string): PlaceProvenance {
  return provenanceByName.get(normalizeProvenanceKey(name)) ?? UNKNOWN_PROVENANCE;
}
