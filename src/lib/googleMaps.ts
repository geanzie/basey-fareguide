import { Client, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js';

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
      console.error('Google Maps API key not found. Please set GOOGLE_MAPS_SERVER_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
      return null;
    }

    const response = await client.directions({
      params: {
        origin: `${origin[0]},${origin[1]}`,
        destination: `${destination[0]},${destination[1]}`,
        mode: TravelMode.driving,
        units: UnitSystem.metric,
        key: apiKey,
      },
    });

    const route = response.data.routes[0];
    
    if (!route) {
      console.error('No route found');
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