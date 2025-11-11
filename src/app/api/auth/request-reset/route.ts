import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.AUTH_RESET)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          message: `Too many password reset attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter)
          }
        }
      )
    }

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

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(
      user.username, // Using username as email for now - update when email field is added
      user.username,
      resetToken
    )

    if (emailSent) {
      return NextResponse.json({
        message: 'Password reset instructions have been sent to your email address.'
      })
    } else {
      // Fallback: Log token for admin retrieval if email fails
      console.log(`Password reset requested for user: ${username}`)
      console.log(`Reset token (admin only - email failed): ${resetToken}`)
      
      return NextResponse.json({
        message: 'Password reset token generated. Please contact an administrator if you did not receive the email.'
      })
    }
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
