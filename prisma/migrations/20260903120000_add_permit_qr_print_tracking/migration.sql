-- Additive manual migration for permit QR print tracking.
-- Records when a permit's QR sticker was last printed. Rotating the QR token
-- clears these columns, because the sticker already pasted on the vehicle is
-- dead once the token changes.

ALTER TABLE "permits" ADD COLUMN IF NOT EXISTS "qrPrintedAt" TIMESTAMP(3);
ALTER TABLE "permits" ADD COLUMN IF NOT EXISTS "qrPrintedBy" TEXT;

CREATE INDEX IF NOT EXISTS "permits_status_qrPrintedAt_idx" ON "permits"("status", "qrPrintedAt");

-- Print events land in the existing permit_qr_audit table alongside ISSUE_QR / ROTATE_QR.
ALTER TYPE "PermitQrAuditAction" ADD VALUE IF NOT EXISTS 'PRINT_QR';
