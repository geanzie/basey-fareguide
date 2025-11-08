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
 * GET /api/admin/discount-cards
 * List all discount cards with filtering and search
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

    // Admin-only authorization
    if (decodedToken.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const discountType = searchParams.get('discountType') || undefined
    const isActive = searchParams.get('isActive')
    const isAdminOverride = searchParams.get('isAdminOverride')
    const search = searchParams.get('search') || undefined

    // Build where clause
    const where: any = {}

    if (discountType) {
      where.discountType = discountType
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    if (isAdminOverride !== null && isAdminOverride !== undefined) {
      where.isAdminOverride = isAdminOverride === 'true'
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } },
        { user: { 
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } }
          ]
        }}
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Fetch discount cards (this will work after migration)
    // @ts-ignore - Will be available after migration
    const [discountCards, totalCount] = await Promise.all([
      prisma.discountCard.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              barangayResidence: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      // @ts-ignore
      prisma.discountCard.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      discountCards,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        discountType,
        isActive,
        isAdminOverride,
        search
      }
    })

  } catch (error: any) {
    console.error('Error fetching discount cards:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch discount cards',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/discount-cards
 * Update discount card status (activate/deactivate/suspend)
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { discountCardId, action, reason } = body

    if (!discountCardId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: discountCardId, action' },
        { status: 400 }
      )
    }

    const validActions = ['activate', 'deactivate', 'suspend', 'approve', 'reject']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Valid actions: ${validActions.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if card exists
    // @ts-ignore
    const existingCard = await prisma.discountCard.findUnique({
      where: { id: discountCardId },
      include: { user: true }
    })

    if (!existingCard) {
      return NextResponse.json(
        { error: 'Discount card not found' },
        { status: 404 }
      )
    }

    // Perform action
    let updateData: any = {}
    let logAction = ''

    switch (action) {
      case 'activate':
        updateData = { isActive: true, verificationStatus: 'APPROVED' }
        logAction = 'DISCOUNT_CARD_ACTIVATED'
        break
      case 'deactivate':
        updateData = { isActive: false }
        logAction = 'DISCOUNT_CARD_DEACTIVATED'
        break
      case 'suspend':
        updateData = { isActive: false, verificationStatus: 'SUSPENDED' }
        logAction = 'DISCOUNT_CARD_SUSPENDED'
        break
      case 'approve':
        updateData = { 
          verificationStatus: 'APPROVED',
          isActive: true,
          verifiedBy: decodedToken.userId,
          verifiedAt: new Date()
        }
        logAction = 'DISCOUNT_CARD_APPROVED'
        break
      case 'reject':
        updateData = { 
          verificationStatus: 'REJECTED',
          isActive: false,
          rejectionReason: reason || 'Rejected by administrator'
        }
        logAction = 'DISCOUNT_CARD_REJECTED'
        break
    }

    // Update discount card
    // @ts-ignore
    const updatedCard = await prisma.discountCard.update({
      where: { id: discountCardId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Create audit log
    await prisma.userVerificationLog.create({
      data: {
        userId: existingCard.userId,
        action: logAction,
        performedBy: decodedToken.userId,
        reason: reason || `Admin ${action} action`,
        evidence: JSON.stringify({
          discountCardId: discountCardId,
          previousStatus: existingCard.verificationStatus,
          newStatus: updateData.verificationStatus,
          previousActive: existingCard.isActive,
          newActive: updateData.isActive,
          performedBy: `${decodedToken.firstName} ${decodedToken.lastName}`,
          timestamp: new Date().toISOString()
        }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    return NextResponse.json({
      success: true,
      message: `Discount card ${action}d successfully`,
      discountCard: updatedCard
    })

  } catch (error: any) {
    console.error('Error updating discount card:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to update discount card',
        details: error.message
      },
      { status: 500 }
    )
  }
}
