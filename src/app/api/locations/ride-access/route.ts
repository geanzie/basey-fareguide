import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { serializeLocationRideAccess } from '@/lib/serializers'

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

/**
 * GET /api/locations/ride-access
 *
 * The review queue for whether a habal-habal or tricycle can reach each saved
 * Place. `status=review` (the default) surfaces the ones carrying a proposed
 * drop-off that nobody has confirmed yet — an UNVERIFIED place with a
 * dropoffCoordinates written by scripts/backfill-vehicle-access.js. That pair
 * is the queue; no separate flag column exists, and none should, since
 * validationStatus drives whether a place is visible to the calculator at all.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'review'
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 25,
      maxLimit: 100,
    })

    const where = {
      isActive: true,
      ...(status === 'review'
        ? { vehicleAccess: 'UNVERIFIED' as const, dropoffCoordinates: { not: null } }
        : {}),
      ...(status === 'unverified' ? { vehicleAccess: 'UNVERIFIED' as const } : {}),
      ...(status === 'walk_only' ? { vehicleAccess: 'WALK_ONLY' as const } : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.location.findMany({
        where,
        select: RIDE_ACCESS_SELECT,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.location.count({ where }),
    ])

    return NextResponse.json({
      locations: rows.map(serializeLocationRideAccess),
      pagination: buildPaginationMetadata(pagination, total),
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
