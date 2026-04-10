import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])
    const { searchParams } = new URL(request.url)
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 50,
      maxLimit: 100,
    })
    
    const [users, total, active, pending, usersByType] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          userType: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
          governmentId: true,
          barangayResidence: true,
          reasonForRegistration: true,
          phoneNumber: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.user.count(),
      prisma.user.count({
        where: {
          isActive: true,
        },
      }),
      prisma.user.count({
        where: {
          isVerified: false,
        },
      }),
      prisma.user.groupBy({
        by: ['userType'],
        _count: {
          _all: true,
        },
      }),
    ])

    const byType = Object.fromEntries(
      usersByType.map((group) => [group.userType, group._count._all]),
    )

    return NextResponse.json({
      success: true,
      users,
      pagination: buildPaginationMetadata(pagination, total),
      summary: {
        total,
        active,
        pending,
        byType,
      },
    })
  } catch (error) {
    const authError = createAuthErrorResponse(error)
    if (authError.status !== 500) {
      return authError
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
