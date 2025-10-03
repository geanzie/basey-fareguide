'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface User {
  userType: string
  firstName: string
  lastName: string
}

export default function Navigation() {
  const [user, setUser] = useState<User | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        setUser(JSON.parse(userData))
      } catch (err) {
        // Invalid user data, ignore
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    setUser(null)
    window.location.href = '/'
  }

  const isAuthority = user && ['ADMIN', 'DATA_ENCODER', 'ENFORCER'].includes(user.userType)

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <span className="text-2xl mr-2">🚌</span>
            <span className="text-xl font-bold text-gray-800">Basey Fare Guide</span>
          </div>
          
          <div className="hidden md:flex space-x-6">
            <Link 
              href="/" 
              className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
            >
              🏠 Home
            </Link>
            
            {!user ? (
              <Link 
                href="/auth" 
                className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              >
                👤 Login
              </Link>
            ) : (
              <>
                <Link 
                  href="/dashboard" 
                  className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                >
                  📊 {user.userType === 'PUBLIC' ? 'My Dashboard' : 'Dashboard'}
                </Link>
                
                {isAuthority && (
                  <Link 
                    href="/features" 
                    className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                  >
                    ⭐ Features
                  </Link>
                )}
                
                <Link 
                  href="/report" 
                  className="text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                >
                  📝 Report
                </Link>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Hi, {user.firstName}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
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
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-2 space-y-1">
            <Link 
              href="/" 
              className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              🏠 Home
            </Link>
            
            {!user ? (
              <Link 
                href="/auth" 
                className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                👤 Login
              </Link>
            ) : (
              <>
                <Link 
                  href="/dashboard" 
                  className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  📊 {user.userType === 'PUBLIC' ? 'My Dashboard' : 'Dashboard'}
                </Link>
                
                {isAuthority && (
                  <Link 
                    href="/features" 
                    className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ⭐ Features
                  </Link>
                )}
                
                <Link 
                  href="/report" 
                  className="block text-gray-600 hover:text-emerald-600 px-3 py-2 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  📝 Report
                </Link>
                
                <div className="px-3 py-2 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-2">
                    Hi, {user.firstName}
                  </div>
                  <button
                    onClick={() => {
                      handleLogout()
                      setMobileMenuOpen(false)
                    }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}