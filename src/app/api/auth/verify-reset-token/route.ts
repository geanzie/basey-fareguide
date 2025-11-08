import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    // Validate input
    if (!token) {
      return NextResponse.json(
        { message: 'Reset token is required' },
        { status: 400 }
      )
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: {
          gte: new Date() // Token must not be expired
        }
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      user: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      }
    })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
