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

// GET - Retrieve fare calculation history
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
        routeData: true,
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

    return NextResponse.json({
      calculations: fareCalculations,
      pagination: {
        page,
        limit,
        total: totalCalculations,
        totalPages: Math.ceil(totalCalculations / limit)
      }
    })

  } catch (error) {
    console.error('GET /api/fare-calculations error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save a new fare calculation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      fromLocation, 
      toLocation, 
      distance, 
      calculatedFare, 
      calculationType, 
      routeData,
      vehicleId 
    } = body

    // Validate required fields
    if (!fromLocation || !toLocation || !distance || !calculatedFare || !calculationType) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['fromLocation', 'toLocation', 'distance', 'calculatedFare', 'calculationType']
        },
        { status: 400 }
      )
    }

    // Validate data types
    if (typeof distance !== 'number' || typeof calculatedFare !== 'number') {
      return NextResponse.json(
        { error: 'Distance and calculatedFare must be numbers' },
        { status: 400 }
      )
    }

    // Get user ID from token (if provided) - fare calculations can be saved without authentication for public users
    let userId: string | undefined = undefined
    
    try {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any
        
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, isActive: true }
        })

        if (user?.isActive) {
          userId = user.id
        }
      }
    } catch (error) {
      // If token verification fails, continue without user ID (anonymous calculation)
      console.log('Token verification failed, saving as anonymous calculation')
    }

    // Create fare calculation record
    const fareCalculation = await prisma.fareCalculation.create({
      data: {
        userId,
        vehicleId: vehicleId || null,
        fromLocation: String(fromLocation),
        toLocation: String(toLocation),
        distance: parseFloat(String(distance)),
        calculatedFare: parseFloat(String(calculatedFare)),
        calculationType: String(calculationType),
        routeData: routeData ? JSON.stringify(routeData) : null
      },
      include: {
        user: userId ? {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        } : false,
        vehicle: vehicleId ? {
          select: {
            id: true,
            plateNumber: true,
            vehicleType: true
          }
        } : false
      }
    })

    return NextResponse.json({
      success: true,
      calculation: fareCalculation,
      message: 'Fare calculation saved successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('POST /api/fare-calculations error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}