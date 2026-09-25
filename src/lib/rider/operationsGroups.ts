/**
 * Client-safe pieces of the rider dashboard: labels, the page filter, and the
 * aggregations the page re-runs whenever a filter changes.
 *
 * Kept free of server-only imports (Prisma) so the page can import it without
 * shipping them to the browser.
 */
import type { RiderFareGroup, RiderTripDto } from "@/lib/contracts";
import { stackedSeries, type StackedBucket } from "@/lib/operations/period";

export const FARE_GROUPS: readonly RiderFareGroup[] = ["FULL", "DISCOUNTED"];

export const FARE_GROUP_LABELS: Record<RiderFareGroup, string> = {
  FULL: "Full fare",
  DISCOUNTED: "With discount",
};

/** Vehicle type key for trips that did not record one. */
export const UNKNOWN_VEHICLE_TYPE = "UNKNOWN";

export type RiderFilter = { kind: "vehicleType"; vehicleType: string } | null;

export function matchesTrip(filter: RiderFilter, trip: RiderTripDto): boolean {
  if (!filter) return true;
  return (trip.vehicleType ?? UNKNOWN_VEHICLE_TYPE) === filter.vehicleType;
}

export function tripTotals(trips: readonly RiderTripDto[]): { spent: number; saved: number; distanceKm: number } {
  return trips.reduce(
    (totals, trip) => ({
      spent: totals.spent + trip.fare,
      saved: totals.saved + trip.discount,
      distanceKm: totals.distanceKm + trip.distanceKm,
    }),
    { spent: 0, saved: 0, distanceKm: 0 },
  );
}

/** Pesos paid per bucket, split by full fare and discounted fare. */
export function spendSeries(
  trips: readonly RiderTripDto[],
  since: Date,
  until: Date,
  unit: "day" | "hour",
): StackedBucket<RiderFareGroup>[] {
  return stackedSeries(trips, FARE_GROUPS, (trip) => trip.group, since, until, unit, (trip) => trip.fare);
}

/** Pesos saved by discounts per bucket. */
export function savingsSeries(
  trips: readonly RiderTripDto[],
  since: Date,
  until: Date,
  unit: "day" | "hour",
): StackedBucket<"SAVED">[] {
  return stackedSeries(
    trips.filter((trip) => trip.discount > 0),
    ["SAVED"] as const,
    () => "SAVED",
    since,
    until,
    unit,
    (trip) => trip.discount,
  );
}

/** Trips per vehicle type, largest first; missing types count as UNKNOWN. */
export function tripsByVehicleType(
  trips: readonly RiderTripDto[],
): Array<{ vehicleType: string; count: number; spent: number }> {
  const rows = new Map<string, { vehicleType: string; count: number; spent: number }>();
  for (const trip of trips) {
    const key = trip.vehicleType ?? UNKNOWN_VEHICLE_TYPE;
    const row = rows.get(key) ?? { vehicleType: key, count: 0, spent: 0 };
    row.count += 1;
    row.spent += trip.fare;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.vehicleType.localeCompare(b.vehicleType));
}

export interface FrequentRoute {
  key: string;
  from: string;
  to: string;
  count: number;
  averageFare: number;
}

/** The rider's most repeated from→to pairs, most trips first. */
export function frequentRoutes(trips: readonly RiderTripDto[], limit = 8): FrequentRoute[] {
  const routes = new Map<string, { from: string; to: string; count: number; total: number }>();
  for (const trip of trips) {
    const key = `${trip.from.trim().toLowerCase()}|${trip.to.trim().toLowerCase()}`;
    const route = routes.get(key) ?? { from: trip.from, to: trip.to, count: 0, total: 0 };
    route.count += 1;
    route.total += trip.fare;
    routes.set(key, route);
  }
  return [...routes.entries()]
    .map(([key, route]) => ({
      key,
      from: route.from,
      to: route.to,
      count: route.count,
      averageFare: route.total / route.count,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}
