import { NextRequest, NextResponse } from 'next/server'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { serializeDashboardActivityItem } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    await requireRequestUser(request)
    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 10,
      maxLimit: 50,
    })

    const [recentIncidents, total] = await Promise.all([
      prisma.incident.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
      }),
      prisma.incident.count(),
    ])

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
      ,
      pagination: buildPaginationMetadata(pagination, total)
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
