import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    // Validate input
    if (!username) {
      return NextResponse.json(
        { message: 'Username is required' },
        { status: 400 }
      )
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { username }
    })
    
    // For security, always return success even if user doesn't exist
    // This prevents username enumeration attacks
    if (!user) {
      return NextResponse.json({
        message: 'If the username exists, a password reset token has been generated. Please contact an administrator with your username to get your reset token.'
      })
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex')
    
    // Set token expiry to 1 hour from now
    const resetExpiry = new Date()
    resetExpiry.setHours(resetExpiry.getHours() + 1)

    // Update user with reset token
    await prisma.user.update({
      where: { username },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: resetExpiry
      }
    })

    // In a production system, you would send this token via email
    return NextResponse.json({
      message: 'If the username exists, a password reset token has been generated. Please contact an administrator with your username to get your reset token.',
      // In development, include the token. Remove this in production
      token: resetToken
    })

  } catch (error) {
    console.error('Password reset request error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
