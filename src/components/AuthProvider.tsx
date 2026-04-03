'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'

import AuthStateShell from './AuthStateShell'
import UnifiedLayout from './UnifiedLayout'
import type { SessionUserDto, UserProfileResponseDto } from '@/lib/contracts'
import { isAuthRoute, LOGIN_ROUTE } from '@/lib/authRoutes'
import { SWR_KEYS } from '@/lib/swrKeys'
import {
  buildOptimisticUserProfileResponse,
  fetchUserProfileResponse,
} from '@/lib/userProfile'

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'logging_out'

interface AuthContextType {
  user: SessionUserDto | null
  status: AuthStatus
  loading: boolean
  login: (userData: SessionUserDto) => void
  logout: () => Promise<void>
  refreshUser: () => Promise<SessionUserDto | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { mutate: mutateCache } = useSWRConfig()
  const { data, isLoading, mutate } = useSWR<UserProfileResponseDto | null>(
    SWR_KEYS.userProfile,
    fetchUserProfileResponse,
  )
  const [transitionState, setTransitionState] = useState<'idle' | 'logging_out'>('idle')

  const user = data?.user ?? null
  const status: AuthStatus =
    transitionState === 'logging_out'
      ? 'logging_out'
      : isLoading && data === undefined
        ? 'loading'
        : user
          ? 'authenticated'
          : 'unauthenticated'
  const loading = status === 'loading'

  useEffect(() => {
    if (transitionState === 'logging_out' && isAuthRoute(pathname)) {
      setTransitionState('idle')
    }
  }, [pathname, transitionState])

  const refreshUser = async () => {
    const nextData = await mutate()
    return nextData?.user ?? null
  }

  const login = (userData: SessionUserDto) => {
    setTransitionState('idle')
    void mutateCache(
      SWR_KEYS.userProfile,
      buildOptimisticUserProfileResponse(userData),
      { populateCache: true, revalidate: true },
    )
  }

  const logout = async () => {
    if (transitionState === 'logging_out') {
      return
    }

    setTransitionState('logging_out')

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
    } catch {}

    await Promise.all([
      mutateCache(SWR_KEYS.userProfile, null, { populateCache: true, revalidate: false }),
      mutateCache(SWR_KEYS.incidents, undefined, { revalidate: false }),
      mutateCache(SWR_KEYS.fareCalculations, undefined, { revalidate: false }),
    ])
    router.replace(LOGIN_ROUTE)
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ user, status, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth()
  const pathname = usePathname()

  if (isAuthRoute(pathname)) {
    return <main className="flex-1">{children}</main>
  }

  if (status === 'logging_out') {
    return (
      <main className="flex-1">
        <AuthStateShell
          title="Signing out"
          message="Please wait while we close your session."
        />
      </main>
    )
  }

  if (status === 'loading' || !user) {
    return <main className="flex-1">{children}</main>
  }

  return (
    <UnifiedLayout user={user}>
      {children}
    </UnifiedLayout>
  )
}
