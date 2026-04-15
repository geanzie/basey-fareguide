import { NextRequest, NextResponse } from 'next/server'

import { createAuthErrorResponse } from '@/lib/auth'
import { isDriverSessionError, startDriverSession } from '@/lib/driverSession'

export async function POST(request: NextRequest) {
  try {
    const response = await startDriverSession(request)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (isDriverSessionError(error)) {
      return NextResponse.json({ message: error.message, code: error.code }, { status: error.status })
    }

    return createAuthErrorResponse(error)
  }
}