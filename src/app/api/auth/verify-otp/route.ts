import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const { email, otp } = await request.json()

    // Validate input
    if (!email || !otp) {
      return NextResponse.json(
        { message: 'Email address and OTP code are required' },
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

    // Find user with this email and OTP
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        passwordResetOtp: otp
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        passwordResetOtpExpiry: true
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

    return NextResponse.json({
      valid: true,
      user: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
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
