import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { UserType } from '@/generated/prisma'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  username: string
  userType: UserType
  isActive: boolean
}

/**
 * Gets the JWT secret from environment variables.
 * Throws an error if not configured.
 */
export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    console.error('CRITICAL: JWT_SECRET environment variable is not configured')
    throw new Error('Server configuration error: JWT_SECRET not set')
  }
  return secret
}

/**
 * Verifies the JWT token from the Authorization header or httpOnly cookie and returns the authenticated user.
 * Returns null if authentication fails.
 */
export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    let token: string | undefined

    // First, try to get token from Authorization header (for API clients)
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7) // Remove 'Bearer ' prefix
    }

    // If no Authorization header, try httpOnly cookie (for browser clients)
    if (!token) {
      token = request.cookies.get('auth-token')?.value
    }

    // If still no token, authentication failed
    if (!token) {
      return null
    }

    const decoded = jwt.verify(token, getJWTSecret()) as any
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        userType: true,
        isActive: true
      }
    })

    return user?.isActive ? user : null
  } catch (error) {
    return null
  }
}

/**
 * Requires authentication. Throws an error if user is not authenticated.
 * Use this in combination with try-catch to handle unauthorized access.
 */
export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Requires specific user roles. Throws an error if user doesn't have the required role.
 * Use this in combination with try-catch to handle forbidden access.
 */
export function requireRole(user: AuthUser | null, allowedRoles: UserType[]): AuthUser {
  const authenticated = requireAuth(user)
  if (!allowedRoles.includes(authenticated.userType)) {
    throw new Error('Forbidden')
  }
  return authenticated
}

/**
 * Helper function to create standardized error responses
 */
export function createAuthErrorResponse(error: unknown): NextResponse {
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { message: 'Unauthorized. Please login.' },
        { status: 401 }
      )
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json(
        { message: 'Access denied. Insufficient permissions.' },
        { status: 403 }
      )
    }
  }
  
  return NextResponse.json(
    { message: 'Internal server error' },
    { status: 500 }
  )
}
