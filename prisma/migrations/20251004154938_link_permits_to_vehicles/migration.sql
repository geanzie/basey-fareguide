/*
  Warnings:

  - A unique constraint covering the columns `[vehicleId]` on the table `permits` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `vehicleId` to the `permits` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add vehicleId column as nullable first
ALTER TABLE "permits" ADD COLUMN "vehicleId" TEXT;

-- Step 2: Create vehicles for existing permits that don't have matching vehicles
INSERT INTO "vehicles" (
  "id", "plateNumber", "vehicleType", "make", "model", "year", "color", 
  "capacity", "ownerName", "ownerContact", "driverName", "driverLicense",
  "isActive", "registrationExpiry", "createdAt", "updatedAt"
)
SELECT 
  'vh_' || "plateNumber" || '_' || extract(epoch from now())::text as "id",
  "plateNumber",
  "vehicleType",
  'Unknown' as "make",
  'Unknown' as "model",
  2020 as "year",
  'Unknown' as "color",
  CASE 
    WHEN "vehicleType" = 'TRICYCLE' THEN 6  
    WHEN "vehicleType" = 'HABAL_HABAL' THEN 2
    ELSE 4
  END as "capacity",
  'Unknown Owner' as "ownerName",
  'Unknown' as "ownerContact", 
  "driverFullName" as "driverName",
  'Unknown' as "driverLicense",
  CASE WHEN "status" = 'ACTIVE' THEN true ELSE false END as "isActive",
  "expiryDate" as "registrationExpiry",
  "encodedAt" as "createdAt",
  now() as "updatedAt"
FROM "permits" p
WHERE NOT EXISTS (
  SELECT 1 FROM "vehicles" v WHERE v."plateNumber" = p."plateNumber"
);

-- Step 3: Update permits to link to vehicles
UPDATE "permits" 
SET "vehicleId" = (
  SELECT "id" FROM "vehicles" 
  WHERE "vehicles"."plateNumber" = "permits"."plateNumber" 
  LIMIT 1
);

-- Step 4: Make vehicleId NOT NULL
ALTER TABLE "permits" ALTER COLUMN "vehicleId" SET NOT NULL;

-- Step 5: Create unique index
CREATE UNIQUE INDEX "permits_vehicleId_key" ON "permits"("vehicleId");

-- Step 6: Add foreign key constraint
ALTER TABLE "permits" ADD CONSTRAINT "permits_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
