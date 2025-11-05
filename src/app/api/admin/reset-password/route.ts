import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { verifyAuth, requireRole, createAuthErrorResponse } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const currentUser = await verifyAuth(request)
    requireRole(currentUser, ['ADMIN'])

    const { userId, action } = await request.json()

    // Validate input
    if (!userId || !action) {
      return NextResponse.json(
        { message: 'User ID and action are required' },
        { status: 400 }
      )
    }

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        userType: true
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    if (action === 'generate-token') {
      // Generate a secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex')
      
      // Set token expiry to 24 hours from now (longer for admin-generated tokens)
      const resetExpiry = new Date()
      resetExpiry.setHours(resetExpiry.getHours() + 24)

      // Update user with reset token
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpiry: resetExpiry
        }
      })

      return NextResponse.json({
        message: 'Password reset token generated successfully',
        token: resetToken,
        expiresAt: resetExpiry,
        user: {
          username: targetUser.username,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        }
      })
    }

    if (action === 'set-password') {
      const { newPassword } = await request.json()

      if (!newPassword) {
        return NextResponse.json(
          { message: 'New password is required' },
          { status: 400 }
        )
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return NextResponse.json(
          { message: 'Password must be at least 8 characters long' },
          { status: 400 }
        )
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 12)

      // Update password and clear any reset tokens
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null,
          loginAttempts: 0,
          lockedUntil: null
        }
      })

      return NextResponse.json({
        message: 'Password successfully reset',
        user: {
          username: targetUser.username,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        }
      })
    }

    return NextResponse.json(
      { message: 'Invalid action. Use "generate-token" or "set-password"' },
      { status: 400 }
    )

  } catch (error) {
    return createAuthErrorResponse(error)
  }
}
