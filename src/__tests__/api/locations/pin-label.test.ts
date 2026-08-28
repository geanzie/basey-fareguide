import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/api/locations/pin-label/route";

/** Inside the Sulod barangay polygon, in the Basey poblacion area. */
const IN_SULOD = { lat: 11.28185, lng: 125.06835 };

function request(query: string) {
  return new NextRequest(`http://localhost/api/locations/pin-label${query}`);
}

describe("GET /api/locations/pin-label", () => {
  it("names a coordinate after the barangay containing it", async () => {
    const response = await GET(
      request(`?lat=${IN_SULOD.lat}&lng=${IN_SULOD.lng}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.pinLabel.barangayName).toBe("SULOD");
    expect(body.pinLabel.displayLabel).toBe("SULOD");
    expect(body.pinLabel.isFallback).toBe(false);
    expect(body.pinLabel.rawCoordinates).toBe("11.281850, 125.068350");
  });

  it("caches the response, since the polygons never move per request", async () => {
    const response = await GET(
      request(`?lat=${IN_SULOD.lat}&lng=${IN_SULOD.lng}`),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300",
    );
  });

  it("falls back to the raw coordinate outside every barangay polygon", async () => {
    // Still inside the Philippines, well away from Basey.
    const response = await GET(request("?lat=14.5995&lng=120.9842"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pinLabel.isFallback).toBe(true);
    expect(body.pinLabel.barangayName).toBeNull();
    expect(body.pinLabel.displayLabel).toBe("14.599500, 120.984200");
  });

  it("rejects a missing or non-numeric coordinate", async () => {
    for (const query of ["", "?lat=11.28", "?lat=abc&lng=125.06"]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_COORDINATES");
    }
  });

  it("rejects a coordinate outside the Philippines", async () => {
    const response = await GET(request("?lat=52.52&lng=13.405"));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_COORDINATES");
  });

  it("accepts a literal zero rather than treating it as missing", async () => {
    // 0,0 is outside the Philippines, so the bounds guard is what must reject
    // it — not a truthiness check that would call it an invalid number.
    const response = await GET(request("?lat=0&lng=0"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Coordinate is outside the Philippines.");
  });
});
