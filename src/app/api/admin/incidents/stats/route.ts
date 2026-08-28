import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_OR_ENFORCER, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

const RECENT_INCIDENT_LIMIT = 10

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_OR_ENFORCER])

    // Monthly trends window (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [incidentStats, totalIncidents, recentIncidents, monthlyRows] = await Promise.all([
      // Incident counts by status
      prisma.incident.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      }),
      prisma.incident.count(),
      // Recent incidents (last 10)
      prisma.incident.findMany({
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
      }),
      // Month buckets aggregated in the DB (UTC months, matching the stored timestamps)
      prisma.$queryRaw<Array<{ month: string; total: bigint; resolved: bigint; pending: bigint }>>`
        SELECT
          to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending
        FROM incidents
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY 1
      `
    ])

    // Process stats into a more usable format
    const statusCounts = incidentStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count.id
      return acc
    }, {} as Record<string, number>)

    const monthlyTrends = Object.fromEntries(
      monthlyRows.map((row) => [
        row.month,
        { total: Number(row.total), resolved: Number(row.resolved), pending: Number(row.pending) },
      ]),
    )

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
