import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Validate OTP format
function isValidOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp)
}

// Check if OTP has expired
function isOTPExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate
}

export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json()

    // Validate input
    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { message: 'Email address, OTP code, and new password are required' },
        { status: 400 }
      )
    }

    // Validate OTP format
    if (!isValidOTP(otp)) {
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

    // Find user with this email and OTP
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        passwordResetOtp: otp
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid OTP code or email address' },
        { status: 400 }
      )
    }

    // Check if OTP has expired
    if (!user.passwordResetOtpExpiry || isOTPExpired(user.passwordResetOtpExpiry)) {
      return NextResponse.json(
        { message: 'OTP code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetOtp: null,
        passwordResetOtpExpiry: null,
        loginAttempts: 0, // Reset failed login attempts
        lockedUntil: null // Unlock account if it was locked
      }
    })

    return NextResponse.json({
      message: 'Password successfully reset. You can now login with your new password.'
    })
      } catch (error) {    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
