import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { serializeDashboardActivityItem } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    await requireRequestUser(request)

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
      activity: recentIncidents.map((incident) =>
        serializeDashboardActivityItem({
          id: incident.id,
          incidentType: incident.incidentType,
          description: incident.description,
          location: incident.location,
          status: incident.status,
          createdAt: incident.createdAt,
          ticketNumber: incident.ticketNumber,
          reportedBy: incident.reportedBy,
          handledBy: incident.handledBy,
        }),
      )
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
