-- Add DRIVER role and active-assignment support for vehicle-linked driver accounts.
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'DRIVER';

ALTER TABLE "users"
ADD COLUMN "assignedVehicleId" TEXT,
ADD COLUMN "assignedVehicleAssignedAt" TIMESTAMP(3),
ADD COLUMN "assignedVehicleAssignedBy" TEXT;

ALTER TABLE "admin_user_creations"
ADD COLUMN "assignedVehicleId" TEXT;

CREATE TABLE "driver_vehicle_assignment_history" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedBy" TEXT,
  "endedAt" TIMESTAMP(3),
  "reason" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "driver_vehicle_assignment_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_assignedVehicleId_key" ON "users"("assignedVehicleId");
CREATE INDEX "driver_vehicle_assignment_history_userId_assignedAt_idx" ON "driver_vehicle_assignment_history"("userId", "assignedAt");
CREATE INDEX "driver_vehicle_assignment_history_vehicleId_assignedAt_idx" ON "driver_vehicle_assignment_history"("vehicleId", "assignedAt");
CREATE INDEX "driver_vehicle_assignment_history_isActive_assignedAt_idx" ON "driver_vehicle_assignment_history"("isActive", "assignedAt");

ALTER TABLE "users"
ADD CONSTRAINT "users_assignedVehicleId_fkey"
FOREIGN KEY ("assignedVehicleId") REFERENCES "vehicles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "driver_vehicle_assignment_history"
ADD CONSTRAINT "driver_vehicle_assignment_history_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "driver_vehicle_assignment_history"
ADD CONSTRAINT "driver_vehicle_assignment_history_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
