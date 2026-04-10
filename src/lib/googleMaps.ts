import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

/**
 * Test coordinates by trying to geocode them to verify they're valid locations
 * @param coords - Coordinates to test [lat, lng]
 * @returns Promise with location validation result
 */
export async function testCoordinates(coords: [number, number]): Promise<boolean> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return false;

    const response = await client.reverseGeocode({
      params: {
        latlng: `${coords[0]},${coords[1]}`,
        key: apiKey,
      },
    });

    const isValid = response.data.results.length > 0;
    return isValid;
  } catch {
    return false;
  }
}
