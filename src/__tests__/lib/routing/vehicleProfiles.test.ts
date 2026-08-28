import { describe, expect, it } from "vitest";
import { VehicleType } from "@prisma/client";

import {
  DEFAULT_VEHICLE_PROFILE,
  ORS_VEHICLE_PROFILE_UNAVAILABLE,
  VEHICLE_ROUTING_PROFILES,
  getVehicleRoutingProfile,
  requiresTwoWheelerNotice,
  vehicleCacheSegment,
} from "@/lib/routing/vehicleProfiles";

const ALL_VEHICLE_TYPES = Object.values(VehicleType);

describe("vehicle routing profiles", () => {
  it("covers every vehicle type in the Prisma enum", () => {
    // Table-driven off the enum itself, so adding a vehicle type to the schema
    // fails here rather than silently routing it as a car.
    for (const vehicleType of ALL_VEHICLE_TYPES) {
      expect(VEHICLE_ROUTING_PROFILES[vehicleType]).toBeDefined();
    }

    expect(Object.keys(VEHICLE_ROUTING_PROFILES).sort()).toEqual(
      [...ALL_VEHICLE_TYPES].sort(),
    );
  });

  it("gives every vehicle type a complete provider mapping and a grade limit", () => {
    for (const vehicleType of ALL_VEHICLE_TYPES) {
      const profile = VEHICLE_ROUTING_PROFILES[vehicleType];

      expect(profile.valhallaCosting).toBeTruthy();
      expect(profile.googleTravelMode).toBeTruthy();
      expect(profile.orsProfile).toBe("driving-car");
      expect(profile.maxUpwardGradePercent).toBeGreaterThan(0);
    }
  });

  it("never shapes cost on a fare-quoting request", () => {
    // The ordinance prices distance. Any preference that makes the router pick
    // a longer road raises the fare for terrain, which is a surcharge we have
    // no authority to levy. `shortest` plus hard limits only.
    const COST_SHAPING_KEYS = [
      "use_hills",
      "use_trails",
      "use_primary",
      "use_highways",
      "use_tracks",
      "use_living_streets",
      "use_tolls",
      "service_penalty",
      "speed_penalty_factor",
    ];

    for (const vehicleType of ALL_VEHICLE_TYPES) {
      const fareOptions = VEHICLE_ROUTING_PROFILES[vehicleType].valhallaFareOptions;

      expect(fareOptions.shortest).toBe(true);

      for (const key of COST_SHAPING_KEYS) {
        expect(fareOptions).not.toHaveProperty(key);
      }
    }

    expect(DEFAULT_VEHICLE_PROFILE.valhallaFareOptions.shortest).toBe(true);
  });

  it("routes habal-habal as a motorcycle and a tricycle as a scooter", () => {
    expect(VEHICLE_ROUTING_PROFILES.HABAL_HABAL.valhallaCosting).toBe("motorcycle");
    expect(VEHICLE_ROUTING_PROFILES.TRICYCLE.valhallaCosting).toBe("motor_scooter");
  });

  it("sends only habal-habal to Google's two-wheeler mode", () => {
    // A tricycle stays on DRIVE on purpose: TWO_WHEELER routes down motorcycle
    // cut-throughs a sidecar cannot fit, and Google returns no width data.
    expect(VEHICLE_ROUTING_PROFILES.HABAL_HABAL.googleTravelMode).toBe("TWO_WHEELER");

    for (const vehicleType of ALL_VEHICLE_TYPES.filter((t) => t !== "HABAL_HABAL")) {
      expect(VEHICLE_ROUTING_PROFILES[vehicleType].googleTravelMode).toBe("DRIVE");
    }
  });

  it("declares ORS unable to represent the two-wheeled vehicles", () => {
    expect(VEHICLE_ROUTING_PROFILES.HABAL_HABAL.orsFallbackReason).toBe(
      ORS_VEHICLE_PROFILE_UNAVAILABLE,
    );
    expect(VEHICLE_ROUTING_PROFILES.TRICYCLE.orsFallbackReason).toBe(
      ORS_VEHICLE_PROFILE_UNAVAILABLE,
    );
    expect(VEHICLE_ROUTING_PROFILES.JEEPNEY.orsFallbackReason).toBeNull();
  });

  it("holds a tricycle to a lower grade limit than a habal-habal", () => {
    expect(VEHICLE_ROUTING_PROFILES.TRICYCLE.maxUpwardGradePercent).toBeLessThan(
      VEHICLE_ROUTING_PROFILES.HABAL_HABAL.maxUpwardGradePercent,
    );
  });

  it("falls back to car-equivalent routing when no vehicle type is given", () => {
    for (const absent of [null, undefined]) {
      const profile = getVehicleRoutingProfile(absent);

      expect(profile).toBe(DEFAULT_VEHICLE_PROFILE);
      expect(profile.valhallaCosting).toBe("auto");
      expect(profile.googleTravelMode).toBe("DRIVE");
    }
  });
});

describe("vehicleCacheSegment", () => {
  it("separates every vehicle type from every other and from the absent case", () => {
    const segments = [
      ...ALL_VEHICLE_TYPES.map((vehicleType) => vehicleCacheSegment(vehicleType)),
      vehicleCacheSegment(null),
    ];

    expect(new Set(segments).size).toBe(segments.length);
  });
});

describe("requiresTwoWheelerNotice", () => {
  it("fires only for a Google route in two-wheeler mode", () => {
    expect(requiresTwoWheelerNotice("HABAL_HABAL", "google_routes")).toBe(true);
  });

  it("stays quiet for the same vehicle on a provider that has no such mode", () => {
    expect(requiresTwoWheelerNotice("HABAL_HABAL", "ors")).toBe(false);
    expect(requiresTwoWheelerNotice("HABAL_HABAL", null)).toBe(false);
  });

  it("stays quiet for a tricycle, which is routed as a car on Google", () => {
    expect(requiresTwoWheelerNotice("TRICYCLE", "google_routes")).toBe(false);
  });

  it("stays quiet when no vehicle type was supplied", () => {
    expect(requiresTwoWheelerNotice(null, "google_routes")).toBe(false);
  });
});
