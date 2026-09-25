/**
 * Server-side shaping for GET /api/public/operations. Pure: takes rows the
 * route already read and returns the DTO pieces, so it tests without a DB.
 */
import type { RiderCommunityDto, RiderReportDto, RiderTripDto } from "@/lib/contracts";
import { closeTimes, outcomeCounts } from "@/lib/incidents/dashboardGroups";
import { manilaParts } from "@/lib/operations/period";
import { formatFareLocationLabel } from "@/lib/serializers/fares";
import { formatIncidentTypeLabel } from "@/lib/serializers/incidents";

/** Prisma Decimal, a plain number, or a numeric string. */
export type Numeric = { toString(): string } | number | string | null | undefined;

export function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value.toString());
  return Number.isFinite(number) ? number : null;
}

/** Statuses that end a report for the rider; everything else is still open. */
export const CLOSED_REPORT_STATUSES = ["RESOLVED", "DISMISSED"] as const;

export function isOpenReport(status: string): boolean {
  return !(CLOSED_REPORT_STATUSES as readonly string[]).includes(status);
}

/** When the case left the enforcer queue, same rule as the enforcer dashboard. */
export function reportClosedAt(row: {
  resolvedAt: Date | null;
  dismissedAt: Date | null;
  referredAt: Date | null;
}): Date | null {
  return row.resolvedAt ?? row.dismissedAt ?? row.referredAt;
}

export interface TripRow {
  id: string;
  fromLocation: string;
  toLocation: string;
  distance: Numeric;
  calculatedFare: Numeric;
  originalFare: Numeric;
  discountApplied: Numeric;
  discountType: string | null;
  seatsPaid: number | null;
  createdAt: Date;
  vehicle: {
    plateNumber: string;
    vehicleType: string;
    permit: { permitPlateNumber: string } | null;
  } | null;
}

export function buildTrip(row: TripRow): RiderTripDto {
  const discount = toNumber(row.discountApplied) ?? 0;
  return {
    id: row.id,
    at: row.createdAt.toISOString(),
    ...manilaParts(row.createdAt),
    group: discount > 0 ? "DISCOUNTED" : "FULL",
    from: formatFareLocationLabel(row.fromLocation),
    to: formatFareLocationLabel(row.toLocation),
    distanceKm: toNumber(row.distance) ?? 0,
    // Same figure the fare history shows as the fare.
    fare: toNumber(row.calculatedFare) ?? 0,
    originalFare: discount > 0 ? toNumber(row.originalFare) : null,
    discount,
    discountType: row.discountType ?? null,
    seatsPaid: row.seatsPaid ?? 1,
    plateNumber: row.vehicle?.permit?.permitPlateNumber || row.vehicle?.plateNumber || null,
    vehicleType: row.vehicle?.vehicleType ?? null,
  };
}

export interface ReportRow {
  id: string;
  incidentType: string;
  status: string;
  location: string;
  ticketNumber: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  dismissedAt: Date | null;
  referredAt: Date | null;
}

export function buildReport(row: ReportRow): RiderReportDto {
  return {
    id: row.id,
    typeLabel: formatIncidentTypeLabel(row.incidentType),
    status: row.status,
    open: isOpenReport(row.status),
    location: row.location,
    ticketNumber: row.ticketNumber || null,
    createdAt: row.createdAt.toISOString(),
    closedAt: reportClosedAt(row)?.toISOString() ?? null,
  };
}

export type CommunityRow = Omit<ReportRow, "id" | "incidentType" | "location" | "ticketNumber">;

/** Municipality-wide aggregates only; the rows themselves never leave the server. */
export function buildCommunity(
  rows: readonly CommunityRow[],
  previousPeriodCount: number,
  now: Date,
): RiderCommunityDto {
  const records = rows.map((row) => ({
    status: row.status,
    // "Open" here matches the enforcer's closeTimes: not yet closed out.
    open: reportClosedAt(row) === null && isOpenReport(row.status),
    createdAt: row.createdAt.toISOString(),
    closedAt: reportClosedAt(row)?.toISOString() ?? null,
  }));
  const close = closeTimes(records, now);
  return {
    reportCount: rows.length,
    previousPeriodCount,
    outcomes: outcomeCounts(records),
    closedCount: close.closedCount,
    medianCloseHours: close.medianHours,
    closeBuckets: close.buckets,
    openOverAWeek: close.openOverAWeek,
  };
}
