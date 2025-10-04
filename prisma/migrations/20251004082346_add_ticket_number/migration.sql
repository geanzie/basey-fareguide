/*
  Warnings:

  - A unique constraint covering the columns `[ticketNumber]` on the table `incidents` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "ticketNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "incidents_ticketNumber_key" ON "incidents"("ticketNumber");
