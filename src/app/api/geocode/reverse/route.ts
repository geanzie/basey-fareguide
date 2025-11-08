// API route for reverse geocoding coordinates
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates. Please provide valid latitude and longitude.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {      return NextResponse.json(
        { error: 'Google Maps API not configured' },
        { status: 500 }
      );
    }    const response = await client.reverseGeocode({
      params: {
        latlng: `${lat},${lng}`,
        key: apiKey,
        result_type: [], // Get all types
        location_type: [], // Get all location types
      },
    });

    if (response.data.status !== 'OK') {
      return NextResponse.json(
        { error: `Geocoding failed: ${response.data.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: response.data,
    });

  } catch (error) {    return NextResponse.json(
      { 
        error: 'Internal server error during geocoding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
