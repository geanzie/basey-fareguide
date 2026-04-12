'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'

import AuthStateShell from './AuthStateShell'
import QrComplianceTerminal from './QrComplianceTerminal'
import UnifiedLayout from './UnifiedLayout'
import type { SessionResponseDto, SessionUserDto } from '@/lib/contracts'
import { isAuthRoute, POST_LOGOUT_ROUTE } from '@/lib/authRoutes'
import { SWR_KEYS } from '@/lib/swrKeys'
import {
  fetchSessionResponse,
} from '@/lib/userProfile'
import {
  AUTH_SESSION_IDLE_TIMEOUT_MS,
  AUTH_SESSION_REVALIDATION_MS,
} from '@/lib/authSession'

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

export function AuthProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode
  initialSession?: SessionResponseDto | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { mutate: mutateCache } = useSWRConfig()
  const { data, isLoading, mutate } = useSWR<SessionResponseDto | null>(
    SWR_KEYS.authSession,
    fetchSessionResponse,
    {
      fallbackData: initialSession,
    },
  )
  const [transitionState, setTransitionState] = useState<'idle' | 'logging_out'>('idle')
  const lastActivityAtRef = useRef(Date.now())
  const logoutRef = useRef<() => Promise<void>>(async () => {})

  const user = data?.user ?? null
  const status: AuthStatus =
    transitionState === 'logging_out'
      ? 'logging_out'
      : isLoading && data === undefined
        ? 'loading'
        : user
          ? 'authenticated'
          : 'unauthenticated'
  const isAuthenticated = status === 'authenticated'
  const loading = status === 'loading'

  useEffect(() => {
    if (
      transitionState === 'logging_out' &&
      (isAuthRoute(pathname) || pathname === POST_LOGOUT_ROUTE)
    ) {
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
      SWR_KEYS.authSession,
      { user: userData },
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
      mutateCache(SWR_KEYS.authSession, null, { populateCache: true, revalidate: false }),
      mutateCache(SWR_KEYS.userProfile, null, { populateCache: true, revalidate: false }),
      mutateCache(SWR_KEYS.incidents, undefined, { revalidate: false }),
      mutateCache(SWR_KEYS.fareCalculations, undefined, { revalidate: false }),
    ])
    router.replace(POST_LOGOUT_ROUTE)
    router.refresh()
  }

  useEffect(() => {
    logoutRef.current = logout
  }, [logout])

  useEffect(() => {
    if (!isAuthenticated || transitionState === 'logging_out') {
      return
    }

    let canceled = false

    const revalidateSession = async () => {
      try {
        const nextData = await fetchSessionResponse()

        if (!canceled && !nextData?.user) {
          await logoutRef.current()
          return
        }

        if (!canceled) {
          await mutateCache(SWR_KEYS.authSession, nextData, {
            populateCache: true,
            revalidate: false,
          })
        }
      } catch {
        // Leave the current session state unchanged on transient fetch errors.
      }
    }

    const intervalId = window.setInterval(() => {
      void revalidateSession()
    }, AUTH_SESSION_REVALIDATION_MS)

    const handleFocus = () => {
      void revalidateSession()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void revalidateSession()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      canceled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, mutateCache, transitionState])

  useEffect(() => {
    if (!isAuthenticated || transitionState === 'logging_out') {
      return
    }

    let timeoutId: number | null = null
    let idleLogoutStarted = false

    const triggerIdleLogout = () => {
      if (idleLogoutStarted) {
        return
      }

      idleLogoutStarted = true
      void logoutRef.current()
    }

    const scheduleIdleTimeout = () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId)
      }

      timeoutId = window.setTimeout(() => {
        triggerIdleLogout()
      }, AUTH_SESSION_IDLE_TIMEOUT_MS)
    }

    const recordActivity = () => {
      lastActivityAtRef.current = Date.now()
      scheduleIdleTimeout()
    }

    const checkIdleTimeout = () => {
      if (Date.now() - lastActivityAtRef.current >= AUTH_SESSION_IDLE_TIMEOUT_MS) {
        triggerIdleLogout()
        return
      }

      scheduleIdleTimeout()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkIdleTimeout()
      }
    }

    recordActivity()

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    events.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity)
    })
    window.addEventListener('focus', checkIdleTimeout)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId)
      }

      events.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity)
      })
      window.removeEventListener('focus', checkIdleTimeout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, transitionState])

  return (
    <AuthContext.Provider value={{ user, status, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth()
  const pathname = usePathname()
  const shouldShowTerminal = pathname === '/' || status === 'authenticated'

  if (isAuthRoute(pathname)) {
    return <main className="app-page-bg flex-1">{children}</main>
  }

  if (status === 'logging_out') {
    return (
      <main className="app-page-bg flex-1">
        <AuthStateShell
          title="Signing out"
          message="Please wait while we close your session."
        />
      </main>
    )
  }

  if (status === 'loading' || !user) {
    return (
      <>
        <main className="app-page-bg flex-1">{children}</main>
        {shouldShowTerminal ? <QrComplianceTerminal /> : null}
      </>
    )
  }

  return (
    <>
      <UnifiedLayout user={user}>
        {children}
      </UnifiedLayout>
      {shouldShowTerminal ? <QrComplianceTerminal /> : null}
    </>
  )
}
