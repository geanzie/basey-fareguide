export interface LocationCoordinatesDto {
  lat: number;
  lng: number;
}

export type PlannerLocationCategory = "barangay" | "landmark" | "sitio";

/**
 * How a Place's coordinate was produced. A coordinate is only as defensible as
 * the rule that produced it, so the rule travels with it — barangay points are
 * a deliberate mix of hall coordinates (where one is known) and polygon
 * centroids (everywhere else), and a disputed fare is unexplainable without it.
 */
export type PlacePointSource =
  | "barangay_hall"
  | "polygon_centroid"
  | "field_gps"
  | "osm"
  | "manual"
  | "unknown";

/**
 * Whether a habal-habal or tricycle can actually reach a Place's coordinate.
 * "WALK_ONLY" means the road stops short and the last stretch is footpath or
 * stairs — those Places carry a drop-off point the ride can reach instead.
 */
export type PlaceVehicleAccess =
  | "UNVERIFIED"
  | "VEHICLE_ACCESSIBLE"
  | "WALK_ONLY";

export interface PlannerLocationDto {
  id: string;
  name: string;
  type: string;
  category: PlannerLocationCategory;
  coordinates: LocationCoordinatesDto;
  address: string;
  /**
   * True only when a real Google reverse-geocode confirmed this location — i.e.
   * the row carries a googlePlaceId. Seeded rows do not, so they report false.
   */
  verified: boolean;
  source: string;
  pointSource: PlacePointSource;
  /** Set when the coordinate is known to be too imprecise to quote a fare from. */
  needsResurvey?: boolean;
  barangay?: string;
  description?: string;
  /** Whether a ride can reach this coordinate. Defaults to "UNVERIFIED". */
  vehicleAccess: PlaceVehicleAccess;
  /** Where the ride stops when vehicleAccess is "WALK_ONLY". */
  dropoffCoordinates?: LocationCoordinatesDto;
  /** Rider-facing note about the walk, e.g. "Stairs from the gate to the campus." */
  accessNote?: string;
  updatedAt: string;
}

/**
 * A Place as it appears in the ride-access review queue: enough to judge
 * whether a habal-habal or tricycle can reach the coordinate, and to record
 * where it should stop instead.
 */
export interface LocationRideAccessDto {
  id: string;
  name: string;
  barangay: string | null;
  coordinates: LocationCoordinatesDto;
  vehicleAccess: PlaceVehicleAccess;
  dropoffCoordinates: LocationCoordinatesDto | null;
  accessNote: string | null;
  accessVerifiedAt: string | null;
  updatedAt: string;
}

/**
 * A coordinate resolved to the barangay whose polygon contains it.
 *
 * Mirrors ResolvedPinLabel in @/lib/locations/pinLabelResolver. The web app
 * resolves pins locally against the bundled barangay polygons; the mobile app
 * has no such data on device and reads this shape from
 * GET /api/locations/pin-label instead.
 */
export interface PinLabelDto {
  /** The barangay name, or the raw "lat, lng" string when outside every polygon. */
  displayLabel: string;
  barangayName: string | null;
  rawCoordinates: string;
  /** True when no barangay contained the point and displayLabel is the coordinate. */
  isFallback: boolean;
}
