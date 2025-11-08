import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { VehicleType } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vehicleType = searchParams.get('vehicleType') as VehicleType | null
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

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
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      vehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
      } catch (error) {    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Check if plate number already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { plateNumber }
    })

    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle with this plate number already exists' },
        { status: 409 }
      )
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber,
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

    return NextResponse.json(vehicle, { status: 201 })
      } catch (error) {    return NextResponse.json(
      { error: 'Failed to create vehicle' },
      { status: 500 }
    )
  }
}
