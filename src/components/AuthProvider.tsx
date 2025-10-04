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

export function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  
  // Check if user is an authority user who should see sidebar
  const isAuthority = user && ['ADMIN', 'DATA_ENCODER', 'ENFORCER'].includes(user.userType)
  
  if (!isAuthority) {
    // Regular layout for public users
    return (
      <main className="flex-1">
        {children}
      </main>
    )
  }

  // Layout with sidebar for authority users
  return (
    <main className="flex-1 flex">
      {/* Quick Actions Sidebar */}
      <aside className="w-80 bg-white shadow-lg border-r border-gray-200">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
            
            <nav className="space-y-2">
              {/* Main Dashboard Link - Routes based on user type */}
              <a
                href={user.userType === 'DATA_ENCODER' ? '/encoder' : '/dashboard'}
                className="w-full flex items-center p-3 rounded-lg hover:bg-emerald-50 transition-colors group"
              >
                <span className="text-xl mr-3">📊</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-emerald-700">
                    {user.userType === 'DATA_ENCODER' ? 'Encoder Dashboard' : 'Dashboard'}
                  </div>
                  <div className="text-xs text-gray-500 group-hover:text-emerald-600">
                    {user.userType === 'DATA_ENCODER' ? 'Manage permits & statistics' : 'View overview & statistics'}
                  </div>
                </div>
              </a>

              {/* Additional navigation for non-encoder users */}
              {user.userType === 'ADMIN' && (
                <a
                  href="/admin"
                  className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors group"
                >
                  <span className="text-xl mr-3">⚙️</span>
                  <div className="text-left">
                    <div className="font-medium text-gray-700 group-hover:text-blue-700">Admin Panel</div>
                    <div className="text-xs text-gray-500 group-hover:text-blue-600">System administration</div>
                  </div>
                </a>
              )}

              {/* Divider */}
              <hr className="my-4 border-gray-200" />
              
              {/* Quick Action Buttons */}
              <div className="space-y-1">
                <button className="w-full flex items-center p-3 rounded-lg hover:bg-red-50 transition-colors group">
                  <span className="text-xl mr-3">📝</span>
                  <div className="text-left">
                    <div className="font-medium text-gray-700 group-hover:text-red-700">Create Incident</div>
                    <div className="text-xs text-gray-500 group-hover:text-red-600">Report new violation</div>
                  </div>
                </button>

                {user.userType === 'DATA_ENCODER' && (
                  <button className="w-full flex items-center p-3 rounded-lg hover:bg-emerald-50 transition-colors group">
                    <span className="text-xl mr-3">➕</span>
                    <div className="text-left">
                      <div className="font-medium text-gray-700 group-hover:text-emerald-700">Add Permit</div>
                      <div className="text-xs text-gray-500 group-hover:text-emerald-600">Register new permit</div>
                    </div>
                  </button>
                )}

                {(user.userType === 'ADMIN' || user.userType === 'DATA_ENCODER') && (
                  <button className="w-full flex items-center p-3 rounded-lg hover:bg-purple-50 transition-colors group">
                    <span className="text-xl mr-3">🚗</span>
                    <div className="text-left">
                      <div className="font-medium text-gray-700 group-hover:text-purple-700">Add Vehicle</div>
                      <div className="text-xs text-gray-500 group-hover:text-purple-600">Register new vehicle</div>
                    </div>
                  </button>
                )}

                <button className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50 transition-colors group">
                  <span className="text-xl mr-3">📊</span>
                  <div className="text-left">
                    <div className="font-medium text-gray-700 group-hover:text-blue-700">Generate Report</div>
                    <div className="text-xs text-gray-500 group-hover:text-blue-600">Export statistics</div>
                  </div>
                </button>

                {user.userType === 'ADMIN' && (
                  <>
                    <button className="w-full flex items-center p-3 rounded-lg hover:bg-indigo-50 transition-colors group">
                      <span className="text-xl mr-3">👥</span>
                      <div className="text-left">
                        <div className="font-medium text-gray-700 group-hover:text-indigo-700">Manage Users</div>
                        <div className="text-xs text-gray-500 group-hover:text-indigo-600">View user accounts</div>
                      </div>
                    </button>

                    <button className="w-full flex items-center p-3 rounded-lg hover:bg-orange-50 transition-colors group">
                      <span className="text-xl mr-3">⚙️</span>
                      <div className="text-left">
                        <div className="font-medium text-gray-700 group-hover:text-orange-700">User Management</div>
                        <div className="text-xs text-gray-500 group-hover:text-orange-600">Create admin users</div>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-h-screen">
        {children}
      </div>
    </main>
  )
}