'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import FareCalculator from '@/components/FareCalculator'
import GPSFareCalculator from '@/components/GPSFareCalculator'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'route' | 'gps'>('route')

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <Navigation />

      {/* Compact Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative container mx-auto px-4 py-12 lg:py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-4">
              <span className="inline-block px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold backdrop-blur-sm">
                Municipal Ordinance 105 Series of 2023
              </span>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-bold mb-4 leading-tight">
              Basey Fare Guide
            </h1>
            
            <p className="text-lg lg:text-xl mb-6 opacity-90">
              Official transportation fare calculator for Basey Municipality, Samar
            </p>
            
            {/* Compact Statistics */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
              <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-3 border border-white border-opacity-20">
                <div className="text-xl font-bold">₱15</div>
                <div className="text-xs opacity-90">Base Fare</div>
              </div>
              <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-3 border border-white border-opacity-20">
                <div className="text-xl font-bold">₱3</div>
                <div className="text-xs opacity-90">Per Add'l KM</div>
              </div>
              <div className="bg-white bg-opacity-15 backdrop-blur-sm rounded-lg p-3 border border-white border-opacity-20">
                <div className="text-xl font-bold">51</div>
                <div className="text-xs opacity-90">Barangays</div>
              </div>
            </div>

            {/* Quick Access Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
              <button
                onClick={() => setActiveTab('route')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center justify-center transition-all font-semibold border border-white border-opacity-30"
              >
                <span className="mr-2 text-lg">🗺️</span>
                Route Calculator
              </button>
              <button
                onClick={() => setActiveTab('gps')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center justify-center transition-all font-semibold border border-white border-opacity-30"
              >
                <span className="mr-2 text-lg">📍</span>
                GPS Calculator
              </button>
              <a
                href="/auth"
                className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-6 py-3 flex items-center justify-center transition-all font-semibold border border-white border-opacity-30"
              >
                <span className="mr-2 text-lg">👤</span>
                Login/Register
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Calculator Section - More Prominent */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Tab Indicator */}
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-lg p-1 shadow-md">
                <button
                  onClick={() => setActiveTab('route')}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    activeTab === 'route'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-emerald-600'
                  }`}
                >
                  🗺️ Route Calculator
                </button>
                <button
                  onClick={() => setActiveTab('gps')}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    activeTab === 'gps'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-emerald-600'
                  }`}
                >
                  📍 GPS Calculator
                </button>
              </div>
            </div>

            {activeTab === 'route' && (
              <div className="animate-fade-in">
                <FareCalculator />
              </div>
            )}
            
            {activeTab === 'gps' && (
              <div className="animate-fade-in">
                <GPSFareCalculator />
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
                  <span className="text-xl">🎯</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">95% Accuracy</h3>
                <p className="text-sm text-gray-600">Road-based routing</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">�</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Incident Reports</h3>
                <p className="text-sm text-gray-600">Online violation reporting</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">👤</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">User Accounts</h3>
                <p className="text-sm text-gray-600">Driver & user profiles</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">�</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Management</h3>
                <p className="text-sm text-gray-600">Authority dashboard</p>
              </div>
            </div>

            {/* Security & Trust Section */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-8 mb-8 border border-red-100">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Enhanced Security & Trust</h3>
                <p className="text-gray-600">Preventing fraud and ensuring legitimate usage</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm">🚫</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Restricted Role Registration</h4>
                      <p className="text-sm text-gray-600">Only administrators can create Enforcer and Data Encoder accounts. Prevents unauthorized access to sensitive functions.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm">✅</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Identity Verification</h4>
                      <p className="text-sm text-gray-600">All public users must provide government ID, age verification (18+), and barangay residence. Manual admin approval required.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm">📋</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Complete Audit Trail</h4>
                      <p className="text-sm text-gray-600">Track all user activities, account changes, and incident reports with IP logging and verification history.</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <div className="flex items-start">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3 mt-1">
                      <span className="text-sm">⚙️</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Admin User Management</h4>
                      <p className="text-sm text-gray-600">Centralized user creation, verification queue, account status controls, and comprehensive user management tools.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-center mt-6">
                <div className="bg-white rounded-lg p-4 border border-green-200 bg-green-50">
                  <h4 className="font-semibold text-green-800 mb-2">🛡️ System Integrity Guaranteed</h4>
                  <p className="text-sm text-green-700">
                    Our enhanced security prevents fake accounts, false reports, and unauthorized access. 
                    Only verified users can file incident reports, ensuring accountability and system trust.
                  </p>
                </div>
              </div>
            </div>

            {/* System Features */}
            <div className="bg-gray-50 rounded-xl p-8 mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Complete Transportation Management System</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link 
                  href="/auth"
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-emerald-500"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">🧮</span>
                    <h4 className="font-semibold text-gray-900">Fare Calculator</h4>
                  </div>
                  <p className="text-gray-600 text-sm">Route-based and GPS fare calculation with 95% accuracy</p>
                </Link>
                
                <Link 
                  href="/report"
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-red-500"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">⚠️</span>
                    <h4 className="font-semibold text-gray-900">Incident Reporting</h4>
                  </div>
                  <p className="text-gray-600 text-sm">Report violations with GPS location and photo evidence</p>
                </Link>
                
                <Link 
                  href="/auth"
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-blue-500"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">🚗</span>
                    <h4 className="font-semibold text-gray-900">Driver Profiles</h4>
                  </div>
                  <p className="text-gray-600 text-sm">License management and vehicle registration system</p>
                </Link>
                
                <Link 
                  href="/auth"
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-purple-500"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">👥</span>
                    <h4 className="font-semibold text-gray-900">User Management</h4>
                  </div>
                  <p className="text-gray-600 text-sm">4 user types: Admin, Encoder, Enforcer, Public</p>
                </Link>
                
                <Link 
                  href="/dashboard"
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-yellow-500"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">📊</span>
                    <h4 className="font-semibold text-gray-900">Authority Dashboard</h4>
                  </div>
                  <p className="text-gray-600 text-sm">Real-time statistics and incident management</p>
                </Link>
                
                <Link 
                  href="/auth"
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-green-500"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">📋</span>
                    <h4 className="font-semibold text-gray-900">Incident Lists</h4>
                  </div>
                  <p className="text-gray-600 text-sm">Track and manage all violation reports</p>
                </Link>
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

            {/* Contact & Quick Actions Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Report Violations */}
              <div className="bg-blue-600 rounded-xl p-6 text-white">
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-2">Report Violations</h3>
                  <p className="text-blue-100 mb-4 text-sm">
                    Help maintain fair pricing by reporting violations
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <Link 
                      href="/report"
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-center transition-all font-medium text-sm"
                    >
                      <span className="mr-2">📝</span>
                      Report Online
                    </Link>
                    <div className="flex gap-2">
                      <a 
                        href="tel:09985986570" 
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-center transition-all font-medium text-xs flex-1"
                      >
                        <span className="mr-1">📞</span>
                        09985986570
                      </a>
                      <a 
                        href="tel:09177140798" 
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-center transition-all font-medium text-xs flex-1"
                      >
                        <span className="mr-1">📞</span>
                        09177140798
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* System Access */}
              <div className="bg-emerald-600 rounded-xl p-6 text-white">
                <div className="text-center">
                  <h3 className="text-lg font-bold mb-2">System Access</h3>
                  <p className="text-emerald-100 mb-4 text-sm">
                    Access driver profiles, incident reports, and more
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <Link 
                      href="/auth"
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-center transition-all font-medium text-sm"
                    >
                      <span className="mr-2">👤</span>
                      Login / Register
                    </Link>
                    <Link 
                      href="/dashboard"
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-center transition-all font-medium text-sm"
                    >
                      <span className="mr-2">📊</span>
                      Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* About */}
            <div>
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-2">🚌</span>
                <span className="text-xl font-bold">Basey Fare Guide</span>
              </div>
              <p className="text-gray-300 text-sm">
                Official transportation fare management system for Basey Municipality, Samar.
              </p>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="text-gray-300 hover:text-white">🏠 Home</Link></li>
                <li><Link href="/auth" className="text-gray-300 hover:text-white">👤 Login</Link></li>
                <li><Link href="/dashboard" className="text-gray-300 hover:text-white">📊 Dashboard</Link></li>
              </ul>
            </div>
            
            {/* Features */}
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth" className="text-gray-300 hover:text-white">🧮 Fare Calculator</Link></li>
                <li><Link href="/report" className="text-gray-300 hover:text-white">📝 Report Incidents</Link></li>
                <li><Link href="/auth" className="text-gray-300 hover:text-white">🚗 Driver Profiles</Link></li>
                <li><Link href="/auth" className="text-gray-300 hover:text-white">📊 Statistics</Link></li>
              </ul>
            </div>
            
            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="tel:09985986570" className="text-gray-300 hover:text-white">📞 09985986570</a></li>
                <li><a href="tel:09177140798" className="text-gray-300 hover:text-white">📞 09177140798</a></li>
                <li><span className="text-gray-300">🏛️ Municipal Hall, Basey</span></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2025 Basey Municipality, Samar. Municipal Ordinance 105 Series of 2023.</p>
            <p className="mt-2">Official Transportation Fare Management System</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
