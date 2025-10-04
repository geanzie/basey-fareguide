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
        email: true,
        userType: true,
        isActive: true
      }
    })

    return user?.isActive ? user : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get recent activity (last 10 incidents)
    const recentIncidents = await prisma.incident.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        handledBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    })

    return NextResponse.json({
      activity: recentIncidents.map(incident => ({
        id: incident.id,
        type: incident.incidentType,
        description: incident.description,
        location: incident.location,
        status: incident.status,
        reportedBy: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`,
        handledBy: incident.handledBy ? `${incident.handledBy.firstName} ${incident.handledBy.lastName}` : null,
        createdAt: incident.createdAt,
        ticketNumber: incident.ticketNumber
      }))
    })

  } catch (error) {
    console.error('GET /api/dashboard/activity error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}