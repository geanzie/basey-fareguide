import { NextRequest, NextResponse } from 'next/server'
import {
  RoadRestrictionGeometry,
  RoadRestrictionKind,
  VehicleType,
} from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { clearRoutingCache, invalidateRestrictionCache } from '@/lib/routing'
import { serializeRoadRestriction } from '@/lib/serializers'
import {
  VALID_GEOMETRY_TYPES,
  VALID_RESTRICTION_KINDS,
  VALID_VEHICLE_TYPES,
  parseEffectiveWindow,
  validateGeometry,
} from '@/lib/routing/restrictionValidation'

const RESTRICTION_INCLUDE = {
  createdByUser: { select: { firstName: true, lastName: true, username: true } },
  updatedByUser: { select: { firstName: true, lastName: true, username: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const restrictions = await prisma.roadRestrictionOverride.findMany({
      // In-effect closures first: this list is read to answer "what is shut
      // right now", not to browse history.
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      include: RESTRICTION_INCLUDE,
    })

    return NextResponse.json({
      roadRestrictions: restrictions.map((restriction) =>
        serializeRoadRestriction(restriction),
      ),
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [...ADMIN_ONLY])

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      name,
      kind,
      geometryType,
      geometry,
      appliesTo,
      effectiveFrom,
      effectiveTo,
      note,
    } = body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ message: 'name is required' }, { status: 400 })
    }

    if (typeof kind !== 'string' || !VALID_RESTRICTION_KINDS.has(kind)) {
      return NextResponse.json(
        { message: `kind must be one of: ${[...VALID_RESTRICTION_KINDS].join(', ')}` },
        { status: 400 },
      )
    }

    if (typeof geometryType !== 'string' || !VALID_GEOMETRY_TYPES.has(geometryType)) {
      return NextResponse.json(
        { message: `geometryType must be one of: ${[...VALID_GEOMETRY_TYPES].join(', ')}` },
        { status: 400 },
      )
    }

    // A malformed geometry does not fail loudly at route time — it silently
    // stops restricting anything, so it is rejected here instead.
    const geometryCheck = validateGeometry(geometryType, geometry)
    if (!geometryCheck.ok) {
      return NextResponse.json({ message: geometryCheck.message }, { status: 400 })
    }

    const vehicleTypes = Array.isArray(appliesTo) ? appliesTo.map(String) : []
    const unknownVehicleTypes = vehicleTypes.filter((v) => !VALID_VEHICLE_TYPES.has(v))

    if (unknownVehicleTypes.length > 0) {
      return NextResponse.json(
        { message: `Unknown vehicle types: ${unknownVehicleTypes.join(', ')}` },
        { status: 400 },
      )
    }

    const window = parseEffectiveWindow(effectiveFrom, effectiveTo)
    if (!window.ok) {
      return NextResponse.json({ message: window.message }, { status: 400 })
    }

    const existing = await prisma.roadRestrictionOverride.findUnique({
      where: { name: name.trim() },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { message: 'A restriction with that name already exists' },
        { status: 409 },
      )
    }

    const created = await prisma.roadRestrictionOverride.create({
      data: {
        name: name.trim(),
        kind: kind as RoadRestrictionKind,
        geometryType: geometryType as RoadRestrictionGeometry,
        geometry: geometry as object,
        appliesTo: vehicleTypes as VehicleType[],
        effectiveFrom: window.from,
        effectiveTo: window.to,
        note: typeof note === 'string' && note.trim() ? note.trim() : null,
        createdBy: user.id,
      },
      include: RESTRICTION_INCLUDE,
    })

    const roadRestriction = serializeRoadRestriction(created)

    await prisma.roadRestrictionOverrideAudit.create({
      data: {
        roadRestrictionOverrideId: created.id,
        action: 'CREATE',
        next: roadRestriction as unknown as object,
        changedBy: user.id,
      },
    })

    // A closure must be live now, not whenever the caches happen to expire.
    invalidateRestrictionCache()
    clearRoutingCache()

    return NextResponse.json({ roadRestriction }, { status: 201 })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
