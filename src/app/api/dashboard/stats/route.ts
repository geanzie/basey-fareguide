import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireRequestUser(request)

    // Get dashboard statistics
    const [
      totalUsers,
      incidentCounts,
      totalVehicles,
      totalPermits
    ] = await Promise.all([
      prisma.user.count(),
      prisma.incident.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      prisma.vehicle.count(),
      prisma.permit.count()
    ])

    const totalIncidents = incidentCounts.reduce(
      (sum, group) => sum + group._count._all,
      0,
    )
    const pendingIncidents = incidentCounts.find((group) => group.status === 'PENDING')?._count._all ?? 0
    const resolvedIncidents = incidentCounts.find((group) => group.status === 'RESOLVED')?._count._all ?? 0

    return NextResponse.json({
      stats: {
        totalUsers,
        totalIncidents,
        pendingIncidents,
        resolvedIncidents,
        totalVehicles,
        totalPermits
      }
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
