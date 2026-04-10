import { NextRequest, NextResponse } from 'next/server'

import { LEGACY_AUTH_ROUTE, getAuthenticatedHomeRoute } from '@/lib/authRoutes'
import {
  applyLoginSessionCookie,
  authenticateLoginAttempt,
} from '@/lib/login'

function buildAuthRedirectUrl(request: NextRequest, username: string, errorMessage: string): URL {
  const redirectUrl = new URL(LEGACY_AUTH_ROUTE, request.url)
  redirectUrl.searchParams.set('error', errorMessage)

  if (username.trim()) {
    redirectUrl.searchParams.set('username', username.trim())
  }

  return redirectUrl
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const username = String(formData.get('username') ?? '')
    const password = String(formData.get('password') ?? '')

    const result = await authenticateLoginAttempt(request, { username, password })

    if (!result.ok) {
      const errorMessage = typeof result.error.body.message === 'string'
        ? result.error.body.message
        : 'Login failed'

      return NextResponse.redirect(buildAuthRedirectUrl(request, username, errorMessage), 303)
    }

    const response = NextResponse.redirect(
      new URL(getAuthenticatedHomeRoute(result.serializedUser.userType), request.url),
      303,
    )

    applyLoginSessionCookie(response, result.token)

    return response
  } catch (error) {
    console.error('[FORM LOGIN ERROR]', error)
    return NextResponse.redirect(
      buildAuthRedirectUrl(request, '', 'Internal server error'),
      303,
    )
  }
}