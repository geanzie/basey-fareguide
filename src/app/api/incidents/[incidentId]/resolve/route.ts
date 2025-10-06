import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

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
  { params }: { params: Promise<{ incidentId: string }> }
) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    const { incidentId } = await params
    const { ticketNumber } = await request.json()

    if (!ticketNumber || !ticketNumber.trim()) {
      return NextResponse.json({ message: 'Ticket number is required' }, { status: 400 })
    }

    // Check if incident exists and is being handled by this enforcer
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    if (incident.handledById !== user.id) {
      return NextResponse.json({ 
        message: 'You can only resolve incidents that are assigned to you' 
      }, { status: 403 })
    }

    if (incident.status !== 'INVESTIGATING') {
      return NextResponse.json({ 
        message: 'This incident is not in investigating status' 
      }, { status: 400 })
    }

    // Check if ticket number already exists
    const existingTicket = await prisma.incident.findUnique({
      where: { ticketNumber: ticketNumber.trim() }
    })

    if (existingTicket) {
      return NextResponse.json({ 
        message: 'Ticket number already exists. Please use a unique ticket number.' 
      }, { status: 400 })
    }

    // Update incident to resolved with ticket number
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: 'RESOLVED',
        ticketNumber: ticketNumber.trim(),
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
        }
      }
    })

    return NextResponse.json({
      incident: updatedIncident,
      message: 'Incident resolved successfully'
    })

  } catch (error) {
    console.error('PATCH /api/incidents/[incidentId]/resolve error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}