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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Fetch user's incidents
    const incidents = await prisma.incident.findMany({
      where: {
        reportedById: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        incidentType: true,
        description: true,
        location: true,
        plateNumber: true,
        vehicleType: true,
        incidentDate: true,
        status: true,
        ticketNumber: true,
        createdAt: true,
        updatedAt: true,
        vehicle: {
          select: {
            vehicleType: true
          }
        }
      }
    })

    // Get total count for pagination
    const totalIncidents = await prisma.incident.count({
      where: {
        reportedById: user.id
      }
    })

    // Format incidents for frontend
    const formattedIncidents = incidents.map(incident => ({
      id: incident.id,
      type: incident.incidentType,
      description: incident.description,
      location: incident.location,
      plateNumber: incident.plateNumber || 'N/A',
      vehicleType: incident.vehicleType || incident.vehicle?.vehicleType || 'N/A',
      date: incident.incidentDate.toISOString().split('T')[0],
      status: incident.status,
      ticketNumber: incident.ticketNumber || null,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString()
    }))

    return NextResponse.json({
      incidents: formattedIncidents,
      pagination: {
        page,
        limit,
        total: totalIncidents,
        totalPages: Math.ceil(totalIncidents / limit)
      }
    })

  } catch (error) {
    console.error('GET /api/incidents error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}