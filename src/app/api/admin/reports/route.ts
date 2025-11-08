import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
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

    // Fetch incidents data
    const [
      totalIncidents,
      incidentsByStatus,
      incidentsByType,
      recentIncidents
    ] = await Promise.all([
      // Total incidents
      prisma.incident.count({
        where: {
          createdAt: {
            gte: startDate
          }
        }
      }),
      
      // Incidents by status
      prisma.incident.groupBy({
        by: ['status'],
        _count: true,
        where: {
          createdAt: {
            gte: startDate
          }
        }
      }),
      
      // Incidents by incident type
      prisma.incident.groupBy({
        by: ['incidentType'],
        _count: true,
        where: {
          createdAt: {
            gte: startDate
          }
        }
      }),

      // Recent incidents for monthly trends
      prisma.incident.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        select: {
          createdAt: true,
          status: true
        }
      })
    ])

    // Fetch users data
    const [
      totalUsers,
      activeUsers,
      usersByType,
      recentUsers
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Active users
      prisma.user.count({
        where: {
          isActive: true
        }
      }),
      
      // Users by type
      prisma.user.groupBy({
        by: ['userType'],
        _count: true
      }),

      // Recent users for registration trends
      prisma.user.findMany({
        where: {
          createdAt: {
            gte: startDate
          }
        },
        select: {
          createdAt: true
        }
      })
    ])

    // Fetch storage/evidence data
    const evidenceFiles = await prisma.evidence.findMany({
      select: {
        fileType: true,
        fileSize: true
      }
    })

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
    let totalFiles = evidenceFiles.length
    let totalSizeBytes = evidenceFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0)
    let totalSizeMB = totalSizeBytes / (1024 * 1024)

    const storageByType: Record<string, { files: number; sizeMB: number }> = {}
    evidenceFiles.forEach(file => {
      const type = file.fileType || 'UNKNOWN'
      if (!storageByType[type]) {
        storageByType[type] = { files: 0, sizeMB: 0 }
      }
      storageByType[type].files++
      storageByType[type].sizeMB += (file.fileSize || 0) / (1024 * 1024)
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

    // Calculate system uptime (simplified - you'd need proper monitoring)
    const uptime = '99.7%' // This would come from actual monitoring in production

    // Build response
    const reportData = {
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
      },
      system: {
        responseTime: 245, // This would come from actual monitoring
        uptime,
        lastGenerated: new Date().toISOString()
      }
    }

    return NextResponse.json({
      success: true,
      data: reportData
    })
      } catch (error) {    return NextResponse.json(
      { success: false, error: 'Failed to generate system reports' },
      { status: 500 }
    )
  }
}
