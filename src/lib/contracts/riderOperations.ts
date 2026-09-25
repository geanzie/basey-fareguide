/**
 * GET /api/public/operations — the rider (PUBLIC user) dashboard payload.
 *
 * Personal rows (`trips`, `reports`) belong to the signed-in rider only.
 * `community` is aggregates across every report in the period, with no
 * row-level data: no other rider's report, plate or location reaches here.
 */

import type { OperationsRange } from "@/lib/operations/period";

export type RiderOperationsRange = OperationsRange;

/** Fares split two ways in the spending chart. */
export type RiderFareGroup = "FULL" | "DISCOUNTED";

export interface RiderTripDto {
  id: string;
  /** When the fare was recorded (driver accepted, or the rider scanned the QR). */
  at: string;
  /** YYYY-MM-DD, Philippine time. */
  day: string;
  /** 0-23, Philippine time. */
  hour: number;
  /** 0 = Sunday, Philippine time. */
  weekday: number;
  group: RiderFareGroup;
  from: string;
  to: string;
  distanceKm: number;
  /** Pesos charged; on a charter, the total for every seat. */
  fare: number;
  /** Fare before the discount; null when no discount applied. */
  originalFare: number | null;
  /** Pesos saved by a discount card; 0 when none. */
  discount: number;
  discountType: string | null;
  seatsPaid: number;
  plateNumber: string | null;
  vehicleType: string | null;
}

export interface RiderReportDto {
  id: string;
  typeLabel: string;
  status: string;
  /** Still waiting on an outcome: not resolved, not dismissed. */
  open: boolean;
  location: string;
  ticketNumber: string | null;
  /** When the report was filed. */
  createdAt: string;
  /** Resolved, dismissed or referred; null while still with enforcers. */
  closedAt: string | null;
}

export interface RiderOperationsPulseDto {
  /** Trips recorded in the period. */
  tripCount: number;
  /** Pesos paid in the period. */
  spent: number;
  /** Pesos saved by discounts in the period. */
  saved: number;
  distanceKm: number;
  /** The rider's reports, any date, still waiting on an outcome. */
  openReportCount: number;
}

export interface RiderCommunityDto {
  /** Every report filed in the period, across the municipality. */
  reportCount: number;
  /** Reports filed in the previous period of equal length. */
  previousPeriodCount: number;
  /** Counts per status, in OUTCOME_ORDER. */
  outcomes: Array<{ status: string; count: number }>;
  closedCount: number;
  /** Median hours from report to close, over reports closed so far. */
  medianCloseHours: number | null;
  /** Closed reports per time-to-close bucket, in CLOSE_TIME_BUCKETS order. */
  closeBuckets: Array<{ label: string; count: number }>;
  /** Open reports filed more than a week ago. */
  openOverAWeek: number;
}

export interface RiderOperationsDto {
  generatedAt: string;
  range: RiderOperationsRange;
  since: string;
  pulse: RiderOperationsPulseDto;
  /** The rider's trips in the period, newest first. */
  trips: RiderTripDto[];
  /** The rider's reports filed in the period, newest first. */
  reports: RiderReportDto[];
  previousPeriodTrips: number;
  previousPeriodSpent: number;
  previousPeriodSaved: number;
  community: RiderCommunityDto;
  /** True when the rider has more trips in the period than the server reads at once. */
  truncated: boolean;
}
