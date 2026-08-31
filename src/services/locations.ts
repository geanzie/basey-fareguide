import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import type { Place, PlaceCandidate, PinLabel, PlacesResponse } from '@/types/places';

/** Basey bounding box, used to bias geocoding toward the municipality. */
const BASEY_BOUNDS = {
  southwest: { lat: 11.1, lng: 124.8 },
  northeast: { lat: 11.5, lng: 125.3 },
};

const PLACES_CACHE_KEY = 'places_cache:v1';

let cachedPlaces: Place[] | null = null;
let inFlight: Promise<Place[]> | null = null;

/**
 * The full Place list is ~150 rows and is served with a cache header, so it is
 * fetched once per session and matched against locally. That keeps search
 * instant on the rural connections these users actually have.
 */
export async function fetchPlaces(): Promise<Place[]> {
  if (cachedPlaces) return cachedPlaces;
  if (inFlight) return inFlight;

  inFlight = api
    .get<PlacesResponse>('/api/locations')
    .then((res) => {
      cachedPlaces = res.locations ?? [];
      void writeCachedPlaces(cachedPlaces);
      return cachedPlaces;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * The list as of the last successful fetch, without touching the network.
 *
 * Search is the way into the calculator now, so waiting on a round trip before
 * anything is tappable would be the whole screen waiting. Callers render this
 * first and let {@link fetchPlaces} replace it when it arrives; on a dead
 * connection it is the only list there is.
 */
export async function readCachedPlaces(): Promise<Place[] | null> {
  if (cachedPlaces) return cachedPlaces;

  try {
    const raw = await AsyncStorage.getItem(PLACES_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    cachedPlaces = parsed as Place[];
    return cachedPlaces;
  } catch {
    // An unreadable cache is the same as no cache.
    return null;
  }
}

async function writeCachedPlaces(places: Place[]): Promise<void> {
  if (places.length === 0) return;
  try {
    await AsyncStorage.setItem(PLACES_CACHE_KEY, JSON.stringify(places));
  } catch {
    // Persisting is an optimisation; the session cache still holds.
  }
}

export function clearPlacesCache() {
  cachedPlaces = null;
  void AsyncStorage.removeItem(PLACES_CACHE_KEY).catch(() => {});
}

interface GeocodeResult {
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
}

/**
 * Discovery fallback for names the curated list does not carry. Only ever
 * called on an explicit user action — never per keystroke — because it spends
 * the Google key and requires an authenticated user.
 */
export async function searchWider(query: string): Promise<PlaceCandidate[]> {
  const res = await api.post<{ success: boolean; results: GeocodeResult[] }>(
    '/api/geocode/forward',
    { query, bounds: BASEY_BOUNDS },
  );

  return (res.results ?? [])
    .map((result) => {
      const location = result.geometry?.location;
      if (!location) return null;
      const address = result.formatted_address ?? query;
      return {
        label: address.split(',')[0]?.trim() || address,
        address,
        coordinates: { lat: location.lat, lng: location.lng },
      };
    })
    .filter((candidate): candidate is PlaceCandidate => candidate !== null);
}

/**
 * Names an arbitrary coordinate after its barangay. Cheap and public — no
 * Google key behind it, just the polygon lookup the web app runs locally.
 *
 * Callers treat a failure as "no better label available"; nothing depends on
 * this resolving, because /api/routes/calculate labels the endpoints again in
 * the quote itself.
 */
export async function fetchPinLabel(lat: number, lng: number): Promise<PinLabel> {
  const res = await api.get<{ success: boolean; pinLabel: PinLabel }>(
    `/api/locations/pin-label?lat=${lat}&lng=${lng}`,
  );
  return res.pinLabel;
}
