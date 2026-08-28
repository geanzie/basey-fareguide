import { NextRequest, NextResponse } from 'next/server';
import type { PinLabelDto } from '@/lib/contracts';
import { resolvePinLabel } from '@/lib/locations/pinLabelResolver';
import { isInBounds } from '@/lib/tracker/calculations';
import { PH_BOUNDS } from '@/lib/tracker/constants';

/**
 * GET /api/locations/pin-label?lat=&lng=
 *
 * Names an arbitrary coordinate after the barangay whose polygon contains it.
 *
 * Public and purely computational — no database, no Google key. It exists for
 * the mobile app, which cannot run resolvePinLabel itself because the barangay
 * polygons are a 267 KB bundle asset on the web side. The web calculator calls
 * resolvePinLabel directly and never hits this route.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));

  // Number.isFinite, not truthiness: a coordinate of exactly 0 is legitimate,
  // and Number('') is 0, so both are checked by the same guard.
  if (
    params.get('lat') === null ||
    params.get('lng') === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return NextResponse.json(
      { success: false, code: 'INVALID_COORDINATES', message: 'lat and lng must be finite numbers.' },
      { status: 400 },
    );
  }

  if (!isInBounds(lat, lng, PH_BOUNDS)) {
    return NextResponse.json(
      { success: false, code: 'INVALID_COORDINATES', message: 'Coordinate is outside the Philippines.' },
      { status: 400 },
    );
  }

  const pinLabel: PinLabelDto = resolvePinLabel(lat, lng);

  return NextResponse.json(
    { success: true, pinLabel },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  );
}
