import { describe, expect, it } from "vitest";

import {
  ENFORCER_ONLY_INCIDENT_TYPES,
  LATE_RENEWAL_FEES,
  PENALTY_RULE_VERSION,
  PUBLIC_PENALTY_SCHEDULE,
  PUBLIC_REPORTABLE_INCIDENT_TYPES,
  VIOLATION_PENALTY_BASIS,
  buildOffensePenaltyDecision,
  getPenaltyBasis,
  isFineable,
  isValidIncidentType,
  normalizePlateNumber,
} from "@/lib/incidents/penaltyRules";

// Ordinance 105 fines four franchise offences and nothing else.
const FINEABLE = [
  "NO_FRANCHISE_AND_MTOP",
  "CANCELLED_FRANCHISE_OPERATION",
  "FRANCHISE_FRAUD",
  "FRANCHISE_TRANSFER_VIOLATION",
] as const;

const FARE_TYPES = [
  "FARE_OVERCHARGE",
  "FARE_UNDERCHARGE",
  "EMPTY_SEAT_CHARGE",
  "UNAUTHORIZED_CARGO_CHARGE",
  "REFUSED_POSTED_FARE",
  "OTHER_FARE_DISPUTE",
  "REFUSED_VALID_DISCOUNT",
] as const;

describe("what Ordinance 105 actually fines", () => {
  it("fines exactly the four franchise offences", () => {
    const fineable = Object.keys(VIOLATION_PENALTY_BASIS).filter((type) =>
      isFineable(type as never),
    );

    expect(fineable.sort()).toEqual([...FINEABLE].sort());
  });

  it("imposes no fine for any fare violation", () => {
    // Sec. 33 is the only penal provision and covers none of these. The system
    // used to ticket all of them under the Sec. 33(a) ladder.
    for (const type of FARE_TYPES) {
      expect(isFineable(type)).toBe(false);
      expect(getPenaltyBasis(type).kind).toBe("NO_FINE");
      expect(buildOffensePenaltyDecision(type, 0).penaltyAmount).toBe(0);
    }
  });

  it("imposes no fine for reckless driving, vehicle or route violations either", () => {
    for (const type of ["RECKLESS_DRIVING", "VEHICLE_VIOLATION", "ROUTE_VIOLATION", "OTHER"] as const) {
      expect(isFineable(type)).toBe(false);
    }
  });

  it("routes an unfined violation to franchise action, not to nothing", () => {
    const basis = getPenaltyBasis("FARE_OVERCHARGE");

    expect(basis).toMatchObject({
      kind: "NO_FINE",
      groundSection: "29(a)",
      processSection: "30",
    });
  });

  it("cites a section for every amount it does impose", () => {
    for (const type of FINEABLE) {
      const decision = buildOffensePenaltyDecision(type, 0);

      expect(decision.section).not.toBeNull();
      expect(decision.penaltyAmount).toBeGreaterThan(0);
    }
  });
});

describe("Sec. 33(a) ladder", () => {
  const TYPE = "NO_FRANCHISE_AND_MTOP";

  it("climbs 500 / 1,000 / 1,500 with the offence number", () => {
    expect(buildOffensePenaltyDecision(TYPE, 0).penaltyAmount).toBe(500);
    expect(buildOffensePenaltyDecision(TYPE, 1).penaltyAmount).toBe(1000);
    expect(buildOffensePenaltyDecision(TYPE, 2).penaltyAmount).toBe(1500);
  });

  it("caps at the third tier rather than climbing without limit", () => {
    expect(buildOffensePenaltyDecision(TYPE, 4).penaltyAmount).toBe(1500);
    expect(buildOffensePenaltyDecision(TYPE, 40).penaltyAmount).toBe(1500);
    expect(buildOffensePenaltyDecision(TYPE, 40).offenseTier).toBe("THIRD_PLUS");
  });

  it("surfaces the court's discretion only on the third offence", () => {
    // "P1,500.00 or imprisonment of thirty (30) days or both at the discretion
    // of the Court" — the municipality imposes the fine only.
    expect(buildOffensePenaltyDecision(TYPE, 0).courtDiscretionNote).toBeNull();
    expect(buildOffensePenaltyDecision(TYPE, 1).courtDiscretionNote).toBeNull();
    expect(buildOffensePenaltyDecision(TYPE, 2).courtDiscretionNote).toContain(
      "discretion of the Court",
    );
  });

  it("treats a negative or absent prior count as a first offence", () => {
    expect(buildOffensePenaltyDecision(TYPE, -3).offenseNumber).toBe(1);
    expect(buildOffensePenaltyDecision(TYPE, -3).penaltyAmount).toBe(500);
  });

  it("gives a tier only to the ladder, not to flat penalties", () => {
    expect(buildOffensePenaltyDecision(TYPE, 0).offenseTier).toBe("FIRST");
    expect(buildOffensePenaltyDecision("FRANCHISE_FRAUD", 0).offenseTier).toBeNull();
    expect(buildOffensePenaltyDecision("FARE_OVERCHARGE", 0).offenseTier).toBeNull();
  });
});

