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
    
    if (!apiKey) {      return null;
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
    
    if (!element || element.status !== 'OK') {      return null;
    }

    return {
      distance: element.distance,
      duration: element.duration,
      polyline: '', // Distance Matrix API doesn't provide polyline
    };
  } catch (error) {
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    // Log specific error details for production debugging
    if (error instanceof Error) {    }
    
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
    if (!apiKey) return false;    // Use reverse geocoding to test if coordinates are valid
    const response = await client.reverseGeocode({
      params: {
        latlng: `${coords[0]},${coords[1]}`,
        key: apiKey,
      },
    });

    const isValid = response.data.results.length > 0;    if (isValid && response.data.results[0]) {    }
    
    return isValid;
  } catch (error) {    return false;
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
    
    if (!apiKey) {      return null;
    }    // Test coordinates validity first
    const [originValid, destValid] = await Promise.all([
      testCoordinates(origin),
      testCoordinates(destination)
    ]);
    
    if (!originValid) {      return null;
    }
    
    if (!destValid) {      return null;
    }    // Try multiple approaches for routing in remote areas
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      attempts++;      try {
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
        
        if (response.data.routes && response.data.routes.length > 0) {          break;
        }
        
      } catch (attemptError) {        if (attempts === maxAttempts) {
          throw attemptError;
        }
      }
    }

    if (!response) {      return null;
    }

    const route = response.data.routes[0];
    
    if (!route) {      return null;
    }

    const leg = route.legs[0];
    
    return {
      distance: leg.distance,
      duration: leg.duration,
      polyline: route.overview_polyline.points,
    };
  } catch (error) {    return null;
  }
}

/**
 * Validate if coordinates are within reasonable bounds for Basey, Samar
 * @param coords - Coordinates to validate [lat, lng]
 * @returns boolean indicating if coordinates are valid
 */
export function validateBaseyCoordinates(coords: [number, number]): boolean {
  const [lat, lng] = coords;
  
  // Actual bounds for Basey Municipality, Samar (based on GeoJSON data)
  // Includes all 51 barangays including remote areas like Mabini and Manlilinab
  const bounds = {
    north: 11.63,  // Updated to include northern barangays like Mabini (11.575)
    south: 11.21,  // Updated to include southern areas
    east: 125.36,  // Updated to include eastern extent (Mabini reaches 125.285)
    west: 124.93,  // Updated to include western coastal areas
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
 * @param discountRate - Optional discount rate (0.20 for 20% discount for seniors, PWDs, students)
 * @returns Fare calculation details with optional discount applied
 */
export function calculateGoogleMapsFare(distanceInKm: number, discountRate?: number) {
  const baseFare = 15; // Municipal Ordinance 105 Series of 2023
  const baseDistance = 3; // First 3 kilometers
  const additionalRate = 3; // ₱3 per additional kilometer

  let originalFare = baseFare;
  let additionalDistance = 0;
  let additionalFare = 0;

  if (distanceInKm > baseDistance) {
    additionalDistance = distanceInKm - baseDistance;
    additionalFare = Math.ceil(additionalDistance) * additionalRate;
    originalFare += additionalFare;
  }

  // Apply discount if provided (Philippine law: 20% for seniors, PWDs, students)
  let finalFare = originalFare;
  let discountApplied = 0;

  if (discountRate && discountRate > 0 && discountRate <= 1) {
    discountApplied = originalFare * discountRate;
    finalFare = originalFare - discountApplied;
  }

  // Round to nearest 0.50 for easier change-giving
  // Examples: 16.20 -> 16.00, 16.30 -> 16.50, 16.80 -> 17.00
  const roundToNearestHalf = (value: number): number => {
    return Math.round(value * 2) / 2;
  };

  const roundedOriginalFare = roundToNearestHalf(originalFare);
  const roundedFinalFare = roundToNearestHalf(finalFare);
  const roundedDiscountApplied = roundedOriginalFare - roundedFinalFare;

  return {
    distance: distanceInKm,
    fare: roundedFinalFare, // Rounded to nearest ₱0.50
    originalFare: roundedOriginalFare, // Also rounded for consistency
    discountApplied: roundedDiscountApplied, // Recalculated based on rounded values
    discountRate: discountRate || 0,
    breakdown: {
      baseFare,
      additionalDistance,
      additionalFare,
    },
  };
}