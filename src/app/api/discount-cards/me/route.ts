import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PUBLIC_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import {
  buildDiscountCardResponse,
  evaluateDiscountCardPolicy
} from '@/lib/discountCardPolicy'
import { serializeDiscountCard } from '@/lib/serializers'

/**
 * GET /api/discount-cards/me
 * Retrieve the authenticated user's active discount card
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestRole(request, [...PUBLIC_ONLY])

    // Get user's discount card
    const discountCard = await prisma.discountCard.findUnique({
      where: { 
        userId: user.id
      },
      select: {
        id: true,
        userId: true,
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

    const evaluation = evaluateDiscountCardPolicy(discountCard, { userId: user.id })
    const responseCard = buildDiscountCardResponse(discountCard, evaluation)

    return NextResponse.json({
      hasDiscountCard: true,
      isValid: evaluation.isValid,
      discountCard: serializeDiscountCard(responseCard),
      validationChecks: responseCard.validationChecks
    })
  } catch (error) {
    const authError = createAuthErrorResponse(error)
    if (authError.status !== 500) {
      return authError
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    )
  }
}
