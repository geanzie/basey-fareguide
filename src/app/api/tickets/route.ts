import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ENFORCER_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

function generateTicketNumber(): string {
  const prefix = 'TKT'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}-${timestamp}-${random}`
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [...ENFORCER_ONLY])

    const body = await request.json()
    const {
      incidentType,
      description,
      location,
      coordinates,
      plateNumber,
      driverLicense,
      vehicleType,
      penalty,
      penaltyAmount,
      incidentDate,
      paymentStatus,
      requiresPayment
    } = body

    // Handle penalty - it could come as 'penalty' or 'penaltyAmount'
    const finalPenaltyAmount = penaltyAmount || penalty

    // Validate required fields
    if (!incidentType || !description || !location || !finalPenaltyAmount) {
      return NextResponse.json({ 
        message: 'Missing required fields: incidentType, description, location, penalty/penaltyAmount' 
      }, { status: 400 })
    }

    // Generate unique ticket number
    const ticketNumber = generateTicketNumber()

    // Find or create vehicle if plateNumber is provided
    let vehicleId = null
    if (plateNumber) {
      let vehicle = await prisma.vehicle.findUnique({
        where: { plateNumber }
      })

      if (!vehicle) {
        // Create a basic vehicle record for ticket issuance
        vehicle = await prisma.vehicle.create({
          data: {
            plateNumber,
            vehicleType: vehicleType || 'JEEPNEY',
            make: 'Unknown',
            model: 'Unknown',
            year: new Date().getFullYear(),
            color: 'Unknown',
            capacity: 16,
            ownerName: 'Unknown',
            ownerContact: 'Unknown',
            driverName: 'Unknown',
            driverLicense: driverLicense || 'Unknown',
            registrationExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
          }
        })
      }
      vehicleId = vehicle.id
    }

    // Create the ticket (as an incident with ticket number)
    const ticket = await prisma.incident.create({
      data: {
        incidentType,
        description,
        location,
        coordinates,
        reportedById: user.id,
        handledById: user.id, // Enforcer creates and handles the ticket
        vehicleId,
        vehicleType,
        driverLicense,
        plateNumber,
        status: paymentStatus === 'PAID' ? 'RESOLVED' : 'PENDING',
        penaltyAmount: parseFloat(finalPenaltyAmount.toString()),
        ticketNumber,
        incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
        resolvedAt: paymentStatus === 'PAID' ? new Date() : null
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
        vehicle: true
      }
    })

    return NextResponse.json({
      ticket,
      ticketNumber,
      message: 'Ticket issued successfully'
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
