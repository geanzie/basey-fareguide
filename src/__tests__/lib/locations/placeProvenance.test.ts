import { describe, expect, it } from "vitest";

import { getPlaceProvenance } from "@/lib/locations/placeProvenance";

describe("getPlaceProvenance", () => {
  it("reports a promoted barangay point as coming from the barangay hall", () => {
    expect(getPlaceProvenance("Sulod").pointSource).toBe("barangay_hall");
    expect(getPlaceProvenance("Mercado").pointSource).toBe("barangay_hall");
  });

  it("reports an unpromoted barangay point as a polygon centroid", () => {
    expect(getPlaceProvenance("Amandayehan").pointSource).toBe("polygon_centroid");
  });

  it("reports OSM-scraped landmarks as such", () => {
    expect(getPlaceProvenance("Basey National High School").pointSource).toBe("osm");
  });

  it("flags hand-entered coordinates that are too coarse to quote a fare from", () => {
    // Sohoton Cave is recorded at two decimal places — roughly ±1.1 km.
    const sohoton = getPlaceProvenance("Sohoton Cave");
    expect(sohoton.pointSource).toBe("manual");
    expect(sohoton.needsResurvey).toBe(true);
  });

  it("does not flag six-decimal coordinates", () => {
    expect(getPlaceProvenance("Amandayehan").needsResurvey).toBe(false);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(getPlaceProvenance("  sohoton cave ").needsResurvey).toBe(true);
  });

  it("reports unknown provenance for a name that is not in the dataset", () => {
    expect(getPlaceProvenance("Somewhere An Admin Added")).toEqual({
      pointSource: "unknown",
      needsResurvey: false,
    });
  });
});
