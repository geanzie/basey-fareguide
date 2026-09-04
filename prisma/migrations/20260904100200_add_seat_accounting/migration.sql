-- Seat accounting for the rider-scan flow.
--
-- vehicles.capacity was required but never read by any code path -- grep over
-- driverSession.ts, lib/fare/ and api/fare-calculations/ returned nothing. It
-- now becomes an optional per-vehicle override beneath the admin-set per-type
-- standard, so its values must be treated as untrusted: they were entered into
-- a field that did nothing, and are about to become load-bearing enough to
-- refuse a paying passenger a fare record.

ALTER TABLE "vehicles" ALTER COLUMN "capacity" DROP NOT NULL;

-- Hand the two rider-scan types back to the per-type standard. Other types are
-- out of scope for seat accounting and keep whatever they hold.
UPDATE "vehicles"
   SET "capacity" = NULL
 WHERE "vehicleType" IN ('HABAL_HABAL', 'TRICYCLE');

-- Seats a single fare paid for. 1 on a shared ride; the vehicle's capacity on
-- a charter, where the fare is the total for all of them.
ALTER TABLE "fare_calculations" ADD COLUMN "seatsPaid" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "vehicle_trip_session_riders" ADD COLUMN "seatsPaid" INTEGER NOT NULL DEFAULT 1;

-- Ceiling resolved when the session opened, so lowering the standard mid-run
-- cannot strand riders already aboard.
ALTER TABLE "vehicle_trip_sessions" ADD COLUMN "seatCapacitySnapshot" INTEGER;
