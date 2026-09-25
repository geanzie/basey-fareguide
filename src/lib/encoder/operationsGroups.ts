/**
 * Client-safe pieces of the encoder control center: labels, grouping, and the
 * aggregations the page re-runs whenever a filter changes.
 *
 * Kept free of server-only imports (Prisma) so the page can import it without
 * shipping them to the browser.
 */
import type {
  EncoderActivityGroup,
  EncoderEventDto,
  EncoderEventKind,
  EncoderExpiryOutlookDto,
  EncoderPermitSnapshotDto,
  EncoderQueueItemDto,
  EncoderQueueKind,
} from "@/lib/contracts";
import {
  DAY_MS,
  MANILA_OFFSET_MS,
  manilaDayKey,
  median,
  stackedSeries,
  type StackedBucket,
} from "@/lib/operations/period";

export const ACTIVITY_GROUPS: readonly EncoderActivityGroup[] = [
  "REGISTRATIONS",
  "PERMITS",
  "STICKERS",
  "PAYMENTS",
];

export const ACTIVITY_GROUP_LABELS: Record<EncoderActivityGroup, string> = {
  REGISTRATIONS: "Vehicle registrations",
  PERMITS: "Permits",
  STICKERS: "QR stickers",
  PAYMENTS: "Ticket payments",
};

export const EVENT_GROUP: Record<EncoderEventKind, EncoderActivityGroup> = {
  VEHICLE_REGISTERED: "REGISTRATIONS",
  PERMIT_ISSUED: "PERMITS",
  PERMIT_RENEWED: "PERMITS",
  QR_ISSUED: "STICKERS",
  QR_ROTATED: "STICKERS",
  QR_PRINTED: "STICKERS",
  PAYMENT_RECORDED: "PAYMENTS",
};

export const EVENT_KIND_LABELS: Record<EncoderEventKind, string> = {
  VEHICLE_REGISTERED: "Vehicle registered",
  PERMIT_ISSUED: "Permit issued",
  PERMIT_RENEWED: "Permit renewed",
  QR_ISSUED: "QR code issued",
  QR_ROTATED: "QR code replaced",
  QR_PRINTED: "Sticker printed",
  PAYMENT_RECORDED: "Payment recorded",
};

/** Display order of the work queue: money and lapsed permits first. */
export const QUEUE_KINDS: readonly EncoderQueueKind[] = [
  "UNPAID_TICKET",
  "PERMIT_LAPSED",
  "PERMIT_EXPIRING",
  "STICKER_TO_PRINT",
  "VEHICLE_NO_PERMIT",
  "REGISTRATION_EXPIRING",
];

export const QUEUE_KIND_LABELS: Record<EncoderQueueKind, string> = {
  UNPAID_TICKET: "Tickets waiting for OR",
  PERMIT_LAPSED: "Permits past expiry",
  PERMIT_EXPIRING: "Permits expiring soon",
  STICKER_TO_PRINT: "Stickers to print",
  VEHICLE_NO_PERMIT: "Vehicles without a permit",
  REGISTRATION_EXPIRING: "Registrations expiring",
};

export const QUEUE_GROUP: Record<EncoderQueueKind, EncoderActivityGroup> = {
  UNPAID_TICKET: "PAYMENTS",
  PERMIT_LAPSED: "PERMITS",
  PERMIT_EXPIRING: "PERMITS",
  STICKER_TO_PRINT: "STICKERS",
  VEHICLE_NO_PERMIT: "REGISTRATIONS",
  REGISTRATION_EXPIRING: "REGISTRATIONS",
};

/** Where each queue kind is cleared. */
export const QUEUE_HREF: Record<EncoderQueueKind, string> = {
  UNPAID_TICKET: "/encoder/ticket-payments",
  PERMIT_LAPSED: "/encoder/permits",
  PERMIT_EXPIRING: "/encoder/permits",
  STICKER_TO_PRINT: "/encoder/permits",
  VEHICLE_NO_PERMIT: "/encoder/permits?modal=add-permit",
  REGISTRATION_EXPIRING: "/encoder/vehicles",
};

// ---------------------------------------------------------------------------
// Page filter

export type EncoderFilter =
  | { kind: "group"; group: EncoderActivityGroup }
  | { kind: "vehicleType"; vehicleType: string }
  | null;

/** Vehicle type key for rows that did not record one. */
export const UNKNOWN_VEHICLE_TYPE = "UNKNOWN";

export function matchesEvent(filter: EncoderFilter, event: EncoderEventDto): boolean {
  if (!filter) return true;
  if (filter.kind === "group") return event.group === filter.group;
  return (event.vehicleType ?? UNKNOWN_VEHICLE_TYPE) === filter.vehicleType;
}

export function matchesQueueItem(filter: EncoderFilter, item: EncoderQueueItemDto): boolean {
  if (!filter) return true;
  if (filter.kind === "group") return QUEUE_GROUP[item.kind] === filter.group;
  return (item.vehicleType ?? UNKNOWN_VEHICLE_TYPE) === filter.vehicleType;
}

// ---------------------------------------------------------------------------
// Aggregations

export type ActivityBucket = StackedBucket<EncoderActivityGroup>;

