-- CreateEnum
CREATE TYPE "DriverTripSessionInitiator" AS ENUM ('DRIVER', 'RIDER');

-- AlterTable
-- A rider-initiated session has no driver account behind it at all.
ALTER TABLE "vehicle_trip_sessions" ADD COLUMN     "initiatedBy" "DriverTripSessionInitiator" NOT NULL DEFAULT 'DRIVER',
ALTER COLUMN "driverUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "driver_session_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "suspendedVehicleTypes" "VehicleType"[] DEFAULT ARRAY['TRICYCLE', 'HABAL_HABAL']::"VehicleType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "driver_session_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_session_settings_audit" (
    "id" TEXT NOT NULL,
    "driverSessionSettingsId" TEXT NOT NULL,
    "previousSuspendedTypes" "VehicleType"[],
    "newSuspendedTypes" "VehicleType"[],
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,

    CONSTRAINT "driver_session_settings_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_session_settings_updatedAt_idx" ON "driver_session_settings"("updatedAt");

-- CreateIndex
CREATE INDEX "driver_session_settings_audit_driverSessionSettingsId_chang_idx" ON "driver_session_settings_audit"("driverSessionSettingsId", "changedAt");

-- CreateIndex
CREATE INDEX "driver_session_settings_audit_changedAt_idx" ON "driver_session_settings_audit"("changedAt");

-- CreateIndex
CREATE INDEX "vehicle_trip_sessions_initiatedBy_status_idx" ON "vehicle_trip_sessions"("initiatedBy", "status");

-- AddForeignKey
ALTER TABLE "driver_session_settings" ADD CONSTRAINT "driver_session_settings_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_session_settings_audit" ADD CONSTRAINT "driver_session_settings_audit_driverSessionSettingsId_fkey" FOREIGN KEY ("driverSessionSettingsId") REFERENCES "driver_session_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_session_settings_audit" ADD CONSTRAINT "driver_session_settings_audit_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton row. The suspension ships ON: tricycle and habal-habal
-- drivers are not required to hold a phone, so riders record those trips
-- themselves by scanning the printed permit QR.
INSERT INTO "driver_session_settings" ("id", "suspendedVehicleTypes", "createdAt", "updatedAt")
VALUES ('global', ARRAY['TRICYCLE', 'HABAL_HABAL']::"VehicleType"[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
