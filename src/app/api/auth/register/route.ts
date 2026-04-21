import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.AUTH_REGISTER)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          message: `Too many registration attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
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

    const {
      username,
      password,
      firstName,
      lastName,
      email,
      phoneNumber,
      dateOfBirth,
      governmentId,
      idType,
      barangayResidence,
      userType,
      privacyNoticeAcknowledged,
      privacyNoticeVersion,
    } = await request.json()

    const normalizedUsername = typeof username === 'string' ? username.trim() : ''
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedGovernmentId = typeof governmentId === 'string' ? governmentId.trim() : ''
    const normalizedIdType = typeof idType === 'string' ? idType.trim() : ''
    const normalizedBarangayResidence = typeof barangayResidence === 'string' ? barangayResidence.trim() : ''

    // Validate required fields
    if (!normalizedUsername || !password || !firstName || !lastName || !normalizedEmail || !phoneNumber) {
      return NextResponse.json(
        { message: 'All required fields must be provided' },
        { status: 400 }
      )
    }

    // Validate privacy notice acknowledgment
    if (privacyNoticeAcknowledged !== true) {
      return NextResponse.json(
        { message: 'You must acknowledge the Privacy Notice before creating an account.' },
        { status: 400 }
      )
    }

    if (!privacyNoticeVersion || privacyNoticeVersion !== CURRENT_PRIVACY_NOTICE_VERSION) {
      return NextResponse.json(
        { message: 'Privacy Notice version mismatch. Please reload the page and try again.' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { message: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate idType is provided
    if (!normalizedIdType) {
      return NextResponse.json(
        { message: 'Government ID Type is required' },
        { status: 400 }
      )
    }

    // Validate governmentId is provided
    if (!normalizedGovernmentId) {
      return NextResponse.json(
        { message: 'Government ID Number is required' },
        { status: 400 }
      )
    }

    // Validate barangayResidence is provided
    if (!normalizedBarangayResidence) {
      return NextResponse.json(
        { message: 'Barangay of Residence is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (Philippine mobile)
    const phoneRegex = /^(09|\+639)\d{9}$/
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json(
        { message: 'Please enter a valid Philippine mobile number' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Validate user type
    const validUserTypes = ['PUBLIC', 'ENFORCER', 'DATA_ENCODER']
    if (!validUserTypes.includes(userType)) {
      return NextResponse.json(
        { message: 'Invalid user type' },
        { status: 400 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Set approval status based on user type
    // PUBLIC users are auto-approved, official roles need admin approval
    const isPublicUser = userType === 'PUBLIC'
    
    // Save user to database
    let newUser
    try {
      newUser = await prisma.user.create({
        data: {
          username: normalizedUsername,
          password: hashedPassword,
          firstName,
          lastName,
          email: normalizedEmail,
          phoneNumber,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          governmentId: normalizedGovernmentId,
          idType: normalizedIdType,
          barangayResidence: normalizedBarangayResidence,
          userType,
          isActive: isPublicUser,
          isVerified: isPublicUser,
          verifiedAt: isPublicUser ? new Date() : null,
          verifiedBy: isPublicUser ? 'AUTO_APPROVED' : null,
          privacyNoticeAcknowledgedAt: new Date(),
          privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : []

        if (target.includes('username')) {
          return NextResponse.json(
            { message: 'Username already taken' },
            { status: 409 }
          )
        }

        if (target.includes('email')) {
          return NextResponse.json(
            { message: 'Email address already registered' },
            { status: 409 }
          )
        }

        if (target.includes('governmentId')) {
          return NextResponse.json(
            { message: 'Government ID Number is already registered' },
            { status: 409 }
          )
        }

        return NextResponse.json(
          { message: 'Account details are already registered' },
          { status: 409 }
        )
      }

      throw error
    }

    const message = isPublicUser 
      ? 'Registration successful! You can now log in to your account.'
      : 'Registration successful! Your account will be activated after admin approval.'

    return NextResponse.json({
      message,
      userId: newUser.id,
      requiresApproval: !isPublicUser,
      canLoginImmediately: isPublicUser
    }, { status: 201 })
  } catch (error) {
    console.error('[REGISTER ERROR]', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
