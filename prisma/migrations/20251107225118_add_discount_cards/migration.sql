-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('SENIOR_CITIZEN', 'PWD', 'STUDENT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'EXPIRED');

-- AlterTable
ALTER TABLE "fare_calculations" ADD COLUMN     "discountApplied" DECIMAL(65,30),
ADD COLUMN     "discountCardId" TEXT,
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "originalFare" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "discount_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "idNumber" TEXT,
    "idType" TEXT,
    "issuingAuthority" TEXT,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,
    "schoolName" TEXT,
    "schoolAddress" TEXT,
    "gradeLevel" TEXT,
    "schoolIdExpiry" TIMESTAMP(3),
    "disabilityType" TEXT,
    "pwdIdExpiry" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "rejectionReason" TEXT,
    "isAdminOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideBy" TEXT,
    "overrideAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "dailyUsageCount" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_usage_logs" (
    "id" TEXT NOT NULL,
    "discountCardId" TEXT NOT NULL,
    "fareCalculationId" TEXT NOT NULL,
    "originalFare" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "finalFare" DECIMAL(10,2) NOT NULL,
    "discountRate" DECIMAL(5,2) NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "distance" DECIMAL(10,2) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "deviceFingerprint" TEXT,
    "gpsCoordinates" TEXT,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "discount_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discount_cards_userId_key" ON "discount_cards"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "discount_cards_idNumber_key" ON "discount_cards"("idNumber");

-- CreateIndex
CREATE INDEX "discount_cards_userId_idx" ON "discount_cards"("userId");

-- CreateIndex
CREATE INDEX "discount_cards_discountType_idx" ON "discount_cards"("discountType");

-- CreateIndex
CREATE INDEX "discount_cards_verificationStatus_idx" ON "discount_cards"("verificationStatus");

-- CreateIndex
CREATE INDEX "discount_cards_isActive_idx" ON "discount_cards"("isActive");

-- CreateIndex
CREATE INDEX "discount_cards_validUntil_idx" ON "discount_cards"("validUntil");

-- CreateIndex
CREATE INDEX "discount_cards_isAdminOverride_idx" ON "discount_cards"("isAdminOverride");

-- CreateIndex
CREATE UNIQUE INDEX "discount_usage_logs_fareCalculationId_key" ON "discount_usage_logs"("fareCalculationId");

-- CreateIndex
CREATE INDEX "discount_usage_logs_discountCardId_usedAt_idx" ON "discount_usage_logs"("discountCardId", "usedAt");

-- CreateIndex
CREATE INDEX "discount_usage_logs_usedAt_idx" ON "discount_usage_logs"("usedAt");

-- CreateIndex
CREATE INDEX "fare_calculations_discountCardId_idx" ON "fare_calculations"("discountCardId");

-- AddForeignKey
ALTER TABLE "fare_calculations" ADD CONSTRAINT "fare_calculations_discountCardId_fkey" FOREIGN KEY ("discountCardId") REFERENCES "discount_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_cards" ADD CONSTRAINT "discount_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_usage_logs" ADD CONSTRAINT "discount_usage_logs_discountCardId_fkey" FOREIGN KEY ("discountCardId") REFERENCES "discount_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_usage_logs" ADD CONSTRAINT "discount_usage_logs_fareCalculationId_fkey" FOREIGN KEY ("fareCalculationId") REFERENCES "fare_calculations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
