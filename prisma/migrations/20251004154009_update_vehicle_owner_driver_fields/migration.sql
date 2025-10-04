/*
  Warnings:

  - You are about to drop the column `driverId` on the `vehicles` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `vehicles` table. All the data in the column will be lost.
  - Added the required column `ownerContact` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerName` to the `vehicles` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_driverId_fkey";

-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_ownerId_fkey";

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "driverId",
DROP COLUMN "ownerId",
ADD COLUMN     "driverLicense" TEXT,
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "ownerContact" TEXT NOT NULL,
ADD COLUMN     "ownerName" TEXT NOT NULL;
