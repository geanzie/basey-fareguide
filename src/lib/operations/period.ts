/**
 * Time periods shared by the operations dashboards (enforcer, encoder).
 *
 * Client-safe: no server-only imports, so pages can bucket data in the
 * browser with the same rules the routes use to pick rows.
 */

export type OperationsRange = "today" | "7d" | "30d" | "90d";

export const OPERATIONS_RANGES: readonly OperationsRange[] = ["today", "7d", "30d", "90d"];

export function isOperationsRange(value: string): value is OperationsRange {
  return (OPERATIONS_RANGES as readonly string[]).includes(value);
}

/** The Philippines has no daylight saving, so a fixed offset is exact. */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** UTC instant of the most recent midnight in Philippine time. */
export function manilaMidnight(now: Date): Date {
  const shifted = now.getTime() + MANILA_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - MANILA_OFFSET_MS);
}

export function rangeStart(range: OperationsRange, now: Date): Date {
  switch (range) {
    case "today":
      return manilaMidnight(now);
    case "7d":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "30d":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "90d":
      return new Date(now.getTime() - 90 * DAY_MS);
  }
}

/** YYYY-MM-DD of `date` in Philippine time. */
export function manilaDayKey(date: Date): string {
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function manilaParts(date: Date): { weekday: number; hour: number; day: string } {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  return {
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    day: manilaDayKey(date),
  };
}

export interface StackedBucket<G extends string> {
  /** YYYY-MM-DD for daily buckets, "0".."23" for hourly ones. */
  key: string;
  total: number;
  byGroup: Record<G, number>;
}

/**
 * Counts (or sums, via `weight`) per bucket, split by group. Every bucket in
 * the window is present, including empty ones, so gaps show as gaps rather
 * than vanishing.
 */
export function stackedSeries<G extends string, R extends { day: string; hour: number }>(
  records: readonly R[],
  groups: readonly G[],
  groupOf: (record: R) => G,
  since: Date,
  until: Date,
  unit: "day" | "hour",
  weight: (record: R) => number = () => 1,
): StackedBucket<G>[] {
  const empty = () => Object.fromEntries(groups.map((group) => [group, 0])) as Record<G, number>;
  const buckets = new Map<string, StackedBucket<G>>();
  if (unit === "hour") {
    for (let hour = 0; hour < 24; hour += 1) {
      buckets.set(String(hour), { key: String(hour), total: 0, byGroup: empty() });
    }
  } else {
    const last = manilaDayKey(until);
    for (let t = since.getTime(); ; t += DAY_MS) {
      const key = manilaDayKey(new Date(t));
      if (key > last) break;
      buckets.set(key, { key, total: 0, byGroup: empty() });
      if (key === last) break;
    }
  }

  for (const record of records) {
    const bucket = buckets.get(unit === "hour" ? String(record.hour) : record.day);
    if (!bucket) continue;
    const value = weight(record);
    bucket.total += value;
    bucket.byGroup[groupOf(record)] += value;
  }
  return [...buckets.values()];
}

/** 7×24 grid of counts, [weekday][hour], Philippine time. */
export function weekdayHourGrid(records: readonly { weekday: number; hour: number }[]): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const record of records) grid[record.weekday][record.hour] += 1;
  return grid;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
