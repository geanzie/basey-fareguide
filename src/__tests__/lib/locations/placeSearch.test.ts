import { describe, expect, it } from "vitest";

import { browsePlaces, normalize, searchPlaces } from "@/lib/locations/placeSearch";
import type { PlannerLocationDto } from "@/lib/contracts";

function place(name: string, overrides: Partial<PlannerLocationDto> = {}): PlannerLocationDto {
  return {
    id: name,
    name,
    type: "LANDMARK",
    category: "landmark",
    coordinates: { lat: 11.28, lng: 125.07 },
    address: `${name}, Basey, Samar`,
    verified: false,
    source: "database",
    pointSource: "osm",
    vehicleAccess: "UNVERIFIED",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalize", () => {
  it("folds the U+2160 roman numeral the dataset actually contains", () => {
    // "Basey Ⅰ Central Elementary school" uses ROMAN NUMERAL ONE, not "I".
    expect(normalize("Basey Ⅰ Central")).toBe("baseyicentral");
  });

  it("strips hyphens so spelling variants collapse together", () => {
    expect(normalize("Balo-Og")).toBe(normalize("Baloog"));
    expect(normalize("Lo-Og")).toBe(normalize("Loog"));
    expect(normalize("Can-Manila")).toBe(normalize("Canmanila"));
  });
});

describe("searchPlaces", () => {
  const places = [
    place("Amandayehan", { category: "barangay", coordinates: { lat: 11.2788, lng: 125.0012 } }),
    place("Balo-Og", { category: "barangay", coordinates: { lat: 11.29, lng: 125.02 } }),
    place("Basey Public Market", { coordinates: { lat: 11.279, lng: 125.0645 } }),
    place("Sohoton Cave", { coordinates: { lat: 11.42, lng: 125.12 }, barangay: "Sohoton" }),
  ];

  it("returns nothing for an empty query", () => {
    expect(searchPlaces(places, "   ")).toEqual({ places: [], isFuzzy: false });
  });

  it("ranks an exact name above a substring match", () => {
    const { places: results, isFuzzy } = searchPlaces(places, "basey");

    expect(isFuzzy).toBe(false);
    expect(results[0].name).toBe("Basey Public Market");
  });

  it("matches a word inside a longer name", () => {
    expect(searchPlaces(places, "market").places.map((p) => p.name)).toEqual([
      "Basey Public Market",
    ]);
  });

  it("finds a hyphenated barangay typed without the hyphen", () => {
    expect(searchPlaces(places, "baloog").places.map((p) => p.name)).toEqual(["Balo-Og"]);
  });

  it("falls back to the barangay so an area query surfaces what is inside it", () => {
    expect(searchPlaces(places, "sohoton").places.map((p) => p.name)).toContain("Sohoton Cave");
  });

  it("offers spelling near-misses only once nothing matched directly", () => {
    const { places: results, isFuzzy } = searchPlaces(places, "amandayehen");

    expect(isFuzzy).toBe(true);
    expect(results.map((p) => p.name)).toEqual(["Amandayehan"]);
  });

  it("does not guess at queries too short to be meaningful", () => {
    expect(searchPlaces(places, "zzz")).toEqual({ places: [], isFuzzy: false });
  });

  it("keeps one result when two sit on the same spot", () => {
    const sulod = place("Sulod", { category: "barangay", coordinates: { lat: 11.3, lng: 125.05 } });
    const hall = place("Bahay Pamahalaan ng Barangay Sulod", {
      coordinates: { lat: 11.30001, lng: 125.05001 },
    });

    expect(searchPlaces([sulod, hall], "sulod").places.map((p) => p.name)).toEqual(["Sulod"]);
  });
});

describe("browsePlaces", () => {
  const amandayehan = place("Amandayehan", {
    category: "barangay",
    coordinates: { lat: 11.2788, lng: 125.0012 },
  });
  const market = place("Basey Public Market", { coordinates: { lat: 11.279, lng: 125.0645 } });
  const sohoton = place("Sohoton Cave", { coordinates: { lat: 11.42, lng: 125.12 } });
  const places = [sohoton, amandayehan, market];

  it("sorts nearest-first against the detected pickup", () => {
    expect(browsePlaces(places, { lat: 11.279, lng: 125.064 }).map((p) => p.name)).toEqual([
      "Basey Public Market",
      "Amandayehan",
      "Sohoton Cave",
    ]);
  });

  it("falls back to alphabetical when there is no fix to measure from", () => {
    expect(browsePlaces(places, null).map((p) => p.name)).toEqual([
      "Amandayehan",
      "Basey Public Market",
      "Sohoton Cave",
    ]);
  });

  it("keeps the barangay rather than the hall standing on the same spot", () => {
    const sulod = place("Sulod", { category: "barangay", coordinates: { lat: 11.3, lng: 125.05 } });
    const hall = place("Bahay Pamahalaan ng Barangay Sulod", {
      coordinates: { lat: 11.30001, lng: 125.05001 },
    });

    expect(browsePlaces([hall, sulod], { lat: 11.3, lng: 125.05 }).map((p) => p.name)).toEqual([
      "Sulod",
    ]);
  });
});
