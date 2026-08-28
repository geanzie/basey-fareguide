import { NextRequest, NextResponse } from 'next/server'
import { Prisma, RoadRestrictionKind, VehicleType } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { clearRoutingCache, invalidateRestrictionCache } from '@/lib/routing'
import { serializeRoadRestriction } from '@/lib/serializers'
import {
  VALID_RESTRICTION_KINDS,
  VALID_VEHICLE_TYPES,
  parseEffectiveWindow,
  validateGeometry,
} from '@/lib/routing/restrictionValidation'

const RESTRICTION_INCLUDE = {
  createdByUser: { select: { firstName: true, lastName: true, username: true } },
  updatedByUser: { select: { firstName: true, lastName: true, username: true } },
} as const

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_ONLY])
    const { id } = await context.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const existing = await prisma.roadRestrictionOverride.findUnique({
      where: { id },
      include: RESTRICTION_INCLUDE,
    })

    if (!existing) {
      return NextResponse.json({ message: 'Road restriction not found' }, { status: 404 })
    }

    const { name, kind, geometry, appliesTo, effectiveFrom, effectiveTo, note, isActive } =
      body as Record<string, unknown>

    const data: Prisma.RoadRestrictionOverrideUpdateInput = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ message: 'name cannot be empty' }, { status: 400 })
      }
      data.name = name.trim()
    }

    if (kind !== undefined) {
      if (typeof kind !== 'string' || !VALID_RESTRICTION_KINDS.has(kind)) {
        return NextResponse.json(
          { message: `kind must be one of: ${[...VALID_RESTRICTION_KINDS].join(', ')}` },
          { status: 400 },
        )
      }
      data.kind = kind as RoadRestrictionKind
    }

    if (geometry !== undefined) {
      // The geometry type itself is immutable: changing it would change how
      // every engine applies the restriction, which is a new restriction.
      const check = validateGeometry(existing.geometryType, geometry)
      if (!check.ok) {
        return NextResponse.json({ message: check.message }, { status: 400 })
      }
      data.geometry = geometry as object
    }

    if (appliesTo !== undefined) {
      const vehicleTypes = Array.isArray(appliesTo) ? appliesTo.map(String) : []
      const unknown = vehicleTypes.filter((v) => !VALID_VEHICLE_TYPES.has(v))

      if (unknown.length > 0) {
        return NextResponse.json(
          { message: `Unknown vehicle types: ${unknown.join(', ')}` },
          { status: 400 },
        )
      }

      data.appliesTo = vehicleTypes as VehicleType[]
    }

    if (effectiveFrom !== undefined || effectiveTo !== undefined) {
      const window = parseEffectiveWindow(
        effectiveFrom !== undefined ? effectiveFrom : existing.effectiveFrom,
        effectiveTo !== undefined ? effectiveTo : existing.effectiveTo,
      )

      if (!window.ok) {
        return NextResponse.json({ message: window.message }, { status: 400 })
      }

      data.effectiveFrom = window.from
      data.effectiveTo = window.to
    }

    if (note !== undefined) {
      data.note = typeof note === 'string' && note.trim() ? note.trim() : null
    }

    if (isActive !== undefined) {
      data.isActive = isActive === true
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'No supported fields to update' }, { status: 400 })
    }

    data.updatedByUser = { connect: { id: user.id } }

    const updated = await prisma.roadRestrictionOverride.update({
      where: { id },
      data,
      include: RESTRICTION_INCLUDE,
    })

    const roadRestriction = serializeRoadRestriction(updated)

    await prisma.roadRestrictionOverrideAudit.create({
      data: {
        roadRestrictionOverrideId: id,
        action: 'UPDATE',
        previous: serializeRoadRestriction(existing) as unknown as object,
        next: roadRestriction as unknown as object,
        changedBy: user.id,
      },
    })

    invalidateRestrictionCache()
    clearRoutingCache()

    return NextResponse.json({ roadRestriction })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

/**
 * Lifts a restriction.
 *
 * Deactivates rather than deletes: the row explains why routes were quoted the
 * way they were while it stood, and its audit trail is worthless without it.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_ONLY])
    const { id } = await context.params

    const existing = await prisma.roadRestrictionOverride.findUnique({
      where: { id },
      include: RESTRICTION_INCLUDE,
    })

    if (!existing) {
      return NextResponse.json({ message: 'Road restriction not found' }, { status: 404 })
    }

    const reason = new URL(request.url).searchParams.get('reason')

    const updated = await prisma.roadRestrictionOverride.update({
      where: { id },
      data: { isActive: false, updatedByUser: { connect: { id: user.id } } },
      include: RESTRICTION_INCLUDE,
    })

    const roadRestriction = serializeRoadRestriction(updated)

    await prisma.roadRestrictionOverrideAudit.create({
      data: {
        roadRestrictionOverrideId: id,
        action: 'LIFT',
        previous: serializeRoadRestriction(existing) as unknown as object,
        next: roadRestriction as unknown as object,
        reason: reason?.trim() || null,
        changedBy: user.id,
      },
    })

    invalidateRestrictionCache()
    clearRoutingCache()

    return NextResponse.json({ roadRestriction })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
