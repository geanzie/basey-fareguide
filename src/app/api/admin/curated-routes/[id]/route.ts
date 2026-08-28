import { NextRequest, NextResponse } from 'next/server'
import { CuratedRouteSource, Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { invalidateCuratedRouteCache } from '@/lib/routing'
import { serializeCuratedRoute } from '@/lib/serializers'
import {
  VALID_CURATED_SOURCES,
  parseStoredCoordinates,
  validateAgainstStraightLine,
  validateDistanceMeters,
  validateDurationSeconds,
} from '@/lib/curatedRoutes/validation'

const CURATED_ROUTE_INCLUDE = {
  origin: { select: { id: true, name: true, barangay: true, coordinates: true } },
  destination: { select: { id: true, name: true, barangay: true, coordinates: true } },
  surveyedByUser: { select: { firstName: true, lastName: true, username: true } },
} as const

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await context.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const existing = await prisma.curatedRouteDistance.findUnique({
      where: { id },
      include: CURATED_ROUTE_INCLUDE,
    })

    if (!existing) {
      return NextResponse.json({ message: 'Curated route not found' }, { status: 404 })
    }

    const {
      distanceMeters,
      durationSeconds,
      polyline,
      isBidirectional,
      source,
      needsSurvey,
      notes,
      isActive,
    } = body as Record<string, unknown>

    const data: Prisma.CuratedRouteDistanceUpdateInput = {}

    if (distanceMeters !== undefined) {
      const distance = validateDistanceMeters(distanceMeters)
      if (!distance.ok) {
        return NextResponse.json({ message: distance.error.message }, { status: 400 })
      }
      // Same geometric floor as creation: a correction can be wrong too.
      const originCoords = parseStoredCoordinates(existing.origin.coordinates)
      const destCoords = parseStoredCoordinates(existing.destination.coordinates)

      if (originCoords && destCoords) {
        const floor = validateAgainstStraightLine(distance.value, originCoords, destCoords)

        if (!floor.ok) {
          return NextResponse.json({ message: floor.message }, { status: 400 })
        }
      }

      data.distanceMeters = distance.value
    }

    if (durationSeconds !== undefined) {
      const duration = validateDurationSeconds(durationSeconds)
      if (!duration.ok) {
        return NextResponse.json({ message: duration.error.message }, { status: 400 })
      }
      data.durationSeconds = duration.value
    }

    if (source !== undefined) {
      if (typeof source !== 'string' || !VALID_CURATED_SOURCES.has(source)) {
        return NextResponse.json(
          { message: `source must be one of: ${[...VALID_CURATED_SOURCES].join(', ')}` },
          { status: 400 },
        )
      }
      data.source = source as CuratedRouteSource
    }

    if (polyline !== undefined) {
      data.polyline = typeof polyline === 'string' && polyline ? polyline : null
    }

    if (isBidirectional !== undefined) data.isBidirectional = isBidirectional === true
    if (needsSurvey !== undefined) data.needsSurvey = needsSurvey === true
    if (isActive !== undefined) data.isActive = isActive === true

    if (notes !== undefined) {
      data.notes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'No supported fields to update' }, { status: 400 })
    }

    // Correcting the distance is a fresh measurement, so it re-stamps who
    // stands behind the number and clears the unconfirmed flag unless the
    // caller deliberately set it in the same request.
    if (data.distanceMeters !== undefined) {
      data.surveyedAt = new Date()
      data.surveyedByUser = { connect: { id: user.id } }
      if (needsSurvey === undefined) {
        data.needsSurvey = false
      }
    }

    const updated = await prisma.curatedRouteDistance.update({
      where: { id },
      data,
      include: CURATED_ROUTE_INCLUDE,
    })

    const curatedRoute = serializeCuratedRoute(updated)

    await prisma.curatedRouteDistanceAudit.create({
      data: {
        curatedRouteDistanceId: id,
        action: 'UPDATE',
        previous: serializeCuratedRoute(existing) as unknown as object,
        next: curatedRoute as unknown as object,
        changedBy: user.id,
      },
    })

    invalidateCuratedRouteCache()

    return NextResponse.json({ curatedRoute })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

/**
 * Retires a curated route.
 *
 * Deactivates rather than deletes. The row is evidence for every fare already
 * quoted from it, and its audit trail is worthless if the thing it describes
 * has been removed.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { id } = await context.params

    const existing = await prisma.curatedRouteDistance.findUnique({
      where: { id },
      include: CURATED_ROUTE_INCLUDE,
    })

    if (!existing) {
      return NextResponse.json({ message: 'Curated route not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const reason = searchParams.get('reason')

    const updated = await prisma.curatedRouteDistance.update({
      where: { id },
      data: { isActive: false },
      include: CURATED_ROUTE_INCLUDE,
    })

    const curatedRoute = serializeCuratedRoute(updated)

    await prisma.curatedRouteDistanceAudit.create({
      data: {
        curatedRouteDistanceId: id,
        action: 'RETIRE',
        previous: serializeCuratedRoute(existing) as unknown as object,
        next: curatedRoute as unknown as object,
        reason: reason?.trim() || null,
        changedBy: user.id,
      },
    })

    invalidateCuratedRouteCache()

    return NextResponse.json({ curatedRoute })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
