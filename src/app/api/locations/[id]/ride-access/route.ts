import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { invalidatePlannerLocationsCache } from '@/lib/locations/plannerLocations'
import { clearRoutingCache } from '@/lib/routing'
import { approxMeters } from '@/lib/routing/geo'
import {
  formatLocationCoordinates,
  parseLocationCoordinates,
  serializeLocationRideAccess,
} from '@/lib/serializers'
import { getBarangayFromCoordinate } from '@/utils/barangayBoundaries'
import type { LocationCoordinatesDto, PlaceVehicleAccess } from '@/lib/contracts'

const VEHICLE_ACCESS_VALUES: PlaceVehicleAccess[] = [
  'UNVERIFIED',
  'VEHICLE_ACCESSIBLE',
  'WALK_ONLY',
]

const MAX_ACCESS_NOTE_LENGTH = 200

/** A drop-off further than this from the Place is a different place entirely. */
const MAX_DROPOFF_DISTANCE_M = 1_000

const RIDE_ACCESS_SELECT = {
  id: true,
  name: true,
  barangay: true,
  coordinates: true,
  vehicleAccess: true,
  dropoffCoordinates: true,
  accessNote: true,
  accessVerifiedAt: true,
  updatedAt: true,
} as const

function parseDropoff(raw: unknown): LocationCoordinatesDto | null {
  if (typeof raw === 'string') {
    return parseLocationCoordinates(raw)
  }

  if (!raw || typeof raw !== 'object') return null

  const point = raw as Record<string, unknown>
  if (typeof point.lat !== 'number' || typeof point.lng !== 'number') return null
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null

  return { lat: point.lat, lng: point.lng }
}

/**
 * PUT /api/locations/[id]/ride-access
 *
 * Records whether a ride can reach a Place, and where it stops when it cannot.
 * A WALK_ONLY Place without a drop-off is refused: the fare calculator would
 * fall back to probing it on every request, which is the cost this record
 * exists to avoid.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await params

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const vehicleAccess = body.vehicleAccess as PlaceVehicleAccess
    if (!VEHICLE_ACCESS_VALUES.includes(vehicleAccess)) {
      return NextResponse.json(
        { message: `vehicleAccess must be one of: ${VEHICLE_ACCESS_VALUES.join(', ')}` },
        { status: 400 },
      )
    }

    const existing = await prisma.location.findUnique({
      where: { id },
      select: RIDE_ACCESS_SELECT,
    })

    if (!existing) {
      return NextResponse.json({ message: 'Location not found' }, { status: 404 })
    }

    const rawNote = typeof body.accessNote === 'string' ? body.accessNote.trim() : ''
    if (rawNote.length > MAX_ACCESS_NOTE_LENGTH) {
      return NextResponse.json(
        { message: `Access note must be ${MAX_ACCESS_NOTE_LENGTH} characters or fewer` },
        { status: 400 },
      )
    }

    let dropoffCoordinates: string | null = null

    if (vehicleAccess === 'WALK_ONLY') {
      const dropoff = parseDropoff(body.dropoffCoordinates)
      if (!dropoff) {
        return NextResponse.json(
          { message: 'A walk-only place needs a drop-off point a ride can reach' },
          { status: 400 },
        )
      }

      if (!getBarangayFromCoordinate(dropoff.lng, dropoff.lat)) {
        return NextResponse.json(
          { message: 'Drop-off point is outside Basey' },
          { status: 400 },
        )
      }

      const placePoint = parseLocationCoordinates(existing.coordinates)
      if (placePoint && approxMeters(placePoint, dropoff) > MAX_DROPOFF_DISTANCE_M) {
        return NextResponse.json(
          {
            message: `Drop-off point is more than ${MAX_DROPOFF_DISTANCE_M} m from ${existing.name}`,
          },
          { status: 400 },
        )
      }

      dropoffCoordinates = formatLocationCoordinates(dropoff)
    }

    const updated = await prisma.location.update({
      where: { id },
      data: {
        vehicleAccess,
        dropoffCoordinates,
        accessNote: rawNote || null,
        accessVerifiedBy: vehicleAccess === 'UNVERIFIED' ? null : user.id,
        accessVerifiedAt: vehicleAccess === 'UNVERIFIED' ? null : new Date(),
      },
      select: RIDE_ACCESS_SELECT,
    })

    // Both caches would otherwise keep quoting the old access facts for minutes.
    invalidatePlannerLocationsCache()
    clearRoutingCache()

    return NextResponse.json({ location: serializeLocationRideAccess(updated) })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
