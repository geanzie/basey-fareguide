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
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
