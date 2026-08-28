import type { VehicleType } from "@prisma/client";

/**
 * How each vehicle type is expressed to each routing provider.
 *
 * One table, because the alternative is the same six-way switch repeated in
 * three provider files that then drift apart.
 *
 * THE RULE THAT GOVERNS THIS FILE: a fare-quoting request must never carry
 * discretionary cost shaping. Ordinance 105 prices distance, so anything that
 * makes the router prefer a longer road — Valhalla's `use_hills`, ORS's
 * steepness weighting — raises the fare for terrain. That is a terrain
 * surcharge by the back door, and it is not ours to levy.
 *
 * Hard *access* rules are a different thing and are welcome: a surface a
 * tricycle cannot cross changes whether a road is usable, not what it costs.
 *
 * So each vehicle gets two shapes. `valhallaFareOptions` is the ordinance-safe
 * one and is the only shape a quote may use. `valhallaDisplayOptions` is for
 * duration estimates and route drawing, where preferring the road a driver
 * would actually pick is a feature.
 */

/** Valhalla costing model name. */
export type ValhallaCosting = "auto" | "bus" | "motorcycle" | "motor_scooter";

/** Google Routes API travel mode. */
export type GoogleTravelMode = "DRIVE" | "TWO_WHEELER";

/** OpenRouteService profile. ORS has no motorised two-wheeler profile at all. */
export type OrsRoutingProfile = "driving-car";

export interface VehicleRoutingProfile {
  valhallaCosting: ValhallaCosting;
  /** Ordinance-safe. `shortest: true` plus hard limits only. */
  valhallaFareOptions: Record<string, unknown>;
  /** Duration and drawing only. Never used for a quote. */
  valhallaDisplayOptions: Record<string, unknown>;
  googleTravelMode: GoogleTravelMode;
  orsProfile: OrsRoutingProfile;
  /** ORS `options.avoid_features`. Empty means the key is omitted entirely. */
  orsAvoidFeatures: readonly string[];
  /**
   * Set when ORS cannot represent this vehicle at all, so a route from the ORS
   * tier silently ignored the vehicle type. Reported on the result rather than
   * hidden, because a habal-habal quoted as a car is a longer quote and the
   * rider deserves to know the number is a car's.
   */
  orsFallbackReason: string | null;
  /**
   * Steepest sustained upward grade this vehicle can climb, in percent.
   *
   * Engineering judgement, not an ordinance figure. These are the seed values
   * for `VehicleRoutingProfile` rows in the database, which is where they live
   * once the grade gate ships, so they can be corrected against what Basey
   * drivers actually report without a deploy.
   */
  maxUpwardGradePercent: number;
}

/**
 * Used when the caller supplied no vehicle type. Byte-for-byte the behaviour
 * every caller had before this table existed.
 */
export const DEFAULT_VEHICLE_PROFILE: VehicleRoutingProfile = {
  valhallaCosting: "auto",
  valhallaFareOptions: { shortest: true },
  valhallaDisplayOptions: {},
  googleTravelMode: "DRIVE",
  orsProfile: "driving-car",
  orsAvoidFeatures: [],
  orsFallbackReason: null,
  maxUpwardGradePercent: 15,
};

export const ORS_VEHICLE_PROFILE_UNAVAILABLE = "vehicle_profile_unavailable_ors";

