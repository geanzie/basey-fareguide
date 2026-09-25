/**
 * Client-safe pieces of the enforcer control center: violation grouping,
 * labels, and the aggregations the page re-runs whenever a filter changes.
 *
 * Kept free of server-only imports (the place table, Prisma) so the page can
 * import it without shipping them to the browser.
 */
import type { EnforcerOperationsRecordDto, ViolationGroup } from "@/lib/contracts";
import {
  DAY_MS,
  HOUR_MS,
  manilaDayKey,
  median,
  stackedSeries,
  weekdayHourGrid,
  type StackedBucket,
} from "@/lib/operations/period";

const GROUP_BY_TYPE: Record<string, ViolationGroup> = {
  FARE_OVERCHARGE: "FARE",
  FARE_UNDERCHARGE: "FARE",
  OVERCHARGING: "FARE",
  EMPTY_SEAT_CHARGE: "FARE",
  UNAUTHORIZED_CARGO_CHARGE: "FARE",
  REFUSED_POSTED_FARE: "FARE",
  OTHER_FARE_DISPUTE: "FARE",
  REFUSED_VALID_DISCOUNT: "FARE",
  RECKLESS_DRIVING: "DRIVING",
  VEHICLE_VIOLATION: "FRANCHISE",
  NO_PERMIT: "FRANCHISE",
  NO_FRANCHISE_AND_MTOP: "FRANCHISE",
  CANCELLED_FRANCHISE_OPERATION: "FRANCHISE",
  FRANCHISE_FRAUD: "FRANCHISE",
  FRANCHISE_TRANSFER_VIOLATION: "FRANCHISE",
  ROUTE_VIOLATION: "ROUTE",
};

export const VIOLATION_GROUPS: readonly ViolationGroup[] = [
  "FARE",
  "DRIVING",
  "FRANCHISE",
  "ROUTE",
  "OTHER",
];

export const VIOLATION_GROUP_LABELS: Record<ViolationGroup, string> = {
  FARE: "Fare disputes",
  DRIVING: "Reckless driving",
  FRANCHISE: "Vehicle & franchise",
  ROUTE: "Route violations",
  OTHER: "Other",
};

export function violationGroupFor(type: string): ViolationGroup {
  return GROUP_BY_TYPE[type] ?? "OTHER";
}

/** Open = still needs enforcer work: PENDING, legacy INVESTIGATING, TICKET_ISSUED. */
export const OPEN_INCIDENT_STATUSES = ["PENDING", "INVESTIGATING", "TICKET_ISSUED"] as const;

export function isOpenStatus(status: string): boolean {
  return (OPEN_INCIDENT_STATUSES as readonly string[]).includes(status);
}

export function normalizePlaceKey(location: string): string {
  return location.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizePlate(plate: string): string {
  return plate.replace(/[\s-]+/g, "").toUpperCase();
}

export interface CountByType {
  type: string;
  count: number;
  open: number;
}

export function countByType(records: readonly EnforcerOperationsRecordDto[]): CountByType[] {
  const byType = new Map<string, CountByType>();
  for (const record of records) {
    const entry = byType.get(record.type) ?? { type: record.type, count: 0, open: 0 };
    entry.count += 1;
    if (record.open) entry.open += 1;
    byType.set(record.type, entry);
  }
  return [...byType.values()].sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/** 7 rows (Sunday first) × 24 hours of counts, Philippine time. */
export function hourByWeekday(records: readonly EnforcerOperationsRecordDto[]): number[][] {
  return weekdayHourGrid(records);
}

export interface Hotspot {
  placeKey: string;
  location: string;
  count: number;
  open: number;
  topType: string;
}

export function rankHotspots(
  records: readonly EnforcerOperationsRecordDto[],
  limit = 8,
): Hotspot[] {
  const byPlace = new Map<string, { location: string; count: number; open: number; types: Map<string, number> }>();
  for (const record of records) {
    if (!record.placeKey) continue;
    const entry =
      byPlace.get(record.placeKey) ??
      { location: record.location, count: 0, open: 0, types: new Map<string, number>() };
    entry.count += 1;
    if (record.open) entry.open += 1;
    entry.types.set(record.type, (entry.types.get(record.type) ?? 0) + 1);
    byPlace.set(record.placeKey, entry);
  }

  return [...byPlace.entries()]
    .map(([placeKey, entry]) => ({
      placeKey,
      location: entry.location,
      count: entry.count,
      open: entry.open,
      topType: topKey(entry.types),
    }))
    .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location))
    .slice(0, limit);
}

export interface RepeatPlate {
  plate: string;
  count: number;
  open: number;
  lastSeenAt: string;
  topType: string;
}

