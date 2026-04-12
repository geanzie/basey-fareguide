import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { VehicleType, PermitStatus } from '@prisma/client'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { createPermitWithQr } from '@/lib/permits/qr'
import { serializePermit } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PermitStatus | null
    const vehicleType = searchParams.get('vehicleType') as VehicleType | null
    const search = searchParams.get('search')
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 10,
      maxLimit: 100,
    })

    // Build where clause
    const where: any = {}
    
    if (status) {
      where.status = status
    }
    
    if (vehicleType) {
      where.vehicleType = vehicleType
    }
    
    if (search) {
      where.OR = [
        { permitPlateNumber: { contains: search, mode: 'insensitive' } },
        { driverFullName: { contains: search, mode: 'insensitive' } },
        { vehicle: { plateNumber: { contains: search, mode: 'insensitive' } } },
        { vehicle: { ownerName: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [permits, total] = await Promise.all([
      prisma.permit.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ encodedAt: 'desc' }, { id: 'desc' }],
        include: {
          renewalHistory: {
            orderBy: { renewedAt: 'desc' },
            take: 1
          },
          vehicle: true
        }
      }),
      prisma.permit.count({ where })
    ])

    return NextResponse.json({
      permits: permits.map((permit) => serializePermit(permit)),
      pagination: buildPaginationMetadata(pagination, total)
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const body = await request.json()
    const { vehicleId, permitPlateNumber, driverFullName, vehicleType, remarks } = body

    // Validate required fields
    if (!vehicleId || !permitPlateNumber || !driverFullName || !vehicleType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if permit plate number already exists
    const existingPlatePermit = await prisma.permit.findUnique({
      where: { permitPlateNumber: permitPlateNumber.toUpperCase() }
    })

    if (existingPlatePermit) {
      return NextResponse.json(
        { error: 'Permit plate number already exists' },
        { status: 409 }
      )
    }

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Check if vehicle already has an active permit
    const existingPermit = await prisma.permit.findUnique({
      where: { vehicleId }
    })

    if (existingPermit) {
      return NextResponse.json(
        { error: 'Vehicle already has a permit' },
        { status: 409 }
      )
    }

    const permit = await createPermitWithQr({
      vehicleId,
      permitPlateNumber,
      driverFullName,
      vehicleType,
      encodedBy: actor.id,
      remarks,
    })

    return NextResponse.json(serializePermit(permit, { includeQrToken: true }), { status: 201 })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
