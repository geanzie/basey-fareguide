import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { invalidateAuthUserCache } from '@/lib/auth'
import { applyLoginSessionCookie, issueSessionForUser } from '@/lib/login'
import { createOAuthUser } from '@/lib/oauth/signup'
import { clearSignupTicketCookie, readSignupTicket } from '@/lib/oauth/state'
import { CURRENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacyNotice'
import {
  consumeRateLimit,
  getClientIdentifier,
  logRateLimitHit,
  peekRateLimit,
  RATE_LIMITS,
} from '@/lib/rateLimit'

const PH_MOBILE_REGEX = /^(09|\+639)\d{9}$/

/**
 * Finishes a social sign-up: the caller holds a signup ticket cookie minted by
 * the OAuth callback and supplies the details the provider could not give us.
 *
 * Responds with `{ user, token }` and sets the session cookie, matching
 * /api/auth/login so a native client can consume the same endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)

    // The ticket is read first so the limit can be keyed on the provider
    // account rather than the IP: the caller already proved identity with the
    // provider, and a shared telco NAT must not lock out unrelated users.
    // Reading it is a signed-cookie decode, no database call.
    const ticket = readSignupTicket(request)

    if (!ticket) {
      return NextResponse.json(
        { message: 'Your sign-in session expired. Please sign in again.', code: 'oauth_ticket_expired' },
        { status: 401 },
      )
    }

    const rateLimitKey = ticket.providerAccountId
    const rateLimitResult = peekRateLimit(rateLimitKey, RATE_LIMITS.OAUTH_COMPLETE_REJECT)

    if (!rateLimitResult.success) {
      logRateLimitHit(RATE_LIMITS.OAUTH_COMPLETE_REJECT, 'oauth', rateLimitResult.retryAfter)
      return NextResponse.json(
        {
          message: `Too many registration attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } },
      )
    }

    // Only an attempt the server actually rejected spends budget. A request
    // that succeeds, or that never reached us because the connection dropped,
    // costs the user nothing.
    const rejected = <T extends NextResponse>(response: T): T => {
      consumeRateLimit(rateLimitKey, RATE_LIMITS.OAUTH_COMPLETE_REJECT)
      return response
    }

    const {
      phoneNumber,
      dateOfBirth,
      barangayResidence,
      idType,
      governmentId,
      privacyNoticeAcknowledged,
      privacyNoticeVersion,
    } = await request.json()

    if (privacyNoticeAcknowledged !== true) {
      return rejected(NextResponse.json(
        { message: 'You must acknowledge the Privacy Notice before creating an account.' },
        { status: 400 },
      ))
    }

    if (!privacyNoticeVersion || privacyNoticeVersion !== CURRENT_PRIVACY_NOTICE_VERSION) {
      return rejected(NextResponse.json(
        { message: 'Privacy Notice version mismatch. Please reload the page and try again.' },
        { status: 400 },
      ))
    }

    const normalizedPhone = typeof phoneNumber === 'string' ? phoneNumber.replace(/\s/g, '') : ''

    if (!PH_MOBILE_REGEX.test(normalizedPhone)) {
      return rejected(NextResponse.json(
        { message: 'Please enter a valid Philippine mobile number' },
        { status: 400 },
      ))
    }

    const normalizedGovernmentId = typeof governmentId === 'string' ? governmentId.trim() : ''
    const normalizedIdType = typeof idType === 'string' ? idType.trim() : ''
    const normalizedBarangay = typeof barangayResidence === 'string' ? barangayResidence.trim() : ''

    let user

    try {
      user = await createOAuthUser({
        provider: ticket.provider,
        providerAccountId: ticket.providerAccountId,
        email: ticket.email,
        firstName: ticket.firstName,
        lastName: ticket.lastName,
        phoneNumber: normalizedPhone,
        dateOfBirth: typeof dateOfBirth === 'string' && dateOfBirth ? dateOfBirth : null,
        barangayResidence: normalizedBarangay || null,
        idType: normalizedIdType || null,
        governmentId: normalizedGovernmentId || null,
        registrationIp: clientId,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target : []

        if (target.includes('email')) {
          return rejected(NextResponse.json(
            { message: 'Email address already registered. Please log in instead.' },
            { status: 409 },
          ))
        }

        if (target.includes('governmentId')) {
          return rejected(NextResponse.json(
            { message: 'Government ID Number is already registered' },
            { status: 409 },
          ))
        }

        if (target.includes('providerAccountId')) {
          return rejected(NextResponse.json(
            { message: 'This account is already linked. Please sign in again.' },
            { status: 409 },
          ))
        }

        return rejected(NextResponse.json(
          { message: 'Account details are already registered' },
          { status: 409 },
        ))
      }

      throw error
    }

    const { token, serializedUser } = await issueSessionForUser(user, request)
    invalidateAuthUserCache(user.id)

    const response = NextResponse.json({ user: serializedUser, token }, { status: 201 })
    applyLoginSessionCookie(response, token)
    clearSignupTicketCookie(response)

    return response
  } catch (error) {
    console.error('[OAUTH COMPLETE ERROR]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
