import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { VehicleType, PermitStatus } from '@/generated/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PermitStatus | null
    const vehicleType = searchParams.get('vehicleType') as VehicleType | null
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

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
        skip,
        take: limit,
        orderBy: { encodedAt: 'desc' },
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
      permits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
      } catch (error) {    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicleId, permitPlateNumber, driverFullName, vehicleType, encodedBy, remarks } = body

    // Validate required fields
    if (!vehicleId || !permitPlateNumber || !driverFullName || !vehicleType || !encodedBy) {
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

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)

    const permit = await prisma.permit.create({
      data: {
        vehicleId,
        permitPlateNumber: permitPlateNumber.toUpperCase(),
        driverFullName,
        vehicleType,
        expiryDate,
        encodedBy,
        remarks,
        status: PermitStatus.ACTIVE
      },
      include: {
        renewalHistory: true,
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
            ownerName: true,
            vehicleType: true
          }
        }
      }
    })

    return NextResponse.json(permit, { status: 201 })
      } catch (error) {    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
