import { NextResponse } from 'next/server'

import { listConfiguredProviders } from '@/lib/oauth/providers'

/**
 * The social providers this deployment has credentials for.
 *
 * The web login page calls listConfiguredProviders() directly in a server
 * component; the native app has no such access and would otherwise render a
 * sign-in button that 404s whenever the credentials are unset.
 */
export async function GET() {
  return NextResponse.json({
    providers: listConfiguredProviders().map(({ slug, label }) => ({ slug, label })),
  })
}
