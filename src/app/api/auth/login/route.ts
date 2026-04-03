import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getJWTSecret } from '@/lib/auth'
import { AUTH_SESSION_JWT_EXPIRES_IN, AUTH_SESSION_MAX_AGE_SECONDS } from '@/lib/authSession'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import { serializeSessionUser } from '@/lib/serializers'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.AUTH_LOGIN)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          message: `Too many login attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Limit': String(RATE_LIMITS.AUTH_LOGIN.maxAttempts),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000))
          }
        }
      )
    }

    const { username, password } = await request.json()

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { username }
    })
    
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Check if password is correct
    const validPassword = await bcrypt.compare(password, user.password)
    
    if (!validPassword) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Check if account is active and verified
    if (!user.isActive) {
      return NextResponse.json(
        { message: 'Account is not yet approved. Please wait for admin approval.' },
        { status: 403 }
      )
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        userType: user.userType 
      },
      getJWTSecret(),
      { expiresIn: AUTH_SESSION_JWT_EXPIRES_IN }
    )

    // Create response with user data
    const response = NextResponse.json({
      user: serializeSessionUser(user)
    })

    // Set httpOnly cookie for enhanced security
    // This cookie cannot be accessed by JavaScript, protecting against XSS
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'strict', // CSRF protection
      maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
      path: '/'
    })

    return response
  } catch (error) {
    console.error('[LOGIN ERROR]', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
