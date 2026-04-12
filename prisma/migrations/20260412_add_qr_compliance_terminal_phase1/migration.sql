-- Additive manual migration for QR Compliance Terminal Phase 1.
-- This file is intentionally written to avoid reset-style workflows on a shared live database.

DO $$
BEGIN
	CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'REVIEW_REQUIRED');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
	CREATE TYPE "ScanDisposition" AS ENUM ('CLEAR', 'FLAGGED', 'BLOCKED');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
	CREATE TYPE "QrScanResultType" AS ENUM ('MATCHED', 'NOT_FOUND', 'ERROR', 'UNAUTHORIZED');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
	CREATE TYPE "QrScanSource" AS ENUM ('CAMERA', 'MANUAL');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "permits"
	ADD COLUMN IF NOT EXISTS "qrToken" TEXT,
	ADD COLUMN IF NOT EXISTS "qrIssuedAt" TIMESTAMP(3),
	ADD COLUMN IF NOT EXISTS "qrIssuedBy" TEXT;

CREATE TABLE IF NOT EXISTS "terminal_unlock_sessions" (
	"id" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"tokenHash" TEXT NOT NULL,
	"expiresAt" TIMESTAMP(3) NOT NULL,
	"lastActivityAt" TIMESTAMP(3) NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "terminal_unlock_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "qr_scan_audit" (
	"id" TEXT NOT NULL,
	"scannerUserId" TEXT,
	"scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"submittedToken" TEXT NOT NULL,
	"matchedPermitId" TEXT,
	"resultType" "QrScanResultType" NOT NULL,
	"scanSource" "QrScanSource" NOT NULL,
	"disposition" "ScanDisposition",

	CONSTRAINT "qr_scan_audit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permits_qrToken_key" ON "permits"("qrToken");
CREATE INDEX IF NOT EXISTS "permits_qrIssuedAt_idx" ON "permits"("qrIssuedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "terminal_unlock_sessions_tokenHash_key" ON "terminal_unlock_sessions"("tokenHash");
CREATE INDEX IF NOT EXISTS "terminal_unlock_sessions_userId_idx" ON "terminal_unlock_sessions"("userId");
CREATE INDEX IF NOT EXISTS "terminal_unlock_sessions_expiresAt_idx" ON "terminal_unlock_sessions"("expiresAt");
CREATE INDEX IF NOT EXISTS "terminal_unlock_sessions_lastActivityAt_idx" ON "terminal_unlock_sessions"("lastActivityAt");

CREATE INDEX IF NOT EXISTS "qr_scan_audit_scannerUserId_scannedAt_idx" ON "qr_scan_audit"("scannerUserId", "scannedAt");
CREATE INDEX IF NOT EXISTS "qr_scan_audit_matchedPermitId_scannedAt_idx" ON "qr_scan_audit"("matchedPermitId", "scannedAt");
CREATE INDEX IF NOT EXISTS "qr_scan_audit_resultType_scannedAt_idx" ON "qr_scan_audit"("resultType", "scannedAt");
