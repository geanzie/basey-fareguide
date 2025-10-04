'use client'

import { useState, useEffect } from 'react'
import IncidentsList from './IncidentsList'
import AdminUserManagement from './AdminUserManagement'
import PermitManagement from './PermitManagement'
import PermitStatistics from './PermitStatistics'

interface DashboardStats {
  totalIncidents: number
  pendingIncidents: number
  resolvedIncidents: number
  totalUsers: number
  activeDrivers: number
  registeredVehicles: number
  todayReports: number
  penaltiesCollected: number
}

interface RecentActivity {
  id: string
  type: 'incident' | 'registration' | 'penalty'
  description: string
  timestamp: string
  status?: string
}

const AuthorityDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState<string>('PUBLIC')

  useEffect(() => {
    // Get user type from localStorage or context
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      setUserType(userData.userType)
    }
    
    loadDashboardData()
    loadRecentActivity()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err)
    }
  }

  const loadRecentActivity = async () => {
    try {
      const response = await fetch('/api/dashboard/activity')
      if (response.ok) {
        const data = await response.json()
        setRecentActivity(data.activities || [])
      }
    } catch (err) {
      console.error('Error loading recent activity:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'incident': return '⚠️'
      case 'registration': return '👤'
      case 'penalty': return '💰'
      default: return '📋'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
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

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Dashboard Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl shadow-lg p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  {userType === 'ADMIN' ? 'Admin Dashboard' : 
                   userType === 'ENFORCER' ? 'Enforcer Dashboard' : 
                   userType === 'DATA_ENCODER' ? 'Encoder Dashboard' :
                   'Authority Dashboard'}
                </h1>
                <p className="text-emerald-100 mt-2">
                  Basey Transportation Management System
                </p>
              </div>
              <div className="text-right">
                <div className="text-emerald-200 text-sm">Today</div>
                <div className="text-2xl font-bold">{new Date().toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="px-6 py-8">
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Total Incidents</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalIncidents || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Pending Cases</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.pendingIncidents || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Resolved Cases</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.resolvedIncidents || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Penalties Collected</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.penaltiesCollected ? formatCurrency(stats.penaltiesCollected) : '₱0'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Statistics */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Registered Users</span>
                  <span className="font-semibold">{stats?.totalUsers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Drivers</span>
                  <span className="font-semibold">{stats?.activeDrivers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Registered Vehicles</span>
                  <span className="font-semibold">{stats?.registeredVehicles || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Today's Reports</span>
                  <span className="font-semibold text-red-600">{stats?.todayReports || 0}</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-lg">{getActivityIcon(activity.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Type Specific Content */}
          {userType === 'DATA_ENCODER' && (
            <div className="space-y-6">
              <PermitStatistics />
              <PermitManagement />
            </div>
          )}

          {userType === 'ADMIN' && (
            <div className="space-y-6">
              <AdminUserManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthorityDashboard