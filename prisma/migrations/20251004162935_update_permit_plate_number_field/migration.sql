/*
  Warnings:

  - You are about to drop the column `plateNumber` on the `permits` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[permitPlateNumber]` on the table `permits` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `permitPlateNumber` to the `permits` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add the new column with existing plateNumber values
ALTER TABLE "permits" ADD COLUMN "permitPlateNumber" TEXT;

-- Step 2: Copy existing plateNumber values to permitPlateNumber
UPDATE "permits" SET "permitPlateNumber" = "plateNumber";

-- Step 3: Make permitPlateNumber NOT NULL
ALTER TABLE "permits" ALTER COLUMN "permitPlateNumber" SET NOT NULL;

-- Step 4: Drop the old plateNumber column and its index
DROP INDEX "permits_plateNumber_key";
ALTER TABLE "permits" DROP COLUMN "plateNumber";

-- Step 5: Create unique index for permitPlateNumber
CREATE UNIQUE INDEX "permits_permitPlateNumber_key" ON "permits"("permitPlateNumber");
