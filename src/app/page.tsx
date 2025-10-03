'use client'

import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import FareCalculator from '@/components/FareCalculator'

export default function HomePage() {
  const { user, loading } = useAuth()
  const isAuthenticated = !!user

  return (
    <>

      {/* Compact Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative container mx-auto px-4 py-12 lg:py-16">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-3xl lg:text-5xl font-bold mb-4 leading-tight">
              🚌 Basey Fare Guide
            </h1>
            
            <p className="text-lg lg:text-xl mb-8 opacity-90">
              Official transportation fare calculator for Basey Municipality, Samar
            </p>

            {/* Quick Access Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              {isAuthenticated ? (
                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center justify-center font-semibold border border-white border-opacity-30">
                  <span className="mr-2 text-lg">🗺️</span>
                  Route Calculator Available Below
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center justify-center transition-all font-semibold border border-white border-opacity-30"
                >
                  <span className="mr-2 text-lg">👤</span>
                  Login to Access Fare Calculator
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Calculator Section - Authentication Required */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            ) : isAuthenticated ? (
              <div className="animate-fade-in">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🗺️ Fare Calculator
                  </h2>
                  <p className="text-gray-600">
                    Calculate official transportation fares for Basey Municipality
                  </p>
                </div>
                <FareCalculator />
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">🔒</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Authentication Required
                  </h2>
                  <p className="text-gray-600 mb-8">
                    The fare calculator is only available to registered and authenticated users to ensure legitimate travel recording and system integrity.
                  </p>
                  <div className="space-y-3">
                    <Link
                      href="/auth"
                      className="block w-full bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                    >
                      Login to Access Calculator
                    </Link>
                    <Link
                      href="/auth?tab=register"
                      className="block w-full bg-gray-100 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Register New Account
                    </Link>
                  </div>
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-2">Why Authentication?</h3>
                    <ul className="text-sm text-blue-700 text-left space-y-1">
                      <li>• Ensures legitimate travel recording</li>
                      <li>• Prevents system abuse and fraud</li>
                      <li>• Maintains data accuracy and integrity</li>
                      <li>• Enables proper incident reporting</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Compact Features & Legal Section */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Features Grid */}
            <div className="text-center mb-8">
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">Key Features</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🔒</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Authenticated Access</h3>
                <p className="text-sm text-gray-600">Login required for calculator</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl">📝</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Incident Reports</h3>
                <p className="text-sm text-gray-600">Online violation reporting</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🎯</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">95% Accuracy</h3>
                <p className="text-sm text-gray-600">Road-based routing</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl">🧮</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Data Integrity</h3>
                <p className="text-sm text-gray-600">Legitimate user tracking</p>
              </div>
            </div>




            {/* Compact Legal Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fare Structure */}
              <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">📋</span>
                  <h3 className="text-lg font-bold text-emerald-700">Official Fare Structure</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">Base Fare (3km)</span>
                    <span className="text-xl font-bold text-emerald-600">₱15</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">Per additional km</span>
                    <span className="text-xl font-bold text-emerald-600">₱3</span>
                  </div>
                </div>
              </div>
              
              {/* Violation Penalties */}
              <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">⚠️</span>
                  <h3 className="text-lg font-bold text-red-700">Violation Penalties</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">1st Offense</span>
                    <span className="text-lg font-bold text-red-600">₱500</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">2nd Offense</span>
                    <span className="text-lg font-bold text-red-600">₱1,000</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">3rd Offense</span>
                    <span className="text-lg font-bold text-red-600">₱1,500</span>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>
      </section>

    </>
  )
}
