import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { evaluateDiscountCardPolicy } from '@/lib/discountCardPolicy'
import { serializeFareCalculation } from '@/lib/serializers'

// GET - Retrieve fare calculation history
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    // If user is not authenticated, return empty history but don't error
    // This allows public pages to call this endpoint gracefully
    if (!user) {
      return NextResponse.json({ 
        calculations: [],
        total: 0,
        page: 1,
        totalPages: 0,
        message: 'Login required to view calculation history'
      })
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
        originalFare: true,
        discountApplied: true,
        discountType: true,
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
      calculations: fareCalculations.map((calculation) => serializeFareCalculation(calculation)),
      pagination: {
        page,
        limit,
        total: totalCalculations,
        totalPages: Math.ceil(totalCalculations / limit)
      }
    })

  } catch (error) {
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
      vehicleId,
      // Discount card fields
      discountCardId,
      originalFare,
      discountApplied,
      discountType
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

    // Get user ID from the shared auth helper when available.
    let userId: string | undefined = undefined
    
    try {
      const user = await verifyAuth(request)
      if (user) {
        userId = user.id
      }
    } catch (error) {
      // If token verification fails, continue without user ID (anonymous calculation)
    }

    // Verify discount card ownership — prevent using another user's card
    let resolvedDiscountType = discountType || null

    if (discountCardId) {
      if (!userId) {
        return NextResponse.json(
          { error: 'Authentication required to use a discount card' },
          { status: 401 }
        )
      }

      if (typeof originalFare !== 'number' || typeof discountApplied !== 'number' || discountApplied <= 0) {
        return NextResponse.json(
          { error: 'A valid discount usage must include originalFare and a positive discountApplied amount' },
          { status: 400 }
        )
      }

      const card = await prisma.discountCard.findUnique({
        where: { id: discountCardId },
        select: {
          id: true,
          userId: true,
          discountType: true,
          verificationStatus: true,
          isActive: true,
          validFrom: true,
          validUntil: true
        }
      })

      if (!card) {
        return NextResponse.json(
          { error: 'Invalid discount card' },
          { status: 404 }
        )
      }

      const evaluation = evaluateDiscountCardPolicy(card, { userId })
      if (!evaluation.isValid) {
        return NextResponse.json(
          {
            error: 'Invalid or unauthorized discount card',
            validationChecks: evaluation
          },
          { status: 403 }
        )
      }

      if (discountType && discountType !== card.discountType) {
        return NextResponse.json(
          { error: 'Discount type does not match the supplied discount card' },
          { status: 400 }
        )
      }

      resolvedDiscountType = card.discountType
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
        routeData: routeData ? JSON.stringify(routeData) : null,
        // Discount card fields
        discountCardId: discountCardId || null,
        originalFare: originalFare ? parseFloat(String(originalFare)) : null,
        discountApplied: discountApplied ? parseFloat(String(discountApplied)) : null,
        discountType: resolvedDiscountType
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
        } : false,
        discountCard: discountCardId ? {
          select: {
            id: true,
            discountType: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        } : false
      }
    })

    // Create discount usage log if discount was applied
    if (discountCardId && userId && discountApplied && discountApplied > 0) {
      try {
        await prisma.discountUsageLog.create({
          data: {
            discountCardId: discountCardId,
            fareCalculationId: fareCalculation.id,
            originalFare: parseFloat(String(originalFare)),
            discountAmount: parseFloat(String(discountApplied)),
            finalFare: parseFloat(String(calculatedFare)),
            discountRate: discountApplied / originalFare, // Calculate actual rate used
            fromLocation: String(fromLocation),
            toLocation: String(toLocation),
            distance: parseFloat(String(distance)),
            // Optional tracking fields
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            gpsCoordinates: null, // Can be added later if needed
            isSuspicious: false
          }
        })

        // Update discount card usage stats
        await prisma.discountCard.update({
          where: { id: discountCardId },
          data: {
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
            dailyUsageCount: { increment: 1 }
          }
        })
      } catch (logError) {
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({
      success: true,
      calculation: serializeFareCalculation(fareCalculation),
      message: 'Fare calculation saved successfully'
    }, { status: 201 })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
