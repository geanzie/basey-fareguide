import { describe, expect, it } from "vitest";

import { ORDINANCE_105_FARE_POINTS } from "@/lib/ordinance105Digest";

describe("Ordinance 105 fare digest", () => {
  it("cites a section for every point", () => {
    for (const point of ORDINANCE_105_FARE_POINTS) {
      expect(point.section).toMatch(/^\d+/);
    }
  });

  it("keeps to fares, leaving franchise fees and fines to the full ordinance", () => {
    const text = ORDINANCE_105_FARE_POINTS.map((point) => point.text).join(" ");

    expect(text).not.toMatch(/MTOP|fee|fine/i);
  });

  it("does not print the 2023 fare figures, which the live rate replaces", () => {
    const text = ORDINANCE_105_FARE_POINTS.map((point) => point.text).join(" ");

    expect(text).not.toMatch(/₱|peso/i);
  });
});
