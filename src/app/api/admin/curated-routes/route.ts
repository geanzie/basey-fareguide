import { NextRequest, NextResponse } from 'next/server'
import { CuratedRouteSource, VehicleType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { invalidateCuratedRouteCache } from '@/lib/routing'
import { serializeCuratedRoute } from '@/lib/serializers'
import {
  VALID_CURATED_SOURCES,
  VALID_VEHICLE_TYPES,
  parseStoredCoordinates,
  validateAgainstStraightLine,
  validateDistanceMeters,
  validateDurationSeconds,
} from '@/lib/curatedRoutes/validation'

/** Everything the serializer needs, in one place so both handlers agree. */
const CURATED_ROUTE_INCLUDE = {
  origin: { select: { id: true, name: true, barangay: true } },
  destination: { select: { id: true, name: true, barangay: true } },
  surveyedByUser: { select: { firstName: true, lastName: true, username: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    const { searchParams } = new URL(request.url)
    const vehicleType = searchParams.get('vehicleType')
    const needsSurvey = searchParams.get('needsSurvey')
    const isActive = searchParams.get('isActive')
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 25,
      maxLimit: 100,
    })

    const where: {
      vehicleType?: VehicleType
      needsSurvey?: boolean
      isActive?: boolean
    } = {}

    if (vehicleType && VALID_VEHICLE_TYPES.has(vehicleType)) {
      where.vehicleType = vehicleType as VehicleType
    }

    if (needsSurvey === 'true' || needsSurvey === 'false') {
      where.needsSurvey = needsSurvey === 'true'
    }

    if (isActive === 'true' || isActive === 'false') {
      where.isActive = isActive === 'true'
    }

    const [curatedRoutes, total] = await Promise.all([
      prisma.curatedRouteDistance.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        // Unconfirmed rows first: this list exists to be worked through, and a
        // batch-seeded distance is the one most worth a surveyor's attention.
        orderBy: [{ needsSurvey: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
        include: CURATED_ROUTE_INCLUDE,
      }),
      prisma.curatedRouteDistance.count({ where }),
    ])

    return NextResponse.json({
      curatedRoutes: curatedRoutes.map(serializeCuratedRoute),
      pagination: buildPaginationMetadata(pagination, total),
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_OR_ENCODER])

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      originLocationId,
      destinationLocationId,
      vehicleType,
      distanceMeters,
      durationSeconds,
      polyline,
      isBidirectional,
      source,
      needsSurvey,
      notes,
    } = body as Record<string, unknown>

    if (typeof originLocationId !== 'string' || !originLocationId.trim()) {
      return NextResponse.json({ message: 'originLocationId is required' }, { status: 400 })
    }

    if (typeof destinationLocationId !== 'string' || !destinationLocationId.trim()) {
      return NextResponse.json({ message: 'destinationLocationId is required' }, { status: 400 })
    }

    if (originLocationId === destinationLocationId) {
      return NextResponse.json(
        { message: 'A curated route must join two different places' },
        { status: 400 },
      )
    }

    if (typeof vehicleType !== 'string' || !VALID_VEHICLE_TYPES.has(vehicleType)) {
      return NextResponse.json(
        { message: `vehicleType must be one of: ${[...VALID_VEHICLE_TYPES].join(', ')}` },
        { status: 400 },
      )
    }

    if (typeof source !== 'string' || !VALID_CURATED_SOURCES.has(source)) {
      return NextResponse.json(
        { message: `source must be one of: ${[...VALID_CURATED_SOURCES].join(', ')}` },
        { status: 400 },
      )
    }

    const distance = validateDistanceMeters(distanceMeters)
    if (!distance.ok) {
      return NextResponse.json({ message: distance.error.message }, { status: 400 })
    }

    const duration = validateDurationSeconds(durationSeconds)
    if (!duration.ok) {
      return NextResponse.json({ message: duration.error.message }, { status: 400 })
    }

    // Both ends must be real saved places, or the corpus can never be matched
    // against a quote and the row is dead weight.
    const places = await prisma.location.findMany({
      where: { id: { in: [originLocationId, destinationLocationId] } },
      select: { id: true, coordinates: true },
    })

    if (places.length !== 2) {
      return NextResponse.json(
        { message: 'Both originLocationId and destinationLocationId must be saved places' },
        { status: 400 },
      )
    }

    // A road cannot be shorter than the straight line it spans. Engines asked
    // about two remote points sometimes snap both onto the same road and return
    // the gap between the snap points, and a curated row outranks every engine
    // — so that has to be caught here rather than priced.
    const originCoords = parseStoredCoordinates(
      places.find((place) => place.id === originLocationId)?.coordinates,
    )
    const destCoords = parseStoredCoordinates(
      places.find((place) => place.id === destinationLocationId)?.coordinates,
    )

    if (originCoords && destCoords) {
      const floor = validateAgainstStraightLine(distance.value, originCoords, destCoords)

      if (!floor.ok) {
        return NextResponse.json({ message: floor.message }, { status: 400 })
      }
    }

    const existing = await prisma.curatedRouteDistance.findUnique({
      where: {
        originLocationId_destinationLocationId_vehicleType: {
          originLocationId,
          destinationLocationId,
          vehicleType: vehicleType as VehicleType,
        },
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        {
          message:
            'A curated route already exists for this pair and vehicle type. Edit it instead.',
        },
        { status: 409 },
      )
    }

    const created = await prisma.curatedRouteDistance.create({
      data: {
        originLocationId,
        destinationLocationId,
        vehicleType: vehicleType as VehicleType,
        distanceMeters: distance.value,
        durationSeconds: duration.value,
        polyline: typeof polyline === 'string' && polyline ? polyline : null,
        isBidirectional: isBidirectional === true,
        source: source as CuratedRouteSource,
        needsSurvey: needsSurvey === true,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        surveyedAt: new Date(),
        surveyedBy: user.id,
      },
      include: CURATED_ROUTE_INCLUDE,
    })

    const curatedRoute = serializeCuratedRoute(created)

    await prisma.curatedRouteDistanceAudit.create({
      data: {
        curatedRouteDistanceId: created.id,
        action: 'CREATE',
        previous: undefined,
        next: curatedRoute as unknown as object,
        changedBy: user.id,
      },
    })

    // A curated distance sets a fare, so the change has to be live now rather
    // than whenever the two-minute lookup cache happens to expire.
    invalidateCuratedRouteCache()

    return NextResponse.json({ curatedRoute }, { status: 201 })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
