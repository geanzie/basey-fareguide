'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Incident {
  id: string
  type: string
  description: string
  location: string
  date: string
  status: string
}

interface Route {
  id: string
  from: string
  to: string
  distance: string
  fare: string
  date: string
}

export default function PublicUserDashboard() {
  const [reportedIncidents, setReportedIncidents] = useState<Incident[]>([])
  const [recentRoutes, setRecentRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading user's personal data
    // In real implementation, fetch from API based on user ID
    setTimeout(() => {
      setReportedIncidents([
        {
          id: '1',
          type: 'Overcharging',
          description: 'Jeepney charged ₱25 for a ₱18 route',
          location: 'Basey to San Sebastian',
          date: '2024-01-15',
          status: 'Under Investigation'
        }
      ])
      
      setRecentRoutes([
        {
          id: '1',
          from: 'Basey Town Center',
          to: 'Brgy. San Sebastian',
          distance: '8.2 km',
          fare: '₱30.60',
          date: '2024-01-20'
        },
        {
          id: '2',
          from: 'Brgy. Poblacion',
          to: 'Brgy. Mercado',
          distance: '4.5 km',
          fare: '₱19.50',
          date: '2024-01-18'
        }
      ])
      
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-gray-300 rounded-lg"></div>
            <div className="h-48 bg-gray-300 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
        <h2 className="text-2xl font-bold text-emerald-800 mb-2">� Welcome to Your Dashboard</h2>
        <p className="text-emerald-700">
          Manage your travel activities and transportation information in Basey Municipality.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/calculator"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100 group"
        >
          <div className="text-center">
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🧮</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fare Calculator</h3>
            <p className="text-gray-600 text-sm">Calculate official transportation fares</p>
          </div>
        </Link>
        
        <Link
          href="/dashboard/report"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100 group"
        >
          <div className="text-center">
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🚨</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Report Incident</h3>
            <p className="text-gray-600 text-sm">Report transportation violations</p>
          </div>
        </Link>
        
        <Link
          href="/dashboard/profile"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100 group"
        >
          <div className="text-center">
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">👤</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">My Profile</h3>
            <p className="text-gray-600 text-sm">Manage your account settings</p>
          </div>
        </Link>
      </div>

      {/* Compact Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl mb-1">📊</div>
            <p className="text-lg font-bold text-gray-900">{recentRoutes.length}</p>
            <p className="text-xs text-gray-600">Routes</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl mb-1">📝</div>
            <p className="text-lg font-bold text-gray-900">{reportedIncidents.length}</p>
            <p className="text-xs text-gray-600">Reports</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl mb-1">💰</div>
            <p className="text-lg font-bold text-gray-900">₱{
              recentRoutes.reduce((total, route) => 
                total + parseFloat(route.fare.replace('₱', '')), 0
              ).toFixed(0)
            }</p>
            <p className="text-xs text-gray-600">Total Fare</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl mb-1">📍</div>
            <p className="text-lg font-bold text-gray-900">{
              recentRoutes.reduce((total, route) => 
                total + parseFloat(route.distance.split(' ')[0]), 0
              ).toFixed(1)
            }</p>
            <p className="text-xs text-gray-600">km Traveled</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Routes */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Routes</h3>
            <p className="text-sm text-gray-600">Your transportation history</p>
          </div>
          <div className="p-6">
            {recentRoutes.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-6xl mb-4 block">🚌</span>
                <p className="text-gray-600">No routes calculated yet</p>
                <a 
                  href="/"
                  className="mt-4 inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Calculate Fare
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRoutes.map((route) => (
                  <div key={route.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {route.from} → {route.to}
                        </p>
                        <p className="text-sm text-gray-600">
                          {route.distance} • {route.date}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-emerald-600">
                        {route.fare}
                      </span>
                    </div>
                  </div>
                ))}
                <button className="w-full text-center py-2 text-emerald-600 hover:text-emerald-700 font-medium">
                  View All Routes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Reported Incidents */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">My Reports</h3>
            <p className="text-sm text-gray-600">Incidents you've reported</p>
          </div>
          <div className="p-6">
            {reportedIncidents.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-6xl mb-4 block">📝</span>
                <p className="text-gray-600">No incidents reported yet</p>
                <button className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                  Report Incident
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reportedIncidents.map((incident) => (
                  <div key={incident.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{incident.type}</p>
                        <p className="text-sm text-gray-600 mb-1">
                          {incident.location} • {incident.date}
                        </p>
                        <p className="text-sm text-gray-700">{incident.description}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        incident.status === 'Under Investigation' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : incident.status === 'Resolved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                ))}
                <button className="w-full text-center py-2 text-red-600 hover:text-red-700 font-medium">
                  View All Reports
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/"
            className="flex items-center p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <span className="text-2xl mr-3">🧮</span>
            <div>
              <p className="font-medium text-emerald-800">Calculate Fare</p>
              <p className="text-sm text-emerald-600">Check route pricing</p>
            </div>
          </a>
          
          <button className="flex items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
            <span className="text-2xl mr-3">📝</span>
            <div>
              <p className="font-medium text-red-800">Report Issue</p>
              <p className="text-sm text-red-600">File a complaint</p>
            </div>
          </button>
          
          <a
            href="tel:09985986570"
            className="flex items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <span className="text-2xl mr-3">📞</span>
            <div>
              <p className="font-medium text-blue-800">Emergency Call</p>
              <p className="text-sm text-blue-600">Contact authorities</p>
            </div>
          </a>
          
          <button className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
            <span className="text-2xl mr-3">📊</span>
            <div>
              <p className="font-medium text-purple-800">View History</p>
              <p className="text-sm text-purple-600">See all activities</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}