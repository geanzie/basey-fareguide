'use client'

import { useEffect, useState } from 'react'

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
    myTicketsIssued: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/enforcer/dashboard')

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setRecentActivity(data.recentActivity)
      }
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

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'incident_assigned':
        return 'Assigned'
      case 'incident_resolved':
        return 'Resolved'
      case 'evidence_uploaded':
        return 'Evidence'
      default:
        return 'Update'
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard label="Active Incidents" value={stats.activeIncidents} />
        <MetricCard label="Assigned To Me" value={stats.assignedToMe} />
        <MetricCard label="Resolved Today" value={stats.resolvedToday} />
        <MetricCard label="Incidents With Evidence" value={stats.pendingEvidence} />
        <MetricCard label="30-Day Avg Resolution" value={stats.averageResolutionTime} />
        <MetricCard label="Tickets Issued" value={stats.myTicketsIssued} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        {getActivityLabel(activity.type)}
                      </span>
                      <span className="text-xs text-gray-500">{formatTime(activity.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-900 mt-1">{activity.message}</p>
                  </div>
                  {activity.incidentId ? (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      #{activity.incidentId}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-sm font-medium text-gray-500">{label}</h3>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
    </div>
  )
}

export default EnforcerDashboard
