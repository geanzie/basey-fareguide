import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import { VehicleType, PermitStatus } from '@/generated/prisma'

const prisma = new PrismaClient()

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
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { driverFullName: { contains: search, mode: 'insensitive' } }
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
          }
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
  } catch (error) {
    console.error('Error fetching permits:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plateNumber, driverFullName, vehicleType, encodedBy } = body

    // Validate required fields
    if (!plateNumber || !driverFullName || !vehicleType || !encodedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if plate number already exists
    const existingPermit = await prisma.permit.findUnique({
      where: { plateNumber }
    })

    if (existingPermit) {
      return NextResponse.json(
        { error: 'Plate number already exists' },
        { status: 409 }
      )
    }

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 1)

    const permit = await prisma.permit.create({
      data: {
        plateNumber: plateNumber.toUpperCase(),
        driverFullName,
        vehicleType,
        expiryDate,
        encodedBy,
        status: PermitStatus.ACTIVE
      },
      include: {
        renewalHistory: true
      }
    })

    return NextResponse.json(permit, { status: 201 })
  } catch (error) {
    console.error('Error creating permit:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}