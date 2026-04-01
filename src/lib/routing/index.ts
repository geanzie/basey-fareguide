import type { RouteResult } from "./types";
import type { Coordinates } from "./providers/base";
import { OrsProvider } from "./providers/ors";
import { GpsProvider } from "./providers/gps";

export type { RouteResult } from "./types";
export type { Coordinates } from "./providers/base";

const gps = new GpsProvider();

/**
 * Calculate a route between two coordinates.
 * Tries ORS first; falls back to GPS/Haversine if ORS is unavailable or errors.
 */
export async function calculateRouteWithFallback(
  origin: Coordinates,
  destination: Coordinates
): Promise<RouteResult> {
  try {
    const ors = new OrsProvider();
    return await ors.calculate(origin, destination);
  } catch (orsError) {
    const fallbackReason =
      orsError instanceof Error ? orsError.message : String(orsError);

    console.error("[routing] ORS failed, falling back to GPS:", fallbackReason);

    const gpsResult = await gps.calculate(origin, destination);
    return {
      ...gpsResult,
      fallbackReason,
    };
  }
}
