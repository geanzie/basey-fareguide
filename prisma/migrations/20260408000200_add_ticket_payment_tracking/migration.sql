-- CreateEnum
CREATE TYPE "TicketPaymentStatus" AS ENUM ('NOT_APPLICABLE', 'UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "incidents"
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paymentStatus" "TicketPaymentStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- Backfill existing tickets as unpaid because prior workflow had no durable payment settlement flag.
UPDATE "incidents"
SET "paymentStatus" = CASE
  WHEN "ticketNumber" IS NULL THEN 'NOT_APPLICABLE'::"TicketPaymentStatus"
  ELSE 'UNPAID'::"TicketPaymentStatus"
END;

-- CreateIndex
CREATE INDEX "incidents_paymentStatus_idx" ON "incidents"("paymentStatus");