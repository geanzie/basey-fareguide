import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeSessionUser } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request)

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        userType: true,
        isActive: true,
        isVerified: true,
      },
    })

    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: serializeSessionUser(currentUser) })
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}