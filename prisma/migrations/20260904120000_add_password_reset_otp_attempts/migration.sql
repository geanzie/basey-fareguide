-- Bounds brute-force guessing of a password-reset OTP independent of the
-- caller's IP. The OTP is invalidated after a fixed number of wrong guesses
-- (see MAX_OTP_VERIFY_ATTEMPTS in src/lib/passwordResetOtp.ts), so rotating
-- source addresses no longer defeats the limit.

ALTER TABLE "users" ADD COLUMN "passwordResetOtpAttempts" INTEGER NOT NULL DEFAULT 0;
