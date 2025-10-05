'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import HeaderNavigation from './HeaderNavigation'

interface User {
  id: string
  userType: string
  firstName: string
  lastName: string
  email: string
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

// Role-based dashboard routing
const getDashboardUrl = (userType: string) => {
  switch (userType) {
    case 'ADMIN': return '/admin'
    case 'DATA_ENCODER': return '/encoder'
    // case 'ENFORCER': return '/enforcer'
    case 'PUBLIC': return '/dashboard'
    default: return '/dashboard'
  }
}

const getDashboardLabel = (userType: string) => {
  switch (userType) {
    case 'ADMIN': return 'Admin Panel'
    case 'DATA_ENCODER': return 'Data Encoder'
    case 'ENFORCER': return 'Enforcement Dashboard'
    case 'PUBLIC': return 'My Dashboard'
    default: return 'Dashboard'
  }
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
              {user && (pathname === getDashboardUrl(user.userType) || pathname === '/dashboard' || pathname === '/admin' || pathname === '/encoder' || pathname === '/enforcer') 
                ? `Basey Fare Guide - ${getDashboardLabel(user.userType)}` 
                : 'Basey Fare Guide'}
            </span>
          </a>
          
          {/* Navigation Links */}
          <nav className="flex items-center space-x-6">
            {/* <a href="/" className="flex items-center space-x-1 text-gray-600 hover:text-emerald-600 transition-colors">
              <span>🏠</span>
              <span className="hidden sm:inline">Home</span>
            </a> */}
            
          {user ? (
              <HeaderNavigation user={user} logout={logout} />
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

// Role-specific navigation scaffolding for optimized UX
function renderRoleSpecificNavigation(userType: string, setSidebarOpen: (open: boolean) => void) {
  const commonLinkClass = "w-full flex items-center p-4 rounded-lg transition-colors group touch-manipulation"
  const closeSidebar = () => setSidebarOpen(false)

  switch (userType) {
    case 'ADMIN':
      return (
        <nav className="space-y-3">
          {/* Admin Dashboard */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Administration</h3>
            <a href="/admin" className={`${commonLinkClass} hover:bg-blue-50`} onClick={closeSidebar}>
              <span className="text-xl mr-3">⚙️</span>
              <div className="text-left">
                <div className="font-medium text-gray-700 group-hover:text-blue-700">Admin Dashboard</div>
                <div className="text-xs text-gray-500 group-hover:text-blue-600">System administration center</div>
              </div>
            </a>
          </div>

          {/* User Management Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">User Management</h3>
            <div className="space-y-2">
              <button className={`${commonLinkClass} hover:bg-indigo-50`}>
                <span className="text-xl mr-3">👥</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-indigo-700">View All Users</div>
                  <div className="text-xs text-gray-500 group-hover:text-indigo-600">Manage user accounts</div>
                </div>
              </button>
              <button className={`${commonLinkClass} hover:bg-green-50`}>
                <span className="text-xl mr-3">➕</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-green-700">Create Admin User</div>
                  <div className="text-xs text-gray-500 group-hover:text-green-600">Add new administrator</div>
                </div>
              </button>
              <button className={`${commonLinkClass} hover:bg-purple-50`}>
                <span className="text-xl mr-3">🔐</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-purple-700">Role Permissions</div>
                  <div className="text-xs text-gray-500 group-hover:text-purple-600">Manage user roles</div>
                </div>
              </button>
            </div>
          </div>

          {/* System Management */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">System</h3>
            <div className="space-y-2">
              <button className={`${commonLinkClass} hover:bg-orange-50`}>
                <span className="text-xl mr-3">📊</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-orange-700">System Analytics</div>
                  <div className="text-xs text-gray-500 group-hover:text-orange-600">View system statistics</div>
                </div>
              </button>
              <button className={`${commonLinkClass} hover:bg-red-50`}>
                <span className="text-xl mr-3">🔧</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-red-700">System Settings</div>
                  <div className="text-xs text-gray-500 group-hover:text-red-600">Configure system</div>
                </div>
              </button>
            </div>
          </div>
        </nav>
      )

    case 'DATA_ENCODER':
      return (
        <nav className="space-y-3">
          {/* Encoder Dashboard */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Data Management</h3>
            <a href="/encoder" className={`${commonLinkClass} hover:bg-emerald-50`} onClick={closeSidebar}>
              <span className="text-xl mr-3">📊</span>
              <div className="text-left">
                <div className="font-medium text-gray-700 group-hover:text-emerald-700">Data Dashboard</div>
                <div className="text-xs text-gray-500 group-hover:text-emerald-600">View permits & statistics</div>
              </div>
            </a>
          </div>

          {/* Permit Management */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Permits</h3>
            <div className="space-y-2">
              <a href="/encoder?modal=add-permit" className={`${commonLinkClass} hover:bg-green-50`} onClick={closeSidebar}>
                <span className="text-xl mr-3">➕</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-green-700">Add New Permit</div>
                  <div className="text-xs text-gray-500 group-hover:text-green-600">Register driver permit</div>
                </div>
              </a>
              <a href="/encoder/permits" className={`${commonLinkClass} hover:bg-blue-50`} onClick={closeSidebar}>
                <span className="text-xl mr-3">📋</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-blue-700">View All Permits</div>
                  <div className="text-xs text-gray-500 group-hover:text-blue-600">Browse permit records</div>
                </div>
              </a>
              <a href="/encoder/permits/pending" className={`${commonLinkClass} hover:bg-yellow-50`} onClick={closeSidebar}>
                <span className="text-xl mr-3">⏳</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-yellow-700">Pending Permits</div>
                  <div className="text-xs text-gray-500 group-hover:text-yellow-600">Review applications</div>
                </div>
              </a>
            </div>
          </div>

          {/* Vehicle Management */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vehicles</h3>
            <div className="space-y-2">
              <a href="/encoder/vehicles/new" className={`${commonLinkClass} hover:bg-purple-50`} onClick={closeSidebar}>
                <span className="text-xl mr-3">🚗</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-purple-700">Register Vehicle</div>
                  <div className="text-xs text-gray-500 group-hover:text-purple-600">Add new vehicle</div>
                </div>
              </a>
              <a href="/encoder/vehicles" className={`${commonLinkClass} hover:bg-indigo-50`} onClick={closeSidebar}>
                <span className="text-xl mr-3">🔍</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 group-hover:text-indigo-700">Vehicle Registry</div>
                  <div className="text-xs text-gray-500 group-hover:text-indigo-600">Browse all vehicles</div>
                </div>
              </a>
            </div>
          </div>
        </nav>
      )

    // case 'ENFORCER':
    //   return (
    //     <nav className="space-y-3">
    //       {/* Enforcer Dashboard */}
    //       <div className="mb-6">
    //         <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Enforcement</h3>
    //         <a href="/enforcer" className={`${commonLinkClass} hover:bg-blue-50`} onClick={closeSidebar}>
    //           <span className="text-xl mr-3">🚔</span>
    //           <div className="text-left">
    //             <div className="font-medium text-gray-700 group-hover:text-blue-700">Enforcement Dashboard</div>
    //             <div className="text-xs text-gray-500 group-hover:text-blue-600">Monitor enforcement activities</div>
    //           </div>
    //         </a>
    //       </div>

    //       {/* Incident Management */}
    //       {/* <div className="mb-6">
    //         <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Incidents</h3>
    //         <div className="space-y-2">
    //           <button className={`${commonLinkClass} hover:bg-red-50`}>
    //             <span className="text-xl mr-3">📝</span>
    //             <div className="text-left">
    //               <div className="font-medium text-gray-700 group-hover:text-red-700">Create Incident Report</div>
    //               <div className="text-xs text-gray-500 group-hover:text-red-600">Report new violation</div>
    //             </div>
    //           </button>
    //           <button className={`${commonLinkClass} hover:bg-orange-50`}>
    //             <span className="text-xl mr-3">⚠️</span>
    //             <div className="text-left">
    //               <div className="font-medium text-gray-700 group-hover:text-orange-700">Active Incidents</div>
    //               <div className="text-xs text-gray-500 group-hover:text-orange-600">View ongoing cases</div>
    //             </div>
    //           </button>
    //           <button className={`${commonLinkClass} hover:bg-green-50`}>
    //             <span className="text-xl mr-3">✅</span>
    //             <div className="text-left">
    //               <div className="font-medium text-gray-700 group-hover:text-green-700">Resolved Cases</div>
    //               <div className="text-xs text-gray-500 group-hover:text-green-600">View closed incidents</div>
    //             </div>
    //           </button>
    //         </div>
    //       </div> */}

    //       {/* Field Tools */}
    //       <div className="mb-6">
    //         <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Field Tools</h3>
    //         <div className="space-y-2">
    //           <button className={`${commonLinkClass} hover:bg-purple-50`}>
    //             <span className="text-xl mr-3">🧮</span>
    //             <div className="text-left">
    //               <div className="font-medium text-gray-700 group-hover:text-purple-700">Fare Calculator</div>
    //               <div className="text-xs text-gray-500 group-hover:text-purple-600">Calculate fare violations</div>
    //             </div>
    //           </button>
    //           <button className={`${commonLinkClass} hover:bg-indigo-50`}>
    //             <span className="text-xl mr-3">📍</span>
    //             <div className="text-left">
    //               <div className="font-medium text-gray-700 group-hover:text-indigo-700">Location Verification</div>
    //               <div className="text-xs text-gray-500 group-hover:text-indigo-600">Verify coordinates</div>
    //             </div>
    //           </button>
    //           <button className={`${commonLinkClass} hover:bg-teal-50`}>
    //             <span className="text-xl mr-3">💰</span>
    //             <div className="text-left">
    //               <div className="font-medium text-gray-700 group-hover:text-teal-700">Penalty Calculator</div>
    //               <div className="text-xs text-gray-500 group-hover:text-teal-600">Calculate penalties</div>
    //             </div>
    //           </button>
    //         </div>
    //       </div>
    //     </nav>
    //   )

    default:
      return null
  }
}

export function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Check if user is an authority user who should see sidebar
  // Note: DATA_ENCODER and ENFORCER have their own layouts, only ADMIN uses sidebar
  const isAuthority = user && ['ADMIN', 'DATA_ENCODER'].includes(user.userType)
  
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
    <main className="flex-1 flex relative overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
            )}      {/* Quick Actions Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed lg:relative lg:translate-x-0
        w-80 flex-shrink-0 bg-white shadow-lg border-r border-gray-200
        h-[calc(100vh-4rem)] lg:h-full top-16 lg:top-0 z-40 transition-transform duration-300 ease-in-out
        lg:flex lg:flex-col
      `}>
        <div className="h-full overflow-y-auto">
          <div className="p-6">
            {/* Mobile Close Button */}
            <div className="flex items-center justify-between mb-6 lg:mb-0">
              <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Role-Specific Scaffolded Navigation */}
            {renderRoleSpecificNavigation(user.userType, setSidebarOpen)}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-h-screen min-w-0 overflow-auto">
        {/* Mobile Menu Toggle Button */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Open sidebar menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="font-medium">Menu</span>
          </button>
        </div>
        
        {children}
      </div>
    </main>
  )
}