'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  userType: string
  firstName: string
  lastName: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (userData: User, token: string) => void
  logout: () => void
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
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthAwareHeader() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🚌</span>
            <span className="text-xl font-bold text-gray-900">
              {pathname === '/dashboard' ? 'Basey Fare Guide - Dashboard' : 'Basey Fare Guide'}
            </span>
          </a>
          
          {/* Navigation Links */}
          <nav className="flex items-center space-x-6">
            <a href="/" className="flex items-center space-x-1 text-gray-600 hover:text-emerald-600 transition-colors">
              <span>🏠</span>
              <span className="hidden sm:inline">Home</span>
            </a>
            
            {user ? (
              <div className="flex items-center space-x-4">
                <a href="/dashboard" className="flex items-center space-x-1 text-gray-600 hover:text-emerald-600 transition-colors">
                  <span>📊</span>
                  <span className="hidden sm:inline">Dashboard</span>
                </a>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="hidden md:inline">Welcome, {user.firstName}</span>
                  <button
                    onClick={logout}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Logout"
                  >
                    <span>🚪</span>
                    <span className="hidden sm:inline ml-1">Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <a href="/auth" className="flex items-center space-x-1 text-gray-600 hover:text-emerald-600 transition-colors">
                <span>👤</span>
                <span className="hidden sm:inline">Login</span>
              </a>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}