import { NextRequest, NextResponse } from 'next/server'

import { buildPaginationMetadata, parsePaginationParams } from '@/lib/api/pagination'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'
import type { FeedbackStatusCountsDto } from '@/lib/contracts'
import {
  FEEDBACK_STATUSES,
  isFeedbackCategory,
  isFeedbackStatus,
} from '@/lib/feedback/categories'
import { prisma } from '@/lib/prisma'
import { serializeAdminUserFeedback } from '@/lib/serializers'

const FEEDBACK_SELECT = {
  id: true,
  userId: true,
  category: true,
  rating: true,
  message: true,
  status: true,
  reviewedById: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { firstName: true, lastName: true, username: true, userType: true },
  },
  reviewedBy: {
    select: { firstName: true, lastName: true, username: true },
  },
} as const

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim()
    const pagination = parsePaginationParams(searchParams, {
      defaultLimit: 20,
      maxLimit: 100,
    })

    // An unrecognized filter value is treated as "no filter" rather than a 400 —
    // the chips only ever send known values.
    const where = {
      ...(isFeedbackStatus(status) ? { status } : {}),
      ...(isFeedbackCategory(category) ? { category } : {}),
      ...(search ? { message: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [rows, total, grouped] = await Promise.all([
      prisma.userFeedback.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: FEEDBACK_SELECT,
      }),
      prisma.userFeedback.count({ where }),
      prisma.userFeedback.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    // Counts cover the whole table, not the filtered page — the chips show what
    // is waiting overall.
    const counts = FEEDBACK_STATUSES.reduce<FeedbackStatusCountsDto>(
      (acc, value) => {
        const match = grouped.find((entry) => entry.status === value)
        acc[value] = match?._count._all ?? 0
        acc.all += acc[value]
        return acc
      },
      { all: 0, NEW: 0, REVIEWED: 0, RESOLVED: 0 },
    )

    return NextResponse.json({
      feedback: rows.map(serializeAdminUserFeedback),
      pagination: buildPaginationMetadata(pagination, total),
      counts,
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
