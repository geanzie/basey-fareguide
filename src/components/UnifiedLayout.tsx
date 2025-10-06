'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getCurrentPageData, subscribeToPageData } from './PageWrapper'

interface User {
  id: string
  userType: 'ADMIN' | 'DATA_ENCODER' | 'ENFORCER' | 'PUBLIC'
  firstName: string
  lastName: string
  username: string
  employeeId?: string
}

interface NavigationItem {
  id: string
  label: string
  icon: string
  href: string
  badge?: string
  children?: NavigationItem[]
}

interface UnifiedLayoutProps {
  children: React.ReactNode
  user: User
  title?: string
  subtitle?: string
  headerContent?: React.ReactNode
}

export default function UnifiedLayout({ children, user, title, subtitle, headerContent }: UnifiedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [pageData, setPageData] = useState(getCurrentPageData)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = subscribeToPageData(() => {
      setPageData({ ...getCurrentPageData() })
    })
    return unsubscribe
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    router.push('/auth')
  }

  const navigationItems: NavigationItem[] = getNavigationItems(user.userType)

  const isActive = (href: string) => {
    if (href === '/') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:relative lg:flex lg:flex-col
      `}>
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="flex items-center px-6 py-5 border-b border-gray-200 h-20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">BF</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">Basey Fare</h1>
                <p className="text-xs text-gray-500">Municipality System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => (
              <NavigationLink
                key={item.id}
                item={item}
                isActive={isActive(item.href)}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 flex-shrink-0 h-20">
          <div className="flex items-center justify-between px-4 py-5 sm:px-6 h-full">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Page Title */}
            <div className="flex-1 min-w-0 px-4 lg:px-0">
              {(pageData.title || title) && (
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 truncate">
                    {pageData.title || title}
                  </h1>
                  {(pageData.subtitle || subtitle) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {pageData.subtitle || subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Header Content */}
            {(pageData.headerContent || headerContent) && (
              <div className="flex-shrink-0 mr-4">
                {pageData.headerContent || headerContent}
              </div>
            )}

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-emerald-600 text-sm font-semibold">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </span>
                </div>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    👤 Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// Navigation Link Component
function NavigationLink({ 
  item, 
  isActive, 
  onNavigate 
}: { 
  item: NavigationItem
  isActive: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`
        flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${isActive 
          ? 'bg-emerald-100 text-emerald-700 border-r-2 border-emerald-500' 
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }
      `}
    >
      <span className="text-lg">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

// Navigation items based on user role
function getNavigationItems(userType: string): NavigationItem[] {
  const commonItems = [
    {
      id: 'verify-coordinates',
      label: 'Coordinate Verification',
      icon: '📍',
      href: '/verify-coordinates'
    }
  ]

  switch (userType) {
    case 'ADMIN':
      return [
        {
          id: 'dashboard',
          label: 'Admin Dashboard',
          icon: '📊',
          href: '/admin'
        },
        {
          id: 'users',
          label: 'User Management',
          icon: '👥',
          href: '/admin/users'
        },
        {
          id: 'incidents',
          label: 'All Incidents',
          icon: '🚨',
          href: '/admin/incidents'
        },
        {
          id: 'reports',
          label: 'System Reports',
          icon: '📈',
          href: '/admin/reports'
        },
        ...commonItems
      ]

    case 'DATA_ENCODER':
      return [
        {
          id: 'dashboard',
          label: 'Encoder Dashboard',
          icon: '📊',
          href: '/encoder'
        },
        {
          id: 'permits',
          label: 'Permit Management',
          icon: '📄',
          href: '/encoder/permits'
        },
        {
          id: 'vehicles',
          label: 'Vehicle Registry',
          icon: '🚗',
          href: '/encoder/vehicles'
        },
        ...commonItems
      ]

    case 'ENFORCER':
      return [
        {
          id: 'dashboard',
          label: 'Enforcement Dashboard',
          icon: '📊',
          href: '/enforcer'
        },
        {
          id: 'incidents',
          label: 'Incident Queue',
          icon: '📋',
          href: '/enforcer/incidents'
        },
        {
          id: 'patrol',
          label: 'Patrol Management',
          icon: '🚓',
          href: '/enforcer/patrol'
        },
        {
          id: 'reports',
          label: 'Enforcement Reports',
          icon: '📝',
          href: '/enforcer/reports'
        },
        {
          id: 'map',
          label: 'Offline Map',
          icon: '🗺️',
          href: '/enforcer/map'
        }
      ]

    case 'PUBLIC':
      return [
        {
          id: 'dashboard',
          label: 'My Dashboard',
          icon: '📊',
          href: '/dashboard'
        },
        {
          id: 'calculator',
          label: 'Fare Calculator',
          icon: '🧮',
          href: '/calculator'
        },
        {
          id: 'report',
          label: 'Report Incident',
          icon: '🚨',
          href: '/report'
        },
        {
          id: 'history',
          label: 'My History',
          icon: '📋',
          href: '/history'
        },
        {
          id: 'profile',
          label: 'My Profile',
          icon: '👤',
          href: '/profile'
        }
      ]

    default:
      return []
  }
}