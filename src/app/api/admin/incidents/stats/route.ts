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

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and enforcers can view incident statistics
    if (!['ADMIN', 'ENFORCER'].includes(user.userType)) {
      return NextResponse.json({ 
        message: 'Access denied. Admin or Enforcer role required.' 
      }, { status: 403 })
    }

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
      take: 10,
      orderBy: { createdAt: 'desc' },
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
        totalThisMonth: Object.values(monthlyTrends).reduce((sum, month) => 
          sum + (new Date(Object.keys(monthlyTrends).pop() + '-01').getMonth() === new Date().getMonth() 
            ? month.total : 0), 0),
        resolvedThisMonth: Object.values(monthlyTrends).reduce((sum, month) => 
          sum + (new Date(Object.keys(monthlyTrends).pop() + '-01').getMonth() === new Date().getMonth() 
            ? month.resolved : 0), 0),
        averageResolutionTime: null // Could be calculated if needed
      }
    })

  } catch (error) {
    console.error('GET /api/admin/incidents/stats error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}