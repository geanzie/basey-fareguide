import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ADMIN_ONLY, createAuthErrorResponse, requireRequestRole } from '@/lib/auth'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(raw ?? String(DEFAULT_LIMIT), 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(parsed, MAX_LIMIT)
}

export async function GET(request: NextRequest) {
  try {
    await requireRequestRole(request, [...ADMIN_ONLY])

    const { searchParams } = new URL(request.url)
    const limit = parseLimit(searchParams.get('limit'))

    const users = await prisma.user.findMany({
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userType: true,
        isActive: true
      },
      where: {
        isActive: true
      },
      orderBy: {
        firstName: 'asc'
      }
    })

    return NextResponse.json({
      users
    })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
