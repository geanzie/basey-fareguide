import { NextRequest, NextResponse } from 'next/server'
import { UserType } from '@prisma/client'

import { invalidateAuthUserCache } from '@/lib/auth'
import { getAuthenticatedHomeRoute, LOGIN_ROUTE, SOCIAL_SIGNUP_ROUTE } from '@/lib/authRoutes'
import { applyLoginSessionCookie, issueSessionForUser } from '@/lib/login'
import {
  buildRedirectUri,
  exchangeCodeForProfile,
  isProviderConfigured,
  resolveProviderSlug,
} from '@/lib/oauth/providers'
import {
  applySignupTicketCookie,
  buildNativeRedirect,
  clearOAuthStateCookie,
  peekNativeRedirect,
  readOAuthState,
  signHandoffTicket,
  signSignupTicket,
} from '@/lib/oauth/state'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier, logRateLimitHit, RATE_LIMITS } from '@/lib/rateLimit'

function failure(request: NextRequest, code: string, nativeRedirectUri: string | null): NextResponse {
  const response = nativeRedirectUri
    ? NextResponse.redirect(buildNativeRedirect(nativeRedirectUri, { error: code }))
    : NextResponse.redirect(new URL(`${LOGIN_ROUTE}?error=${code}`, request.url))

  clearOAuthStateCookie(response)
  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  // Read straight off the state cookie before any check runs: a native caller
  // has to be answered with a deep link even when the failure is the CSRF check
  // itself, or its auth session hangs on an HTML page.
  const nativeRedirectUri = peekNativeRedirect(request)

  try {
    const { provider: slug } = await params
    const provider = resolveProviderSlug(slug)

    if (!provider || !isProviderConfigured(provider)) {
      return NextResponse.json({ message: 'Sign-in provider not available' }, { status: 404 })
    }

    const rateLimitResult = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.OAUTH_REDIRECT)

    if (!rateLimitResult.success) {
      logRateLimitHit(RATE_LIMITS.OAUTH_REDIRECT, 'ip', rateLimitResult.retryAfter)
      return failure(request, 'oauth_rate_limited', nativeRedirectUri)
    }

    if (request.nextUrl.searchParams.get('error')) {
      return failure(request, 'oauth_denied', nativeRedirectUri)
    }

    const state = readOAuthState(request, provider, request.nextUrl.searchParams.get('state'))
    const code = request.nextUrl.searchParams.get('code')

    if (!state || !code) {
      return failure(request, 'oauth_state', nativeRedirectUri)
    }

    const profile = await exchangeCodeForProfile({
      provider,
      code,
      codeVerifier: state.codeVerifier,
      // Providers require the redirect_uri on exchange to match the one used at
      // authorize time, so reuse the value carried in the state cookie.
      redirectUri: state.redirectUri || buildRedirectUri(provider, request.nextUrl.origin),
    })

    if (!profile.email) {
      // Facebook accounts registered with a phone number have no email to match on.
      return failure(request, 'oauth_no_email', nativeRedirectUri)
    }

    const email = profile.email.trim().toLowerCase()

    // Already-linked identity: straight to a session.
    const linked = await prisma.userOAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    })

    if (linked) {
      if (!linked.user.isActive) {
        return failure(request, 'oauth_inactive', nativeRedirectUri)
      }

      await prisma.userOAuthAccount.update({
        where: { id: linked.id },
        data: { lastLoginAt: new Date(), email },
      })

      return await redirectWithSession(request, linked.user, nativeRedirectUri)
    }

    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
      // Social sign-in serves PUBLIC users only: a provider account matching a
      // staff email must never mint a privileged session.
      if (existing.userType !== UserType.PUBLIC) {
        return failure(request, 'oauth_staff_account', nativeRedirectUri)
      }

      if (!existing.isActive) {
        return failure(request, 'oauth_inactive', nativeRedirectUri)
      }

      if (!profile.emailVerified) {
        return failure(request, 'oauth_unverified_email', nativeRedirectUri)
      }

      await prisma.userOAuthAccount.create({
        data: {
          userId: existing.id,
          provider,
          providerAccountId: profile.providerAccountId,
          email,
          lastLoginAt: new Date(),
        },
      })

      return await redirectWithSession(request, existing, nativeRedirectUri)
    }

    // No account yet. Hold the verified identity in a short-lived ticket and
    // collect the remaining details plus Privacy Notice consent before creating
    // the user — consent has to be recorded at creation time.
    const ticket = {
      provider,
      providerAccountId: profile.providerAccountId,
      email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    }

    // The native app has no cookie jar of its own, so it carries the same
    // signed ticket in the deep link and posts it back in the request body.
    if (nativeRedirectUri) {
      const response = NextResponse.redirect(
        buildNativeRedirect(nativeRedirectUri, { signup: signSignupTicket(ticket) }),
      )
      clearOAuthStateCookie(response)

      return response
    }

    const response = NextResponse.redirect(new URL(SOCIAL_SIGNUP_ROUTE, request.url))
    clearOAuthStateCookie(response)
    applySignupTicketCookie(response, ticket)

    return response
  } catch (error) {
    console.error('[OAUTH CALLBACK ERROR]', error)
    return failure(request, 'oauth_failed', nativeRedirectUri)
  }
}

async function redirectWithSession(
  request: NextRequest,
  user: Parameters<typeof issueSessionForUser>[0] & { userType: UserType },
  nativeRedirectUri: string | null,
): Promise<NextResponse> {
  // The native flow issues no session here. It hands back a 60-second ticket
  // that /api/auth/oauth/native/exchange trades for the real token, so a handoff
  // the app never completes leaves no login recorded against the account.
  if (nativeRedirectUri) {
    const response = NextResponse.redirect(
      buildNativeRedirect(nativeRedirectUri, { ticket: signHandoffTicket(user.id) }),
    )
    clearOAuthStateCookie(response)

    return response
  }

  const { token } = await issueSessionForUser(user, request)
  invalidateAuthUserCache(user.id)

  const response = NextResponse.redirect(
    new URL(getAuthenticatedHomeRoute(user.userType), request.url),
  )
  clearOAuthStateCookie(response)
  applyLoginSessionCookie(response, token)

  return response
}
