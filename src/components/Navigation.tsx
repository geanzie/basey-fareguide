'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function Navigation() {
  const { user, loading, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await logout()
  }

  const getDashboardUrl = (userType: string) => {
    switch (userType) {
      case 'ADMIN': return '/admin'
      case 'DATA_ENCODER': return '/encoder'
      case 'ENFORCER': return '/enforcer'
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

  const renderRoleBasedNavigation = (userType: string, isMobile = false) => {
    const linkClass = isMobile
      ? 'block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium'
      : 'text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium'

    const handleClick = isMobile ? () => setMobileMenuOpen(false) : undefined

    const dashboardLink = (
      <Link
        href={getDashboardUrl(userType)}
        className={linkClass}
        onClick={handleClick}
        key="dashboard"
      >
        ðŸ“Š {getDashboardLabel(userType)}
      </Link>
    )

    switch (userType) {
      case 'DATA_ENCODER':
        return <>{dashboardLink}</>

      case 'PUBLIC':
      default:
        return (
          <>
            {dashboardLink}
            <Link href="/calculator" className={linkClass} onClick={handleClick} key="calculator">
              ðŸ§® Fare Calculator
            </Link>
            <Link href="/report" className={linkClass} onClick={handleClick} key="report">
              ðŸ“ Report Issue
            </Link>
            <Link href="/features" className={linkClass} onClick={handleClick} key="features">
              â­ Features
            </Link>
          </>
        )
    }
  }

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <span className="text-2xl mr-2">ðŸšŒ</span>
            <span className="text-xl font-bold text-gray-800">Basey Fare Guide</span>
          </div>

          <div className="hidden md:flex space-x-6">
            <Link href="/" className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium">
              ðŸ  Home
            </Link>

            {!user && !loading ? (
              <Link href="/auth" className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium">
                ðŸ‘¤ Login
              </Link>
            ) : user ? (
              <>
                {renderRoleBasedNavigation(user.userType, false)}
                <Link href="/report" className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium">
                  ï¿½ Report Issue
                </Link>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Hi, {user.firstName}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-600 hover:text-emerald-600 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-2 space-y-1">
            <Link
              href="/"
              className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              ðŸ  Home
            </Link>

            {!user && !loading ? (
              <Link
                href="/auth"
                className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                ðŸ‘¤ Login
              </Link>
            ) : user ? (
              <>
                {renderRoleBasedNavigation(user.userType, true)}
                <Link
                  href="/report"
                  className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ï¿½ Report Issue
                </Link>
                <div className="px-3 py-2 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">Hi, {user.firstName}</div>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  )
}
