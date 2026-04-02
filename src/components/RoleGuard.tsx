'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: string[]
  redirectTo?: string
  fallback?: React.ReactNode
}

export default function RoleGuard({
  children,
  allowedRoles,
  redirectTo = '/auth',
  fallback = null
}: RoleGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.push(redirectTo)
      return
    }

    if (!allowedRoles.includes(user.userType)) {
      router.push(getRoleBasedDashboard(user.userType))
    }
  }, [allowedRoles, loading, redirectTo, router, user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user || !allowedRoles.includes(user.userType)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">ðŸš«</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <button
            onClick={() => router.push(getRoleBasedDashboard(user?.userType || 'PUBLIC'))}
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

function getRoleBasedDashboard(userType: string): string {
  switch (userType) {
    case 'ADMIN': return '/admin'
    case 'DATA_ENCODER': return '/encoder'
    case 'ENFORCER': return '/enforcer'
    case 'PUBLIC': return '/dashboard'
    default: return '/dashboard'
  }
}

export function useCurrentUser() {
  const { user } = useAuth()
  return user
}

export function usePermissions() {
  const user = useCurrentUser()

  const hasRole = (roles: string[]) => {
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
    isAuthority
  }
}
