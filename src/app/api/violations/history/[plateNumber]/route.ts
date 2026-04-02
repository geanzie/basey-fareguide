import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plateNumber: string }> }
) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

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
    return createAuthErrorResponse(error)
  }
}
