import { describe, expect, it } from "vitest";
import { evaluateDiscountCardPolicy, validateDiscountValidityWindow } from "@/lib/discountCardPolicy";

const baseCard = {
  id: "card-1",
  userId: "public-1",
  discountType: "STUDENT",
  verificationStatus: "APPROVED",
  isActive: true,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2026-12-31T23:59:59.000Z"),
};

describe("discount card policy", () => {
  it("accepts an owned, active, approved card within its validity window", () => {
    const evaluation = evaluateDiscountCardPolicy(baseCard, {
      userId: "public-1",
      now: new Date("2026-04-02T00:00:00.000Z"),
    });

    expect(evaluation.isValid).toBe(true);
    expect(evaluation.reasons).toHaveLength(0);
  });

  it("rejects cards that do not belong to the authenticated user", () => {
    const evaluation = evaluateDiscountCardPolicy(baseCard, {
      userId: "other-user",
      now: new Date("2026-04-02T00:00:00.000Z"),
    });

    expect(evaluation.isValid).toBe(false);
    expect(evaluation.isOwner).toBe(false);
    expect(evaluation.reasons[0]).toMatch(/does not belong/i);
  });

  it("rejects inactive and non-approved cards", () => {
    const evaluation = evaluateDiscountCardPolicy(
      {
        ...baseCard,
        isActive: false,
        verificationStatus: "PENDING",
      },
      {
        userId: "public-1",
        now: new Date("2026-04-02T00:00:00.000Z"),
      },
    );

    expect(evaluation.isValid).toBe(false);
    expect(evaluation.isActive).toBe(false);
    expect(evaluation.isApproved).toBe(false);
    expect(evaluation.reasons.join(" ")).toMatch(/inactive/i);
    expect(evaluation.reasons.join(" ")).toMatch(/not approved/i);
  });

  it("rejects expired and not-yet-valid cards based on the same policy", () => {
    const expired = evaluateDiscountCardPolicy(baseCard, {
      userId: "public-1",
      now: new Date("2027-01-01T00:00:00.000Z"),
    });
    const notYetValid = evaluateDiscountCardPolicy(
      {
        ...baseCard,
        validFrom: new Date("2026-05-01T00:00:00.000Z"),
      },
      {
        userId: "public-1",
        now: new Date("2026-04-02T00:00:00.000Z"),
      },
    );

    expect(expired.isExpired).toBe(true);
    expect(expired.isValid).toBe(false);
    expect(notYetValid.isNotYetValid).toBe(true);
    expect(notYetValid.isValid).toBe(false);
  });

  it("validates admin override date windows consistently", () => {
    expect(
      validateDiscountValidityWindow(
        new Date("2026-04-01T00:00:00.000Z"),
        new Date("2026-05-01T00:00:00.000Z"),
      ).valid,
    ).toBe(true);

    expect(
      validateDiscountValidityWindow(
        new Date("2026-05-01T00:00:00.000Z"),
        new Date("2026-04-01T00:00:00.000Z"),
      ),
    ).toEqual({
      valid: false,
      error: "Valid until date must be after valid from date",
    });
  });
});