/** Plates reported at least `minCount` times in the range, most reports first. */
export function repeatPlates(
  records: readonly EnforcerOperationsRecordDto[],
  minCount = 2,
  limit = 8,
): RepeatPlate[] {
  const byPlate = new Map<string, { plate: string; count: number; open: number; last: string; types: Map<string, number> }>();
  for (const record of records) {
    if (!record.plateNumber?.trim()) continue;
    const key = normalizePlate(record.plateNumber);
    const entry =
      byPlate.get(key) ??
      { plate: record.plateNumber.trim().toUpperCase(), count: 0, open: 0, last: record.incidentDate, types: new Map<string, number>() };
    entry.count += 1;
    if (record.open) entry.open += 1;
    if (record.incidentDate > entry.last) entry.last = record.incidentDate;
    entry.types.set(record.type, (entry.types.get(record.type) ?? 0) + 1);
    byPlate.set(key, entry);
  }

  return [...byPlate.values()]
    .filter((entry) => entry.count >= minCount)
    .map((entry) => ({
      plate: entry.plate,
      count: entry.count,
      open: entry.open,
      lastSeenAt: entry.last,
      topType: topKey(entry.types),
    }))
    .sort((a, b) => b.count - a.count || b.open - a.open || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit);
}

function topKey(counts: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Analytics section

export { manilaDayKey };

export type SeriesBucket = StackedBucket<ViolationGroup>;

/**
 * Reports per bucket, split by violation group. Every bucket in the window is
 * present, including empty ones, so gaps show as gaps rather than vanishing.
 */
export function reportSeries(
  records: readonly EnforcerOperationsRecordDto[],
  since: Date,
  until: Date,
  unit: "day" | "hour",
): SeriesBucket[] {
  return stackedSeries(records, VIOLATION_GROUPS, (record) => record.group, since, until, unit);
}

/** Display order for case outcomes: still with enforcers first, then how cases left. */
export const OUTCOME_ORDER = [
  "PENDING",
  "TICKET_ISSUED",
  "REFERRED_FOR_FRANCHISE_ACTION",
  "RESOLVED",
  "DISMISSED",
] as const;

export type Outcome = (typeof OUTCOME_ORDER)[number];

export function outcomeCounts(
  records: readonly Pick<EnforcerOperationsRecordDto, "status">[],
): Array<{ status: Outcome; count: number }> {
  const counts = new Map<Outcome, number>(OUTCOME_ORDER.map((status) => [status, 0]));
  for (const record of records) {
    // INVESTIGATING is legacy and means the same as PENDING to an enforcer.
    const status = (record.status === "INVESTIGATING" ? "PENDING" : record.status) as Outcome;
    if (counts.has(status)) counts.set(status, counts.get(status)! + 1);
  }
  return OUTCOME_ORDER.map((status) => ({ status, count: counts.get(status)! }));
}

export const CLOSE_TIME_BUCKETS = [
  { label: "Same day", maxHours: 24 },
  { label: "1–3 days", maxHours: 72 },
  { label: "3–7 days", maxHours: 168 },
  { label: "1–2 weeks", maxHours: 336 },
  { label: "Over 2 weeks", maxHours: Infinity },
] as const;

export interface CloseTimeSummary {
  closedCount: number;
  medianHours: number | null;
  buckets: Array<{ label: string; count: number }>;
  /** Open cases filed more than 7 days before `now`. */
  openOverAWeek: number;
}

export function closeTimes(
  records: readonly Pick<EnforcerOperationsRecordDto, "createdAt" | "closedAt" | "open">[],
  now: Date,
): CloseTimeSummary {
  const hours: number[] = [];
  let openOverAWeek = 0;
  for (const record of records) {
    const filed = new Date(record.createdAt).getTime();
    if (record.closedAt) {
      hours.push(Math.max(0, (new Date(record.closedAt).getTime() - filed) / HOUR_MS));
    } else if (record.open && now.getTime() - filed > 7 * DAY_MS) {
      openOverAWeek += 1;
    }
  }

  const medianHours = median(hours);

  const buckets = CLOSE_TIME_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));
  for (const value of hours) {
    const index = CLOSE_TIME_BUCKETS.findIndex((bucket) => value < bucket.maxHours);
    buckets[index].count += 1;
  }

  return { closedCount: hours.length, medianHours, buckets, openOverAWeek };
}

export function countByVehicleType(
  records: readonly EnforcerOperationsRecordDto[],
): Array<{ vehicleType: string; count: number }> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = record.vehicleType ?? "UNKNOWN";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([vehicleType, count]) => ({ vehicleType, count }))
    .sort((a, b) => b.count - a.count || a.vehicleType.localeCompare(b.vehicleType));
}
