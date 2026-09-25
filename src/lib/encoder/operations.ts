/**
 * Server-side shaping for GET /api/encoder/operations. Pure: takes rows the
 * route already read and returns the DTO pieces, so it tests without a DB.
 */
import type {
  EncoderEventDto,
  EncoderEventKind,
  EncoderExpiryOutlookDto,
  EncoderQueueItemDto,
  EncoderQueueKind,
} from "@/lib/contracts";
import { DAY_MS, manilaParts } from "@/lib/operations/period";
import { EVENT_GROUP, QUEUE_HREF, manilaWeekStart } from "./operationsGroups";

/** Prisma Decimal, a plain number, or a numeric string, as pesos. */
export type Money = { toString(): string } | number | string | null | undefined;

export function toPesos(value: Money): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value.toString());
  return Number.isFinite(number) ? number : null;
}

export function buildEvent(
  kind: EncoderEventKind,
  sourceId: string,
  at: Date,
  fields: {
    plateNumber?: string | null;
    vehicleType?: string | null;
    amount?: number | null;
    lagDays?: number | null;
  } = {},
): EncoderEventDto {
  return {
    id: `${kind}:${sourceId}`,
    kind,
    group: EVENT_GROUP[kind],
    at: at.toISOString(),
    ...manilaParts(at),
    plateNumber: fields.plateNumber || null,
    vehicleType: fields.vehicleType || null,
    amount: fields.amount ?? null,
    lagDays: fields.lagDays ?? null,
  };
}

const QR_EVENT_KIND: Record<string, EncoderEventKind> = {
  ISSUE_QR: "QR_ISSUED",
  ROTATE_QR: "QR_ROTATED",
  PRINT_QR: "QR_PRINTED",
};

export function qrEventKind(action: string): EncoderEventKind | null {
  return QR_EVENT_KIND[action] ?? null;
}

/** Whole and fractional days from ticket to payment; null without a ticket date. */
export function paymentLagDays(ticketIssuedAt: Date | null, paidAt: Date | null): number | null {
  if (!ticketIssuedAt || !paidAt) return null;
  return Math.max(0, (paidAt.getTime() - ticketIssuedAt.getTime()) / DAY_MS);
}

/** Newest first; ties broken by id so the order is stable between polls. */
export function sortEventsDesc(events: EncoderEventDto[]): EncoderEventDto[] {
  return events.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at)));
}

export function buildQueueItem(
  kind: EncoderQueueKind,
  sourceId: string,
  fields: {
    plateNumber?: string | null;
    vehicleType?: string | null;
    dueAt?: Date | null;
    amount?: number | null;
    reference?: string | null;
  },
): EncoderQueueItemDto {
  return {
    id: `${kind}:${sourceId}`,
    kind,
    plateNumber: fields.plateNumber || null,
    vehicleType: fields.vehicleType || null,
    dueAt: fields.dueAt ? fields.dueAt.toISOString() : null,
    amount: fields.amount ?? null,
    reference: fields.reference || null,
    href: QUEUE_HREF[kind],
  };
}

/** Expiring permits counted by Manila week (Monday start) and vehicle type. */
export function buildExpiryOutlook(
  rows: readonly { expiryDate: Date; vehicleType: string }[],
): EncoderExpiryOutlookDto[] {
  const counts = new Map<string, EncoderExpiryOutlookDto>();
  for (const row of rows) {
    const weekStart = manilaWeekStart(row.expiryDate);
    const key = `${weekStart}|${row.vehicleType}`;
    const entry = counts.get(key) ?? { weekStart, vehicleType: row.vehicleType, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort(
    (a, b) => a.weekStart.localeCompare(b.weekStart) || a.vehicleType.localeCompare(b.vehicleType),
  );
}
