import { NextResponse } from 'next/server'

import type { AdminApiFailure, AdminApiSuccess } from '@/lib/admin/user-management-contract'

export function createAdminRouteSuccess<T>(
  data: T,
  options?: { message?: string; status?: number },
): NextResponse<AdminApiSuccess<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(options?.message ? { message: options.message } : {}),
    },
    { status: options?.status ?? 200 },
  )
}

export function createAdminRouteError(error: string, status = 400): NextResponse<AdminApiFailure> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  )
}

export function createAdminRouteAuthError(error: unknown): NextResponse<AdminApiFailure> {
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return createAdminRouteError('Unauthorized. Please login.', 401)
    }

    if (error.message === 'Forbidden') {
      return createAdminRouteError('Access denied. Insufficient permissions.', 403)
    }
  }

  return createAdminRouteError('Internal server error', 500)
}
