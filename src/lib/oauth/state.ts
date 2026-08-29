import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { OAuthProvider } from '@prisma/client'

import { getJWTSecret } from '@/lib/auth'

export const OAUTH_STATE_COOKIE = 'oauth-state'
export const OAUTH_SIGNUP_COOKIE = 'oauth-signup'

const STATE_TTL_SECONDS = 10 * 60
const SIGNUP_TICKET_TTL_SECONDS = 15 * 60

/**
 * OAuth cookies must be sameSite 'lax', not 'strict' like the session cookie:
 * the provider redirect back to the callback is a cross-site navigation, and a
 * strict cookie would not be sent with it.
 */
function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  }
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

export interface OAuthStatePayload {
  provider: OAuthProvider
  state: string
  codeVerifier: string
  redirectUri: string
}

/** Creates the CSRF state and PKCE pair for an authorization request. */
export function createOAuthState(provider: OAuthProvider, redirectUri: string): {
  payload: OAuthStatePayload
  codeChallenge: string
} {
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())

  return {
    payload: {
      provider,
      state: base64url(crypto.randomBytes(32)),
      codeVerifier,
      redirectUri,
    },
    codeChallenge,
  }
}

export function applyOAuthStateCookie(response: NextResponse, payload: OAuthStatePayload): void {
  const token = jwt.sign(payload, getJWTSecret(), { expiresIn: STATE_TTL_SECONDS })
  response.cookies.set(OAUTH_STATE_COOKIE, token, cookieOptions(STATE_TTL_SECONDS))
}

export function clearOAuthStateCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 })
}

/**
 * Reads the state cookie and checks it against the state the provider echoed
 * back. Returns null on any mismatch, expiry, or tampering.
 */
export function readOAuthState(
  request: NextRequest,
  provider: OAuthProvider,
  returnedState: string | null,
): OAuthStatePayload | null {
  const cookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (!cookie || !returnedState) {
    return null
  }

  let payload: OAuthStatePayload

  try {
    payload = jwt.verify(cookie, getJWTSecret()) as OAuthStatePayload
  } catch {
    return null
  }

  if (payload.provider !== provider || typeof payload.state !== 'string') {
    return null
  }

  const expected = Buffer.from(payload.state)
  const actual = Buffer.from(returnedState)

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null
  }

  return payload
}

export interface SignupTicket {
  typ: 'oauth_signup'
  provider: OAuthProvider
  providerAccountId: string
  email: string
  firstName: string
  lastName: string
}

export function applySignupTicketCookie(
  response: NextResponse,
  ticket: Omit<SignupTicket, 'typ'>,
): void {
  const token = jwt.sign({ ...ticket, typ: 'oauth_signup' }, getJWTSecret(), {
    expiresIn: SIGNUP_TICKET_TTL_SECONDS,
  })
  response.cookies.set(OAUTH_SIGNUP_COOKIE, token, cookieOptions(SIGNUP_TICKET_TTL_SECONDS))
}

export function clearSignupTicketCookie(response: NextResponse): void {
  response.cookies.set(OAUTH_SIGNUP_COOKIE, '', { ...cookieOptions(0), maxAge: 0 })
}

export function readSignupTicket(request: NextRequest): SignupTicket | null {
  return parseSignupTicket(request.cookies.get(OAUTH_SIGNUP_COOKIE)?.value)
}

/** Ticket reader for server components, which read cookies via `next/headers`. */
export function parseSignupTicket(cookie: string | undefined): SignupTicket | null {
  if (!cookie) {
    return null
  }

  try {
    const payload = jwt.verify(cookie, getJWTSecret()) as SignupTicket

    if (payload.typ !== 'oauth_signup' || !payload.providerAccountId || !payload.email) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
