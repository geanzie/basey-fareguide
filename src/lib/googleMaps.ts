import { Client, TravelMode, UnitSystem, Language } from '@googlemaps/google-maps-services-js';

// Initialize Google Maps Services client
const client = new Client({});

export interface GoogleMapsRoute {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  polyline: string;
}

export interface BaseyLocation {
  name: string;
  coords: [number, number]; // [lat, lng]
  type: 'urban' | 'rural' | 'landmark';
}

/**
 * Calculate route distance and duration using Google Maps Distance Matrix API
 * @param origin - Starting location coordinates [lat, lng]
 * @param destination - Destination coordinates [lat, lng]
 * @returns Promise with route information
 */
export async function getGoogleMapsRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<GoogleMapsRoute | null> {
  try {
    // Use server-side API key (without NEXT_PUBLIC prefix for server-side operations)
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not found. Please set GOOGLE_MAPS_SERVER_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
      return null;
    }

    const response = await client.distancematrix({
      params: {
        origins: [`${origin[0]},${origin[1]}`],
        destinations: [`${destination[0]},${destination[1]}`],
        mode: TravelMode.driving,
        units: UnitSystem.metric,
        avoid: [], // Can add 'tolls', 'highways', 'ferries' as needed
        key: apiKey,
      },
    });

    const element = response.data.rows[0]?.elements[0];
    
    if (!element || element.status !== 'OK') {
      console.error('No route found or API error:', element?.status);
      return null;
    }

    return {
      distance: element.distance,
      duration: element.duration,
      polyline: '', // Distance Matrix API doesn't provide polyline
    };
  } catch (error) {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    console.error('Google Maps Distance Matrix API Error:', {
      error: error,
      apiKeyExists: !!apiKey,
      origin,
      destination,
      timestamp: new Date().toISOString()
    });
    
    // Log specific error details for production debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return null;
  }
}

/**
 * Test coordinates by trying to geocode them to verify they're valid locations
 * @param coords - Coordinates to test [lat, lng]
 * @returns Promise with location validation result
 */
