import { calculateFare, getFareBreakdown } from '@/lib/fare/calculator';
import { resolveFarePolicySnapshot } from '@/lib/fare/policy';
import { loadLastFarePolicy } from './farePolicyCache';
import { lookupCurated } from './curatedCache';
import { loadCachedRoute, routeCacheKey } from './routeCache';
import type { PassengerType, RouteCalculationResponse, VehicleType } from '@/types/fare';
import { selectionLabel, type PlaceSelection } from '@/types/places';

/** The trip was priced from the municipality's surveyed distance corpus. */
export const OFFLINE_CURATED_REASON = 'offline_curated';
/** The trip replays a distance this device already fetched from the server. */
export const OFFLINE_CACHE_REASON = 'offline_cache';

export interface OfflineQuoteInput {
  origin: PlaceSelection;
  destination: PlaceSelection;
  passengerType: PassengerType;
  vehicleType: VehicleType | null;
}

/**
 * Price a trip with no network, or return null.
 *
 * Null is a first-class answer here. Under Ordinance 105 a fare that disagrees
 * with the driver's app starts an argument at the roadside, so this deliberately
 * has no estimating fallback: there is no straight-line heuristic and no
 * on-device road graph, only distances the server itself would have returned.
 * When neither source covers the trip the caller shows an offline state and the
 * official rate card, never a computed number.
 *
 * Resolution order:
 *   1. the curated corpus — surveyed, and what an online quote consults first,
 *      so it agrees with the server exactly
 *   2. a replay of a route this device already measured online
 */
export async function resolveOfflineQuote(
  input: OfflineQuoteInput,
): Promise<RouteCalculationResponse | null> {
  const { origin, destination, passengerType, vehicleType } = input;

  const farePolicy = resolveFarePolicySnapshot(await loadLastFarePolicy());

  const curated = await lookupCurated(
    origin.kind === 'place' ? origin.place.id : null,
    destination.kind === 'place' ? destination.place.id : null,
    vehicleType,
  );

  if (curated) {
    return buildResponse(input, farePolicy, {
      distanceKm: curated.distanceKm,
      durationMin: curated.durationMin,
      fallbackReason: OFFLINE_CURATED_REASON,
      method: 'curated',
    });
  }

  const cached = await loadCachedRoute(routeCacheKey(origin, destination, vehicleType));
  if (cached) {
    return buildResponse(
      input,
      // The policy stored with the route wins: it is the one that was in force
      // when the distance was measured, and it may be newer than the global.
      resolveFarePolicySnapshot(cached.farePolicy ?? farePolicy),
      {
        distanceKm: cached.distanceKm,
        durationMin: cached.durationMin,
        fallbackReason: OFFLINE_CACHE_REASON,
        method: null,
      },
    );
  }

  return null;
}

function buildResponse(
  input: OfflineQuoteInput,
  farePolicy: ReturnType<typeof resolveFarePolicySnapshot>,
  opts: {
    distanceKm: number;
    durationMin: number | null;
    fallbackReason: string;
    method: RouteCalculationResponse['method'];
  },
): RouteCalculationResponse {
  const { origin, destination, passengerType, vehicleType } = input;

  return {
    distanceKm: opts.distanceKm,
    durationMin: opts.durationMin ?? undefined,
    fare: calculateFare(opts.distanceKm, passengerType, farePolicy),
    fareBreakdown: getFareBreakdown(opts.distanceKm, passengerType, farePolicy),
    farePolicy,
    // NOT an estimate. Both offline sources return a distance the server would
    // have returned, which is the whole precondition for showing a number here.
    isEstimate: false,
    method: opts.method,
    provider: opts.method,
    fallbackReason: opts.fallbackReason,
    // No map offline, so no geometry to draw and nothing was snapped.
    polyline: null,
    snappedOrigin: null,
    snappedDestination: null,
    passengerType,
    origin: selectionLabel(origin),
    destination: selectionLabel(destination),
    inputMode: origin.kind === 'place' && destination.kind === 'place' ? 'preset' : 'pin',
    vehicleType,
    // Neither offline source came from Google, so its two-wheeler notice does
    // not apply, and terrain is never checked without a polyline.
    twoWheelerNotice: false,
    routeValidity: null,
    // Drop-off advice needs the server's curated access data, which the offline
    // path has no copy of. Better silent than wrong about where a ride can stop.
    dropoffNotices: [],
  };
}
