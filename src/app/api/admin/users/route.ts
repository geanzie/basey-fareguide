import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      where: {
        userType: {
          in: ['ADMIN', 'DATA_ENCODER', 'ENFORCER']
        }
      },
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
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      users
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
