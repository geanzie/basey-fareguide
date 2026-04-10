import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

const RECENT_INCIDENT_LIMIT = 10
const INCIDENT_STATS_TREND_ROW_LIMIT = 5000

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

    // Get incident counts by status
    const incidentStats = await prisma.incident.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })

    // Get total count
    const totalIncidents = await prisma.incident.count()

    // Get recent incidents (last 10)
    const recentIncidents = await prisma.incident.findMany({
      take: RECENT_INCIDENT_LIMIT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        incidentType: true,
        description: true,
        status: true,
        location: true,
        createdAt: true,
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

    // Process stats into a more usable format
    const statusCounts = incidentStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count.id
      return acc
    }, {} as Record<string, number>)

    // Get monthly trends (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyStats = await prisma.incident.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: INCIDENT_STATS_TREND_ROW_LIMIT,
      select: {
        createdAt: true,
        status: true
      }
    })

    // Process monthly data
    const monthlyTrends = monthlyStats.reduce((acc, incident) => {
      const month = incident.createdAt.toISOString().slice(0, 7) // YYYY-MM format
      if (!acc[month]) {
        acc[month] = { total: 0, resolved: 0, pending: 0 }
      }
      acc[month].total++
      if (incident.status === 'RESOLVED') {
        acc[month].resolved++
      } else if (incident.status === 'PENDING') {
        acc[month].pending++
      }
      return acc
    }, {} as Record<string, { total: number; resolved: number; pending: number }>)

    const currentMonthKey = new Date().toISOString().slice(0, 7)
    const currentMonthSummary = monthlyTrends[currentMonthKey] || { total: 0, resolved: 0, pending: 0 }

    return NextResponse.json({
      success: true,
      total: totalIncidents,
      pending: statusCounts.pending || 0,
      investigating: statusCounts.investigating || 0,
      resolved: statusCounts.resolved || 0,
      dismissed: statusCounts.dismissed || 0,
      byStatus: statusCounts,
      recent: recentIncidents.map(incident => ({
        id: incident.id,
        type: incident.incidentType,
        description: incident.description.length > 100 
          ? incident.description.substring(0, 100) + '...' 
          : incident.description,
        status: incident.status,
        location: incident.location,
        createdAt: incident.createdAt,
        reportedBy: incident.reportedBy 
          ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`
          : 'Unknown',
        handledBy: incident.handledBy 
          ? `${incident.handledBy.firstName} ${incident.handledBy.lastName}`
          : null
      })),
      monthlyTrends,
      summary: {
        totalThisMonth: currentMonthSummary.total,
        resolvedThisMonth: currentMonthSummary.resolved,
        averageResolutionTime: null // Could be calculated if needed
      }
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
