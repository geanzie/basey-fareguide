/*
  Warnings:

  - You are about to drop the `driver_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "driver_profiles" DROP CONSTRAINT "driver_profiles_userId_fkey";

-- DropTable
DROP TABLE "driver_profiles";

-- CreateIndex
CREATE INDEX "evidence_incidentId_idx" ON "evidence"("incidentId");

-- CreateIndex
CREATE INDEX "evidence_status_idx" ON "evidence"("status");

-- CreateIndex
CREATE INDEX "evidence_uploadedBy_idx" ON "evidence"("uploadedBy");

-- CreateIndex
CREATE INDEX "evidence_createdAt_idx" ON "evidence"("createdAt");

-- CreateIndex
CREATE INDEX "evidence_status_createdAt_idx" ON "evidence"("status", "createdAt");

-- CreateIndex
CREATE INDEX "fare_calculations_userId_idx" ON "fare_calculations"("userId");

-- CreateIndex
CREATE INDEX "fare_calculations_vehicleId_idx" ON "fare_calculations"("vehicleId");

-- CreateIndex
CREATE INDEX "fare_calculations_createdAt_idx" ON "fare_calculations"("createdAt");

-- CreateIndex
CREATE INDEX "fare_calculations_calculationType_idx" ON "fare_calculations"("calculationType");

-- CreateIndex
CREATE INDEX "incidents_status_idx" ON "incidents"("status");

-- CreateIndex
CREATE INDEX "incidents_incidentType_idx" ON "incidents"("incidentType");

-- CreateIndex
CREATE INDEX "incidents_reportedById_idx" ON "incidents"("reportedById");

-- CreateIndex
CREATE INDEX "incidents_handledById_idx" ON "incidents"("handledById");

-- CreateIndex
CREATE INDEX "incidents_plateNumber_idx" ON "incidents"("plateNumber");

-- CreateIndex
CREATE INDEX "incidents_incidentDate_idx" ON "incidents"("incidentDate");

-- CreateIndex
CREATE INDEX "incidents_createdAt_idx" ON "incidents"("createdAt");

-- CreateIndex
CREATE INDEX "incidents_status_incidentType_idx" ON "incidents"("status", "incidentType");

-- CreateIndex
CREATE INDEX "incidents_status_createdAt_idx" ON "incidents"("status", "createdAt");

-- CreateIndex
CREATE INDEX "permits_status_idx" ON "permits"("status");

-- CreateIndex
CREATE INDEX "permits_vehicleType_idx" ON "permits"("vehicleType");

-- CreateIndex
CREATE INDEX "permits_permitPlateNumber_idx" ON "permits"("permitPlateNumber");

-- CreateIndex
CREATE INDEX "permits_expiryDate_idx" ON "permits"("expiryDate");

-- CreateIndex
CREATE INDEX "permits_status_vehicleType_idx" ON "permits"("status", "vehicleType");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_userType_idx" ON "users"("userType");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_isVerified_idx" ON "users"("isVerified");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_userType_isActive_idx" ON "users"("userType", "isActive");

-- CreateIndex
CREATE INDEX "vehicles_plateNumber_idx" ON "vehicles"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicles_vehicleType_idx" ON "vehicles"("vehicleType");

-- CreateIndex
CREATE INDEX "vehicles_isActive_idx" ON "vehicles"("isActive");

-- CreateIndex
CREATE INDEX "vehicles_ownerName_idx" ON "vehicles"("ownerName");

-- CreateIndex
CREATE INDEX "vehicles_vehicleType_isActive_idx" ON "vehicles"("vehicleType", "isActive");
