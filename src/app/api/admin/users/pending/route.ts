import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get users who are not verified or need approval
    const pendingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { isVerified: false },
          { userType: 'PUBLIC', isActive: false }
        ]
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
      users: pendingUsers
    })
  } catch (error) {
    console.error('Error fetching pending users:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
