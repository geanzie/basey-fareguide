import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        userType: true
      }
    })

    return user
  } catch (error) {
    return null
  }
}

// GET /api/enforcer/dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    // Calculate dashboard statistics from real data
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Active incidents (PENDING and INVESTIGATING)
    const activeIncidents = await prisma.incident.count({
      where: {
        status: {
          in: ['PENDING', 'INVESTIGATING']
        }
      }
    })

    // Incidents assigned to current enforcer
    const assignedToMe = await prisma.incident.count({
      where: {
        handledById: user.id,
        status: {
          in: ['INVESTIGATING']
        }
      }
    })

    // Incidents resolved today
    const resolvedToday = await prisma.incident.count({
      where: {
        status: 'RESOLVED',
        updatedAt: {
          gte: today
        }
      }
    })

    // Incidents with evidence uploaded
    const incidentsWithEvidence = await prisma.incident.findMany({
      where: {
        status: {
          in: ['PENDING', 'INVESTIGATING']
        }
      },
      include: {
        evidence: true
      }
    })
    const pendingEvidence = incidentsWithEvidence.filter(inc => inc.evidence.length > 0).length

    // Tickets issued by this enforcer
    const myTicketsIssued = await prisma.incident.count({
      where: {
        handledById: user.id,
        ticketNumber: {
          not: null
        }
      }
    })

    // Calculate average resolution time
    const resolvedIncidents = await prisma.incident.findMany({
      where: {
        status: 'RESOLVED',
        updatedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    })

    let averageResolutionTime = '0h'
    if (resolvedIncidents.length > 0) {
      const totalMinutes = resolvedIncidents.reduce((sum, inc) => {
        const diff = inc.updatedAt.getTime() - inc.createdAt.getTime()
        return sum + (diff / (1000 * 60))
      }, 0)
      const avgMinutes = totalMinutes / resolvedIncidents.length
      const avgHours = Math.round(avgMinutes / 60 * 10) / 10
      averageResolutionTime = avgHours >= 24 
        ? `${Math.round(avgHours / 24)}d` 
        : `${avgHours}h`
    }

    const stats = {
      activeIncidents,
      assignedToMe,
      resolvedToday,
      pendingEvidence,
      averageResolutionTime,
      myTicketsIssued
    }

    // Get recent activity
    const recentIncidents = await prisma.incident.findMany({
      take: 5,
      orderBy: {
        updatedAt: 'desc'
      },
      where: {
        OR: [
          { handledById: user.id },
          { status: 'PENDING' }
        ]
      },
      include: {
        evidence: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    })

    const recentActivity = recentIncidents.map(incident => {
      if (incident.evidence.length > 0) {
        return {
          id: incident.id,
          type: 'evidence_uploaded' as const,
          message: `Evidence uploaded for incident at ${incident.location}`,
          timestamp: incident.evidence[0].createdAt.toISOString(),
          incidentId: incident.id
        }
      } else if (incident.status === 'RESOLVED') {
        return {
          id: incident.id,
          type: 'incident_resolved' as const,
          message: `Incident resolved at ${incident.location}`,
          timestamp: incident.updatedAt.toISOString(),
          incidentId: incident.id
        }
      } else {
        return {
          id: incident.id,
          type: 'incident_assigned' as const,
          message: `New incident: ${incident.incidentType} at ${incident.location}`,
          timestamp: incident.createdAt.toISOString(),
          incidentId: incident.id
        }
      }
    })

    return NextResponse.json({ stats, recentActivity })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
