-- Add privacy notice acknowledgment audit fields to users table
-- Both columns are nullable so existing rows remain valid without backfill.
ALTER TABLE "users"
  ADD COLUMN "privacyNoticeAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "privacyNoticeVersion"        TEXT;
