import { afterEach, describe, expect, it, vi } from "vitest";

import { routePairKey, routePairKeyForVehicle } from "@/lib/offline/routeCache";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const origin = { lat: 11.278823, lng: 125.001194 };
const dest = { lat: 11.304796, lng: 125.10899 };

function orsResponse(distanceMeters: number) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        routes: [
          {
            summary: { distance: distanceMeters, duration: 1320 },
            geometry: "encodedPolylineString",
          },
        ],
      }),
  };
}

describe("route cache separation by vehicle type", () => {
  it("does not serve one vehicle type's route to another", async () => {
    // Without a vehicle segment in the cache key, the tricycle answer below
    // would be handed straight back for the habal-habal request and the second
    // fetch would never happen.
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(orsResponse(14800))
      .mockResolvedValueOnce(orsResponse(9200));
    vi.stubGlobal("fetch", fetchMock);

    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    const tricycle = await calculateShortestRoadRoute(origin, dest, {
      vehicleType: "TRICYCLE",
    });
    const habal = await calculateShortestRoadRoute(origin, dest, {
      vehicleType: "HABAL_HABAL",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tricycle.distanceKm).toBeCloseTo(14.8);
    expect(habal.distanceKm).toBeCloseTo(9.2);
  });

  it("still reuses the cache for a repeat of the same vehicle type", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});

    const fetchMock = vi.fn().mockResolvedValue(orsResponse(14800));
    vi.stubGlobal("fetch", fetchMock);

    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    await calculateShortestRoadRoute(origin, dest, { vehicleType: "TRICYCLE" });
    await calculateShortestRoadRoute(origin, dest, { vehicleType: "TRICYCLE" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a vehicle-less call separate from a vehicle-typed one", async () => {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});

    const fetchMock = vi.fn().mockResolvedValue(orsResponse(14800));
    vi.stubGlobal("fetch", fetchMock);

    const { calculateShortestRoadRoute } = await import("@/lib/routing");

    await calculateShortestRoadRoute(origin, dest);
    await calculateShortestRoadRoute(origin, dest, { vehicleType: "JEEPNEY" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ORS request shaping by vehicle type", () => {
  async function captureOrsBody(vehicleType?: "TRICYCLE" | "HABAL_HABAL" | "JEEPNEY") {
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => {});

    const fetchMock = vi.fn().mockResolvedValue(orsResponse(14800));
    vi.stubGlobal("fetch", fetchMock);

    const { calculateShortestRoadRoute } = await import("@/lib/routing");
    const route = await calculateShortestRoadRoute(
      origin,
      dest,
      vehicleType ? { vehicleType } : undefined,
    );

    const [, init] = fetchMock.mock.calls[0];
    return { body: JSON.parse(init.body as string), route };
  }

  it("asks ORS to avoid ferries and fords for a tricycle", async () => {
    const { body } = await captureOrsBody("TRICYCLE");

    expect(body.options).toEqual({ avoid_features: ["ferries", "fords"] });
  });

  it("omits the options key entirely when there is nothing to avoid", async () => {
    const { body } = await captureOrsBody("JEEPNEY");

    expect(body).not.toHaveProperty("options");
  });

  it("keeps asking ORS for the shortest route, whatever the vehicle", async () => {
    // The ordinance prices distance, so this preference is load-bearing.
    const { body } = await captureOrsBody("HABAL_HABAL");

    expect(body.preference).toBe("shortest");
  });

  it("reports that ORS ignored the vehicle when it cannot represent it", async () => {
    // A habal-habal quoted by ORS is a car's distance. Say so rather than
    // letting the number pass as a motorcycle route.
    const { route } = await captureOrsBody("HABAL_HABAL");

    expect(route.fallbackReason).toBe("vehicle_profile_unavailable_ors");
  });

  it("reports no such caveat for a vehicle ORS can represent", async () => {
    const { route } = await captureOrsBody("JEEPNEY");

    expect(route.fallbackReason).toBeNull();
  });
});

describe("Google Routes travel mode by vehicle type", () => {
  async function captureGoogleBody(vehicleType: "TRICYCLE" | "HABAL_HABAL") {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("OPENROUTESERVICE_API_KEY", "");
    vi.stubEnv("GOOGLE_ROUTES_API_KEY", "google-test-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          routes: [
            {
              distanceMeters: 15100,
              duration: "1380s",
              polyline: { encodedPolyline: "googleEncodedPolyline" },
              legs: [
                {
                  startLocation: { latLng: { latitude: origin.lat, longitude: origin.lng } },
                  endLocation: { latLng: { latitude: dest.lat, longitude: dest.lng } },
                },
              ],
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { calculateShortestRoadRoute } = await import("@/lib/routing");
    await calculateShortestRoadRoute(origin, dest, { vehicleType });

    const [, init] = fetchMock.mock.calls[0];
    return JSON.parse(init.body as string);
  }

  it("sends a habal-habal as a two-wheeler", async () => {
    expect((await captureGoogleBody("HABAL_HABAL")).travelMode).toBe("TWO_WHEELER");
  });

  it("sends a tricycle as a car, because a sidecar does not fit a bike gap", async () => {
    expect((await captureGoogleBody("TRICYCLE")).travelMode).toBe("DRIVE");
  });
});

describe("routePairKeyForVehicle", () => {
  it("returns the legacy key untouched when no vehicle type is given", () => {
    // The IndexedDB store is at version 1 with no migration, so a changed key
    // format would orphan every route already cached on a rider's device.
    const legacy = routePairKey(origin, dest);

    expect(routePairKeyForVehicle(origin, dest, null)).toBe(legacy);
    expect(routePairKeyForVehicle(origin, dest, undefined)).toBe(legacy);
    expect(routePairKeyForVehicle(origin, dest, "")).toBe(legacy);
  });

  it("separates vehicle types from each other and from the legacy key", () => {
    const keys = [
      routePairKey(origin, dest),
      routePairKeyForVehicle(origin, dest, "TRICYCLE"),
      routePairKeyForVehicle(origin, dest, "HABAL_HABAL"),
    ];

    expect(new Set(keys).size).toBe(3);
  });
});
