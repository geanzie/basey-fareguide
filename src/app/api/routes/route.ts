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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Fetch user's fare calculations
    const fareCalculations = await prisma.fareCalculation.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
      select: {
        id: true,
        fromLocation: true,
        toLocation: true,
        distance: true,
        calculatedFare: true,
        actualFare: true,
        calculationType: true,
        createdAt: true,
        vehicle: {
          select: {
            vehicleType: true,
            plateNumber: true
          }
        }
      }
    })

    // Get total count for pagination
    const totalCalculations = await prisma.fareCalculation.count({
      where: {
        userId: user.id
      }
    })

    // Format routes for frontend
    const formattedRoutes = fareCalculations.map(calc => ({
      id: calc.id,
      from: calc.fromLocation,
      to: calc.toLocation,
      distance: `${parseFloat(calc.distance.toString()).toFixed(1)} km`,
      fare: `₱${parseFloat(calc.calculatedFare.toString()).toFixed(2)}`,
      actualFare: calc.actualFare ? `₱${parseFloat(calc.actualFare.toString()).toFixed(2)}` : null,
      calculationType: calc.calculationType,
      date: calc.createdAt.toISOString().split('T')[0],
      vehicleType: calc.vehicle?.vehicleType || null,
      plateNumber: calc.vehicle?.plateNumber || null,
      createdAt: calc.createdAt.toISOString()
    }))

    return NextResponse.json({
      routes: formattedRoutes,
      pagination: {
        page,
        limit,
        total: totalCalculations,
        totalPages: Math.ceil(totalCalculations / limit)
      }
    })

  } catch (error) {
    console.error('GET /api/routes error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save a new named route
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Only allow admin and data encoder to create named routes
    if (!['ADMIN', 'DATA_ENCODER'].includes(user.userType)) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, waypoints, distance } = body

    // Validate required fields
    if (!name || !waypoints || !distance) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['name', 'waypoints', 'distance']
        },
        { status: 400 }
      )
    }

    // Validate data types
    if (typeof distance !== 'number') {
      return NextResponse.json(
        { error: 'Distance must be a number' },
        { status: 400 }
      )
    }

    // Check if route name already exists
    const existingRoute = await prisma.route.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    })

    if (existingRoute) {
      return NextResponse.json(
        { error: 'A route with this name already exists' },
        { status: 409 }
      )
    }

    // Create new route
    const route = await prisma.route.create({
      data: {
        name: String(name),
        description: description ? String(description) : null,
        waypoints: JSON.stringify(waypoints),
        distance: parseFloat(String(distance))
      }
    })

    return NextResponse.json({
      success: true,
      route,
      message: 'Route created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('POST /api/routes error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
