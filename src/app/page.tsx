'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import AuthStateShell from '@/components/AuthStateShell'
import { useAuth } from '@/components/AuthProvider'
import { getAuthenticatedHomeRoute, LOGIN_ROUTE } from '@/lib/authRoutes'

export default function HomePage() {
  const router = useRouter()
  const { user, status } = useAuth()

  useEffect(() => {
    if (status === 'loading') {
      return
    }

    if (status === 'authenticated' && user) {
      router.replace(getAuthenticatedHomeRoute(user.userType))
      return
    }

    router.replace(LOGIN_ROUTE)
  }, [router, status, user])

  return (
    <div className="min-h-dvh">
      <AuthStateShell
        title="Opening Basey FareCheck"
        message="Taking you to the right place for your account."
      />
    </div>
  )
}
