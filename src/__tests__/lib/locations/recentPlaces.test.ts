// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_RECENT_PINS,
  MAX_RECENT_PLACES,
  clearRecentPlaces,
  loadRecentPlaces,
  mergeRecents,
  recentKey,
  recentLabel,
  recentToSelection,
  rememberRecentPlaces,
} from "@/lib/locations/recentPlaces";
import { buildPinSelection, buildPlaceSelection } from "@/lib/planner/selection";
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

const pick = (name: string, overrides: Partial<PlannerLocationDto> = {}) =>
  buildPlaceSelection(place(name, overrides));

const pin = (lat: number, lng: number, label = "Dropped pin") =>
  buildPinSelection({ lat, lng, label });

describe("mergeRecents", () => {
  it("records both ends of a trip, newest first", () => {
    const merged = mergeRecents([], [pick("Amandayehan"), pick("Basey Public Market")]);

    expect(merged.map(recentLabel)).toEqual(["Amandayehan", "Basey Public Market"]);
  });

  it("promotes a place that is quoted again instead of listing it twice", () => {
    const first = mergeRecents([], [pick("Amandayehan"), pick("Balo-Og")]);
    const second = mergeRecents(first, [pick("Balo-Og")]);

    expect(second.map(recentLabel)).toEqual(["Balo-Og", "Amandayehan"]);
  });

  it("treats a pin re-dropped within a metre as the same spot", () => {
    const first = mergeRecents([], [pin(11.2801234, 125.0705678, "Sulod")]);
    // Nobody clicks the same coordinate twice; rounding is what makes this work.
    const second = mergeRecents(first, [pin(11.28012341, 125.07056783, "Sulod")]);

    expect(second).toHaveLength(1);
  });

  it("keeps a pin a few metres away as its own entry", () => {
    const first = mergeRecents([], [pin(11.28, 125.07)]);

    expect(mergeRecents(first, [pin(11.2805, 125.0705)])).toHaveLength(2);
  });

  it("caps named places and pins apart, so pins cannot crowd out the list", () => {
    const manyPlaces = Array.from({ length: MAX_RECENT_PLACES + 4 }, (_, i) => pick(`Place ${i}`));
    const manyPins = Array.from({ length: MAX_RECENT_PINS + 4 }, (_, i) =>
      pin(11.28 + i / 1000, 125.07),
    );

    const merged = mergeRecents([], [...manyPins, ...manyPlaces]);

    expect(merged.filter((entry) => entry.kind === "place")).toHaveLength(MAX_RECENT_PLACES);
    expect(merged.filter((entry) => entry.kind === "pin")).toHaveLength(MAX_RECENT_PINS);
  });

  it("evicts the oldest entry once the cap is reached", () => {
    const filled = mergeRecents(
      [],
      Array.from({ length: MAX_RECENT_PLACES }, (_, i) => pick(`Place ${i}`)),
    );
    // Position 0 is the newest, so the last one added is the first one out.
    const oldest = recentLabel(filled[filled.length - 1]);

    const merged = mergeRecents(filled, [pick("Newcomer")]);

    expect(merged.map(recentLabel)).toContain("Newcomer");
    expect(merged.map(recentLabel)).not.toContain(oldest);
  });

  it("drops selections it could never identify again", () => {
    const merged = mergeRecents(
      [],
      [
        buildPlaceSelection(place("No id", { id: "" })),
        buildPinSelection({ lat: Number.NaN, lng: 125.07 }),
        pick("Amandayehan"),
      ],
    );

    expect(merged.map(recentLabel)).toEqual(["Amandayehan"]);
  });

  it("separates a place from a pin sitting on the same coordinate", () => {
    const entries = mergeRecents(
      [],
      [pick("Sulod", { coordinates: { lat: 11.28, lng: 125.07 } }), pin(11.28, 125.07, "Sulod")],
    );

    expect(new Set(entries.map(recentKey)).size).toBe(2);
  });
});

describe("recentToSelection", () => {
  it("round-trips a place back into the selection the quote takes", () => {
    const [entry] = mergeRecents([], [pick("Amandayehan")]);
    const selection = recentToSelection(entry);

    expect(selection.source).toBe("place");
    expect(selection.place?.name).toBe("Amandayehan");
  });

  it("keeps the resolved label on a pin, so the row still reads offline", () => {
    const [entry] = mergeRecents([], [pin(11.28, 125.07, "Sulod")]);
    const selection = recentToSelection(entry);

    expect(selection.place).toBeUndefined();
    expect(selection.point).toEqual({ lat: 11.28, lng: 125.07, label: "Sulod" });
  });
});

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists what it merged and reads it back", () => {
    rememberRecentPlaces("rider-1", [pick("Amandayehan"), pin(11.28, 125.07, "Sulod")]);

    expect(loadRecentPlaces("rider-1").map(recentLabel)).toEqual(["Amandayehan", "Sulod"]);
  });

  it("keeps riders apart, because one machine gets shared", () => {
    rememberRecentPlaces("rider-1", [pick("Amandayehan")]);
    rememberRecentPlaces("rider-2", [pick("Balo-Og")]);

    expect(loadRecentPlaces("rider-1").map(recentLabel)).toEqual(["Amandayehan"]);
    expect(loadRecentPlaces("rider-2").map(recentLabel)).toEqual(["Balo-Og"]);
  });

  it("treats an unreadable list as no list rather than wedging the screen", () => {
    window.localStorage.setItem("basey:recentPlaces:v1:rider-1", "not json");

    expect(loadRecentPlaces("rider-1")).toEqual([]);
  });

  it("discards stored entries that no longer parse", () => {
    window.localStorage.setItem(
      "basey:recentPlaces:v1:rider-1",
      JSON.stringify([{ kind: "place" }, { kind: "nonsense" }]),
    );

    expect(loadRecentPlaces("rider-1")).toEqual([]);
  });

  it("clears one rider without touching another", () => {
    rememberRecentPlaces("rider-1", [pick("Amandayehan")]);
    rememberRecentPlaces("rider-2", [pick("Balo-Og")]);

    clearRecentPlaces("rider-1");

    expect(loadRecentPlaces("rider-1")).toEqual([]);
    expect(loadRecentPlaces("rider-2")).toHaveLength(1);
  });
});
