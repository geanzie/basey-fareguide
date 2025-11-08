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

    const { incidentId } = await context.params    // Check if incident exists and is still pending
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    })

    if (!incident) {
      return NextResponse.json({ message: 'Incident not found' }, { status: 404 })
    }

    if (incident.status !== 'PENDING') {
      return NextResponse.json({ 
        message: 'This incident has already been assigned or resolved' 
      }, { status: 400 })
    }

    // Update incident to investigating and assign to current enforcer
    const updatedIncident = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: 'INVESTIGATING',
        handledById: user.id,
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
      message: 'Incident assigned successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
