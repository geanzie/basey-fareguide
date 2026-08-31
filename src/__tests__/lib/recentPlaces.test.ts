import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_RECENT_PINS,
  MAX_RECENT_PLACES,
  loadRecentPlaces,
  mergeRecents,
  recentKey,
  recentLabel,
  recentToSelection,
  rememberRecentPlaces,
  type RecentEntry,
} from '@/lib/recentPlaces';
import type { Place, PlaceSelection } from '@/types/places';

function place(name: string, overrides: Partial<Place> = {}): Place {
  return {
    id: name,
    name,
    type: 'LANDMARK',
    category: 'landmark',
    coordinates: { lat: 11.28, lng: 125.07 },
    address: `${name}, Basey, Samar`,
    verified: false,
    source: 'database',
    pointSource: 'osm',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const pick = (name: string, overrides: Partial<Place> = {}): PlaceSelection => ({
  kind: 'place',
  place: place(name, overrides),
});

const pin = (lat: number, lng: number, label = 'Dropped pin'): PlaceSelection => ({
  kind: 'pin',
  coordinates: { lat, lng },
  label,
});

describe('mergeRecents', () => {
  it('records both ends of a trip, newest first', () => {
    const merged = mergeRecents([], [pick('Amandayehan'), pick('Basey Public Market')]);

    expect(merged.map(recentLabel)).toEqual(['Amandayehan', 'Basey Public Market']);
  });

  it('promotes a place that is quoted again instead of listing it twice', () => {
    const first = mergeRecents([], [pick('Amandayehan'), pick('Balo-Og')]);
    const second = mergeRecents(first, [pick('Balo-Og')]);

    expect(second.map(recentLabel)).toEqual(['Balo-Og', 'Amandayehan']);
  });

  it('treats a pin re-dropped within a metre as the same spot', () => {
    const first = mergeRecents([], [pin(11.2801234, 125.0705678, 'Sulod')]);
    // Nobody taps the same coordinate twice; rounding is what makes this work.
    const second = mergeRecents(first, [pin(11.28012341, 125.07056783, 'Sulod')]);

    expect(second).toHaveLength(1);
  });

  it('keeps a pin a few metres away as its own entry', () => {
    const first = mergeRecents([], [pin(11.28, 125.07)]);
    const second = mergeRecents(first, [pin(11.2805, 125.0705)]);

    expect(second).toHaveLength(2);
  });

  it('caps named places and pins apart, so pins cannot crowd out the list', () => {
    const manyPlaces = Array.from({ length: MAX_RECENT_PLACES + 4 }, (_, i) => pick(`Place ${i}`));
    const manyPins = Array.from({ length: MAX_RECENT_PINS + 4 }, (_, i) =>
      pin(11.28 + i / 1000, 125.07),
    );

    const merged = mergeRecents([], [...manyPins, ...manyPlaces]);

    expect(merged.filter((entry) => entry.kind === 'place')).toHaveLength(MAX_RECENT_PLACES);
    expect(merged.filter((entry) => entry.kind === 'pin')).toHaveLength(MAX_RECENT_PINS);
  });

  it('evicts the oldest entry once the cap is reached', () => {
    const filled = mergeRecents(
      [],
      Array.from({ length: MAX_RECENT_PLACES }, (_, i) => pick(`Place ${i}`)),
    );
    // Position 0 is the newest, so the last one added is the first one out.
    const oldest = recentLabel(filled[filled.length - 1]);

    const merged = mergeRecents(filled, [pick('Newcomer')]);

    expect(merged.map(recentLabel)).toContain('Newcomer');
    expect(merged.map(recentLabel)).not.toContain(oldest);
  });

  it('drops selections it could never identify again', () => {
    const merged = mergeRecents(
      [],
      [
        { kind: 'place', place: place('No id', { id: '' }) },
        { kind: 'pin', coordinates: { lat: Number.NaN, lng: 125.07 } },
        pick('Amandayehan'),
      ],
    );

    expect(merged.map(recentLabel)).toEqual(['Amandayehan']);
  });
});

describe('recentToSelection', () => {
  it('round-trips a place back into the selection the quote takes', () => {
    const [entry] = mergeRecents([], [pick('Amandayehan')]);

    expect(recentToSelection(entry)).toEqual({ kind: 'place', place: place('Amandayehan') });
  });

  it('keeps the resolved label on a pin, so the row still reads offline', () => {
    const [entry] = mergeRecents([], [pin(11.28, 125.07, 'Sulod')]);

    expect(recentToSelection(entry)).toEqual({
      kind: 'pin',
      coordinates: { lat: 11.28, lng: 125.07 },
      label: 'Sulod',
    });
  });
});

describe('storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists what it merged and reads it back', async () => {
    await rememberRecentPlaces('rider-1', [pick('Amandayehan'), pin(11.28, 125.07, 'Sulod')]);

    expect((await loadRecentPlaces('rider-1')).map(recentLabel)).toEqual([
      'Amandayehan',
      'Sulod',
    ]);
  });

  it('keeps riders apart, because these phones get shared', async () => {
    await rememberRecentPlaces('rider-1', [pick('Amandayehan')]);
    await rememberRecentPlaces('rider-2', [pick('Balo-Og')]);

    expect((await loadRecentPlaces('rider-1')).map(recentLabel)).toEqual(['Amandayehan']);
    expect((await loadRecentPlaces('rider-2')).map(recentLabel)).toEqual(['Balo-Og']);
  });

  it('treats an unreadable list as no list rather than wedging the screen', async () => {
    await AsyncStorage.setItem('recent_places:v1:rider-1', 'not json');

    await expect(loadRecentPlaces('rider-1')).resolves.toEqual([]);
  });

  it('discards stored entries that no longer parse', async () => {
    await AsyncStorage.setItem(
      'recent_places:v1:rider-1',
      JSON.stringify([{ kind: 'place' }, { kind: 'nonsense' }]),
    );

    await expect(loadRecentPlaces('rider-1')).resolves.toEqual([]);
  });
});

describe('recentKey', () => {
  it('separates a place from a pin sitting on the same coordinate', () => {
    const entries: RecentEntry[] = mergeRecents(
      [],
      [pick('Sulod', { coordinates: { lat: 11.28, lng: 125.07 } }), pin(11.28, 125.07, 'Sulod')],
    );

    expect(new Set(entries.map(recentKey)).size).toBe(2);
  });
});
