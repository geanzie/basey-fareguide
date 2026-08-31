import { NextRequest, NextResponse } from 'next/server'

import { LOGIN_ROUTE } from '@/lib/authRoutes'
import {
  buildAuthorizeUrl,
  buildRedirectUri,
  isProviderConfigured,
  resolveProviderSlug,
} from '@/lib/oauth/providers'
import {
  applyOAuthStateCookie,
  buildNativeRedirect,
  createOAuthState,
  resolveNativeRedirect,
} from '@/lib/oauth/state'
import { checkRateLimit, getClientIdentifier, logRateLimitHit, RATE_LIMITS } from '@/lib/rateLimit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  // Resolved before anything can fail so a native caller is answered with a
  // deep link rather than the HTML login page it cannot parse.
  const requestedRedirect = request.nextUrl.searchParams.get('redirect')
  const nativeRedirectUri = resolveNativeRedirect(requestedRedirect)

  const failure = (code: string): NextResponse =>
    nativeRedirectUri
      ? NextResponse.redirect(buildNativeRedirect(nativeRedirectUri, { error: code }))
      : NextResponse.redirect(new URL(`${LOGIN_ROUTE}?error=${code}`, request.url))

  try {
    // A redirect we were given but will not honour is a hard error, never a
    // silent fall back to the web flow: the caller is plainly a native client,
    // and quietly redirecting it into HTML would hang its auth session.
    if (requestedRedirect && !nativeRedirectUri) {
      return NextResponse.json(
        { message: 'Unsupported redirect target', code: 'oauth_bad_redirect' },
        { status: 400 },
      )
    }

    const { provider: slug } = await params
    const provider = resolveProviderSlug(slug)

    if (!provider || !isProviderConfigured(provider)) {
      return NextResponse.json({ message: 'Sign-in provider not available' }, { status: 404 })
    }

    const clientId = getClientIdentifier(request)
    // Own namespace: this leg is a cheap redirect, and it must not spend the
    // budget the user needs for the registration form it leads to.
    const rateLimitResult = checkRateLimit(clientId, RATE_LIMITS.OAUTH_REDIRECT)

    if (!rateLimitResult.success) {
      logRateLimitHit(RATE_LIMITS.OAUTH_REDIRECT, 'ip', rateLimitResult.retryAfter)
      return failure('oauth_rate_limited')
    }

    const redirectUri = buildRedirectUri(provider, request.nextUrl.origin)
    const { payload, codeChallenge } = createOAuthState(provider, redirectUri, nativeRedirectUri)

    const response = NextResponse.redirect(
      buildAuthorizeUrl({ provider, redirectUri, state: payload.state, codeChallenge }),
    )
    applyOAuthStateCookie(response, payload)

    return response
  } catch (error) {
    console.error('[OAUTH START ERROR]', error)
    return failure('oauth_failed')
  }
}