export async function testCoordinates(coords: [number, number]): Promise<boolean> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return false;

    console.log(`🧪 Testing coordinates: [${coords[0]}, ${coords[1]}]`);
    
    // Use reverse geocoding to test if coordinates are valid
    const response = await client.reverseGeocode({
      params: {
        latlng: `${coords[0]},${coords[1]}`,
        key: apiKey,
      },
    });

    const isValid = response.data.results.length > 0;
    console.log(`📍 Coordinate test result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    if (isValid && response.data.results[0]) {
      console.log(`📮 Address: ${response.data.results[0].formatted_address}`);
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Error testing coordinates:', error);
    return false;
  }
}

/**
 * Get detailed route with polyline using Directions API
 * @param origin - Starting location coordinates [lat, lng]
 * @param destination - Destination coordinates [lat, lng]
 * @returns Promise with detailed route information including polyline
 */
export async function getDetailedRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<GoogleMapsRoute | null> {
  try {
    // Use server-side API key (without NEXT_PUBLIC prefix for server-side operations)
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('🚫 Google Maps API key not found!');
      console.error('📋 Setup Instructions:');
      console.error('1. Create .env.local file in your project root');
      console.error('2. Add: GOOGLE_MAPS_SERVER_API_KEY=your_api_key_here');
      console.error('3. Ensure Directions API is enabled in Google Cloud Console');
      console.error('4. Restart the development server');
      return null;
    }
    
    console.log(`🗺️ Calculating route: [${origin[0]}, ${origin[1]}] → [${destination[0]}, ${destination[1]}]`);
    
    // Test coordinates validity first
    const [originValid, destValid] = await Promise.all([
      testCoordinates(origin),
      testCoordinates(destination)
    ]);
    
    if (!originValid) {
      console.error('❌ Origin coordinates are not valid or not found by Google Maps');
      return null;
    }
    
    if (!destValid) {
      console.error('❌ Destination coordinates are not valid or not found by Google Maps');
      return null;
    }

    console.log('✅ Both coordinates validated, proceeding with route calculation...');

    // Try multiple approaches for routing in remote areas
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Route calculation attempt ${attempts}/${maxAttempts}`);
      
      try {
        const requestParams = {
          origin: `${origin[0]},${origin[1]}`,
          destination: `${destination[0]},${destination[1]}`,
          mode: TravelMode.driving,
          units: UnitSystem.metric,
          key: apiKey,
        };
        
        // Add region-specific parameters for better routing
        if (attempts === 1) {
          // First attempt: Standard routing with Philippines region
          Object.assign(requestParams, {
            region: 'ph',
            language: Language.en,
            alternatives: false,
          });
        } else if (attempts === 2) {
          // Second attempt: Allow alternatives and different routing
          Object.assign(requestParams, {
            alternatives: true,
            avoid: [], // Clear any restrictions
          });
        } else {
          // Third attempt: Basic routing without extra parameters
          // Just use the basic params
        }
        
        response = await client.directions({
          params: requestParams,
        });
        
        if (response.data.routes && response.data.routes.length > 0) {
          console.log(`✅ Route found on attempt ${attempts}`);
          break;
        }
        
      } catch (attemptError) {
        console.error(`❌ Attempt ${attempts} failed:`, attemptError);
        if (attempts === maxAttempts) {
          throw attemptError;
        }
      }
    }

    if (!response) {
      console.error('❌ No response received from Google Maps API after all attempts');
      return null;
    }

    console.log('📡 Google Maps Response Status:', response.status);
    console.log('🛣️ Routes found:', response.data.routes.length);
    console.log('📊 Response data:', JSON.stringify({
      status: response.data.status,
      routes: response.data.routes.length,
      geocoded_waypoints: response.data.geocoded_waypoints?.length || 0,
      error_message: response.data.error_message
    }, null, 2));

    const route = response.data.routes[0];
    
    if (!route) {
      console.error('❌ No route found - Google Maps Response:');
      console.error('   Status:', response.data.status);
      console.error('   Error Message:', response.data.error_message || 'None provided');
      console.error('   Available Routes:', response.data.routes.length);
      return null;
    }

    const leg = route.legs[0];
    
    return {
      distance: leg.distance,
      duration: leg.duration,
      polyline: route.overview_polyline.points,
    };
  } catch (error) {
    console.error('Error fetching detailed route:', error);
    return null;
  }
}

/**
 * Validate if coordinates are within reasonable bounds for Basey, Samar
 * @param coords - Coordinates to validate [lat, lng]
 * @returns boolean indicating if coordinates are valid
 */
export function validateBaseyCoordinates(coords: [number, number]): boolean {
  const [lat, lng] = coords;
  
  // Rough bounds for Basey Municipality, Samar
  const bounds = {
    north: 11.45,
    south: 11.10,
    east: 125.20,
    west: 124.90,
  };
  
  return lat >= bounds.south && lat <= bounds.north && 
         lng >= bounds.west && lng <= bounds.east;
}

/**
 * Convert meters to kilometers with proper rounding
 * @param meters - Distance in meters
 * @returns Distance in kilometers rounded to 2 decimal places
 */
export function metersToKilometers(meters: number): number {
  return Math.round((meters / 1000) * 100) / 100;
}

/**
 * Convert seconds to human-readable duration
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculate fare based on Google Maps distance using Basey Municipal Ordinance 105
 * @param distanceInKm - Distance in kilometers
 * @returns Fare calculation details
 */
export function calculateGoogleMapsFare(distanceInKm: number) {
  const baseFare = 15; // Municipal Ordinance 105 Series of 2023
  const baseDistance = 3; // First 3 kilometers
  const additionalRate = 3; // ₱3 per additional kilometer

  let fare = baseFare;
  let additionalDistance = 0;
  let additionalFare = 0;

  if (distanceInKm > baseDistance) {
    additionalDistance = distanceInKm - baseDistance;
    additionalFare = Math.ceil(additionalDistance) * additionalRate;
    fare += additionalFare;
  }

  return {
    distance: distanceInKm,
    fare,
    breakdown: {
      baseFare,
      additionalDistance,
      additionalFare,
    },
  };
}