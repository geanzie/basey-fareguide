'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import StatTile from '@/ui/StatTile'

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
      location: string
      createdAt: string
    }>
  }
  storage: {
    totalFiles: number
    totalSizeMB: number
    cleanupRecommended: boolean
  }
}

interface AdminUsersSummaryResponse {
  users?: Array<{ isActive: boolean; isVerified: boolean; userType: string }>
  summary?: {
    total: number
    active: number
    pending: number
    byType: Record<string, number>
  }
}

function getActivityIcon(status: string) {
  if (status === 'RESOLVED') {
    return {
      icon: DASHBOARD_ICONS.check,
      iconClassName: 'text-primary',
    }
  }

  return {
    icon: DASHBOARD_ICONS.reports,
    iconClassName: 'text-amber-600',
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

      const [usersRes, incidentsRes, storageRes] = await Promise.all([
        fetch('/api/admin/users?limit=1'),
        fetch('/api/admin/incidents/stats'),
        fetch('/api/admin/storage'),
      ])

      const [usersData, incidentsData, storageData] = await Promise.all([
        usersRes.ok ? usersRes.json() : { users: [] },
        incidentsRes.ok ? incidentsRes.json() : { total: 0, pending: 0, resolved: 0, investigating: 0, recent: [] },
        storageRes.ok ? storageRes.json() : { storage: { total: { files: 0, sizeMB: 0 } }, recommendations: { cleanupNeeded: false } },
      ])

      const typedUsersData = usersData as AdminUsersSummaryResponse
      const userSummary = typedUsersData.summary
      const fallbackUsers = typedUsersData.users || []

      setStats({
        users: {
          total: userSummary?.total ?? fallbackUsers.length,
          active: userSummary?.active ?? fallbackUsers.filter((user) => user.isActive).length,
          pending: userSummary?.pending ?? fallbackUsers.filter((user) => !user.isVerified).length,
          byType:
            userSummary?.byType ??
            fallbackUsers.reduce((acc: Record<string, number>, user) => {
              acc[user.userType] = (acc[user.userType] || 0) + 1
              return acc
            }, {}),
        },
        incidents: {
          total: incidentsData.total || 0,
          pending: incidentsData.pending || 0,
          resolved: incidentsData.resolved || 0,
          investigating: incidentsData.investigating || 0,
          recentActivity: incidentsData.recent || [],
        },
        storage: {
          totalFiles: storageData.storage?.total?.files || 0,
          totalSizeMB: storageData.storage?.total?.sizeMB || 0,
          cleanupRecommended: storageData.recommendations?.cleanupNeeded || false,
        },
      })
      setError(null)
    } catch (_error) {
      setError('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="border border-surface-border bg-surface shadow-card rounded-card p-6 animate-pulse">
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
        <div className="flex items-center gap-2">
          <DashboardIconSlot
            icon={DASHBOARD_ICONS.reports}
            size={DASHBOARD_ICON_POLICY.sizes.alert}
            className="text-red-700"
          />
          <h3 className="text-red-800 font-semibold">Dashboard Error</h3>
        </div>
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="border bg-surface shadow-card rounded-card p-6 border-gray-200/80">
        <div className="flex items-start gap-4">
          <div className={getDashboardIconChipClasses('emerald')}>
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.dashboard}
              size={DASHBOARD_ICON_POLICY.sizes.hero}
              className="text-primary-dark"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Administration Overview</h2>
            <p className="text-gray-600">
              Monitor live user, incident, and storage activity for the active Basey Fare Check system.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchDashboardStats()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-surface-border px-3 py-2 text-sm font-semibold text-ink-body transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.refresh}
              size={DASHBOARD_ICON_POLICY.sizes.button}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Only Total Users links: /admin/users *is* the list this counts.
            "Open Incidents" is pending + investigating, and the incidents page
            filters by one status at a time, so no view shows that number —
            an arrow there would promise a filter that does not exist. */}
        <StatTile
          label="Total Users"
          value={stats?.users.total || 0}
          icon={DASHBOARD_ICONS.users}
          tone="info"
          href="/admin/users"
        />
        <StatTile
          label="Pending Approvals"
          value={stats?.users.pending || 0}
          icon={DASHBOARD_ICONS.approval}
          tone="warning"
        />
        <StatTile
          label="Open Incidents"
          value={(stats?.incidents.pending || 0) + (stats?.incidents.investigating || 0)}
          icon={DASHBOARD_ICONS.reports}
          tone="danger"
        />
        <StatTile
          label="Storage Used"
          value={`${stats?.storage.totalSizeMB || 0} MB`}
          detail={stats?.storage.cleanupRecommended ? 'Cleanup recommended' : undefined}
          icon={DASHBOARD_ICONS.storage}
          tone="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="border border-surface-border bg-surface shadow-card rounded-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.users}
              size={DASHBOARD_ICON_POLICY.sizes.section}
              className="text-blue-600"
            />
            <h3 className="text-lg font-semibold text-gray-900">User Breakdown</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(stats?.users.byType || {}).length > 0 ? (
              Object.entries(stats?.users.byType || {}).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-gray-600 capitalize">{type.toLowerCase().replace('_', ' ')}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No user data available.</p>
            )}
          </div>
        </div>

        <div className="border border-surface-border bg-surface shadow-card rounded-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.list}
              size={DASHBOARD_ICON_POLICY.sizes.section}
              className="text-red-600"
            />
            <h3 className="text-lg font-semibold text-gray-900">Recent Incident Activity</h3>
          </div>
          {stats?.incidents.recentActivity?.length ? (
            <div className="space-y-4">
              {stats.incidents.recentActivity.slice(0, 5).map((incident) => {
                const activityIcon = getActivityIcon(incident.status)

                return (
                  <Link
                    key={incident.id}
                    href="/admin/incidents"
                    className="group block border border-surface-border bg-surface-alt rounded-xl p-4 transition-colors hover:bg-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex items-start gap-3">
                      <DashboardIconSlot
                        icon={activityIcon.icon}
                        size={DASHBOARD_ICON_POLICY.sizes.card}
                        className={activityIcon.iconClassName}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-gray-900">{incident.type.replace(/_/g, ' ')}</p>
                          <span className="text-xs text-gray-500">
                            {new Date(incident.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{incident.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {incident.location} - {incident.status}
                        </p>
                      </div>
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.arrowRight}
                        size={DASHBOARD_ICON_POLICY.sizes.card}
                        className="mt-0.5 text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent incident activity available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
