// API route for reverse geocoding coordinates
//
// Requires an authenticated user — this endpoint spends the Google Maps key on
// every call, so it is not left open to anonymous traffic (mirrors
// src/app/api/geocode/forward/route.ts). The one internal caller
// (src/utils/locationValidation.ts, reached only from the ADMIN-gated
// /api/admin/locations/validate) forwards its own request's auth into the
// internal fetch so it keeps passing this gate — see reverseGeocode() in
// src/utils/googleMapsVerification.ts.
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@googlemaps/google-maps-services-js';
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth';

const client = new Client({});

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Per-user fixed-window counter. In-process, so it resets on redeploy and is
 * per-instance — enough to stop a runaway client, not a substitute for an edge
 * rate limiter if this ever gets heavy traffic.
 */
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(userId);

  if (!entry || entry.resetAt <= now) {
    requestCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    const user = await requireRequestUser(request);
    userId = user.id;
  } catch (error) {
    return createAuthErrorResponse(error);
  }

  if (isRateLimited(userId)) {
    return NextResponse.json(
      { message: 'Too many geocoding requests. Please wait a moment and try again.' },
      { status: 429 }
    );
  }

  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { message: 'Invalid coordinates. Please provide valid latitude and longitude.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { message: 'Google Maps server API not configured' },
        { status: 500 }
      );
    }

    const response = await client.reverseGeocode({
      params: {
        latlng: `${lat},${lng}`,
        key: apiKey,
        result_type: [], // Get all types
        location_type: [], // Get all location types
      },
    });

    if (response.data.status !== 'OK') {
      return NextResponse.json(
        { message: `Geocoding failed: ${response.data.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: response.data,
    });

  } catch (error) {
    return NextResponse.json(
      { 
        message: 'Internal server error during geocoding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
