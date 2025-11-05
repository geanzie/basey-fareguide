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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    const { incidentId } = await context.params
    const body = await request.json()
    const { ticketNumber, penaltyAmount, remarks } = body

    // Validate required fields
    if (!ticketNumber || !penaltyAmount) {
      return NextResponse.json({ 
        message: 'Missing required fields: ticketNumber, penaltyAmount' 
      }, { status: 400 })
    }

    // Check if incident exists and is in INVESTIGATING status
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    if (incident.status !== 'INVESTIGATING') {
      return NextResponse.json({ 
        message: 'Can only issue tickets for incidents under investigation' 
      }, { status: 400 })
    }

    if (incident.ticketNumber) {
      return NextResponse.json({ 
        message: 'Ticket has already been issued for this incident' 
      }, { status: 400 })
    }

    // Check if ticket number is already in use
    const existingTicket = await prisma.incident.findUnique({
      where: { ticketNumber }
    })

    if (existingTicket) {
      return NextResponse.json({ 
        message: 'Ticket number already exists. Please use a different number.' 
      }, { status: 400 })
    }

    // Update incident with ticket information and mark as resolved
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        ticketNumber,
        penaltyAmount: parseFloat(penaltyAmount.toString()),
        remarks: remarks || incident.remarks,
        status: 'RESOLVED',
        resolvedAt: new Date(),
        updatedAt: new Date()
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
            ownerName: true
          }
        }
      }
    })

    return NextResponse.json({
      incident: updatedIncident,
      message: `Ticket ${ticketNumber} issued successfully. Incident marked as resolved.`
    })

  } catch (error) {
    console.error('PATCH /api/incidents/[incidentId]/issue-ticket error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}