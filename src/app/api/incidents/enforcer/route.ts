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

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
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

    const incidents = await prisma.incident.findMany({
      include: {
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        handledBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        vehicle: {
          select: {
            plateNumber: true,
            vehicleType: true,
            make: true,
            model: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // FIFO - First In, First Out
      }
    })

    return NextResponse.json({
      incidents,
      message: 'Incidents retrieved successfully'
    })

  } catch (error) {
    console.error('GET /api/incidents/enforcer error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}