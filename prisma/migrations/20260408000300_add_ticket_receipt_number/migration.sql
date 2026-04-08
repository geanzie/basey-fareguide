-- AlterTable
ALTER TABLE "incidents"
ADD COLUMN "officialReceiptNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "incidents_officialReceiptNumber_key" ON "incidents"("officialReceiptNumber");