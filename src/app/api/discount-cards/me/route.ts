import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * GET /api/discount-cards/me
 * Retrieve the authenticated user's active discount card
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    let decoded: any
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret')
      } catch (err) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get user's discount card
    const discountCard = await prisma.discountCard.findUnique({
      where: { 
        userId: decoded.userId 
      },
      select: {
        id: true,
        discountType: true,
        verificationStatus: true,
        isActive: true,
        validFrom: true,
        validUntil: true,
        isAdminOverride: true,
        overrideReason: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    // Return null if no card found
    if (!discountCard) {
      return NextResponse.json({ 
        hasDiscountCard: false,
        discountCard: null 
      })
    }

    // Check if card is valid
    const now = new Date()
    const validFrom = new Date(discountCard.validFrom)
    const validUntil = new Date(discountCard.validUntil)
    
    const isExpired = now > validUntil
    const isNotYetValid = now < validFrom
    const isApproved = discountCard.verificationStatus === 'APPROVED'
    const isCardActive = discountCard.isActive
    
    // Card must be active, approved, and within validity period
    const isValid = isCardActive && isApproved && !isExpired && !isNotYetValid

    // Calculate discount rate (20% for all types in Philippines)
    const discountRate = 0.20 // 20% discount

    return NextResponse.json({
      hasDiscountCard: true,
      isValid,
      discountCard: {
        id: discountCard.id,
        discountType: discountCard.discountType,
        discountRate,
        discountPercentage: discountRate * 100,
        verificationStatus: discountCard.verificationStatus,
        isActive: discountCard.isActive,
        validFrom: discountCard.validFrom,
        validUntil: discountCard.validUntil,
        isAdminOverride: discountCard.isAdminOverride,
        overrideReason: discountCard.overrideReason,
        user: discountCard.user
      },
      validationChecks: {
        isActive: isCardActive,
        isApproved,
        isExpired,
        isNotYetValid,
        isValid
      }
    })
      } catch (error) {    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
