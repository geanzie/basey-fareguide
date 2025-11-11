import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { verifyAuth, requireRole, createAuthErrorResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and require ADMIN role
    const user = await verifyAuth(request)
    const adminUser = requireRole(user, ['ADMIN'])
    
    // Fetch all users (including PUBLIC users)
    const users = await prisma.user.findMany({
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
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      users
    })
  } catch (error) {
    // Handle authentication/authorization errors
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      return createAuthErrorResponse(error)
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
