import { NextRequest, NextResponse } from 'next/server';
import { getGoogleMapsRoute, getDetailedRoute, calculateGoogleMapsFare, metersToKilometers, validateBaseyCoordinates, testCoordinates } from '@/lib/googleMaps';
import { BASEY_CENTER } from '@/utils/baseyCenter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination } = body;

    // Validate input
    if (!origin || !destination || !Array.isArray(origin) || !Array.isArray(destination)) {
      return NextResponse.json(
        { error: 'Invalid coordinates provided' },
        { status: 400 }
      );
    }

    // Validate coordinate array length and types
    if (origin.length !== 2 || destination.length !== 2 || 
        typeof origin[0] !== 'number' || typeof origin[1] !== 'number' ||
        typeof destination[0] !== 'number' || typeof destination[1] !== 'number') {
      return NextResponse.json(
        { error: 'Coordinates must be [latitude, longitude] arrays with numeric values' },
        { status: 400 }
      );
    }

    // Type-cast to proper tuple types
    const originCoords: [number, number] = [origin[0], origin[1]];
    const destinationCoords: [number, number] = [destination[0], destination[1]];

    // Validate coordinates are within Basey bounds
    if (!validateBaseyCoordinates(originCoords) || !validateBaseyCoordinates(destinationCoords)) {
      return NextResponse.json(
        { error: 'Coordinates must be within Basey Municipality bounds' },
        { status: 400 }
      );
    }

    // Get detailed route information from Google Maps including polyline
    const route = await getDetailedRoute(originCoords, destinationCoords);

    if (!route) {
      console.error('❌ Google Maps route calculation failed');
      console.error('📍 Origin:', originCoords);
      console.error('📍 Destination:', destinationCoords);
      console.error('🔑 API Key configured:', !!process.env.GOOGLE_MAPS_SERVER_API_KEY || !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
      
      return NextResponse.json(
        { 
          error: 'Google Maps API is required for accurate road-based route calculation. GPS direct distance would be unfair to drivers.',
          details: 'The API key may not be configured, or the Directions API may not be enabled in Google Cloud Console.',
          apiKeyConfigured: !!process.env.GOOGLE_MAPS_SERVER_API_KEY || !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          requiredSetup: [
            'Configure GOOGLE_MAPS_SERVER_API_KEY in .env.local',
            'Enable Directions API in Google Cloud Console', 
            'Restart development server'
          ]
        },
        { status: 404 }
      );
    }

    // Convert distance to kilometers
    const distanceInKm = metersToKilometers(route.distance.value);

    // Calculate fare using Municipal Ordinance
    const fareCalculation = calculateGoogleMapsFare(distanceInKm);

    // Return comprehensive route information including polyline for visualization
    return NextResponse.json({
      success: true,
      route: {
        distance: {
          meters: route.distance.value,
          kilometers: distanceInKm,
          text: route.distance.text,
        },
        duration: {
          seconds: route.duration.value,
          text: route.duration.text,
        },
        polyline: route.polyline, // Include polyline for route visualization
        fare: fareCalculation,
        source: 'Google Maps API',
        accuracy: 'High (GPS-based routing)',
      },
    });
  } catch (error) {
    console.error('Google Maps API error:', error);
    return NextResponse.json(
      { error: 'Internal server error while calculating route' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Google Maps Route API',
      usage: 'POST with { origin: [lat, lng], destination: [lat, lng] }',
      example: {
        origin: BASEY_CENTER, // Basey Center from GeoJSON data
        destination: [11.2768363, 125.0114879], // San Antonio
      },
    },
    { status: 200 }
  );
}
