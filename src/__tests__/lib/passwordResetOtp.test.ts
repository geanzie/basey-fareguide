import { describe, expect, it } from "vitest";

import {
  MAX_OTP_VERIFY_ATTEMPTS,
  checkOTPGuess,
  isOTPExpired,
  isValidOTPFormat,
} from "@/lib/passwordResetOtp";

const FUTURE = new Date(Date.now() + 60_000);
const PAST = new Date(Date.now() - 60_000);

function record(overrides: Partial<Parameters<typeof checkOTPGuess>[0]> = {}) {
  return {
    passwordResetOtp: "123456",
    passwordResetOtpExpiry: FUTURE,
    passwordResetOtpAttempts: 0,
    ...overrides,
  };
}

describe("isValidOTPFormat", () => {
  it("accepts exactly six digits", () => {
    expect(isValidOTPFormat("123456")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const bad of ["12345", "1234567", "abcdef", "", null, undefined, 123456]) {
      expect(isValidOTPFormat(bad)).toBe(false);
    }
  });
});

describe("isOTPExpired", () => {
  it("treats a null expiry as expired", () => {
    expect(isOTPExpired(null)).toBe(true);
  });

  it("compares against now", () => {
    expect(isOTPExpired(FUTURE)).toBe(false);
    expect(isOTPExpired(PAST)).toBe(true);
  });
});

describe("checkOTPGuess", () => {
  it("passes a correct, unexpired, unexhausted guess", () => {
    expect(checkOTPGuess(record(), "123456")).toEqual({ ok: true });
  });

  it("fails closed when there is no active reset at all", () => {
    expect(checkOTPGuess(null, "123456")).toEqual({
      ok: false,
      reason: "NO_ACTIVE_RESET",
    });
    expect(checkOTPGuess(record({ passwordResetOtp: null }), "123456")).toEqual({
      ok: false,
      reason: "NO_ACTIVE_RESET",
    });
  });

  it("blocks once the attempt budget is exhausted, even with the right code", () => {
    // The whole point of the counter: a correct guess after the budget is
    // spent must not succeed, or the limit is decorative.
    const exhausted = record({ passwordResetOtpAttempts: MAX_OTP_VERIFY_ATTEMPTS });
    expect(checkOTPGuess(exhausted, "123456")).toEqual({
      ok: false,
      reason: "TOO_MANY_ATTEMPTS",
    });
  });

  it("reports expiry before mismatch", () => {
    expect(checkOTPGuess(record({ passwordResetOtpExpiry: PAST }), "000000")).toEqual({
      ok: false,
      reason: "EXPIRED",
    });
  });

  it("reports a wrong code as MISMATCH so the caller can charge the budget", () => {
    expect(checkOTPGuess(record(), "000000")).toEqual({
      ok: false,
      reason: "MISMATCH",
    });
  });

  it("checks attempts before expiry, so an exhausted+expired OTP still reads as exhausted", () => {
    const exhaustedAndExpired = record({
      passwordResetOtpAttempts: MAX_OTP_VERIFY_ATTEMPTS,
      passwordResetOtpExpiry: PAST,
    });
    expect(checkOTPGuess(exhaustedAndExpired, "123456").ok).toBe(false);
    expect(
      (checkOTPGuess(exhaustedAndExpired, "123456") as { reason: string }).reason,
    ).toBe("TOO_MANY_ATTEMPTS");
  });
});
