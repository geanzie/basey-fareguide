import { NextRequest, NextResponse } from 'next/server'
import {
  applyLoginSessionCookie,
  authenticateLoginAttempt,
  buildLoginErrorResponse,
} from '@/lib/login'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    const result = await authenticateLoginAttempt(request, { username, password })

    if (!result.ok) {
      return buildLoginErrorResponse(result.error)
    }

    const response = NextResponse.json({
      user: result.serializedUser,
    })

    applyLoginSessionCookie(response, result.token)

    return response
  } catch (error) {
    console.error('[LOGIN ERROR]', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
