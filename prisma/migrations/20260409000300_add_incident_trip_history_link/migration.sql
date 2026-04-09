ALTER TABLE "incidents"
ADD COLUMN "fareCalculationId" TEXT,
ADD COLUMN "tripOrigin" TEXT,
ADD COLUMN "tripDestination" TEXT,
ADD COLUMN "tripFare" DECIMAL,
ADD COLUMN "tripDiscountType" "DiscountType",
ADD COLUMN "tripCalculatedAt" TIMESTAMP(3),
ADD COLUMN "tripCalculationType" TEXT,
ADD COLUMN "tripVehicleType" "VehicleType",
ADD COLUMN "tripPermitPlateNumber" TEXT,
ADD COLUMN "tripPlateNumber" TEXT;

CREATE INDEX "incidents_fareCalculationId_idx" ON "incidents"("fareCalculationId");

ALTER TABLE "incidents"
ADD CONSTRAINT "incidents_fareCalculationId_fkey"
FOREIGN KEY ("fareCalculationId") REFERENCES "fare_calculations"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;