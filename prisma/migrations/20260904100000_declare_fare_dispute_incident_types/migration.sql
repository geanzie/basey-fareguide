-- Re-states the enum values added by 20260409000100 and 20260409000200, which
-- were applied to the database but never mirrored into schema.prisma. Those
-- migrations already ran here, so every statement below is a no-op on an
-- existing database; the point is that a fresh database reaches the same state
-- from migration history alone, now that the schema declares these values.
--
-- Prisma generates its client enum from schema.prisma. Before this, a row
-- holding any of these values made the deserializer throw and killed the whole
-- query -- the enforcer list, driver list, violations history, and every
-- incident count -- not just the offending row.

ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'EMPTY_SEAT_CHARGE';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED_CARGO_CHARGE';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'REFUSED_POSTED_FARE';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'OTHER_FARE_DISPUTE';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'REFUSED_VALID_DISCOUNT';
