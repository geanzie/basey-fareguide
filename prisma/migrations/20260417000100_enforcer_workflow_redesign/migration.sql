-- Add TICKET_ISSUED to IncidentStatus enum
ALTER TYPE "IncidentStatus" ADD VALUE 'TICKET_ISSUED';

-- Add evidence verification audit fields
ALTER TABLE "incidents"
  ADD COLUMN "evidenceVerifiedAt"   TIMESTAMP(3),
  ADD COLUMN "evidenceVerifiedById" TEXT;

-- Add ticket issuance audit fields
ALTER TABLE "incidents"
  ADD COLUMN "ticketIssuedAt"   TIMESTAMP(3),
  ADD COLUMN "ticketIssuedById" TEXT;

-- Add dismissal audit fields
ALTER TABLE "incidents"
  ADD COLUMN "dismissedAt"    TIMESTAMP(3),
  ADD COLUMN "dismissedById"  TEXT,
  ADD COLUMN "dismissRemarks" TEXT;

-- Add payment recording audit fields
ALTER TABLE "incidents"
  ADD COLUMN "paymentRecordedAt"   TIMESTAMP(3),
  ADD COLUMN "paymentRecordedById" TEXT;

-- Foreign key constraints
ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_evidenceVerifiedById_fkey"
    FOREIGN KEY ("evidenceVerifiedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_ticketIssuedById_fkey"
    FOREIGN KEY ("ticketIssuedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_dismissedById_fkey"
    FOREIGN KEY ("dismissedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_paymentRecordedById_fkey"
    FOREIGN KEY ("paymentRecordedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "incidents_status_paymentStatus_idx" ON "incidents"("status", "paymentStatus");
CREATE INDEX "incidents_evidenceVerifiedById_idx"  ON "incidents"("evidenceVerifiedById");
CREATE INDEX "incidents_ticketIssuedById_idx"       ON "incidents"("ticketIssuedById");
CREATE INDEX "incidents_dismissedById_idx"          ON "incidents"("dismissedById");
CREATE INDEX "incidents_paymentRecordedById_idx"    ON "incidents"("paymentRecordedById");
