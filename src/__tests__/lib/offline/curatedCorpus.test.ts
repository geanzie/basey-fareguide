// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import type { CuratedRouteCorpusDto } from "@/lib/contracts";
import {
  findCuratedCorpusRoute,
  loadCuratedCorpus,
  saveCuratedCorpus,
} from "@/lib/offline/curatedCorpus";

/**
 * Locations A(0) B(1) C(2); vehicles TRICYCLE(0) HABAL_HABAL(1).
 *
 * Rows:
 *  A->B tricycle     3200 m, one-way
 *  B->A habal-habal  2100 m, bidirectional
 *  B->C tricycle     5000 m, bidirectional
 */
const CORPUS: CuratedRouteCorpusDto = {
  locationIds: ["loc-a", "loc-b", "loc-c"],
  vehicleTypes: ["TRICYCLE", "HABAL_HABAL"] as CuratedRouteCorpusDto["vehicleTypes"],
  routes: [
    [0, 1, 0, 3200, 480, 0],
    [1, 0, 1, 2100, null, 1],
    [1, 2, 0, 5000, 900, 1],
  ],
  count: 3,
  generatedAt: "2026-08-30T00:00:00.000Z",
};

describe("findCuratedCorpusRoute", () => {
  it("answers a forward pair", () => {
    expect(findCuratedCorpusRoute(CORPUS, "loc-a", "loc-b", "TRICYCLE")).toEqual({
      distanceKm: 3.2,
      durationMin: 8,
      reversed: false,
    });
  });

  it("answers the reverse of a bidirectional row", () => {
    expect(findCuratedCorpusRoute(CORPUS, "loc-c", "loc-b", "TRICYCLE")).toEqual({
      distanceKm: 5,
      durationMin: 15,
      reversed: true,
    });
  });

  it("refuses the reverse of a one-way row", () => {
    // Basey has one-ways, so the return leg is not automatically the same
    // distance. The server refuses this too; if the client did not, the rider
    // would see a fare the driver's app does not.
    expect(findCuratedCorpusRoute(CORPUS, "loc-b", "loc-a", "TRICYCLE")).toBeNull();
  });

  it("keeps vehicle types apart on the same pair", () => {
    // The habal-habal shortcut and the tricycle road are different distances —
    // the whole reason the corpus is keyed by vehicle.
    expect(findCuratedCorpusRoute(CORPUS, "loc-b", "loc-a", "HABAL_HABAL")).toMatchObject({
      distanceKm: 2.1,
      reversed: false,
    });
    expect(findCuratedCorpusRoute(CORPUS, "loc-a", "loc-b", "HABAL_HABAL")).toMatchObject({
      distanceKm: 2.1,
      reversed: true,
    });
  });

  it("prefers the row measured in the direction being travelled", () => {
    // Both a forward row and a bidirectional reverse row exist for A->B.
    const both: CuratedRouteCorpusDto = {
      ...CORPUS,
      routes: [
        [1, 0, 0, 9999, null, 1],
        [0, 1, 0, 3200, 480, 0],
      ],
    };

    expect(findCuratedCorpusRoute(both, "loc-a", "loc-b", "TRICYCLE")).toMatchObject({
      distanceKm: 3.2,
      reversed: false,
    });
  });

  it("carries a null duration through rather than inventing one", () => {
    expect(findCuratedCorpusRoute(CORPUS, "loc-b", "loc-a", "HABAL_HABAL")?.durationMin).toBeNull();
  });

  it("will not price a trip with no vehicle chosen", () => {
    expect(findCuratedCorpusRoute(CORPUS, "loc-a", "loc-b", null)).toBeNull();
  });

  it("returns null for a pair or place the corpus does not cover", () => {
    expect(findCuratedCorpusRoute(CORPUS, "loc-a", "loc-c", "TRICYCLE")).toBeNull();
    expect(findCuratedCorpusRoute(CORPUS, "loc-a", "loc-zz", "TRICYCLE")).toBeNull();
  });

  it("returns null without a corpus or without both endpoints", () => {
    expect(findCuratedCorpusRoute(null, "loc-a", "loc-b", "TRICYCLE")).toBeNull();
    expect(findCuratedCorpusRoute(CORPUS, null, "loc-b", "TRICYCLE")).toBeNull();
    expect(findCuratedCorpusRoute(CORPUS, "loc-a", undefined, "TRICYCLE")).toBeNull();
  });
});

describe("corpus persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the corpus", () => {
    saveCuratedCorpus(CORPUS);
    expect(loadCuratedCorpus()).toEqual(CORPUS);
  });

  it("returns null when nothing has been stored", () => {
    expect(loadCuratedCorpus()).toBeNull();
  });

  it("ignores a corrupt or older-shaped payload rather than throwing on the quote path", () => {
    window.localStorage.setItem("basey:curatedCorpus", "{not json");
    expect(loadCuratedCorpus()).toBeNull();

    window.localStorage.setItem("basey:curatedCorpus", JSON.stringify({ routes: "nope" }));
    expect(loadCuratedCorpus()).toBeNull();
  });
});
