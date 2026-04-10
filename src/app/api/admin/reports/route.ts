import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

const REPORT_TREND_ROW_LIMIT = 5000

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    const [
      totalIncidents,
      incidentsByStatus,
      incidentsByType,
      recentIncidents,
      totalUsers,
      activeUsers,
      usersByType,
      recentUsers,
      evidenceTotals,
      evidenceByType,
    ] = await Promise.all([
      prisma.incident.count({
        where: {
          createdAt: {
            gte: startDate
          }
        }
      }),
      prisma.incident.groupBy({
        by: ['status'],
        _count: true,
        where: {
          createdAt: {
            gte: startDate
          }
        }
      }),
      prisma.incident.groupBy({
        by: ['incidentType'],
        _count: true,
        where: {
          createdAt: {
            gte: startDate
          }
        }
      }),
      // Trend tiles only need bounded source rows; headline totals come from aggregates above.
      prisma.incident.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: REPORT_TREND_ROW_LIMIT,
        select: {
          createdAt: true,
          status: true
        }
      }),
      prisma.user.count(),
      prisma.user.count({
        where: {
          isActive: true
        }
      }),
      prisma.user.groupBy({
        by: ['userType'],
        _count: true
      }),
      prisma.user.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: REPORT_TREND_ROW_LIMIT,
        select: {
          createdAt: true
        }
      }),
      prisma.evidence.aggregate({
        _count: {
          _all: true,
        },
        _sum: {
          fileSize: true,
        },
      }),
      prisma.evidence.groupBy({
        by: ['fileType'],
        _count: {
          _all: true,
        },
        _sum: {
          fileSize: true,
        },
      }),
    ])

    // Process monthly trends for incidents
    const monthlyTrends: Record<string, { total: number; resolved: number }> = {}
    recentIncidents.forEach(incident => {
      const month = incident.createdAt.toISOString().substring(0, 7) // YYYY-MM
      if (!monthlyTrends[month]) {
        monthlyTrends[month] = { total: 0, resolved: 0 }
      }
      monthlyTrends[month].total++
      if (incident.status === 'RESOLVED') {
        monthlyTrends[month].resolved++
      }
    })

    // Process registration trends
    const registrationTrends: Record<string, number> = {}
    recentUsers.forEach(user => {
      const month = user.createdAt.toISOString().substring(0, 7) // YYYY-MM
      if (!registrationTrends[month]) {
        registrationTrends[month] = 0
      }
      registrationTrends[month]++
    })

    // Process storage data
    let totalFiles = evidenceTotals._count._all
    let totalSizeBytes = evidenceTotals._sum.fileSize || 0
    let totalSizeMB = totalSizeBytes / (1024 * 1024)

    const storageByType: Record<string, { files: number; sizeMB: number }> = {}
    evidenceByType.forEach(file => {
      const type = file.fileType || 'UNKNOWN'
      storageByType[type] = {
        files: file._count._all,
        sizeMB: (file._sum.fileSize || 0) / (1024 * 1024),
      }
    })

    // Convert grouped data to objects
    const byStatusObj: Record<string, number> = {}
    incidentsByStatus.forEach(item => {
      byStatusObj[item.status] = item._count
    })

    const byTypeObj: Record<string, number> = {}
    incidentsByType.forEach(item => {
      byTypeObj[item.incidentType] = item._count
    })

    const usersByTypeObj: Record<string, number> = {}
    usersByType.forEach(item => {
      usersByTypeObj[item.userType] = item._count
    })

    // Build response
    const reportData = {
      generatedAt: new Date().toISOString(),
      incidents: {
        total: totalIncidents,
        byStatus: byStatusObj,
        byType: byTypeObj,
        monthlyTrends
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        byType: usersByTypeObj,
        registrationTrends
      },
      storage: {
        totalFiles,
        totalSizeMB: Math.round(totalSizeMB * 100) / 100,
        byType: Object.fromEntries(
          Object.entries(storageByType).map(([type, data]) => [
            type,
            { files: data.files, sizeMB: Math.round(data.sizeMB * 100) / 100 }
          ])
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: reportData
    })
  } catch (error) {
    const authError = createAuthErrorResponse(error)
    if (authError.status !== 500) {
      return authError
    }
    return NextResponse.json(
      { success: false, error: 'Failed to generate system reports' },
      { status: 500 }
    )
  }
}
