/*
  Warnings:

  - Added the required column `createdBy` to the `locations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LocationValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'FAILED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "actualBarangay" TEXT,
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "googleFormattedAddress" TEXT,
ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "isWithinBarangay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isWithinMunicipality" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastValidated" TIMESTAMP(3),
ADD COLUMN     "validationStatus" "LocationValidationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateTable
CREATE TABLE "location_validations" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "validatedBy" TEXT NOT NULL,
    "validationType" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "validationErrors" TEXT[],
    "validationWarnings" TEXT[],
    "withinMunicipality" BOOLEAN NOT NULL,
    "withinBarangay" BOOLEAN NOT NULL,
    "detectedBarangay" TEXT,
    "googleMapsValid" BOOLEAN,
    "googlePlaceId" TEXT,
    "googleAddress" TEXT,
    "googleConfidence" TEXT,
    "validatedCoordinates" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_validations_locationId_idx" ON "location_validations"("locationId");

-- CreateIndex
CREATE INDEX "location_validations_validatedAt_idx" ON "location_validations"("validatedAt");

-- CreateIndex
CREATE INDEX "locations_barangay_idx" ON "locations"("barangay");

-- CreateIndex
CREATE INDEX "locations_isActive_idx" ON "locations"("isActive");

-- CreateIndex
CREATE INDEX "locations_validationStatus_idx" ON "locations"("validationStatus");

-- CreateIndex
CREATE INDEX "locations_createdBy_idx" ON "locations"("createdBy");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_validations" ADD CONSTRAINT "location_validations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
