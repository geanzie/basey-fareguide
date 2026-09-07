import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import { checkOTPGuess, isValidOTPFormat } from '@/lib/passwordResetOtp'

export async function POST(request: NextRequest) {
  try {
    // Per-IP throttle on guessing volume. The per-account attempt counter
    // below is the real bound (it holds regardless of source IP); this only
    // slows one source hammering many different accounts.
    const clientId = getClientIdentifier(request)
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.AUTH_OTP_VERIFY)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          message: `Too many attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
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

    const { email, otp } = await request.json()

    // Validate input
    if (!email || !otp) {
      return NextResponse.json(
        { message: 'Email address and OTP code are required' },
        { status: 400 }
      )
    }

    // Validate OTP format
    if (!isValidOTPFormat(otp)) {
      return NextResponse.json(
        { message: 'Invalid OTP format. Please enter a 6-digit code.' },
        { status: 400 }
      )
    }

    // Looked up by email alone (not email+otp): a wrong guess still needs to
    // land on the right user's row so its attempt counter is the one charged.
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        passwordResetOtp: true,
        passwordResetOtpExpiry: true,
        passwordResetOtpAttempts: true
      }
    })

    const outcome = checkOTPGuess(user, otp)

    if (!outcome.ok) {
      if (outcome.reason === 'TOO_MANY_ATTEMPTS') {
        return NextResponse.json(
          { message: 'Too many incorrect attempts. Please request a new OTP code.' },
          { status: 429 }
        )
      }

      if (outcome.reason === 'EXPIRED') {
        return NextResponse.json(
          { message: 'OTP code has expired. Please request a new one.' },
          { status: 400 }
        )
      }

      // MISMATCH charges the guess budget. NO_ACTIVE_RESET (no user, or no
      // reset in progress) does not — there is no budget to charge, and the
      // response is identical either way so this never discloses which case
      // occurred (no email enumeration).
      if (outcome.reason === 'MISMATCH' && user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordResetOtpAttempts: { increment: 1 } }
        })
      }

      return NextResponse.json(
        { message: 'Invalid OTP code or email address' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      user: {
        username: user!.username,
        firstName: user!.firstName,
        lastName: user!.lastName
      }
    })
  } catch (error) {
    console.error('OTP verification error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
