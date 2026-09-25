/**
 * GET /api/encoder/operations — the encoder control center payload.
 *
 * One response feeds the whole page (tiles, work queue, desk feed, charts),
 * so every client-side filter works on data already in hand. The page does
 * not poll: it fetches on load and on a period change.
 */

import type { OperationsRange } from "@/lib/operations/period";

export type EncoderOperationsRange = OperationsRange;

/** Something the encoder desk did, as it shows in the feed and the charts. */
export type EncoderEventKind =
  | "VEHICLE_REGISTERED"
  | "PERMIT_ISSUED"
  | "PERMIT_RENEWED"
  | "QR_ISSUED"
  | "QR_ROTATED"
  | "QR_PRINTED"
  | "PAYMENT_RECORDED";

/**
 * Event kinds folded into four colors for the charts: seven hues are too
 * many to tell apart in a stacked bar; four areas of work are not.
 */
export type EncoderActivityGroup = "REGISTRATIONS" | "PERMITS" | "STICKERS" | "PAYMENTS";

/** Work waiting on the encoder desk, most urgent kind first. */
export type EncoderQueueKind =
  | "UNPAID_TICKET"
  | "PERMIT_LAPSED"
  | "PERMIT_EXPIRING"
  | "STICKER_TO_PRINT"
  | "VEHICLE_NO_PERMIT"
  | "REGISTRATION_EXPIRING";

export interface EncoderEventDto {
  /** Unique across kinds: `<kind>:<source row id>`. */
  id: string;
  kind: EncoderEventKind;
  group: EncoderActivityGroup;
  at: string;
  /** YYYY-MM-DD, Philippine time. */
  day: string;
  /** 0-23, Philippine time. */
  hour: number;
  /** 0 = Sunday, Philippine time. */
  weekday: number;
  plateNumber: string | null;
  vehicleType: string | null;
  /** Pesos paid, for PAYMENT_RECORDED; null otherwise. */
  amount: number | null;
  /** Days from ticket issuance to payment, for PAYMENT_RECORDED; null otherwise. */
  lagDays: number | null;
}

export interface EncoderQueueItemDto {
  /** Unique across kinds: `<kind>:<source row id>`. */
  id: string;
  kind: EncoderQueueKind;
  plateNumber: string | null;
  vehicleType: string | null;
  /**
   * The date that makes this item urgent: expiry for permits and
   * registrations, ticket issuance for unpaid tickets, QR issuance for
   * stickers, registration for vehicles with no permit.
   */
  dueAt: string | null;
  /** Pesos owed, for UNPAID_TICKET; null otherwise. */
  amount: number | null;
  /** Ticket number for unpaid tickets; permit plate for permit items. */
  reference: string | null;
  /** The page where the encoder clears this item. */
  href: string;
}

export interface EncoderOperationsPulseDto {
  /** Tickets issued and not yet paid. */
  unpaidTicketCount: number;
  /** Sum of their penalties, in pesos. */
  unpaidAmount: number;
  oldestUnpaidAt: string | null;
  /** ACTIVE permits whose expiry falls in the next 30 days. */
  permitsExpiringCount: number;
  /** Permits still marked ACTIVE whose expiry date has passed. */
  permitsLapsedCount: number;
  /** ACTIVE permits with a QR whose sticker was never printed, or was rotated since. */
  stickersToPrintCount: number;
  /** ACTIVE permits with no QR issued at all. */
  permitsWithoutQrCount: number;
  /** Active vehicles with no permit on file. */
  vehiclesWithoutPermitCount: number;
  /** Active vehicles whose registration expires within 30 days or already has. */
  registrationsExpiringCount: number;
  /** Desk events since midnight, Philippine time. */
  doneTodayCount: number;
}

export interface EncoderPermitSnapshotDto {
  vehicleType: string;
  status: string;
  count: number;
}

export interface EncoderExpiryOutlookDto {
  /** Monday of the week, YYYY-MM-DD, Philippine time. */
  weekStart: string;
  vehicleType: string;
  count: number;
}

export interface EncoderOperationsDto {
  generatedAt: string;
  range: EncoderOperationsRange;
  since: string;
  pulse: EncoderOperationsPulseDto;
  /** Up to 25 items per kind, most urgent first within each kind. */
  queue: EncoderQueueItemDto[];
  /** The latest 15 desk events in the period, newest first. */
  feed: EncoderEventDto[];
  /** Every desk event in the period, newest first. */
  events: EncoderEventDto[];
  /** Events in the period of equal length just before `since`. */
  previousPeriodCount: number;
  /** Pesos collected in that previous period. */
  previousPeriodCollected: number;
  /** True when a source held more rows in the period than the server reads at once. */
  truncated: boolean;
  /** Every permit today, by vehicle type and status. */
  permitSnapshot: EncoderPermitSnapshotDto[];
  /** ACTIVE permits expiring in the next 12 weeks, by week and vehicle type. */
  expiryOutlook: EncoderExpiryOutlookDto[];
}
