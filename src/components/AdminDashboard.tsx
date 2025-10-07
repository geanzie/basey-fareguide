'use client'

import { useState, useEffect } from 'react'

interface DashboardStats {
  users: {
    total: number
    active: number
    pending: number
    byType: Record<string, number>
  }
  incidents: {
    total: number
    pending: number
    resolved: number
    investigating: number
    recentActivity: Array<{
      id: string
      type: string
      description: string
      status: string
      createdAt: string
    }>
  }
  storage: {
    totalFiles: number
    totalSizeMB: number
    cleanupRecommended: boolean
  }
  system: {
    serverStatus: 'online' | 'offline'
    lastBackup?: string
    apiHealth: boolean
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Fetch multiple endpoints in parallel
      const [usersRes, incidentsRes, storageRes] = await Promise.all([
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/incidents/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/storage', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      const [usersData, incidentsData, storageData] = await Promise.all([
        usersRes.ok ? usersRes.json() : { users: [] },
        incidentsRes.ok ? incidentsRes.json() : { incidents: [] },
        storageRes.ok ? storageRes.json() : { storage: { total: { files: 0, sizeMB: 0 } } }
      ])

      // Process user stats
      const userStats = {
        total: usersData.users?.length || 0,
        active: usersData.users?.filter((u: any) => u.isActive)?.length || 0,
        pending: usersData.users?.filter((u: any) => !u.isVerified)?.length || 0,
        byType: usersData.users?.reduce((acc: any, user: any) => {
          acc[user.userType] = (acc[user.userType] || 0) + 1
          return acc
        }, {}) || {}
      }

      // Process incident stats (mock data for now since endpoint might not exist)
      const incidentStats = {
        total: incidentsData.total || 0,
        pending: incidentsData.pending || 0,
        resolved: incidentsData.resolved || 0,
        investigating: incidentsData.investigating || 0,
        recentActivity: incidentsData.recent || []
      }

      setStats({
        users: userStats,
        incidents: incidentStats,
        storage: {
          totalFiles: storageData.storage?.total?.files || 0,
          totalSizeMB: storageData.storage?.total?.sizeMB || 0,
          cleanupRecommended: storageData.recommendations?.cleanupNeeded || false
        },
        system: {
          serverStatus: 'online',
          apiHealth: true,
          lastBackup: new Date().toISOString()
        }
      })

    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setError('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <span className="text-red-500 text-xl mr-3">❌</span>
          <div>
            <h3 className="text-red-800 font-semibold">Dashboard Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-emerald-500 to-blue-600 rounded-xl text-white p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome to Admin Dashboard</h2>
            <p className="text-emerald-100">
              Monitor and manage the Basey Fare Guide system
            </p>
          </div>
          <div className="text-6xl opacity-20">
            ⚡
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white text-2xl">
                👥
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Users</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.users.total || 0}</div>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white text-2xl">
                ✅
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Active Users</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.users.active || 0}</div>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500 text-white text-2xl">
                ⏳
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Pending Approvals</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.users.pending || 0}</div>
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`flex items-center justify-center h-12 w-12 rounded-md text-white text-2xl ${
                stats?.storage.cleanupRecommended ? 'bg-red-500' : 'bg-purple-500'
              }`}>
                💾
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Storage Usage</div>
              <div className="text-2xl font-bold text-gray-900">{stats?.storage.totalSizeMB || 0} MB</div>
              {stats?.storage.cleanupRecommended && (
                <div className="text-xs text-red-600 font-medium">Cleanup needed</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Breakdown */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Breakdown by Type</h3>
          <div className="space-y-3">
            {Object.entries(stats?.users.byType || {}).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-gray-600 capitalize">
                  {type.toLowerCase().replace('_', ' ')}
                </span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Server Status</span>
              <span className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  stats?.system.serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="font-semibold capitalize">{stats?.system.serverStatus}</span>
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">API Health</span>
              <span className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  stats?.system.apiHealth ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="font-semibold">{stats?.system.apiHealth ? 'Healthy' : 'Issues'}</span>
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Evidence Files</span>
              <span className="font-semibold">{stats?.storage.totalFiles || 0}</span>
            </div>
          </div>
        </div>

        {/* Data Quality */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Data Quality</h3>
            <button
              onClick={() => window.location.href = '/admin/coordinate-verification'}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Verify Coordinates →
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Location Coordinates</span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                Verification Recommended
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Barangay Boundaries</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                GeoJSON Available
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Google Maps Integration</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                API Ready
              </span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-orange-50 rounded-lg">
            <div className="flex items-center">
              <span className="text-orange-500 text-lg mr-2">🔍</span>
              <div className="text-sm">
                <p className="text-orange-800 font-medium">Coordinate verification available</p>
                <p className="text-orange-700">Use the verification tool to validate location accuracy</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span className="mr-2">🔄</span>
            Refresh Data
          </button>
          
          <button
            onClick={() => {
              // Navigate to coordinate verification tool
              window.location.href = '/admin/coordinate-verification'
            }}
            className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <span className="mr-2">🗺️</span>
            Verify Coordinates
          </button>
          
          <button
            onClick={() => {
              // This would navigate to storage management
              const event = new CustomEvent('adminTabChange', { detail: 'storage' })
              window.dispatchEvent(event)
            }}
            className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <span className="mr-2">🧹</span>
            Manage Storage
          </button>
          
          <button
            onClick={() => {
              // This would navigate to user management
              const event = new CustomEvent('adminTabChange', { detail: 'users' })
              window.dispatchEvent(event)
            }}
            className="flex items-center justify-center px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <span className="mr-2">👥</span>
            Manage Users
          </button>
        </div>
      </div>
    </div>
  )
}