import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { verifyAuth } from '@/lib/auth'
import { evaluateDiscountCardPolicy } from '@/lib/discountCardPolicy'
import { attachFareCalculationToActiveDriverSession } from '@/lib/driverSession'
import { serializeFareCalculation } from '@/lib/serializers'

const RECENT_DUPLICATE_SAVE_WINDOW_MS = 60_000

const fareCalculationSerializeSelect = {
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
      id: true,
      plateNumber: true,
      vehicleType: true,
      permit: {
        select: {
          permitPlateNumber: true,
        },
      },
    },
  },
} as const

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const parsedValue = Number.parseFloat(String(value))
  return Number.isFinite(parsedValue) ? parsedValue : null
}

// GET - Retrieve fare calculation history
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request)
    
    // If user is not authenticated, return empty history but don't error
    // This allows public pages to call this endpoint gracefully
    if (!user) {
      return NextResponse.json({ 
        calculations: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
        total: 0,
        page: 1,
        totalPages: 0,
        message: 'Login required to view calculation history'
      })
    }

    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 10,
      maxLimit: 50,
    })
    const recentDays = parseInt(searchParams.get('recentDays') || '0')
    const whereClause: {
      userId: string
      createdAt?: {
        gte: Date
      }
    } = {
      userId: user.id,
    }

    if (Number.isFinite(recentDays) && recentDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - recentDays)
      whereClause.createdAt = {
        gte: cutoff,
      }
    }

    // Fetch user's fare calculations
    const [fareCalculations, totalCalculations] = await Promise.all([
      prisma.fareCalculation.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
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
              id: true,
              vehicleType: true,
              plateNumber: true,
              permit: {
                select: {
                  permitPlateNumber: true,
                },
              },
            }
          }
        }
      }),
      prisma.fareCalculation.count({
        where: whereClause
      }),
    ])

    return NextResponse.json({
      calculations: fareCalculations.map((calculation) => serializeFareCalculation(calculation)),
      pagination: buildPaginationMetadata(pagination, totalCalculations)
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
    const user = await verifyAuth(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to save fare calculations' },
        { status: 401 }
      )
    }

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
    const userId = user.id

    // Validate required fields
    if (
      !fromLocation ||
      !toLocation ||
      distance === null ||
      distance === undefined ||
      calculatedFare === null ||
      calculatedFare === undefined ||
      !calculationType
    ) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['fromLocation', 'toLocation', 'distance', 'calculatedFare', 'calculationType']
        },
        { status: 400 }
      )
    }

    // Validate data types
    if (
      typeof distance !== 'number' ||
      !Number.isFinite(distance) ||
      typeof calculatedFare !== 'number' ||
      !Number.isFinite(calculatedFare)
    ) {
      return NextResponse.json(
        { error: 'Distance and calculatedFare must be numbers' },
        { status: 400 }
      )
    }

    const parsedDistance = Number.parseFloat(String(distance))
    const parsedCalculatedFare = Number.parseFloat(String(calculatedFare))
    const parsedOriginalFare = toOptionalNumber(originalFare)
    const parsedDiscountApplied = toOptionalNumber(discountApplied)
    const serializedRouteData = routeData ? JSON.stringify(routeData) : null

    let resolvedVehicleId: string | null = null

    if (vehicleId != null) {
      if (typeof vehicleId !== 'string' || vehicleId.trim().length === 0) {
        return NextResponse.json(
          { error: 'vehicleId must be a non-empty string when provided' },
          { status: 400 }
        )
      }

      const selectedVehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: {
          id: true,
          isActive: true,
        }
      })

      if (!selectedVehicle) {
        return NextResponse.json(
          { error: 'Selected vehicle was not found' },
          { status: 404 }
        )
      }

      if (!selectedVehicle.isActive) {
        return NextResponse.json(
          { error: 'Selected vehicle is inactive and cannot be attached to this fare calculation' },
          { status: 400 }
        )
      }

      resolvedVehicleId = selectedVehicle.id
    }

    // Verify discount card ownership — prevent using another user's card
    let resolvedDiscountType = discountType || null

    if (discountCardId) {
      if (parsedOriginalFare === null || parsedDiscountApplied === null || parsedDiscountApplied <= 0) {
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

    const duplicateWindowStart = new Date(Date.now() - RECENT_DUPLICATE_SAVE_WINDOW_MS)
    const existingCalculation = await prisma.fareCalculation.findFirst({
      where: {
        userId,
        vehicleId: resolvedVehicleId,
        fromLocation: String(fromLocation),
        toLocation: String(toLocation),
        distance: parsedDistance,
        calculatedFare: parsedCalculatedFare,
        calculationType: String(calculationType),
        routeData: serializedRouteData,
        discountCardId: discountCardId || null,
        originalFare: parsedOriginalFare,
        discountApplied: parsedDiscountApplied,
        discountType: resolvedDiscountType,
        createdAt: {
          gte: duplicateWindowStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: fareCalculationSerializeSelect,
    })

    if (existingCalculation) {
      await attachFareCalculationToActiveDriverSession(
        {
          id: existingCalculation.id,
          userId,
          vehicleId: resolvedVehicleId,
          fromLocation: existingCalculation.fromLocation,
          toLocation: existingCalculation.toLocation,
          calculatedFare: existingCalculation.calculatedFare,
          discountType: existingCalculation.discountType,
          createdAt: existingCalculation.createdAt,
        },
        user.userType,
      )

      return NextResponse.json({
        success: true,
        calculation: serializeFareCalculation(existingCalculation),
        message: 'Fare calculation already saved',
      })
    }

    // Create fare calculation record
    const fareCalculation = await prisma.fareCalculation.create({
      data: {
        userId,
        vehicleId: resolvedVehicleId,
        fromLocation: String(fromLocation),
        toLocation: String(toLocation),
        distance: parsedDistance,
        calculatedFare: parsedCalculatedFare,
        calculationType: String(calculationType),
        routeData: serializedRouteData,
        // Discount card fields
        discountCardId: discountCardId || null,
        originalFare: parsedOriginalFare,
        discountApplied: parsedDiscountApplied,
        discountType: resolvedDiscountType
      },
      select: fareCalculationSerializeSelect,
    })

    await attachFareCalculationToActiveDriverSession(
      {
        id: fareCalculation.id,
        userId,
        vehicleId: resolvedVehicleId,
        fromLocation: fareCalculation.fromLocation,
        toLocation: fareCalculation.toLocation,
        calculatedFare: fareCalculation.calculatedFare,
        discountType: fareCalculation.discountType,
        createdAt: fareCalculation.createdAt,
      },
      user.userType,
    )

    // Create discount usage log if discount was applied
    if (discountCardId && parsedDiscountApplied && parsedDiscountApplied > 0 && parsedOriginalFare) {
      try {
        await prisma.discountUsageLog.create({
          data: {
            discountCardId: discountCardId,
            fareCalculationId: fareCalculation.id,
            originalFare: parsedOriginalFare,
            discountAmount: parsedDiscountApplied,
            finalFare: parsedCalculatedFare,
            discountRate: parsedDiscountApplied / parsedOriginalFare, // Calculate actual rate used
            fromLocation: String(fromLocation),
            toLocation: String(toLocation),
            distance: parsedDistance,
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
