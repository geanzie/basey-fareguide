/**
 * Mirrors frontend/src/lib/contracts/locations.ts. These are hand-maintained —
 * changing the contract means changing both sides.
 */

export interface PlaceCoordinates {
  lat: number;
  lng: number;
}

export type PlaceCategory = 'barangay' | 'landmark' | 'sitio';

/** Whether a habal-habal or tricycle can reach a Place's coordinate. */
export type PlaceVehicleAccess = 'UNVERIFIED' | 'VEHICLE_ACCESSIBLE' | 'WALK_ONLY';

/** How a Place's coordinate was produced. See the contract for why it travels. */
export type PlacePointSource =
  | 'barangay_hall'
  | 'polygon_centroid'
  | 'field_gps'
  | 'osm'
  | 'manual'
  | 'unknown';

export interface Place {
  id: string;
  name: string;
  type: string;
  category: PlaceCategory;
  coordinates: PlaceCoordinates;
  address: string;
  /** True only when a real Google reverse-geocode confirmed the coordinate. */
  verified: boolean;
  source: string;
  pointSource: PlacePointSource;
  /** Set when the coordinate is too imprecise to quote a fare from. */
  needsResurvey?: boolean;
  barangay?: string;
  description?: string;
  /** Absent from servers older than the ride-access guard. */
  vehicleAccess?: PlaceVehicleAccess;
  /** Where the ride stops when vehicleAccess is WALK_ONLY. */
  dropoffCoordinates?: PlaceCoordinates;
  accessNote?: string;
  updatedAt: string;
}

export interface PlacesResponse {
  success: boolean;
  locations: Place[];
  count: number;
}

/**
 * A coordinate named after the barangay whose polygon contains it.
 * Mirrors PinLabelDto in frontend/src/lib/contracts/locations.ts.
 *
 * Resolved server-side because the barangay polygons are a 267 KB bundle asset
 * on the web side, not something worth shipping in the app.
 */
export interface PinLabel {
  /** The barangay name, or the raw "lat, lng" string when outside every polygon. */
  displayLabel: string;
  barangayName: string | null;
  rawCoordinates: string;
  isFallback: boolean;
}

/**
 * A geocoded suggestion. Never authoritative: it becomes a Pin once the user
 * confirms it on the map, and is then bounds-checked server-side like any pin.
 */
export interface PlaceCandidate {
  label: string;
  address: string;
  coordinates: PlaceCoordinates;
}

/** What fills one end of a trip. */
export type PlaceSelection =
  | { kind: 'place'; place: Place }
  | { kind: 'pin'; coordinates: PlaceCoordinates; label?: string };

export function selectionCoordinates(selection: PlaceSelection): PlaceCoordinates {
  return selection.kind === 'place' ? selection.place.coordinates : selection.coordinates;
}

export function selectionLabel(selection: PlaceSelection): string {
  if (selection.kind === 'place') return selection.place.name;
  return selection.label ?? 'Dropped pin';
}
