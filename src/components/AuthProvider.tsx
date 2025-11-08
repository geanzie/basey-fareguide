'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import UnifiedLayout from './UnifiedLayout'

interface User {
  id: string
  userType: 'ADMIN' | 'DATA_ENCODER' | 'ENFORCER' | 'PUBLIC'
  firstName: string
  lastName: string
  username: string
  dateOfBirth?: string
  phoneNumber?: string
  governmentId?: string
  idType?: string
  employeeId?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (userData: User, token: string) => void
  logout: () => void
  refreshUser: () => Promise<void>
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
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check authentication state
    const userData = localStorage.getItem('user')
    const token = localStorage.getItem('token')

    if (userData && token) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch (err) {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    }
    setLoading(false)
  }, [])

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const updatedUser = data.user
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    } catch (err) {}
  }

  const login = (userData: User, token: string) => {
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
    router.push('/')
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
  
  // Don't render layout for auth pages or while loading
  if (loading || pathname === '/auth' || pathname.startsWith('/auth/') || !user) {
    return <main className="flex-1">{children}</main>
  }

  // Use unified layout for authenticated users
  return (
    <UnifiedLayout user={user}>
      {children}
    </UnifiedLayout>
  )
}