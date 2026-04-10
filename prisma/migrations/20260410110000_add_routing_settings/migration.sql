CREATE TYPE "RoutingProviderSetting" AS ENUM ('ORS', 'GOOGLE_ROUTES');

CREATE TABLE "routing_settings" (
    "id" TEXT NOT NULL,
    "primaryProvider" "RoutingProviderSetting" NOT NULL DEFAULT 'ORS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "routing_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "routing_settings_audit" (
    "id" TEXT NOT NULL,
    "routingSettingsId" TEXT NOT NULL,
    "previousPrimaryProvider" "RoutingProviderSetting",
    "newPrimaryProvider" "RoutingProviderSetting" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "routing_settings_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "routing_settings_updatedAt_idx" ON "routing_settings"("updatedAt");
CREATE INDEX "routing_settings_audit_routingSettingsId_changedAt_idx" ON "routing_settings_audit"("routingSettingsId", "changedAt");
CREATE INDEX "routing_settings_audit_changedAt_idx" ON "routing_settings_audit"("changedAt");

ALTER TABLE "routing_settings"
ADD CONSTRAINT "routing_settings_updatedBy_fkey"
FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "routing_settings_audit"
ADD CONSTRAINT "routing_settings_audit_routingSettingsId_fkey"
FOREIGN KEY ("routingSettingsId") REFERENCES "routing_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "routing_settings_audit"
ADD CONSTRAINT "routing_settings_audit_changedBy_fkey"
FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;