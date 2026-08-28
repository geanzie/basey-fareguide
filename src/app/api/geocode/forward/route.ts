// API route for forward geocoding (address to coordinates)
//
// Discovery only. A result from here is a *candidate*, never an authoritative
// Place: the caller confirms it on a map and submits it as a pin, which is then
// bounds-checked by /api/routes/calculate like any other pin.
//
// Requires an authenticated user — this endpoint spends the Google Maps key on
// every call, so it is not left open to anonymous traffic.
import { NextRequest, NextResponse } from 'next/server';
import { Client, type GeocodeRequest } from '@googlemaps/google-maps-services-js';
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth';

const client = new Client({});

/** Short queries match half the map and burn quota for nothing. */
const MIN_QUERY_LENGTH = 3;

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
    const { query, bounds } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        {
          message: `Invalid query. Please provide at least ${MIN_QUERY_LENGTH} characters of an address or location name.`,
        },
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

    const params: GeocodeRequest['params'] = {
      address: query.trim(),
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
        { message: `Geocoding failed: ${response.data.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      results: response.data.results,
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
