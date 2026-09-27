import { describe, expect, it } from "vitest";

import { PUBLIC_PENALTY_SCHEDULE } from "@/lib/incidents/penaltyRules";
import {
  ORDINANCE_105_ARTICLES,
  ORDINANCE_105_FEES,
  ORDINANCE_105_PENALTIES,
} from "@/lib/ordinance105Digest";

describe("Ordinance 105 digest", () => {
  it("cites a section for every point, fee and penalty", () => {
    const cited = [
      ...ORDINANCE_105_ARTICLES.flatMap((article) => article.points),
      ...ORDINANCE_105_FEES,
      ...ORDINANCE_105_PENALTIES,
    ];

    for (const item of cited) {
      expect(item.section).toMatch(/^\d+/);
    }
  });

  it("lists the eight articles in order", () => {
    expect(ORDINANCE_105_ARTICLES.map((article) => article.numeral)).toEqual([
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII",
    ]);
  });

  it("takes the Sec. 33(a) amounts from the enforcement schedule", () => {
    const sec33a = ORDINANCE_105_PENALTIES.filter((row) => row.section === "33(a)");

    expect(sec33a).toHaveLength(PUBLIC_PENALTY_SCHEDULE.length);
    sec33a.forEach((row, index) => {
      expect(row.amount).toContain(`₱${PUBLIC_PENALTY_SCHEDULE[index].penaltyAmount.toLocaleString("en-PH")}`);
    });
  });

  it("does not print the 2023 fare figures, which the live rate replaces", () => {
    const sec24 = ORDINANCE_105_ARTICLES.flatMap((article) => article.points).find(
      (point) => point.section === "24",
    );

    expect(sec24?.text).not.toMatch(/₱|peso/i);
  });
});
