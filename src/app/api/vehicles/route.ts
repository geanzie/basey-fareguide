import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { VehicleType } from '@prisma/client'
import { ADMIN_OR_ENCODER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'
import { serializeVehicle } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const { searchParams } = new URL(request.url)
    const vehicleType = searchParams.get('vehicleType') as VehicleType | null
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 20,
      maxLimit: 100,
    })

    // Build where clause
    const where: any = {}
    
    if (vehicleType) {
      where.vehicleType = vehicleType
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }
    
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
        { permit: { permitPlateNumber: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          permit: {
            select: {
              id: true,
              permitPlateNumber: true,
              status: true,
              issuedDate: true,
              expiryDate: true
            }
          }
        }
      }),
      prisma.vehicle.count({ where })
    ])

    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => serializeVehicle(vehicle)),
      pagination: buildPaginationMetadata(pagination, total)
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENCODER])
    const body = await request.json()
    const {
      plateNumber,
      vehicleType,
      make,
      model,
      year,
      color,
      capacity,
      ownerName,
      ownerContact,
      driverName,
      driverLicense,
      registrationExpiry,
      insuranceExpiry
    } = body

    // Validate required fields
    if (!plateNumber || !vehicleType || !make || !model || !year || !color || !capacity || !ownerName || !ownerContact || !registrationExpiry) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const normalizedPlate = normalizePlateNumber(plateNumber)
    if (!normalizedPlate) {
      return NextResponse.json(
        { error: 'Invalid plate number' },
        { status: 400 }
      )
    }

    // Check if plate number already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: normalizedPlate }
    })

    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle with this plate number already exists' },
        { status: 409 }
      )
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: normalizedPlate,
        vehicleType,
        make,
        model,
        year: parseInt(year),
        color,
        capacity: parseInt(capacity),
        ownerName,
        ownerContact,
        driverName: driverName || null,
        driverLicense: driverLicense || null,
        registrationExpiry: new Date(registrationExpiry),
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null
      }
    })

    return NextResponse.json(serializeVehicle(vehicle), { status: 201 })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
