ALTER TYPE "DriverTripSessionRiderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TYPE "DriverTripSessionRiderAction" ADD VALUE IF NOT EXISTS 'EXPIRE';

ALTER TABLE "vehicle_trip_session_riders"
  ADD COLUMN "activeRequestKey" TEXT,
  ADD COLUMN "distanceSnapshot" DECIMAL(10, 2),
  ADD COLUMN "calculationTypeSnapshot" TEXT,
  ADD COLUMN "routeDataSnapshot" TEXT,
  ADD COLUMN "farePolicySnapshot" TEXT,
  ADD COLUMN "discountCardIdSnapshot" TEXT,
  ADD COLUMN "originalFareSnapshot" DECIMAL(10, 2),
  ADD COLUMN "discountAppliedSnapshot" DECIMAL(10, 2),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ALTER COLUMN "fareCalculationId" DROP NOT NULL;

UPDATE "vehicle_trip_session_riders" AS rider
SET
  "distanceSnapshot" = fare."distance",
  "calculationTypeSnapshot" = fare."calculationType",
  "routeDataSnapshot" = fare."routeData",
  "discountCardIdSnapshot" = fare."discountCardId",
  "originalFareSnapshot" = fare."originalFare",
  "discountAppliedSnapshot" = fare."discountApplied"
FROM "fare_calculations" AS fare
WHERE rider."fareCalculationId" = fare."id";

ALTER TABLE "vehicle_trip_session_riders"
  ALTER COLUMN "distanceSnapshot" SET NOT NULL,
  ALTER COLUMN "calculationTypeSnapshot" SET NOT NULL;

CREATE UNIQUE INDEX "vehicle_trip_session_riders_activeRequestKey_key"
ON "vehicle_trip_session_riders"("activeRequestKey");

CREATE INDEX "vehicle_trip_session_riders_status_expiresAt_idx"
ON "vehicle_trip_session_riders"("status", "expiresAt");