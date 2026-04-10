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

    const where = {
      OR: [
        { isVerified: false },
        { userType: 'PUBLIC' as const, isActive: false }
      ]
    }

    // Get users who are not verified or need approval
    const [pendingUsers, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          reasonForRegistration: true
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      users: pendingUsers,
      pagination: buildPaginationMetadata(pagination, total),
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
