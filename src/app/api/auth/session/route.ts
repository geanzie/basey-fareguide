import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse, requireRequestUser } from '@/lib/auth'
import { serializeSessionUser } from '@/lib/serializers'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request)

    return NextResponse.json({ user: serializeSessionUser(user) })
  } catch (error) {
    const authErrorResponse = createAuthErrorResponse(error)

    if (authErrorResponse.status === 401) {
      return NextResponse.json({ user: null })
    }

    return authErrorResponse
  }
}