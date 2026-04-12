-- Additive manual migration for permit QR hardening.
-- This keeps QR audit logging explicit without forcing destructive schema resets.

DO $$
BEGIN
	CREATE TYPE "PermitQrAuditAction" AS ENUM ('ISSUE_QR', 'ROTATE_QR');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "permit_qr_audit" (
	"id" TEXT NOT NULL,
	"permitId" TEXT NOT NULL,
	"permitPlateNumber" TEXT NOT NULL,
	"action" "PermitQrAuditAction" NOT NULL,
	"actedBy" TEXT,
	"actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"previousTokenFingerprint" TEXT,
	"currentTokenFingerprint" TEXT NOT NULL,

	CONSTRAINT "permit_qr_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "permit_qr_audit_permitId_actedAt_idx" ON "permit_qr_audit"("permitId", "actedAt");
CREATE INDEX IF NOT EXISTS "permit_qr_audit_actedBy_actedAt_idx" ON "permit_qr_audit"("actedBy", "actedAt");
CREATE INDEX IF NOT EXISTS "permit_qr_audit_action_actedAt_idx" ON "permit_qr_audit"("action", "actedAt");

DO $$
BEGIN
	ALTER TABLE "permit_qr_audit"
		ADD CONSTRAINT "permit_qr_audit_permitId_fkey"
		FOREIGN KEY ("permitId") REFERENCES "permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
	ALTER TABLE "permit_qr_audit"
		ADD CONSTRAINT "permit_qr_audit_actedBy_fkey"
		FOREIGN KEY ("actedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;