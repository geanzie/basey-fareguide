import { NextRequest, NextResponse } from 'next/server';
import { testCoordinates } from '@/lib/googleMaps';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinates } = body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return NextResponse.json(
        { error: 'Invalid coordinates. Expected [lat, lng] array.' },
        { status: 400 }
      );
    }

    const [lat, lng] = coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Coordinates must be numbers.' },
        { status: 400 }
      );
    }    const isValid = await testCoordinates([lat, lng]);
    
    return NextResponse.json({
      success: true,
      coordinates: [lat, lng],
      isValid,
      message: isValid ? 'Coordinates are valid' : 'Coordinates could not be validated'
    });
    
  } catch (error) {    return NextResponse.json(
      { error: 'Internal server error while testing coordinates' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Coordinate Test API',
      usage: 'POST with { coordinates: [lat, lng] }',
      example: {
        coordinates: [11.260895816210494, 125.16131895224565] // Basiao
      },
    },
    { status: 200 }
  );
}