/** Desk events per bucket, split by area of work. */
export function activitySeries(
  events: readonly EncoderEventDto[],
  since: Date,
  until: Date,
  unit: "day" | "hour",
): ActivityBucket[] {
  return stackedSeries(events, ACTIVITY_GROUPS, (event) => event.group, since, until, unit);
}

/** Pesos recorded as paid per bucket. */
export function collectionsSeries(
  events: readonly EncoderEventDto[],
  since: Date,
  until: Date,
  unit: "day" | "hour",
): StackedBucket<"PAYMENTS">[] {
  return stackedSeries(
    events.filter((event) => event.kind === "PAYMENT_RECORDED"),
    ["PAYMENTS"] as const,
    () => "PAYMENTS",
    since,
    until,
    unit,
    (event) => event.amount ?? 0,
  );
}

export function collectedTotal(events: readonly EncoderEventDto[]): number {
  return events.reduce((sum, event) => (event.kind === "PAYMENT_RECORDED" ? sum + (event.amount ?? 0) : sum), 0);
}

export const PAYMENT_LAG_BUCKETS = [
  { label: "Same day", maxDays: 1 },
  { label: "1–3 days", maxDays: 3 },
  { label: "3–7 days", maxDays: 7 },
  { label: "1–4 weeks", maxDays: 28 },
  { label: "Over 4 weeks", maxDays: Infinity },
] as const;

export interface PaymentLagSummary {
  paidCount: number;
  medianDays: number | null;
  buckets: Array<{ label: string; count: number }>;
}

/** How long drivers took to pay, from ticket issuance to payment. */
export function paymentLagSummary(events: readonly EncoderEventDto[]): PaymentLagSummary {
  const lags = events
    .filter((event) => event.kind === "PAYMENT_RECORDED" && event.lagDays !== null)
    .map((event) => event.lagDays!);
  const buckets = PAYMENT_LAG_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));
  for (const value of lags) {
    buckets[PAYMENT_LAG_BUCKETS.findIndex((bucket) => value < bucket.maxDays)].count += 1;
  }
  return { paidCount: lags.length, medianDays: median(lags), buckets };
}

export function countByKind(events: readonly EncoderEventDto[]): Map<EncoderEventKind, number> {
  const counts = new Map<EncoderEventKind, number>();
  for (const event of events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  return counts;
}

/** Events per vehicle type, largest first; missing types count as UNKNOWN. */
export function eventsByVehicleType(
  events: readonly EncoderEventDto[],
): Array<{ vehicleType: string; count: number }> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.vehicleType ?? UNKNOWN_VEHICLE_TYPE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([vehicleType, count]) => ({ vehicleType, count }))
    .sort((a, b) => b.count - a.count || a.vehicleType.localeCompare(b.vehicleType));
}

export const PERMIT_STATUSES = ["ACTIVE", "EXPIRED", "SUSPENDED", "REVOKED"] as const;
export type PermitStatusKey = (typeof PERMIT_STATUSES)[number];

export interface PermitTypeRow {
  vehicleType: string;
  total: number;
  byStatus: Record<PermitStatusKey, number>;
}

/** Permits per vehicle type, split by status, largest type first. */
export function permitsByType(snapshot: readonly EncoderPermitSnapshotDto[]): PermitTypeRow[] {
  const rows = new Map<string, PermitTypeRow>();
  for (const entry of snapshot) {
    const row =
      rows.get(entry.vehicleType) ??
      { vehicleType: entry.vehicleType, total: 0, byStatus: { ACTIVE: 0, EXPIRED: 0, SUSPENDED: 0, REVOKED: 0 } };
    if ((PERMIT_STATUSES as readonly string[]).includes(entry.status)) {
      row.byStatus[entry.status as PermitStatusKey] += entry.count;
    }
    row.total += entry.count;
    rows.set(entry.vehicleType, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.vehicleType.localeCompare(b.vehicleType));
}

export const OUTLOOK_WEEKS = 12;

/** YYYY-MM-DD of the Monday starting `date`'s week, Philippine time. */
export function manilaWeekStart(date: Date): string {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  const sinceMonday = (shifted.getUTCDay() + 6) % 7;
  return manilaDayKey(new Date(date.getTime() - sinceMonday * DAY_MS));
}

/**
 * The next OUTLOOK_WEEKS weeks from `now`, each with its expiring permit
 * count. Every week is present so a quiet week shows as a gap.
 */
export function outlookWeeks(
  outlook: readonly EncoderExpiryOutlookDto[],
  now: Date,
  vehicleType: string | null = null,
): Array<{ weekStart: string; count: number }> {
  const weeks = new Map<string, number>();
  for (let index = 0; index < OUTLOOK_WEEKS; index += 1) {
    weeks.set(manilaWeekStart(new Date(now.getTime() + index * 7 * DAY_MS)), 0);
  }
  for (const entry of outlook) {
    if (vehicleType && entry.vehicleType !== vehicleType) continue;
    if (weeks.has(entry.weekStart)) weeks.set(entry.weekStart, weeks.get(entry.weekStart)! + entry.count);
  }
  return [...weeks.entries()].map(([weekStart, count]) => ({ weekStart, count }));
}
