import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  userId: string
  username: string
  userType: string
  firstName: string
  lastName: string
}

/**
 * POST /api/admin/discount-cards/create
 * Admin-only endpoint to manually create/activate discount cards with override
 * Bypasses all validation requirements
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decodedToken: JWTPayload

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Admin-only authorization
    if (decodedToken.userType !== 'ADMIN') {
      return NextResponse.json(
        { 
          error: 'Forbidden. Only administrators can create discount cards with override.',
          requiredRole: 'ADMIN',
          currentRole: decodedToken.userType
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      userId,
      discountType,
      validFrom,
      validUntil,
      overrideReason,
      // Optional fields for documentation purposes
      fullName,
      dateOfBirth,
      idNumber,
      schoolName,
      disabilityType,
      notes
    } = body

    // Validation: Required fields
    if (!userId || !discountType || !validFrom || !validUntil || !overrideReason) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['userId', 'discountType', 'validFrom', 'validUntil', 'overrideReason']
        },
        { status: 400 }
      )
    }

    // Validate discount type
    const validDiscountTypes = ['SENIOR_CITIZEN', 'PWD', 'STUDENT']
    if (!validDiscountTypes.includes(discountType)) {
      return NextResponse.json(
        { 
          error: 'Invalid discount type',
          validTypes: validDiscountTypes
        },
        { status: 400 }
      )
    }

    // Validate dates
    const fromDate = new Date(validFrom)
    const untilDate = new Date(validUntil)
    const now = new Date()

    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    if (untilDate <= fromDate) {
      return NextResponse.json(
        { error: 'Valid until date must be after valid from date' },
        { status: 400 }
      )
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        isActive: true
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: 'Cannot create discount card for inactive user' },
        { status: 400 }
      )
    }

    // Check if user already has a discount card
    // This will be enabled after migration
    
    const existingCard = await prisma.discountCard.findUnique({
      where: { userId: userId }
    })
    
    if (existingCard) {
      return NextResponse.json(
        { 
          error: 'User already has a discount card',
          existingCard: {
            id: existingCard.id,
            discountType: existingCard.discountType,
            isActive: existingCard.isActive,
            validUntil: existingCard.validUntil
          }
        },
        { status: 409 }
      )
    }

    // Create discount card with admin override
    const discountCard = await prisma.discountCard.create({
      data: {
        userId: userId,
        discountType: discountType,
        
        // Use provided data or fall back to user profile
        fullName: fullName || `${targetUser.firstName} ${targetUser.lastName}`,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : targetUser.dateOfBirth || new Date(),
        
        // Optional documentation fields
        idNumber: idNumber || null,
        idType: idNumber ? 'Admin Override - No ID Required' : null,
        issuingAuthority: 'Municipal Administrator',
        
        // Student-specific
        schoolName: discountType === 'STUDENT' ? schoolName : null,
        schoolIdExpiry: discountType === 'STUDENT' && validUntil ? new Date(validUntil) : null,
        
        // PWD-specific
        disabilityType: discountType === 'PWD' ? disabilityType : null,
        pwdIdExpiry: discountType === 'PWD' && validUntil ? new Date(validUntil) : null,
        
        // Admin Override - KEY FEATURE
        isAdminOverride: true,
        overrideReason: overrideReason,
        overrideBy: decodedToken.userId,
        overrideAt: new Date(),
        
        // Auto-approve since it's admin override
        verificationStatus: 'APPROVED',
        verifiedBy: decodedToken.userId,
        verifiedAt: new Date(),
        verificationNotes: `Admin override by ${decodedToken.firstName} ${decodedToken.lastName}. Reason: ${overrideReason}${notes ? `. Additional notes: ${notes}` : ''}`,
        
        // Validity
        isActive: true,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        
        // Initialize usage tracking
        usageCount: 0,
        dailyUsageCount: 0,
        lastResetDate: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            phoneNumber: true
          }
        }
      }
    })

    // Create audit log
    await prisma.userVerificationLog.create({
      data: {
        userId: userId,
        action: 'DISCOUNT_CARD_ADMIN_OVERRIDE_CREATED',
        performedBy: decodedToken.userId,
        reason: overrideReason,
        evidence: JSON.stringify({
          discountCardId: discountCard.id,
          discountType: discountType,
          validFrom: validFrom,
          validUntil: validUntil,
          notes: notes || null,
          createdBy: `${decodedToken.firstName} ${decodedToken.lastName}`,
          timestamp: new Date().toISOString()
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Discount card created successfully with admin override',
      discountCard: {
        id: discountCard.id,
        userId: discountCard.userId,
        discountType: discountCard.discountType,
        fullName: discountCard.fullName,
        isActive: discountCard.isActive,
        validFrom: discountCard.validFrom,
        validUntil: discountCard.validUntil,
        isAdminOverride: discountCard.isAdminOverride,
        overrideReason: discountCard.overrideReason,
        overrideBy: discountCard.overrideBy,
        overrideAt: discountCard.overrideAt,
        verificationStatus: discountCard.verificationStatus,
        createdAt: discountCard.createdAt,
        user: discountCard.user
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating admin override discount card:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to create discount card',
        details: error.message || 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/discount-cards/create
 * Returns information about available users for discount card creation
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decodedToken: JWTPayload

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    if (decodedToken.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Get users without discount cards
    const eligibleUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        discountCard: null, // Will be enabled after migration
        userType: 'PUBLIC' // Only public users can have discount cards
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phoneNumber: true,
        barangayResidence: true,
        createdAt: true
      },
      orderBy: {
        lastName: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      eligibleUsers: eligibleUsers,
      count: eligibleUsers.length,
      discountTypes: [
        {
          value: 'SENIOR_CITIZEN',
          label: 'Senior Citizen (60+)',
          description: '20% fare discount for senior citizens'
        },
        {
          value: 'PWD',
          label: 'Person with Disability',
          description: '20% fare discount for PWDs'
        },
        {
          value: 'STUDENT',
          label: 'Student',
          description: '20% fare discount for students'
        }
      ]
    })

  } catch (error: any) {
    console.error('Error fetching eligible users:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch eligible users',
        details: error.message
      },
      { status: 500 }
    )
  }
}
