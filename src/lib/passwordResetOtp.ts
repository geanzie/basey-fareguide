/**
 * Shared logic for the password-reset OTP: generation, expiry, format, and the
 * per-account guess limit.
 *
 * Previously duplicated (with drifting field names and no attempt limit) across
 * request-reset/route.ts, verify-otp/route.ts, and reset-password/route.ts —
 * consolidated here so the three stay in lockstep.
 */

/** Guesses allowed against one issued OTP before it is invalidated. */
export const MAX_OTP_VERIFY_ATTEMPTS = 5

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/** OTP validity window from issuance. */
export function getOTPExpiry(): Date {
  const expiry = new Date()
  expiry.setMinutes(expiry.getMinutes() + 10)
  return expiry
}

export function isValidOTPFormat(otp: unknown): otp is string {
  return typeof otp === 'string' && /^\d{6}$/.test(otp)
}

export function isOTPExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) {
    return true
  }
  return new Date() > expiryDate
}

export interface OTPGuessRecord {
  passwordResetOtp: string | null
  passwordResetOtpExpiry: Date | null
  passwordResetOtpAttempts: number
}

export type OTPGuessOutcome =
  | { ok: true }
  | { ok: false; reason: 'NO_ACTIVE_RESET' | 'TOO_MANY_ATTEMPTS' | 'EXPIRED' | 'MISMATCH' }

/**
 * Checks one OTP guess against the record fetched for the target email,
 * without mutating anything — the caller decides how to persist the result
 * (increment attempts, clear the OTP, etc.) inside its own transaction/update.
 *
 * A record with no `passwordResetOtp` set (no reset in progress, or already
 * consumed) and a wrong guess against a real, live OTP both fail closed as
 * MISMATCH-shaped outcomes from the caller's point of view — this function
 * only distinguishes the cases a caller needs to react to differently
 * (attempts already exhausted vs. expired vs. a guess worth counting).
 */
export function checkOTPGuess(record: OTPGuessRecord | null, submittedOtp: string): OTPGuessOutcome {
  if (!record || !record.passwordResetOtp) {
    return { ok: false, reason: 'NO_ACTIVE_RESET' }
  }

  if (record.passwordResetOtpAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
    return { ok: false, reason: 'TOO_MANY_ATTEMPTS' }
  }

  if (isOTPExpired(record.passwordResetOtpExpiry)) {
    return { ok: false, reason: 'EXPIRED' }
  }

  if (record.passwordResetOtp !== submittedOtp) {
    return { ok: false, reason: 'MISMATCH' }
  }

  return { ok: true }
}
