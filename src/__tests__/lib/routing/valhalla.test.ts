import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decodePolyline } from "@/lib/routeUtils";
import {
  ValhallaProvider,
  decodePolyline6,
  isValhallaEnabled,
} from "@/lib/routing/providers/valhalla";

const origin = { lat: 11.278823, lng: 125.001194 };
const dest = { lat: 11.304796, lng: 125.10899 };

/**
 * A real Valhalla shape is precision 6. Build one from known coordinates so the
 * test is about the encoding, not about a magic string.
 */
function encodePrecision6(points: Array<[number, number]>): string {
  const encodeSigned = (num: number) => {
    let sgn = num << 1;
    if (num < 0) sgn = ~sgn;
    let out = "";
    while (sgn >= 0x20) {
      out += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
      sgn >>= 5;
    }
    return out + String.fromCharCode(sgn + 63);
  };

  let out = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e6);
    const iLng = Math.round(lng * 1e6);
    out += encodeSigned(iLat - prevLat) + encodeSigned(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }

  return out;
}

const SHAPE_POINTS: Array<[number, number]> = [
  [origin.lat, origin.lng],
  [11.29, 125.05],
  [dest.lat, dest.lng],
];

function valhallaResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        trip: {
          summary: { length: 9.2, time: 780 },
          legs: [{ shape: encodePrecision6(SHAPE_POINTS) }],
        },
        ...overrides,
      }),
  };
}

beforeEach(() => {
  vi.stubEnv("ROUTING_VALHALLA_URL", "http://valhalla.test:8002");
  vi.stubEnv("ROUTING_VALHALLA_ENABLED", "true");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("decodePolyline6", () => {
  it("round-trips coordinates at six decimal places", () => {
    const decoded = decodePolyline6(encodePrecision6(SHAPE_POINTS));

    expect(decoded).toHaveLength(3);
    expect(decoded[0][0]).toBeCloseTo(origin.lat, 6);
    expect(decoded[2][1]).toBeCloseTo(dest.lng, 6);
  });

  it("is not interchangeable with the precision-5 decoder", () => {
    // The trap this whole file exists to avoid: reading a Valhalla shape with
    // the Google/ORS decoder puts the route ten times too far out, which reads
    // as a routing bug rather than an encoding one.
    const shape = encodePrecision6(SHAPE_POINTS);
    const wrong = decodePolyline(shape);

    expect(Math.abs(wrong[0][0] - origin.lat)).toBeGreaterThan(50);
  });
});

describe("ValhallaProvider", () => {
  it("re-encodes the shape to precision 5 for the rest of the codebase", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(valhallaResponse()));

    const route = await new ValhallaProvider().calculateShortest(origin, dest);
    const redecoded = decodePolyline(route.polyline as string);

    expect(redecoded[0][0]).toBeCloseTo(origin.lat, 4);
    expect(redecoded[redecoded.length - 1][1]).toBeCloseTo(dest.lng, 4);
  });

  it("reports distance in kilometres, as the request asks for", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(valhallaResponse()));

    const route = await new ValhallaProvider().calculateShortest(origin, dest);

    expect(route.distanceKm).toBe(9.2);
    expect(route.distanceMeters).toBe(9200);
    expect(route.durationMin).toBe(13);
    expect(route.provider).toBe("valhalla");
    expect(route.isEstimate).toBe(false);
  });

  it("sends motorcycle costing for a habal-habal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(valhallaResponse());
    vi.stubGlobal("fetch", fetchMock);

    await new ValhallaProvider().calculateShortest(origin, dest, {
      vehicleType: "HABAL_HABAL",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.costing).toBe("motorcycle");
  });

  it("sends motor_scooter costing for a tricycle, with its speed cap", async () => {
    const fetchMock = vi.fn().mockResolvedValue(valhallaResponse());
    vi.stubGlobal("fetch", fetchMock);

    await new ValhallaProvider().calculateShortest(origin, dest, {
      vehicleType: "TRICYCLE",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.costing).toBe("motor_scooter");
    expect(body.costing_options.motor_scooter.top_speed).toBe(40);
  });

  it("routes as a car when the caller named no vehicle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(valhallaResponse());
    vi.stubGlobal("fetch", fetchMock);

    await new ValhallaProvider().calculateShortest(origin, dest);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).costing).toBe("auto");
  });

  it("never asks for a route shaped by cost preference", async () => {
    // Ordinance 105 prices distance. A preference that favours a longer road
    // would raise the fare for terrain, which is a surcharge we cannot levy.
    const fetchMock = vi.fn().mockResolvedValue(valhallaResponse());
    vi.stubGlobal("fetch", fetchMock);

    for (const vehicleType of ["TRICYCLE", "HABAL_HABAL", "JEEPNEY"] as const) {
      await new ValhallaProvider().calculateShortest(origin, dest, { vehicleType });
    }

    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(call[1].body as string);
      const costingOptions = body.costing_options[body.costing];
      expect(costingOptions.shortest).toBe(true);
      expect(costingOptions).not.toHaveProperty("use_hills");
      expect(costingOptions).not.toHaveProperty("use_trails");
      expect(costingOptions).not.toHaveProperty("use_primary");
    }
  });

  it("treats a no-path error code as a route failure, not an outage", async () => {
    // 442 means there is no route; the rider needs a different answer, not a
    // "try again later".
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({ error_code: 442, error: "No path could be found for input" }),
      }),
    );

    await expect(new ValhallaProvider().calculateShortest(origin, dest)).rejects.toMatchObject({
      code: "NO_ROAD_ROUTE_FOUND",
      reason: "no_route_found",
      status: 422,
    });
  });

  it("treats an unrecognised failure as an outage so the chain moves on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "internal" }),
      }),
    );

    await expect(new ValhallaProvider().calculateShortest(origin, dest)).rejects.toMatchObject({
      code: "ROUTING_SERVICE_UNAVAILABLE",
      reason: "upstream_error",
    });
  });

  it("refuses to construct without a URL", () => {
    vi.unstubAllEnvs();

    expect(() => new ValhallaProvider()).toThrow(/ROUTING_VALHALLA_URL/);
  });
});

describe("isValhallaEnabled", () => {
  it("needs both the flag and a URL", () => {
    expect(isValhallaEnabled()).toBe(true);

    vi.stubEnv("ROUTING_VALHALLA_ENABLED", "false");
    expect(isValhallaEnabled()).toBe(false);

    vi.stubEnv("ROUTING_VALHALLA_ENABLED", "true");
    vi.stubEnv("ROUTING_VALHALLA_URL", "");
    expect(isValhallaEnabled()).toBe(false);
  });
});
