'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import UnifiedLayout from './UnifiedLayout'
import type { SessionUserDto, UserProfileResponseDto } from '@/lib/contracts'

interface AuthContextType {
  user: SessionUserDto | null
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
  const [user, setUser] = useState<SessionUserDto | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        credentials: 'same-origin'
      })

      if (!response.ok) {
        setUser(null)
        return null
      }

      const data: UserProfileResponseDto = await response.json()
      setUser(data.user)
      return data.user
    } catch {
      setUser(null)
      return null
    }
  }

  useEffect(() => {
    refreshUser().finally(() => {
      setLoading(false)
    })
  }, [])

  const login = (userData: SessionUserDto) => {
    setUser(userData)
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
    } catch {}

    setUser(null)
    router.push('/')
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading || pathname === '/auth' || pathname.startsWith('/auth/') || !user) {
    return <main className="flex-1">{children}</main>
  }

  return (
    <UnifiedLayout user={user}>
      {children}
    </UnifiedLayout>
  )
}
