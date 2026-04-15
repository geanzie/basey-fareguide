CREATE TYPE "DriverTripSessionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

CREATE TYPE "DriverTripSessionRiderStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'BOARDED',
  'COMPLETED',
  'REJECTED_NOT_HERE',
  'REJECTED_FULL',
  'REJECTED_WRONG_TRIP',
  'CANCELLED'
);

CREATE TYPE "DriverTripSessionRiderAction" AS ENUM (
  'ACCEPT',
  'BOARDED',
  'DROPPED_OFF',
  'NOT_HERE',
  'FULL',
  'WRONG_TRIP',
  'CANCELLED'
);

CREATE TABLE "vehicle_trip_sessions" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverUserId" TEXT NOT NULL,
  "status" "DriverTripSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_trip_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_trip_session_riders" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "fareCalculationId" TEXT NOT NULL,
  "riderUserId" TEXT NOT NULL,
  "status" "DriverTripSessionRiderStatus" NOT NULL DEFAULT 'PENDING',
  "originSnapshot" TEXT NOT NULL,
  "destinationSnapshot" TEXT NOT NULL,
  "fareSnapshot" DECIMAL(10, 2) NOT NULL,
  "discountTypeSnapshot" "DiscountType",
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "boardedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "finalisedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vehicle_trip_session_riders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vehicle_trip_session_rider_events" (
  "id" TEXT NOT NULL,
  "sessionRiderId" TEXT NOT NULL,
  "action" "DriverTripSessionRiderAction" NOT NULL,
  "fromStatus" "DriverTripSessionRiderStatus" NOT NULL,
  "toStatus" "DriverTripSessionRiderStatus" NOT NULL,
  "actedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_trip_session_rider_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vehicle_trip_sessions_vehicleId_status_idx" ON "vehicle_trip_sessions"("vehicleId", "status");
CREATE INDEX "vehicle_trip_sessions_driverUserId_status_idx" ON "vehicle_trip_sessions"("driverUserId", "status");
CREATE INDEX "vehicle_trip_sessions_openedAt_idx" ON "vehicle_trip_sessions"("openedAt");

CREATE UNIQUE INDEX "vehicle_trip_sessions_one_active_per_vehicle_idx"
ON "vehicle_trip_sessions"("vehicleId")
WHERE "status" IN ('OPEN', 'IN_PROGRESS');

CREATE UNIQUE INDEX "vehicle_trip_session_riders_fareCalculationId_key" ON "vehicle_trip_session_riders"("fareCalculationId");
CREATE INDEX "vehicle_trip_session_riders_sessionId_status_idx" ON "vehicle_trip_session_riders"("sessionId", "status");
CREATE INDEX "vehicle_trip_session_riders_riderUserId_status_idx" ON "vehicle_trip_session_riders"("riderUserId", "status");
CREATE INDEX "vehicle_trip_session_riders_joinedAt_idx" ON "vehicle_trip_session_riders"("joinedAt");

CREATE INDEX "vehicle_trip_session_rider_events_sessionRiderId_createdAt_idx"
ON "vehicle_trip_session_rider_events"("sessionRiderId", "createdAt");

CREATE INDEX "vehicle_trip_session_rider_events_actedByUserId_createdAt_idx"
ON "vehicle_trip_session_rider_events"("actedByUserId", "createdAt");

ALTER TABLE "vehicle_trip_sessions"
ADD CONSTRAINT "vehicle_trip_sessions_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_trip_sessions"
ADD CONSTRAINT "vehicle_trip_sessions_driverUserId_fkey"
FOREIGN KEY ("driverUserId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_trip_session_riders"
ADD CONSTRAINT "vehicle_trip_session_riders_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "vehicle_trip_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_trip_session_riders"
ADD CONSTRAINT "vehicle_trip_session_riders_fareCalculationId_fkey"
FOREIGN KEY ("fareCalculationId") REFERENCES "fare_calculations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_trip_session_riders"
ADD CONSTRAINT "vehicle_trip_session_riders_riderUserId_fkey"
FOREIGN KEY ("riderUserId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_trip_session_rider_events"
ADD CONSTRAINT "vehicle_trip_session_rider_events_sessionRiderId_fkey"
FOREIGN KEY ("sessionRiderId") REFERENCES "vehicle_trip_session_riders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vehicle_trip_session_rider_events"
ADD CONSTRAINT "vehicle_trip_session_rider_events_actedByUserId_fkey"
FOREIGN KEY ("actedByUserId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;