export const VEHICLE_ROUTING_PROFILES: Record<VehicleType, VehicleRoutingProfile> = {
  /**
   * Motorcycle. Valhalla's `motorcycle` costing has no surface gate in
   * `Allowed()`, so under `shortest: true` it will already use the tracks and
   * paths a habal-habal really does use — which is the whole point, since
   * routing these as cars is what makes today's quoted distances too long.
   *
   * `use_trails` defaults to 0.0 and would otherwise steer away from exactly
   * those ways, so it is raised — but only on the display shape, because it is
   * a cost preference and cost preferences move the fare.
   */
  HABAL_HABAL: {
    valhallaCosting: "motorcycle",
    valhallaFareOptions: { shortest: true },
    valhallaDisplayOptions: { use_trails: 1.0, top_speed: 60 },
    googleTravelMode: "TWO_WHEELER",
    orsProfile: "driving-car",
    orsAvoidFeatures: [],
    orsFallbackReason: ORS_VEHICLE_PROFILE_UNAVAILABLE,
    maxUpwardGradePercent: 25,
  },

  /**
   * Tricycle: a motorcycle with a sidecar. Valhalla's `motor_scooter` costing
   * refuses any surface worse than dirt inside `Allowed()` — gravel, path and
   * impassable are rejected outright, independent of cost. That is correct
   * tricycle behaviour handed to us for free, at the access layer where it
   * belongs.
   *
   * Google gets DRIVE, deliberately, even though TWO_WHEELER is nominally
   * closer: TWO_WHEELER happily routes down narrow motorcycle cut-throughs a
   * sidecar cannot fit, and Google returns no width or surface data to gate on.
   * A quote that is slightly too long is defensible. One down a road the driver
   * physically cannot take is not.
   */
  TRICYCLE: {
    valhallaCosting: "motor_scooter",
    valhallaFareOptions: { shortest: true, top_speed: 40 },
    valhallaDisplayOptions: { top_speed: 40, use_primary: 0.3 },
    googleTravelMode: "DRIVE",
    orsProfile: "driving-car",
    orsAvoidFeatures: ["ferries", "fords"],
    orsFallbackReason: ORS_VEHICLE_PROFILE_UNAVAILABLE,
    maxUpwardGradePercent: 12,
  },

  JEEPNEY: {
    valhallaCosting: "auto",
    valhallaFareOptions: { shortest: true },
    valhallaDisplayOptions: {},
    googleTravelMode: "DRIVE",
    orsProfile: "driving-car",
    orsAvoidFeatures: [],
    orsFallbackReason: null,
    maxUpwardGradePercent: 15,
  },

  MULTICAB: {
    valhallaCosting: "auto",
    valhallaFareOptions: { shortest: true },
    valhallaDisplayOptions: {},
    googleTravelMode: "DRIVE",
    orsProfile: "driving-car",
    orsAvoidFeatures: [],
    orsFallbackReason: null,
    maxUpwardGradePercent: 15,
  },

  VAN: {
    valhallaCosting: "auto",
    valhallaFareOptions: { shortest: true },
    valhallaDisplayOptions: {},
    googleTravelMode: "DRIVE",
    orsProfile: "driving-car",
    orsAvoidFeatures: [],
    orsFallbackReason: null,
    maxUpwardGradePercent: 15,
  },

  BUS: {
    valhallaCosting: "bus",
    valhallaFareOptions: { shortest: true },
    valhallaDisplayOptions: {},
    googleTravelMode: "DRIVE",
    orsProfile: "driving-car",
    orsAvoidFeatures: [],
    orsFallbackReason: null,
    maxUpwardGradePercent: 15,
  },
};

/** The profile for a vehicle type, or the car-equivalent default when absent. */
export function getVehicleRoutingProfile(
  vehicleType: VehicleType | null | undefined,
): VehicleRoutingProfile {
  if (!vehicleType) {
    return DEFAULT_VEHICLE_PROFILE;
  }

  return VEHICLE_ROUTING_PROFILES[vehicleType] ?? DEFAULT_VEHICLE_PROFILE;
}

/**
 * Cache-key segment for a vehicle type.
 *
 * Two vehicle types on the same coordinates are different routes, so they must
 * not share a cache entry — without this a tricycle quote serves the next
 * habal-habal quote for the life of the entry.
 */
export function vehicleCacheSegment(vehicleType: VehicleType | null | undefined): string {
  return vehicleType ?? "any";
}

/**
 * True when the quote came from Google in two-wheeler mode.
 *
 * Google requires a beta notice to be displayed for two-wheeled routes, so the
 * UI needs to know. This is a compliance obligation, not a nicety.
 */
export function requiresTwoWheelerNotice(
  vehicleType: VehicleType | null | undefined,
  provider: string | null | undefined,
): boolean {
  return (
    provider === "google_routes" &&
    getVehicleRoutingProfile(vehicleType).googleTravelMode === "TWO_WHEELER"
  );
}
