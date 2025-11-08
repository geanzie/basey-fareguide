import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        userType: true,
        isActive: true
      }
    })

    return user?.isActive ? user : null
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plateNumber: string }> }
) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (!['ENFORCER', 'ADMIN'].includes(user.userType)) {
      return NextResponse.json({ message: 'Access denied. Enforcer or Admin role required.' }, { status: 403 })
    }

    const { plateNumber } = await params

    if (!plateNumber) {
      return NextResponse.json({ message: 'Plate number is required' }, { status: 400 })
    }

    // Decode the plate number in case it was URL encoded
    const decodedPlateNumber = decodeURIComponent(plateNumber)

    // Find all incidents (including tickets) for this plate number
    const violations = await prisma.incident.findMany({
      where: {
        plateNumber: {
          equals: decodedPlateNumber,
          mode: 'insensitive'
        }
      },
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        handledBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        vehicle: {
          select: {
            plateNumber: true,
            vehicleType: true,
            make: true,
            model: true,
            year: true,
            color: true,
            ownerName: true,
            driverName: true
          }
        }
      },
      orderBy: {
        incidentDate: 'desc'
      }
    })

    // Calculate summary statistics
    const totalViolations = violations.length
    const totalPenalties = violations.reduce((sum, violation) => {
      return sum + (violation.penaltyAmount ? Number(violation.penaltyAmount) : 0)
    }, 0)
    const paidTickets = violations.filter(v => v.status === 'RESOLVED' && v.ticketNumber).length
    const unpaidTickets = violations.filter(v => v.status === 'PENDING' && v.ticketNumber).length
    const openIncidents = violations.filter(v => !v.ticketNumber && ['PENDING', 'INVESTIGATING'].includes(v.status)).length

    // Get vehicle information if available
    const vehicle = await prisma.vehicle.findUnique({
      where: { plateNumber: decodedPlateNumber },
      select: {
        plateNumber: true,
        vehicleType: true,
        make: true,
        model: true,
        year: true,
        color: true,
        capacity: true,
        ownerName: true,
        ownerContact: true,
        driverName: true,
        driverLicense: true,
        isActive: true,
        registrationExpiry: true,
        insuranceExpiry: true
      }
    })

    return NextResponse.json({
      plateNumber: decodedPlateNumber,
      vehicle,
      violations,
      summary: {
        totalViolations,
        totalPenalties,
        paidTickets,
        unpaidTickets,
        openIncidents
      }
    })

  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
