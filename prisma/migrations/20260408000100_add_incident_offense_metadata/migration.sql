-- CreateEnum
CREATE TYPE "OffenseTier" AS ENUM ('FIRST', 'SECOND', 'THIRD_PLUS');

-- AlterTable
ALTER TABLE "incidents"
ADD COLUMN "offenseNumberAtIssuance" INTEGER,
ADD COLUMN "offenseTierAtIssuance" "OffenseTier",
ADD COLUMN "penaltyRuleVersion" TEXT;