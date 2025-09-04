'use client'

import { useState } from 'react'
import FareCalculator from '@/components/FareCalculator'
import GPSFareCalculator from '@/components/GPSFareCalculator'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'route' | 'gps'>('route')

  return (
    <div className="min-h-screen">
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
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
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🎯</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">90% Accuracy</h3>
                <p className="text-sm text-gray-600">Advanced algorithms</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">🗺️</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Interactive Maps</h3>
                <p className="text-sm text-gray-600">Real-time routes</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">⚖️</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Fair Pricing</h3>
                <p className="text-sm text-gray-600">Standardized rates</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📱</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Mobile Ready</h3>
                <p className="text-sm text-gray-600">All devices</p>
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

            {/* Contact Section */}
            <div className="bg-blue-600 rounded-xl p-6 text-white mt-6">
              <div className="text-center">
                <h3 className="text-lg font-bold mb-2">Report Violations</h3>
                <p className="text-blue-100 mb-4 text-sm">
                  Help maintain fair pricing by reporting violations
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <a 
                    href="tel:09985986570" 
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-center transition-all font-medium text-sm"
                  >
                    <span className="mr-2">📞</span>
                    09985986570
                  </a>
                  <a 
                    href="tel:09177140798" 
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-center transition-all font-medium text-sm"
                  >
                    <span className="mr-2">📞</span>
                    09177140798
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
