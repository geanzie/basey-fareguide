import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

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
      } catch (error) {    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
