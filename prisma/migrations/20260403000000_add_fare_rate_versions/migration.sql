CREATE TABLE "fare_rate_versions" (
    "id" TEXT NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "perKmRate" DECIMAL(10,2) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "notes" TEXT NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "canceledBy" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "fare_rate_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fare_rate_versions_effectiveAt_idx" ON "fare_rate_versions"("effectiveAt");
CREATE INDEX "fare_rate_versions_createdAt_idx" ON "fare_rate_versions"("createdAt");
CREATE INDEX "fare_rate_versions_canceledAt_idx" ON "fare_rate_versions"("canceledAt");
CREATE INDEX "fare_rate_versions_effectiveAt_canceledAt_idx" ON "fare_rate_versions"("effectiveAt", "canceledAt");

ALTER TABLE "fare_rate_versions"
ADD CONSTRAINT "fare_rate_versions_createdBy_fkey"
FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "fare_rate_versions"
ADD CONSTRAINT "fare_rate_versions_canceledBy_fkey"
FOREIGN KEY ("canceledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "fare_rate_versions" (
    "id",
    "baseFare",
    "perKmRate",
    "effectiveAt",
    "createdAt",
    "createdBy",
    "notes",
    "canceledAt",
    "canceledBy",
    "cancellationReason"
) VALUES (
    'legacy-baseline-fare-rate',
    15.00,
    3.00,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL,
    'Baseline fare rates migrated from legacy hardcoded constants.',
    NULL,
    NULL,
    NULL
);