describe("flat penalties", () => {
  it("reads Sec. 33(b) and 33(c) as a floor, not a price", () => {
    for (const type of ["CANCELLED_FRANCHISE_OPERATION", "FRANCHISE_FRAUD"] as const) {
      const decision = buildOffensePenaltyDecision(type, 0);

      expect(decision.penaltyAmount).toBe(2500);
      expect(decision.amountLabel).toBe("not less than PHP 2,500");
    }
  });

  it("prices Sec. 28 at a fixed PHP 2,000 with the court's alternative noted", () => {
    const decision = buildOffensePenaltyDecision("FRANCHISE_TRANSFER_VIOLATION", 0);

    expect(decision.penaltyAmount).toBe(2000);
    expect(decision.section).toBe("28");
    expect(decision.courtDiscretionNote).toContain("discretion of the court");
  });

  it("does not escalate a flat penalty with repeat offences", () => {
    // Only Sec. 33(a) is tiered; the others state one amount.
    expect(buildOffensePenaltyDecision("FRANCHISE_FRAUD", 5).penaltyAmount).toBe(2500);
    expect(buildOffensePenaltyDecision("FRANCHISE_TRANSFER_VIOLATION", 5).penaltyAmount).toBe(2000);
  });
});

describe("arrears are a plate balance, not part of the ticket", () => {
  const TYPE = "NO_FRANCHISE_AND_MTOP";

  it("keeps this ticket's amount free of what the plate already owes", () => {
    const decision = buildOffensePenaltyDecision(TYPE, 2, 4500, 3);

    expect(decision.penaltyAmount).toBe(1500);
    expect(decision.outstandingArrears).toBe(4500);
    expect(decision.totalOwedOnPlate).toBe(6000);
  });

  it("ignores a nonsense arrears figure rather than propagating it", () => {
    for (const arrears of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const decision = buildOffensePenaltyDecision(TYPE, 0, arrears);

      expect(decision.outstandingArrears).toBe(0);
      expect(decision.totalOwedOnPlate).toBe(500);
    }
  });

  it("adds no arrears to a violation that carries no fine", () => {
    const decision = buildOffensePenaltyDecision("FARE_OVERCHARGE", 0, 4500, 3);

    expect(decision.penaltyAmount).toBe(0);
    expect(decision.fineable).toBe(false);
    // The debt is still reported, but this incident imposes none of it.
    expect(decision.outstandingArrears).toBe(4500);
  });
});

describe("who may file what", () => {
  it("keeps the franchise offences off the public report form", () => {
    for (const type of FINEABLE) {
      expect(PUBLIC_REPORTABLE_INCIDENT_TYPES).not.toContain(type);
      expect(ENFORCER_ONLY_INCIDENT_TYPES).toContain(type);
    }
  });

  it("lets the public file every violation that carries no fine", () => {
    for (const type of FARE_TYPES) {
      expect(PUBLIC_REPORTABLE_INCIDENT_TYPES).toContain(type);
    }
  });

  it("accounts for every violation exactly once across the two lists", () => {
    const all = [...PUBLIC_REPORTABLE_INCIDENT_TYPES, ...ENFORCER_ONLY_INCIDENT_TYPES];

    expect(all.sort()).toEqual(Object.keys(VIOLATION_PENALTY_BASIS).sort());
    expect(new Set(all).size).toBe(all.length);
  });

  it("rejects anything that is not a known violation", () => {
    expect(isValidIncidentType("FARE_OVERCHARGE")).toBe(true);
    expect(isValidIncidentType("NOT_A_TYPE")).toBe(false);
    expect(isValidIncidentType("toString")).toBe(false);
    expect(isValidIncidentType(null)).toBe(false);
  });
});

describe("published and reference data", () => {
  it("keeps the public schedule the About page renders unchanged", () => {
    expect(PUBLIC_PENALTY_SCHEDULE.map((tier) => tier.penaltyAmount)).toEqual([500, 1000, 1500]);
    expect(PUBLIC_PENALTY_SCHEDULE.map((tier) => tier.label)).toEqual([
      "1st offense",
      "2nd offense",
      "3rd offense and above",
    ]);
  });

  it("records the Sec. 11 late-renewal fees even though nothing charges them yet", () => {
    expect(LATE_RENEWAL_FEES.map((fee) => fee.amount)).toEqual([200, 300]);
  });

  it("stamps a rule version that names its authority", () => {
    expect(PENALTY_RULE_VERSION).toContain("ord105");
    expect(buildOffensePenaltyDecision("NO_FRANCHISE_AND_MTOP", 0).ruleVersion).toBe(
      PENALTY_RULE_VERSION,
    );
  });
});

describe("normalizePlateNumber", () => {
  it("trims and upper-cases", () => {
    expect(normalizePlateNumber("  abc 123 ")).toBe("ABC 123");
  });

  it("treats blank and missing plates as absent", () => {
    expect(normalizePlateNumber("   ")).toBeNull();
    expect(normalizePlateNumber(null)).toBeNull();
    expect(normalizePlateNumber(undefined)).toBeNull();
  });
});
