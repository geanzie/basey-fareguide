import { NextRequest, NextResponse } from 'next/server'

import { listConfiguredProviders } from '@/lib/oauth/providers'
import { resolveNativeRedirect } from '@/lib/oauth/state'
import type { OAuthProvidersResponseDto } from '@/lib/contracts'

/**
 * The social providers this deployment has credentials for.
 *
 * The web login page calls listConfiguredProviders() directly in a server
 * component; the native app has no such access and would otherwise render a
 * sign-in button that 404s whenever the credentials are unset.
 *
 * A native caller may also pass its deep link as `?redirect=` to learn whether
 * /start would honour it. Answering here costs no extra round trip — the app
 * already calls this to decide which buttons to render — and lets it disable
 * them with an explanation rather than sending the user into a browser tab
 * that dead-ends on a 400.
 */
export async function GET(request: NextRequest) {
  const requestedRedirect = request.nextUrl.searchParams.get('redirect')

  const body: OAuthProvidersResponseDto = {
    providers: listConfiguredProviders().map(({ slug, label }) => ({ slug, label })),
  }

  // Omitted entirely when unasked, so the web caller's shape is unchanged.
  if (requestedRedirect) {
    body.redirectSupported = resolveNativeRedirect(requestedRedirect) !== null
  }

  return NextResponse.json(body)
}
