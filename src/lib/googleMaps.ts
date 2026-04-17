import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

// Cache geocode results to avoid redundant API calls for the same coordinates.
// Coordinates are normalized to 6dp to ensure consistent keys.
// Errors are NOT cached — a failed lookup returns false and is retried next call.
const geocodeCache = new Map<string, { result: boolean; expiresAt: number }>();
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Test coordinates by trying to geocode them to verify they're valid locations
 * @param coords - Coordinates to test [lat, lng]
 * @returns Promise with location validation result
 */
export async function testCoordinates(coords: [number, number]): Promise<boolean> {
  const cacheKey = `${coords[0].toFixed(6)},${coords[1].toFixed(6)}`;
  const now = Date.now();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
    if (!apiKey) return false;

    const response = await client.reverseGeocode({
      params: {
        latlng: `${coords[0]},${coords[1]}`,
        key: apiKey,
      },
    });

    const isValid = response.data.results.length > 0;
    geocodeCache.set(cacheKey, { result: isValid, expiresAt: now + GEOCODE_CACHE_TTL_MS });
    return isValid;
  } catch {
    return false;
  }
}
