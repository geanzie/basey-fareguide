import { browsePlaces, normalize, searchPlaces } from '@/lib/placeSearch';
import type { Place } from '@/types/places';

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

describe('normalize', () => {
  it('folds the U+2160 roman numeral the dataset actually contains', () => {
    // "Basey Ⅰ Central Elementary school" uses ROMAN NUMERAL ONE, not "I".
    expect(normalize('Basey Ⅰ Central')).toBe('baseyicentral');
  });

  it('strips hyphens so spelling variants collapse together', () => {
    expect(normalize('Balo-Og')).toBe(normalize('Baloog'));
    expect(normalize('Lo-Og')).toBe(normalize('Loog'));
    expect(normalize('Can-Manila')).toBe(normalize('Canmanila'));
  });
});

describe('searchPlaces', () => {
  const places = [
    place('Amandayehan', { category: 'barangay', coordinates: { lat: 11.2788, lng: 125.0012 } }),
    place('Balo-Og', { category: 'barangay', coordinates: { lat: 11.29, lng: 125.02 } }),
    place('Basey Public Market', { coordinates: { lat: 11.279, lng: 125.0645 } }),
    place('Sohoton Cave', { coordinates: { lat: 11.42, lng: 125.12 }, needsResurvey: true }),
    place('Sohoton National Park', { coordinates: { lat: 11.425, lng: 125.125 } }),
  ];

  it('returns nothing for an empty query', () => {
    expect(searchPlaces(places, '   ').places).toHaveLength(0);
  });

  it('matches a hyphenated barangay typed without the hyphen', () => {
    const { places: found } = searchPlaces(places, 'baloog');
    expect(found.map((p) => p.name)).toContain('Balo-Og');
  });

  it('ranks an exact match above a substring match', () => {
    const { places: found } = searchPlaces(places, 'sohoton cave');
    expect(found[0].name).toBe('Sohoton Cave');
  });

  it('ranks barangays above landmarks at the same score', () => {
    const withBoth = [
      place('Mercado Barangay Hall', { coordinates: { lat: 11.4, lng: 125.2 } }),
      place('Mercado', { category: 'barangay', coordinates: { lat: 11.2807, lng: 125.0701 } }),
    ];
    const { places: found } = searchPlaces(withBoth, 'mercado');
    expect(found[0].name).toBe('Mercado');
  });

  it('collapses two results that sit on the same spot', () => {
    // A barangay now uses its hall coordinate, so both names are one place.
    const coincident = [
      place('Sulod', { category: 'barangay', coordinates: { lat: 11.2820056, lng: 125.0687521 } }),
      place('Bahay Pamahalaan ng Barangay Sulod', {
        coordinates: { lat: 11.2820056, lng: 125.0687521 },
      }),
    ];
    const { places: found } = searchPlaces(coincident, 'sulod');
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('Sulod');
  });

  it('offers near-misses only when nothing matches directly', () => {
    const { places: found, isFuzzy } = searchPlaces(places, 'sohotan');
    expect(isFuzzy).toBe(true);
    expect(found.map((p) => p.name)).toContain('Sohoton Cave');
  });

  it('does not offer near-misses for very short queries', () => {
    expect(searchPlaces(places, 'zzz')).toEqual({ places: [], isFuzzy: false });
  });

  it('finds places by the barangay they sit in', () => {
    const inBarangay = [place('Rose Pharmacy', { barangay: 'Buscada' })];
    const { places: found } = searchPlaces(inBarangay, 'buscada');
    expect(found.map((p) => p.name)).toEqual(['Rose Pharmacy']);
  });
});

describe('browsePlaces', () => {
  const amandayehan = place('Amandayehan', {
    category: 'barangay',
    coordinates: { lat: 11.2788, lng: 125.0012 },
  });
  const market = place('Basey Public Market', { coordinates: { lat: 11.279, lng: 125.0645 } });
  const sohoton = place('Sohoton Cave', { coordinates: { lat: 11.42, lng: 125.12 } });
  const places = [sohoton, amandayehan, market];

  it('sorts nearest-first against the detected pickup', () => {
    const near = { lat: 11.279, lng: 125.064 };

    expect(browsePlaces(places, near).map((p) => p.name)).toEqual([
      'Basey Public Market',
      'Amandayehan',
      'Sohoton Cave',
    ]);
  });

  it('falls back to alphabetical when there is no fix to measure from', () => {
    expect(browsePlaces(places, null).map((p) => p.name)).toEqual([
      'Amandayehan',
      'Basey Public Market',
      'Sohoton Cave',
    ]);
  });

  it('keeps the barangay rather than the hall standing on the same spot', () => {
    const sulod = place('Sulod', { category: 'barangay', coordinates: { lat: 11.3, lng: 125.05 } });
    const hall = place('Bahay Pamahalaan ng Barangay Sulod', {
      coordinates: { lat: 11.30001, lng: 125.05001 },
    });

    const browsed = browsePlaces([hall, sulod], { lat: 11.3, lng: 125.05 });

    expect(browsed.map((p) => p.name)).toEqual(['Sulod']);
  });
});
