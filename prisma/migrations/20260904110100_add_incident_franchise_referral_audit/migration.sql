-- Referral audit, matching the existing issuance / dismissal / payment pairs on
-- the same table: who referred this incident for franchise action, and when.

ALTER TABLE "incidents"
ADD COLUMN "referredAt" TIMESTAMP(3),
ADD COLUMN "referredById" TEXT;

CREATE INDEX "incidents_referredById_idx" ON "incidents"("referredById");

ALTER TABLE "incidents"
ADD CONSTRAINT "incidents_referredById_fkey"
FOREIGN KEY ("referredById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
