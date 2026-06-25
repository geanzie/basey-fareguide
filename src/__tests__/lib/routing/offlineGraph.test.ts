import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { haversineKm } from "@/lib/routing/geo";
import { routeOffline } from "@/lib/routing/offlineGraph";

const GEOJSON_PATH = join(process.cwd(), "public", "data", "basey-roads.geojson");

let longestLine: [number, number][] | null = null;

beforeAll(async () => {
  const raw = await readFile(GEOJSON_PATH, "utf8");
  const fc = JSON.parse(raw) as {
    features: { geometry: { coordinates: [number, number][] } }[];
  };
  // Pick the road with the most vertices: first/last coords are guaranteed
  // connected (same LineString), so a path must exist between them.
  longestLine = fc.features
    .map((f) => f.geometry.coordinates)
    .reduce((a, b) => (b.length > a.length ? b : a), [] as [number, number][]);

  // Serve the bundled geojson to offlineGraph's fetch() call.
  vi.stubGlobal("fetch", async (url: string) => {
    if (String(url).includes("basey-roads")) {
      return new Response(raw, { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});

afterEach(() => {
  // keep the stub for all tests in this file
});

describe("routeOffline (on-device road graph)", () => {
  it("routes between two connected road vertices", async () => {
    expect(longestLine && longestLine.length).toBeGreaterThan(2);
    const [oLng, oLat] = longestLine![0];
    const [dLng, dLat] = longestLine![longestLine!.length - 1];

    const route = await routeOffline({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });

    expect(route).not.toBeNull();
    expect(route!.coords.length).toBeGreaterThanOrEqual(2);
    expect(route!.distanceKm).toBeGreaterThan(0);

    // Road route is never shorter than the straight line between endpoints.
    const straight = haversineKm({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng });
    expect(route!.distanceKm).toBeGreaterThanOrEqual(straight - 1e-6);
    expect(route!.durationMin).toBeGreaterThan(0);
  });

  it("returns null when a pin is far off the road network", async () => {
    // Middle of the sea, well outside the 200 m snap guard.
    const route = await routeOffline({ lat: 11.0, lng: 124.6 }, { lat: 11.05, lng: 124.62 });
    expect(route).toBeNull();
  });
});
