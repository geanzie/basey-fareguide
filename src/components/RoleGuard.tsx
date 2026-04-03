'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { UserRole } from '@/lib/contracts'
import { LOGIN_ROUTE } from '@/lib/authRoutes'

import AuthStateShell from './AuthStateShell'
import { useAuth, type AuthStatus } from './AuthProvider'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: readonly UserRole[]
  redirectTo?: string
  fallback?: React.ReactNode
}

type RoleGuardState = AuthStatus | 'unauthorized'

export default function RoleGuard({
  children,
  allowedRoles,
  redirectTo = LOGIN_ROUTE,
  fallback = null,
}: RoleGuardProps) {
  const { user, status } = useAuth()
  const router = useRouter()
  const guardState = getRoleGuardState(status, user, allowedRoles)

  useEffect(() => {
    if (guardState === 'unauthenticated') {
      router.replace(redirectTo)
    }
  }, [guardState, redirectTo, router])

  if (guardState === 'loading') {
    return (
      <AuthStateShell
        title="Verifying access"
        message="Checking your session and permissions."
      />
    )
  }

  if (guardState === 'logging_out') {
    return (
      <AuthStateShell
        title="Signing out"
        message="Please wait while we close your session."
      />
    )
  }

  if (guardState === 'unauthenticated') {
    return (
      <AuthStateShell
        title="Redirecting to login"
        message="Taking you to the sign-in page."
      />
    )
  }

  if (guardState === 'unauthorized') {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">!</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You do not have permission to access this page.</p>
          <button
            onClick={() => router.replace(getRoleBasedDashboard(user?.userType ?? 'PUBLIC'))}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Your Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function getRoleGuardState(
  status: AuthStatus,
  user: ReturnType<typeof useAuth>['user'],
  allowedRoles: readonly UserRole[],
): RoleGuardState {
  if (status === 'loading' || status === 'logging_out') {
    return status
  }

  if (status === 'unauthenticated' || !user) {
    return 'unauthenticated'
  }

  if (!allowedRoles.includes(user.userType)) {
    return 'unauthorized'
  }

  return 'authenticated'
}

function getRoleBasedDashboard(userType: UserRole): string {
  switch (userType) {
    case 'ADMIN':
      return '/admin'
    case 'DATA_ENCODER':
      return '/encoder'
    case 'ENFORCER':
      return '/enforcer'
    case 'PUBLIC':
      return '/dashboard'
    default:
      return '/dashboard'
  }
}

export function useCurrentUser() {
  const { user } = useAuth()
  return user
}

export function usePermissions() {
  const user = useCurrentUser()

  const hasRole = (roles: readonly UserRole[]) => {
    return user ? roles.includes(user.userType) : false
  }

  const isAdmin = () => hasRole(['ADMIN'])
  const isEnforcer = () => hasRole(['ENFORCER'])
  const isEncoder = () => hasRole(['DATA_ENCODER'])
  const isPublic = () => hasRole(['PUBLIC'])
  const isAuthority = () => hasRole(['ADMIN', 'DATA_ENCODER', 'ENFORCER'])

  return {
    user,
    hasRole,
    isAdmin,
    isEnforcer,
    isEncoder,
    isPublic,
    isAuthority,
  }
}
