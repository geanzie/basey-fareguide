import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireRequestUser(request)

    // Get dashboard statistics
    const [
      totalUsers,
      totalIncidents,
      pendingIncidents,
      resolvedIncidents,
      totalVehicles,
      totalPermits
    ] = await Promise.all([
      prisma.user.count(),
      prisma.incident.count(),
      prisma.incident.count({ where: { status: 'PENDING' } }),
      prisma.incident.count({ where: { status: 'RESOLVED' } }),
      prisma.vehicle.count(),
      prisma.permit.count()
    ])

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
