import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearRouteCache,
  resetRouteCache,
  loadCachedRoute,
  routeCacheKey,
  saveCachedRoute,
  type CachedRoute,
} from '@/lib/offline/routeCache';
import type { FarePolicySnapshot } from '@/types/fare';
import type { Place, PlaceSelection } from '@/types/places';

const policy: FarePolicySnapshot = {
  versionId: 'fare-v1',
  baseFare: 15,
  baseDistanceKm: 3,
  perKmRate: 3,
  effectiveAt: '2026-01-01T00:00:00.000Z',
};

const place = (name: string, lat: number, lng: number): Place =>
  ({
    id: `id-${name}`,
    name,
    type: 'BARANGAY',
    category: 'barangay',
    coordinates: { lat, lng },
    address: name,
    verified: true,
    source: 'database',
    pointSource: 'polygon_centroid',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }) as unknown as Place;

const preset = (name: string, lat = 11.28, lng = 125.06): PlaceSelection => ({
  kind: 'place',
  place: place(name, lat, lng),
});

const pin = (lat: number, lng: number): PlaceSelection => ({
  kind: 'pin',
  coordinates: { lat, lng },
});

const route = (distanceKm: number): CachedRoute => ({
  distanceKm,
  durationMin: 12,
  farePolicy: policy,
  storedAt: Date.now(),
});

beforeEach(async () => {
  clearRouteCache();
  resetRouteCache();
  await AsyncStorage.clear();
});

describe('routeCacheKey', () => {
  it('keys presets by name, so a re-seeded centroid does not orphan the entry', () => {
    const before = routeCacheKey(preset('Amandayehan', 11.28, 125.06), preset('Basey'), 'TRICYCLE');
    const after = routeCacheKey(preset('Amandayehan', 11.31, 125.09), preset('Basey'), 'TRICYCLE');

    expect(before).toBe(after);
    expect(before).toContain('preset:Amandayehan');
  });

  it('keys pins by coordinate at 4 dp, matching the server routing cache', () => {
    expect(routeCacheKey(pin(11.281234, 125.061111), pin(11.3, 125.1), 'TRICYCLE')).toBe(
      'pin:11.2812,125.0611->pin:11.3000,125.1000#TRICYCLE',
    );
  });

  it('treats pins within about 11 m as the same pair', () => {
    const a = routeCacheKey(pin(11.28001, 125.06001), pin(11.3, 125.1), 'TRICYCLE');
    const b = routeCacheKey(pin(11.28002, 125.06002), pin(11.3, 125.1), 'TRICYCLE');

    expect(a).toBe(b);
  });

  it('separates vehicle types, which are priced over different distances', () => {
    const tricycle = routeCacheKey(preset('A'), preset('B'), 'TRICYCLE');
    const habal = routeCacheKey(preset('A'), preset('B'), 'HABAL_HABAL');

    expect(tricycle).not.toBe(habal);
  });

  it('does not treat a reversed trip as the same entry', () => {
    expect(routeCacheKey(preset('A'), preset('B'), 'TRICYCLE')).not.toBe(
      routeCacheKey(preset('B'), preset('A'), 'TRICYCLE'),
    );
  });
});

describe('route cache', () => {
  it('returns null for a pair this device has never priced', async () => {
    expect(await loadCachedRoute('preset:A->preset:B#TRICYCLE')).toBeNull();
  });

  it('replays a stored distance after a restart', async () => {
    const key = routeCacheKey(preset('A'), preset('B'), 'TRICYCLE');
    await saveCachedRoute(key, route(7.8));
    resetRouteCache(); // in-memory only: this is what a fresh app launch sees

    const loaded = await loadCachedRoute(key);

    expect(loaded?.distanceKm).toBe(7.8);
    expect(loaded?.farePolicy).toEqual(policy);
  });

  it('stores no fare, so a rate change cannot replay a stale price', async () => {
    const key = routeCacheKey(preset('A'), preset('B'), 'TRICYCLE');
    await saveCachedRoute(key, route(7.8));

    expect(await loadCachedRoute(key)).not.toHaveProperty('fare');
  });

  it('evicts the oldest entries past the cap', async () => {
    const oldestKey = routeCacheKey(preset('P0'), preset('D'), 'TRICYCLE');

    for (let i = 0; i < 205; i += 1) {
      await saveCachedRoute(routeCacheKey(preset(`P${i}`), preset('D'), 'TRICYCLE'), {
        ...route(4 + i / 100),
        storedAt: 1000 + i,
      });
    }

    expect(await loadCachedRoute(oldestKey)).toBeNull();
    expect(
      await loadCachedRoute(routeCacheKey(preset('P204'), preset('D'), 'TRICYCLE')),
    ).not.toBeNull();
  });

  it('treats an unreadable cache as empty rather than throwing', async () => {
    await AsyncStorage.setItem('route_cache:v1', 'not json');

    expect(await loadCachedRoute('anything')).toBeNull();
  });
});
