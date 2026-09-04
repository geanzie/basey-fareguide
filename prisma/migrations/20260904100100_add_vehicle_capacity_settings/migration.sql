-- Per-vehicle-type seat capacity, admin-owned, uniform across all vehicles of
-- a type. Modelled on driver_session_settings: a singleton row plus its own
-- audit table.

CREATE TABLE "vehicle_capacity_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "habalHabalCapacity" INTEGER NOT NULL DEFAULT 3,
    "tricycleCapacity" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "vehicle_capacity_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_capacity_settings_audit" (
    "id" TEXT NOT NULL,
    "vehicleCapacitySettingsId" TEXT NOT NULL,
    "previousHabalHabalCapacity" INTEGER NOT NULL,
    "previousTricycleCapacity" INTEGER NOT NULL,
    "newHabalHabalCapacity" INTEGER NOT NULL,
    "newTricycleCapacity" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    CONSTRAINT "vehicle_capacity_settings_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vehicle_capacity_settings_updatedAt_idx" ON "vehicle_capacity_settings"("updatedAt");
CREATE INDEX "vehicle_capacity_settings_audit_vehicleCapacitySettingsId_cha_idx" ON "vehicle_capacity_settings_audit"("vehicleCapacitySettingsId", "changedAt");
CREATE INDEX "vehicle_capacity_settings_audit_changedAt_idx" ON "vehicle_capacity_settings_audit"("changedAt");

ALTER TABLE "vehicle_capacity_settings"
    ADD CONSTRAINT "vehicle_capacity_settings_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicle_capacity_settings_audit"
    ADD CONSTRAINT "vehicle_capacity_settings_audit_vehicleCapacitySettingsId_fkey"
    FOREIGN KEY ("vehicleCapacitySettingsId") REFERENCES "vehicle_capacity_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_capacity_settings_audit"
    ADD CONSTRAINT "vehicle_capacity_settings_audit_changedBy_fkey"
    FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton so the service reads a row rather than falling back.
INSERT INTO "vehicle_capacity_settings" ("id", "habalHabalCapacity", "tricycleCapacity", "createdAt", "updatedAt")
VALUES ('global', 3, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
