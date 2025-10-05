import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@/generated/prisma'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true
      }
    })

    return user
  } catch (error) {
    return null
  }
}

// GET /api/enforcer/dashboard
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.userType !== 'ENFORCER') {
      return NextResponse.json({ message: 'Access denied. Enforcer role required.' }, { status: 403 })
    }

    // Mock dashboard data - replace with actual database queries
    const stats = {
      activeIncidents: 12,
      assignedToMe: 3,
      resolvedToday: 2,
      pendingEvidence: 5,
      averageResolutionTime: '2.5h',
      myTicketsIssued: 15
    }

    const recentActivity = [
      {
        id: '1',
        type: 'incident_assigned',
        message: 'New incident assigned: Fare overcharge at Poblacion Market',
        timestamp: new Date().toISOString(),
        incidentId: 'INC001'
      },
      {
        id: '2',
        type: 'evidence_uploaded',
        message: 'Evidence uploaded for incident #INC002',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        incidentId: 'INC002'
      }
    ]

    return NextResponse.json({ stats, recentActivity })
  } catch (error) {
    console.error('GET /api/enforcer/dashboard error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}