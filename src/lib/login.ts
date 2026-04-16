import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserType } from '@prisma/client'

import { getJWTSecret } from '@/lib/auth'
import { AUTH_SESSION_JWT_EXPIRES_IN, AUTH_SESSION_MAX_AGE_SECONDS } from '@/lib/authSession'
import { normalizePlateNumber } from '@/lib/incidents/penaltyRules'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import { serializeSessionUser } from '@/lib/serializers'

export interface LoginAttemptError {
  status: number
  body: Record<string, unknown>
  headers?: HeadersInit
}

export type LoginAttemptResult =
  | {
      ok: true
      token: string
      serializedUser: ReturnType<typeof serializeSessionUser>
    }
  | {
      ok: false
      error: LoginAttemptError
    }

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

async function resolveLoginUser(username: string) {
  const exactUser = await prisma.user.findUnique({
    where: { username },
  })

  if (exactUser) {
    return exactUser
  }

  const normalizedDriverUsername = normalizePlateNumber(username)

  if (!normalizedDriverUsername) {
    return null
  }

  // Driver usernames are plate-derived and normalized at creation time, so only
  // allow a case-insensitive fallback when the lookup resolves to exactly one user.
  const caseInsensitiveCandidates = await prisma.user.findMany({
    where: {
      username: {
        equals: normalizedDriverUsername,
        mode: 'insensitive',
      },
    },
  })

  if (caseInsensitiveCandidates.length !== 1) {
    return null
  }

  const [candidate] = caseInsensitiveCandidates
  return candidate.userType === UserType.DRIVER ? candidate : null
}

export async function authenticateLoginAttempt(
  request: NextRequest,
  credentials: { username: string; password: string },
): Promise<LoginAttemptResult> {
  const clientId = getClientIdentifier(request)
  const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.AUTH_LOGIN)

  if (!rateLimitResult.success) {
    return {
      ok: false,
      error: {
        status: 429,
        body: {
          message: `Too many login attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMITS.AUTH_LOGIN.maxAttempts),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000)),
        },
      },
    }
  }

  const username = credentials.username.trim()
  const password = credentials.password

  if (!username || !password) {
    return {
      ok: false,
      error: {
        status: 400,
        body: { message: 'Username and password are required' },
      },
    }
  }

  const user = await resolveLoginUser(username)

  if (!user) {
    return {
      ok: false,
      error: {
        status: 401,
        body: { message: 'Invalid credentials' },
      },
    }
  }

  const validPassword = await verifyPassword(password, user.password)

  if (!validPassword) {
    return {
      ok: false,
      error: {
        status: 401,
        body: { message: 'Invalid credentials' },
      },
    }
  }

  if (!user.isActive) {
    return {
      ok: false,
      error: {
        status: 403,
        body: { message: 'Account is not yet approved. Please wait for admin approval.' },
      },
    }
  }

  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      userType: user.userType,
    },
    getJWTSecret(),
    { expiresIn: AUTH_SESSION_JWT_EXPIRES_IN },
  )

  return {
    ok: true,
    token,
    serializedUser: serializeSessionUser(user),
  }
}

export function buildLoginErrorResponse(error: LoginAttemptError): NextResponse {
  return NextResponse.json(error.body, {
    status: error.status,
    headers: error.headers,
  })
}

export function applyLoginSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
}