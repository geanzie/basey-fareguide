import { describe, expect, it } from "vitest";

import { decodePolyline, encodePolyline } from "@/lib/routeUtils";

describe("encodePolyline", () => {
  it("round-trips through decodePolyline", () => {
    const coords: [number, number][] = [
      [11.2754, 125.0689],
      [11.2801, 125.0712],
      [11.2899, 125.0805],
    ];

    const decoded = decodePolyline(encodePolyline(coords));

    expect(decoded).toHaveLength(coords.length);
    decoded.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(coords[i][0], 4);
      expect(lng).toBeCloseTo(coords[i][1], 4);
    });
  });

  it("matches the known Google example encoding", () => {
    // From Google's polyline algorithm reference.
    const coords: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    expect(encodePolyline(coords)).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });
});
