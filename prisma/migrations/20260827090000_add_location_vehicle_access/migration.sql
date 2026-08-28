-- Record whether a habal-habal or tricycle can actually reach a location's
-- coordinate, and where the ride stops when it cannot.

CREATE TYPE "VehicleAccess" AS ENUM ('UNVERIFIED', 'VEHICLE_ACCESSIBLE', 'WALK_ONLY');

ALTER TABLE "locations"
ADD COLUMN "vehicleAccess" "VehicleAccess" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "dropoffCoordinates" TEXT,
ADD COLUMN "accessNote" TEXT,
ADD COLUMN "accessVerifiedBy" TEXT,
ADD COLUMN "accessVerifiedAt" TIMESTAMP(3);

CREATE INDEX "locations_vehicleAccess_idx" ON "locations"("vehicleAccess");

ALTER TABLE "locations"
ADD CONSTRAINT "locations_accessVerifiedBy_fkey"
FOREIGN KEY ("accessVerifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
