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
 * The handoff ticket is a bearer credential that travels through a deep link,
 * where the OS may log it. The app exchanges it the moment the browser closes,
 * so it lives far shorter than the session token it buys.
 */
const HANDOFF_TICKET_TTL_SECONDS = 60

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

/** The mobile app's own scheme, from `mobile/app.json`. */
const NATIVE_SCHEME = 'baseyfare:'
/**
 * Expo Go serves the app from an `exp://` URL rather than the app's scheme, so
 * a developer testing there needs these too. They are accepted off production
 * only: widening the allowlist on the deployed server would let anyone with an
 * Expo dev server collect handoff tickets.
 */
const DEV_SCHEMES = ['exp:', 'exp+basey-farecheck:']

/**
 * Validates a deep-link target the OAuth callback may bounce back to.
 *
 * This is an allowlist rather than a format check on purpose: /start would
 * otherwise be an open redirect that hands a session ticket to whatever URL the
 * caller asked for. Returns null for anything not explicitly permitted.
 */
export function resolveNativeRedirect(raw: string | null | undefined): string | null {
  if (!raw) {
    return null
  }

  let url: URL

  try {
    url = new URL(raw)
  } catch {
    return null
  }

  const allowed =
    url.protocol === NATIVE_SCHEME ||
    (process.env.NODE_ENV !== 'production' && DEV_SCHEMES.includes(url.protocol))

  return allowed ? url.toString() : null
}

/** Appends a query parameter to a deep link, preserving any it already carries. */
export function buildNativeRedirect(
  nativeRedirectUri: string,
  params: Record<string, string>,
): string {
  const url = new URL(nativeRedirectUri)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return url.toString()
}

export interface OAuthStatePayload {
  provider: OAuthProvider
  state: string
  codeVerifier: string
  redirectUri: string
  /**
   * Set when the sign-in was started by the mobile app. Its presence is what
   * switches the callback from web redirects to deep links; it rides inside the
   * signed state cookie so it cannot be swapped after /start validated it.
   */
  nativeRedirectUri?: string
}

/** Creates the CSRF state and PKCE pair for an authorization request. */
export function createOAuthState(
  provider: OAuthProvider,
  redirectUri: string,
  nativeRedirectUri?: string | null,
): {
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
      ...(nativeRedirectUri ? { nativeRedirectUri } : {}),
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

/**
 * Reads the native redirect out of the state cookie without checking the state
 * parameter. The callback needs somewhere to send a native caller even when the
 * CSRF check is what failed — otherwise the app sits on an HTML error page
 * waiting for a deep link that never comes. It is only ever used to pick a
 * redirect target, never to authenticate anything.
 */
export function peekNativeRedirect(request: NextRequest): string | null {
  const cookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (!cookie) {
    return null
  }

  try {
    const payload = jwt.verify(cookie, getJWTSecret()) as OAuthStatePayload
    return resolveNativeRedirect(payload.nativeRedirectUri)
  } catch {
    return null
  }
}

export interface SignupTicket {
  typ: 'oauth_signup'
  provider: OAuthProvider
  providerAccountId: string
  email: string
  firstName: string
  lastName: string
}

/**
 * Signs the sign-up ticket. Shared by the cookie the web flow sets and the deep
 * link the native flow returns, so the two cannot drift apart.
 */
export function signSignupTicket(ticket: Omit<SignupTicket, 'typ'>): string {
  return jwt.sign({ ...ticket, typ: 'oauth_signup' }, getJWTSecret(), {
    expiresIn: SIGNUP_TICKET_TTL_SECONDS,
  })
}

export function applySignupTicketCookie(
  response: NextResponse,
  ticket: Omit<SignupTicket, 'typ'>,
): void {
  response.cookies.set(
    OAUTH_SIGNUP_COOKIE,
    signSignupTicket(ticket),
    cookieOptions(SIGNUP_TICKET_TTL_SECONDS),
  )
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

export interface HandoffTicket {
  typ: 'oauth_handoff'
  userId: string
}

/**
 * Mints the ticket the native callback deep-links back with. It stands in for
 * the session cookie the web flow would set: it names a user the server has
 * already authenticated against the provider, and buys exactly one session at
 * /api/auth/oauth/native/exchange.
 */
export function signHandoffTicket(userId: string): string {
  return jwt.sign({ typ: 'oauth_handoff', userId }, getJWTSecret(), {
    expiresIn: HANDOFF_TICKET_TTL_SECONDS,
  })
}

export function readHandoffTicket(raw: unknown): HandoffTicket | null {
  if (typeof raw !== 'string' || !raw) {
    return null
  }

  try {
    const payload = jwt.verify(raw, getJWTSecret()) as HandoffTicket

    if (payload.typ !== 'oauth_handoff' || typeof payload.userId !== 'string' || !payload.userId) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
