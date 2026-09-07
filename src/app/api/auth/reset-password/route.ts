import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
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

    const { email, otp, newPassword } = await request.json()

    // Validate input
    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { message: 'Email address, OTP code, and new password are required' },
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

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Looked up by email alone (not email+otp): a wrong guess still needs to
    // land on the right user's row so its attempt counter is the one charged.
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
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

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and clear OTP. passwordResetOtpAttempts resets to 0 so
    // it is never inherited by a future reset issued for this account.
    await prisma.user.update({
      where: { id: user!.id },
      data: {
        password: hashedPassword,
        hasUsablePassword: true,
        passwordResetOtp: null,
        passwordResetOtpExpiry: null,
        passwordResetOtpAttempts: 0,
        loginAttempts: 0, // Reset failed login attempts
        lockedUntil: null // Unlock account if it was locked
      }
    })

    return NextResponse.json({
      message: 'Password successfully reset. You can now login with your new password.'
    })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
