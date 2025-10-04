'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  userType: 'ADMIN' | 'DATA_ENCODER' | 'ENFORCER' | 'PUBLIC'
  firstName: string
  lastName: string
}

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
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    
    if (!userData || !token) {
      // Not logged in
      router.push('/auth')
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      
      // Check if user has permission
      if (!allowedRoles.includes(parsedUser.userType)) {
        // Redirect to appropriate dashboard based on role
        const userDashboard = getRoleBasedDashboard(parsedUser.userType)
        router.push(userDashboard)
        return
      }
    } catch (error) {
      // Invalid user data
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      router.push('/auth')
      return
    }
    
    setLoading(false)
  }, [router, allowedRoles])

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
          <div className="text-6xl mb-4">🚫</div>
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

// Helper hook to get current user
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null)
  
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (error) {
        setUser(null)
      }
    }
  }, [])
  
  return user
}

// Helper hook to check user permissions
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