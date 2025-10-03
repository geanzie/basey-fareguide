'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

interface NavigationItem {
  key: string
  label: string
  icon: string
  path: string
  available: string[]
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Redirect if not authenticated
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-2">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to auth
  }

  const navigationItems: NavigationItem[] = [
    {
      key: 'dashboard',
      label: user?.userType === 'PUBLIC' ? 'My Dashboard' : 'Authority Dashboard',
      icon: '📊',
      path: '/dashboard',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    },
    {
      key: 'calculator',
      label: 'Fare Calculator',
      icon: '🧮',
      path: '/dashboard/calculator',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: '👤',
      path: '/dashboard/profile',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    },
    {
      key: 'incidents',
      label: 'View Incidents',
      icon: '📋',
      path: '/dashboard/incidents',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER']
    },
    {
      key: 'report',
      label: 'Report Incident',
      icon: '🚨',
      path: '/dashboard/report',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    }
  ]

  const availableItems = navigationItems.filter(item => 
    item.available.includes(user?.userType || '')
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden bg-white shadow-sm border-b px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center text-gray-600 hover:text-emerald-600"
        >
          <span className="text-xl mr-2">☰</span>
          Menu
        </button>
      </div>

      <div className="lg:flex">
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'block' : 'hidden'} lg:block
          w-full lg:w-64 bg-white shadow-lg lg:shadow-xl
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          overflow-y-auto
        `}>
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚌</span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Basey Fare Guide</h2>
                <p className="text-sm text-gray-500">Dashboard</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {availableItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.key}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-emerald-100 text-emerald-700 border-l-4 border-emerald-600' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-emerald-600'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 mt-auto">
            <div className="text-sm text-gray-500">
              <p><strong>Welcome back,</strong></p>
              <p>{user.firstName} {user.lastName}</p>
              <p className="text-xs mt-1 bg-gray-100 px-2 py-1 rounded">
                {user.userType}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 lg:ml-0">
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}