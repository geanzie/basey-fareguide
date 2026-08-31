import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadCuratedCorpus,
  lookupCurated,
  resetCuratedCache,
  saveCuratedCorpus,
} from '@/lib/offline/curatedCache';
import type { CuratedRouteCorpus } from '@/types/curatedRoutes';

const corpus: CuratedRouteCorpus = {
  locationIds: ['loc-a', 'loc-b', 'loc-c'],
  vehicleTypes: ['TRICYCLE', 'HABAL_HABAL'],
  routes: [
    // a -> b, tricycle, 4.2 km, 10 min, bidirectional
    [0, 1, 0, 4200, 600, 1],
    // a -> c, tricycle, 7.8 km, no duration, one-way
    [0, 2, 0, 7800, null, 0],
    // b -> c, habal-habal, 3.1 km
    [1, 2, 1, 3100, 300, 1],
  ],
  count: 3,
  generatedAt: '2026-06-02T00:00:00.000Z',
};

beforeEach(async () => {
  resetCuratedCache();
  await AsyncStorage.clear();
});

describe('curated corpus cache', () => {
  it('returns null before the device has ever held a corpus', async () => {
    expect(await loadCuratedCorpus()).toBeNull();
  });

  it('survives a restart by reading back from storage', async () => {
    await saveCuratedCorpus(corpus);
    resetCuratedCache();

    expect(await loadCuratedCorpus()).toEqual(corpus);
  });

  it('resolves a forward pair to the surveyed distance', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-a', 'loc-b', 'TRICYCLE')).toEqual({
      distanceKm: 4.2,
      durationMin: 10,
      reversed: false,
    });
  });

  it('resolves a reverse pair when the stored row is bidirectional', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-b', 'loc-a', 'TRICYCLE')).toEqual({
      distanceKm: 4.2,
      durationMin: 10,
      reversed: true,
    });
  });

  it('refuses a reverse pair when the stored row is one-way', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-c', 'loc-a', 'TRICYCLE')).toBeNull();
  });

  it('never crosses vehicle types', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-a', 'loc-b', 'HABAL_HABAL')).toBeNull();
    expect(await lookupCurated('loc-b', 'loc-c', 'HABAL_HABAL')).not.toBeNull();
  });

  it('carries a null duration through rather than inventing one', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-a', 'loc-c', 'TRICYCLE')).toEqual({
      distanceKm: 7.8,
      durationMin: null,
      reversed: false,
    });
  });

  it('returns null for an uncovered pair rather than guessing', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-a', 'loc-unknown', 'TRICYCLE')).toBeNull();
  });

  it('returns null without a vehicle type, matching the server', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-a', 'loc-b', null)).toBeNull();
  });

  it('returns null when both ends are the same place', async () => {
    await saveCuratedCorpus(corpus);

    expect(await lookupCurated('loc-a', 'loc-a', 'TRICYCLE')).toBeNull();
  });

  it('treats an unreadable cache as no cache', async () => {
    await AsyncStorage.setItem('curated_routes:v1', 'not json');

    expect(await loadCuratedCorpus()).toBeNull();
  });

  it('replaces the corpus wholesale on refresh', async () => {
    await saveCuratedCorpus(corpus);
    await saveCuratedCorpus({
      locationIds: ['loc-a', 'loc-b'],
      vehicleTypes: ['TRICYCLE'],
      routes: [[0, 1, 0, 9900, 900, 1]],
      count: 1,
      generatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(await lookupCurated('loc-a', 'loc-b', 'TRICYCLE')).toEqual({
      distanceKm: 9.9,
      durationMin: 15,
      reversed: false,
    });
    expect(await lookupCurated('loc-a', 'loc-c', 'TRICYCLE')).toBeNull();
  });
});
