'use client'

import { useState, useEffect } from 'react'
import QuickActions from './QuickActions'

interface DashboardStats {
  activeIncidents: number
  assignedToMe: number
  resolvedToday: number
  pendingEvidence: number
  averageResolutionTime: string
  myTicketsIssued: number
}

interface RecentActivity {
  id: string
  type: 'incident_assigned' | 'incident_resolved' | 'evidence_uploaded'
  message: string
  timestamp: string
  incidentId?: string
}

const EnforcerDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    activeIncidents: 0,
    assignedToMe: 0,
    resolvedToday: 0,
    pendingEvidence: 0,
    averageResolutionTime: '0h',
    myTicketsIssued: 0
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      // Fetch dashboard statistics
      const response = await fetch('/api/enforcer/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setRecentActivity(data.recentActivity)
      } else {
        console.error('Failed to fetch dashboard data:', response.status)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now.getTime() - time.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'incident_assigned': return '🚨'
      case 'incident_resolved': return '✅'
      case 'evidence_uploaded': return '📁'
      default: return '📝'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <QuickActions />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <span className="text-2xl">🚨</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Active Incidents</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.activeIncidents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <span className="text-2xl">👮</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Assigned to Me</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.assignedToMe}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Resolved Today</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.resolvedToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <span className="text-2xl">📁</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Evidence</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingEvidence}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <span className="text-2xl">⏱️</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Avg. Resolution</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.averageResolutionTime}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <span className="text-2xl">🎫</span>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Tickets Issued</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.myTicketsIssued}</p>
            </div>
          </div>
        </div>
      </div>



      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <span className="text-xl">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">{formatTime(activity.timestamp)}</p>
                  </div>
                  {activity.incidentId && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      #{activity.incidentId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">📋</span>
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EnforcerDashboard