CREATE TABLE "fare_rate_deletion_audit" (
    "id" TEXT NOT NULL,
    "fareRateVersionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT,

    CONSTRAINT "fare_rate_deletion_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fare_rate_deletion_audit_fareRateVersionId_deletedAt_idx" ON "fare_rate_deletion_audit"("fareRateVersionId", "deletedAt");
CREATE INDEX "fare_rate_deletion_audit_deletedAt_idx" ON "fare_rate_deletion_audit"("deletedAt");

ALTER TABLE "fare_rate_deletion_audit"
ADD CONSTRAINT "fare_rate_deletion_audit_deletedBy_fkey"
FOREIGN KEY ("deletedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;