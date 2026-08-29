import { NextRequest, NextResponse } from 'next/server'

import { LOGIN_ROUTE } from '@/lib/authRoutes'
import {
  buildAuthorizeUrl,
  buildRedirectUri,
  isProviderConfigured,
  resolveProviderSlug,
} from '@/lib/oauth/providers'
import { applyOAuthStateCookie, createOAuthState } from '@/lib/oauth/state'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider: slug } = await params
    const provider = resolveProviderSlug(slug)

    if (!provider || !isProviderConfigured(provider)) {
      return NextResponse.json({ message: 'Sign-in provider not available' }, { status: 404 })
    }

    const clientId = getClientIdentifier(request)
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.AUTH_LOGIN)

    if (!rateLimitResult.success) {
      return NextResponse.redirect(new URL(`${LOGIN_ROUTE}?error=oauth_rate_limited`, request.url))
    }

    const redirectUri = buildRedirectUri(provider, request.nextUrl.origin)
    const { payload, codeChallenge } = createOAuthState(provider, redirectUri)

    const response = NextResponse.redirect(
      buildAuthorizeUrl({ provider, redirectUri, state: payload.state, codeChallenge }),
    )
    applyOAuthStateCookie(response, payload)

    return response
  } catch (error) {
    console.error('[OAUTH START ERROR]', error)
    return NextResponse.redirect(new URL(`${LOGIN_ROUTE}?error=oauth_failed`, request.url))
  }
}
