import AsyncStorage from '@react-native-async-storage/async-storage';

import { saveLastFarePolicy, resetFarePolicyCache } from '@/lib/offline/farePolicyCache';
import { resetCuratedCache, saveCuratedCorpus } from '@/lib/offline/curatedCache';
import { resetRouteCache, routeCacheKey, saveCachedRoute } from '@/lib/offline/routeCache';
import {
  OFFLINE_CACHE_REASON,
  OFFLINE_CURATED_REASON,
  resolveOfflineQuote,
} from '@/lib/offline/offlineQuote';
import type { FarePolicySnapshot } from '@/types/fare';
import type { Place, PlaceSelection } from '@/types/places';

const legacyPolicy: FarePolicySnapshot = {
  versionId: 'fare-v1',
  baseFare: 15,
  baseDistanceKm: 3,
  perKmRate: 3,
  effectiveAt: '2026-01-01T00:00:00.000Z',
};

const raisedPolicy: FarePolicySnapshot = {
  ...legacyPolicy,
  versionId: 'fare-v2',
  baseFare: 18,
  perKmRate: 4,
};

const presetOf = (id: string, name: string): PlaceSelection => ({
  kind: 'place',
  place: { id, name, coordinates: { lat: 11.28, lng: 125.06 } } as unknown as Place,
});

const pin: PlaceSelection = { kind: 'pin', coordinates: { lat: 11.2812, lng: 125.0611 } };

const amandayehan = presetOf('loc-a', 'Amandayehan');
const basey = presetOf('loc-b', 'Basey Poblacion');
const uncovered = presetOf('loc-z', 'Nowhere');

beforeEach(async () => {
  resetCuratedCache();
  resetRouteCache();
  resetFarePolicyCache();
  await AsyncStorage.clear();
  await saveLastFarePolicy(legacyPolicy);
  // 7.8 km Amandayehan -> Basey Poblacion by tricycle, bidirectional.
  await saveCuratedCorpus({
    locationIds: ['loc-a', 'loc-b'],
    vehicleTypes: ['TRICYCLE'],
    routes: [[0, 1, 0, 7800, 600, 1]],
    count: 1,
    generatedAt: '2026-06-02T00:00:00.000Z',
  });
});

describe('resolveOfflineQuote', () => {
  it('prices a surveyed pair from the curated corpus', async () => {
    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    // 7.8 km: 15 base + ceil(4.8) * 3 = 30
    expect(quote?.fare).toBe(30);
    expect(quote?.distanceKm).toBe(7.8);
    expect(quote?.fallbackReason).toBe(OFFLINE_CURATED_REASON);
    expect(quote?.method).toBe('curated');
  });

  it('never marks an offline answer as an estimate', async () => {
    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    expect(quote?.isEstimate).toBe(false);
  });

  it('applies the discount on device', async () => {
    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'STUDENT',
      vehicleType: 'TRICYCLE',
    });

    expect(quote?.fare).toBe(24);
    expect(quote?.fareBreakdown.discount).toBe(6);
  });

  it('prices with the cached policy, not the legacy default', async () => {
    await saveLastFarePolicy(raisedPolicy);

    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    // 18 base + ceil(4.8) * 4 = 38
    expect(quote?.fare).toBe(38);
    expect(quote?.farePolicy.versionId).toBe('fare-v2');
  });

  it('falls back to a route this device already measured', async () => {
    await saveCachedRoute(routeCacheKey(amandayehan, uncovered, 'TRICYCLE'), {
      distanceKm: 4.2,
      durationMin: 11,
      farePolicy: legacyPolicy,
      storedAt: Date.now(),
    });

    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: uncovered,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    // 4.2 km: 15 base + ceil(1.2) * 3 = 21
    expect(quote?.fare).toBe(21);
    expect(quote?.fallbackReason).toBe(OFFLINE_CACHE_REASON);
  });

  it('prefers the curated corpus over a stale cached route for the same pair', async () => {
    await saveCachedRoute(routeCacheKey(amandayehan, basey, 'TRICYCLE'), {
      distanceKm: 99,
      durationMin: 11,
      farePolicy: legacyPolicy,
      storedAt: Date.now(),
    });

    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    expect(quote?.distanceKm).toBe(7.8);
  });

  it('returns null for a pin origin rather than estimating', async () => {
    const quote = await resolveOfflineQuote({
      origin: pin,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    expect(quote).toBeNull();
  });

  it('returns null for a pair nothing covers', async () => {
    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: uncovered,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    expect(quote).toBeNull();
  });

  it('returns null when the corpus has no row for this vehicle type', async () => {
    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'HABAL_HABAL',
    });

    expect(quote).toBeNull();
  });

  it('prices the reverse of a bidirectional surveyed pair', async () => {
    const quote = await resolveOfflineQuote({
      origin: basey,
      destination: amandayehan,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    expect(quote?.fare).toBe(30);
  });

  it('honours the policy stored with a cached route over the global one', async () => {
    await saveCachedRoute(routeCacheKey(amandayehan, uncovered, 'TRICYCLE'), {
      distanceKm: 4.2,
      durationMin: 11,
      farePolicy: raisedPolicy,
      storedAt: Date.now(),
    });

    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: uncovered,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    // 18 base + ceil(1.2) * 4 = 26
    expect(quote?.fare).toBe(26);
  });

  it('carries no polyline or drop-off advice it cannot stand behind', async () => {
    const quote = await resolveOfflineQuote({
      origin: amandayehan,
      destination: basey,
      passengerType: 'REGULAR',
      vehicleType: 'TRICYCLE',
    });

    expect(quote?.polyline).toBeNull();
    expect(quote?.dropoffNotices).toEqual([]);
    expect(quote?.twoWheelerNotice).toBe(false);
  });
});
