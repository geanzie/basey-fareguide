import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse } from '@/lib/auth'
import { closeDriverSession, isDriverSessionError } from '@/lib/driverSession'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params
    const response = await closeDriverSession(request, sessionId)
    return NextResponse.json(response)
  } catch (error) {
    if (isDriverSessionError(error)) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
    }

    return createAuthErrorResponse(error)
  }
}