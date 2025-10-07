// API route for forward geocoding (address to coordinates)
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@googlemaps/google-maps-services-js';

const client = new Client({});

export async function POST(request: NextRequest) {
  try {
    const { query, bounds } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid query. Please provide a valid address or location name.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return NextResponse.json(
        { error: 'Google Maps API not configured' },
        { status: 500 }
      );
    }

    console.log(`🔍 Forward geocoding: ${query}`);

    const params: any = {
      address: query,
      key: apiKey,
    };

    // Add bounds if provided (to bias results to Basey area)
    if (bounds && bounds.northeast && bounds.southwest) {
      params.bounds = `${bounds.southwest.lat},${bounds.southwest.lng}|${bounds.northeast.lat},${bounds.northeast.lng}`;
    }

    // Add Philippines region bias
    params.region = 'ph';
    params.components = 'country:PH';

    const response = await client.geocode({
      params,
    });

    if (response.data.status !== 'OK') {
      return NextResponse.json(
        { error: `Geocoding failed: ${response.data.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      results: response.data.results,
    });

  } catch (error) {
    console.error('Forward geocoding error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error during geocoding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}