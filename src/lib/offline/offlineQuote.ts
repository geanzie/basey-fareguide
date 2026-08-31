import type { FarePolicySnapshotDto } from "@/lib/contracts";

/** Marks a quote replayed from a route this browser already measured online. */
export const OFFLINE_CACHE_REASON = "offline_cache";

const peso = (value: number) => `₱${value.toFixed(2)}`;

/**
 * What to tell a rider offline when no measured distance covers their trip.
 *
 * It quotes the official rates rather than a fare. The rates are a fact and
 * cannot be wrong; a fare derived from a guessed distance can be, and under
 * Ordinance 105 a wrong fare is an argument with a driver rather than a minor
 * UI inaccuracy. The rider still gets what they need to judge whether the fare
 * being asked of them is plausible.
 */
export function offlineUnpricedMessage(
  farePolicy: FarePolicySnapshotDto | null,
): string {
  const base =
    "You're offline and this trip has no measured distance saved, so no official fare can be shown.";

  if (!farePolicy) {
    return `${base} Reconnect to calculate it.`;
  }

  return (
    `${base} Official rates: ${peso(farePolicy.baseFare)} for the first ` +
    `${farePolicy.baseDistanceKm} km, then ${peso(farePolicy.perKmRate)} per additional km ` +
    `(billed as whole kilometres), less 20% for students, seniors and PWDs. ` +
    `Reconnect to calculate the exact fare.`
  );
}
