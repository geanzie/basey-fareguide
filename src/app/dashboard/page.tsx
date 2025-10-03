'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import AuthorityDashboard from '@/components/AuthorityDashboard'
import PublicUserDashboard from '@/components/PublicUserDashboard'
import UserProfile from '@/components/UserProfile'
import IncidentReporting from '@/components/IncidentReporting'
import IncidentsList from '@/components/IncidentsList'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const [activeSection, setActiveSection] = useState<'dashboard' | 'profile' | 'driver' | 'incidents' | 'report'>('dashboard')
  const router = useRouter()

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

  const navigationItems = [
    {
      key: 'dashboard' as const,
      label: user?.userType === 'PUBLIC' ? 'My Dashboard' : 'Authority Dashboard',
      icon: '📊',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    },
    {
      key: 'profile' as const,
      label: 'My Profile',
      icon: '👤',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    },

    {
      key: 'report' as const,
      label: 'Report Incident',
      icon: '📝',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER', 'PUBLIC']
    },
    {
      key: 'incidents' as const,
      label: 'Manage Incidents',
      icon: '📋',
      available: ['ADMIN', 'DATA_ENCODER', 'ENFORCER'] // Only authorities can manage incidents
    }
  ]

  const availableItems = navigationItems.filter(item => 
    item.available.includes(user.userType)
  )

  return (
    <div className="bg-gray-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <nav className="space-y-2">
                {availableItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeSection === item.key
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Quick Access</h3>
                <div className="space-y-2">
                  <a
                    href="/"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <span className="mr-3">🧮</span>
                    Fare Calculator
                  </a>
                  <a
                    href="tel:09985986570"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <span className="mr-3">📞</span>
                    Emergency Hotline
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeSection === 'dashboard' && (
              user.userType === 'PUBLIC' ? (
                <PublicUserDashboard />
              ) : (
                <AuthorityDashboard />
              )
            )}
            
            {activeSection === 'profile' && (
              <UserProfile user={user} />
            )}
            
            {activeSection === 'report' && (
              <IncidentReporting />
            )}
            
            {activeSection === 'incidents' && (
              <IncidentsList />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}