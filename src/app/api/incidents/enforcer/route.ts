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

    // Only enforcers can access this endpoint
    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days') || '30'
    const filter = searchParams.get('filter') || 'all'

    // Calculate date range
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(days))

    // Build where clause
    const whereClause: any = {
      createdAt: {
        gte: daysAgo
      }
    }

    // Add violation type filter if specified
    if (filter !== 'all') {
      whereClause.incidentType = filter
    }

    const incidents = await prisma.incident.findMany({
      where: whereClause,
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        handledBy: {
          select: {
            firstName: true,
            lastName: true,
            username: true
          }
        },
        vehicle: {
          select: {
            plateNumber: true,
            vehicleType: true,
            make: true,
            model: true
          }
        },
        evidence: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // FIFO - First In, First Out
      }
    })

    // Add evidence count to each incident
    const incidentsWithCounts = incidents.map(incident => ({
      ...incident,
      evidenceCount: incident.evidence?.length || 0
    }))

    return NextResponse.json({
      incidents: incidentsWithCounts,
      message: 'Incidents retrieved successfully',
      filters: {
        days: parseInt(days),
        violationType: filter
      }
    }, {
      headers: {
        // Per-user browser cache for 30s with SWR
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
      }
    })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
