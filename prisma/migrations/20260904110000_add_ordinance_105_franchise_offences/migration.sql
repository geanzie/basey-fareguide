-- Ordinance 105 fines exactly five things, and until now the system could file
-- none of them. Sec. 33(a)'s 500/1,000/1,500 ladder attaches to operating
-- without BOTH a franchise and an MTOP; Sec. 33(b) and (c) to cancelled-franchise
-- operation and franchise fraud; Sec. 28 to selling or renting a franchise.
-- (Sec. 11's late-renewal fee is charged on renewal, not by ticket, so it gets
-- no incident type.)
--
-- Every value added here is also declared in schema.prisma in the same change.
-- The enum drift that let the database hold values the Prisma client could not
-- deserialize -- which kills a whole query, not one row -- must not recur.

ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'NO_FRANCHISE_AND_MTOP';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'CANCELLED_FRANCHISE_OPERATION';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'FRANCHISE_FRAUD';
ALTER TYPE "IncidentType" ADD VALUE IF NOT EXISTS 'FRANCHISE_TRANSFER_VIOLATION';

-- The outcome a violation with no fine actually has under Ordinance 105:
-- Sec. 29(a) makes it a ground for franchise cancellation, Sec. 30 the process.
ALTER TYPE "IncidentStatus" ADD VALUE IF NOT EXISTS 'REFERRED_FOR_FRANCHISE_ACTION';
