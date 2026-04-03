import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import { getPasswordResetEmailCapability, sendOTPEmail } from '@/lib/email'

// Generate a 6-digit OTP code
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Get OTP expiry date (10 minutes from now)
function getOTPExpiry(): Date {
  const expiry = new Date()
  expiry.setMinutes(expiry.getMinutes() + 10)
  return expiry
}

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

    const { email } = await request.json()

    // Validate input
    if (!email) {
      return NextResponse.json(
        { message: 'Email address is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    const emailCapability = getPasswordResetEmailCapability()
    if (!emailCapability.available) {
      console.error('Password reset email is unavailable:', emailCapability.reason)
      return NextResponse.json(
        { message: 'Password reset email is temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() }
    })
    
    // For security, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return NextResponse.json({
        message: 'If this email is registered, an OTP code has been sent. Please check your inbox and spam folder.'
      })
    }

    // Check if user has an email
    if (!user.email) {
      return NextResponse.json({
        message: 'If this email is registered, an OTP code has been sent. Please check your inbox and spam folder.'
      })
    }

    // Generate a 6-digit OTP
    const otp = generateOTP()
    const otpExpiry = getOTPExpiry()

    // Update user with OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtp: otp,
        passwordResetOtpExpiry: otpExpiry
      }
    })

    // Send OTP via email
    const emailResult = await sendOTPEmail(user.email, user.username, otp)

    if (emailResult.success) {
      if (emailResult.mode === 'development_console') {
        return NextResponse.json({
          message: 'OTP code generated in development mode. Check the server console for the code.',
          deliveryMode: 'development_console'
        })
      }

      // Partially mask email
      const [localPart, domain] = user.email.split('@')
      const maskedEmail = localPart.length > 2 
        ? `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`
        : `***@${domain}`

      return NextResponse.json({
        message: 'A 6-digit OTP code has been sent to your email address. The code is valid for 10 minutes.',
        email: maskedEmail,
        deliveryMode: 'provider'
      })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtp: null,
        passwordResetOtpExpiry: null,
      },
    })

    console.error('Failed to send password reset OTP email:', emailResult.reason)

    return NextResponse.json(
      { message: 'Password reset email is temporarily unavailable. Please try again later.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Password reset request error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
