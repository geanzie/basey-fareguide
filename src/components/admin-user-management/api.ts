'use client'

import type {
  AdminApiFailure,
  AdminApiSuccess,
  AdminDriverOptionDto,
  AdminDriverOptionsData,
  AdminPasswordResetAction,
  AdminPasswordResetData,
  AdminToggleUserStatusData,
  AdminUserCreateData,
  AdminUsersListData,
  AdminUsersSummaryDto,
} from '@/lib/admin/user-management-contract'

const ADMIN_USERS_PAGE_SIZE = 100

type AdminApiResult<T> = AdminApiSuccess<T> | AdminApiFailure | { message?: string; error?: string }

async function parseAdminResponse<T>(response: Response): Promise<AdminApiSuccess<T>> {
  const body = (await response.json()) as AdminApiResult<T>

  if (!response.ok || !('success' in body) || body.success !== true) {
    const errorMessage =
      ('error' in body && typeof body.error === 'string' && body.error) ||
      ('message' in body && typeof body.message === 'string' && body.message) ||
      'Request failed'

    throw new Error(errorMessage)
  }

  return body
}

export async function fetchAllAdminUsers() {
  let page = 1
  let totalPages = 1
  const users: AdminUsersListData['users'] = []
  let summary: AdminUsersSummaryDto | null = null

  while (page <= totalPages) {
    const response = await fetch(`/api/admin/users?page=${page}&limit=${ADMIN_USERS_PAGE_SIZE}`)
    const result = await parseAdminResponse<AdminUsersListData>(response)

    users.push(...result.data.users)
    summary = result.data.summary
    totalPages = result.data.pagination.totalPages || 1
    page += 1
  }

  return {
    users,
    summary,
  }
}

export async function createAdminUser(payload: unknown) {
  const response = await fetch('/api/admin/users/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseAdminResponse<AdminUserCreateData>(response)
}

export async function fetchAdminDriverOptions(): Promise<AdminDriverOptionDto[]> {
  const response = await fetch('/api/admin/users/driver-options')
  const result = await parseAdminResponse<AdminDriverOptionsData>(response)
  return result.data.drivers
}

export async function updateAdminUserStatus(userId: string, isActive: boolean) {
  const response = await fetch('/api/admin/users/toggle-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, isActive }),
  })

  return parseAdminResponse<AdminToggleUserStatusData>(response)
}

export async function submitAdminPasswordReset(input: {
  userId: string
  action: AdminPasswordResetAction
  newPassword?: string
}) {
  const response = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  return parseAdminResponse<AdminPasswordResetData>(response)
}
