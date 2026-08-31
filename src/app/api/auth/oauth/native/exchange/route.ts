import { NextRequest, NextResponse } from 'next/server'

import { invalidateAuthUserCache } from '@/lib/auth'
import { issueSessionForUser } from '@/lib/login'
import { readHandoffTicket } from '@/lib/oauth/state'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier, logRateLimitHit, RATE_LIMITS } from '@/lib/rateLimit'

/**
 * Trades the handoff ticket the OAuth callback deep-linked to the native app
 * for a real session.
 *
 * This is the native counterpart of the session cookie the web callback sets:
 * the app cannot read an httpOnly cookie, so it needs the JWT in the body the
 * way /api/auth/login returns it. Deliberately sets no cookie — the caller is
 * not a browser.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = checkRateLimit(
      getClientIdentifier(request),
      RATE_LIMITS.OAUTH_NATIVE_EXCHANGE,
    )

    if (!rateLimitResult.success) {
      logRateLimitHit(RATE_LIMITS.OAUTH_NATIVE_EXCHANGE, 'ip', rateLimitResult.retryAfter)
      return NextResponse.json(
        {
          message: `Too many sign-in attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
      )
    }

    const body = await request.json().catch(() => ({}))
    const ticket = readHandoffTicket(body?.ticket)

    if (!ticket) {
      return NextResponse.json(
        { message: 'Your sign-in session expired. Please sign in again.', code: 'oauth_ticket_expired' },
        { status: 401 },
      )
    }

    const user = await prisma.user.findUnique({ where: { id: ticket.userId } })

    if (!user) {
      return NextResponse.json(
        { message: 'Your sign-in session expired. Please sign in again.', code: 'oauth_ticket_expired' },
        { status: 401 },
      )
    }

    // Re-checked rather than trusted from the callback: the ticket is only a
    // minute old, but an admin could have deactivated the account inside it.
    if (!user.isActive) {
      return NextResponse.json(
        { message: 'Your account is not yet approved. Please wait for admin approval.', code: 'oauth_inactive' },
        { status: 403 },
      )
    }

    const { token, serializedUser } = await issueSessionForUser(user, request)
    invalidateAuthUserCache(user.id)

    return NextResponse.json({ user: serializedUser, token })
  } catch (error) {
    console.error('[OAUTH NATIVE EXCHANGE ERROR]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
