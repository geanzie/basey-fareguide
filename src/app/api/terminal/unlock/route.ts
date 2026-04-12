import { NextRequest, NextResponse } from 'next/server'
import { UserType } from '@prisma/client'

import {
  createAuthErrorResponse,
  requireRole,
  verifyAuthWithSelect,
} from '@/lib/auth'
import { verifyPassword } from '@/lib/login'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'
import {
  applyTerminalUnlockCookie,
  clearTerminalUnlockCookie,
  createTerminalUnlockSession,
  invalidateTerminalUnlockSession,
} from '@/lib/terminal/session'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthWithSelect(request, { password: true })

    requireRole(user, [UserType.ENFORCER])

    if (!user) {
      throw new Error('Unauthorized')
    }

    const rateLimitKey = `terminal-unlock:${user.id}:${getClientIdentifier(request)}`
    const body = await request.json()
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!password) {
      return NextResponse.json({ message: 'Password is required.' }, { status: 400 })
    }

    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.TERMINAL_UNLOCK)

      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            message: `Too many unlock attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimitResult.retryAfter),
            },
          },
        )
      }

      return NextResponse.json({ message: 'Invalid password.' }, { status: 401 })
    }

    await invalidateTerminalUnlockSession(request)
    const session = await createTerminalUnlockSession(user.id)

    const response = NextResponse.json({
      unlocked: true,
      expiresAt: session.expiresAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      message: 'QR terminal unlocked.',
    })
    applyTerminalUnlockCookie(response, session.token)

    return response
  } catch (error) {
    return createAuthErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await invalidateTerminalUnlockSession(request)

    const response = NextResponse.json({
      unlocked: false,
      expiresAt: null,
      lastActivityAt: null,
      message: 'QR terminal locked.',
    })
    clearTerminalUnlockCookie(response)

    return response
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    )
  }
}