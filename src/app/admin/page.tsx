'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import RoleGuard from '@/components/RoleGuard'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
} from '@/components/dashboardIcons'
import PageWrapper from '@/components/PageWrapper'

const AdminUserManagement = dynamic(() => import('@/components/AdminUserManagement'), {
  loading: () => <div className="p-6">Loading users...</div>,
})

const StorageManagement = dynamic(() => import('@/components/StorageManagement'), {
  loading: () => <div className="p-6">Loading storage tools...</div>,
})

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <div className="p-6">Loading admin dashboard...</div>,
})

const AdminLocationManager = dynamic(() => import('@/components/AdminLocationManager'), {
  loading: () => <div className="p-6">Loading location manager...</div>,
})

type AdminTab = 'dashboard' | 'users' | 'storage' | 'locations'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent<AdminTab>
      if (customEvent.detail) {
        setActiveTab(customEvent.detail)
      }
    }

    window.addEventListener('adminTabChange', handleTabChange as EventListener)
    return () => window.removeEventListener('adminTabChange', handleTabChange as EventListener)
  }, [])

  const tabs: Array<{
    key: AdminTab
    label: string
    icon: DashboardIcon
  }> = [
    { key: 'dashboard', label: 'Dashboard', icon: DASHBOARD_ICONS.dashboard },
    { key: 'users', label: 'User Management', icon: DASHBOARD_ICONS.users },
    { key: 'storage', label: 'Storage Management', icon: DASHBOARD_ICONS.storage },
    { key: 'locations', label: 'Location Management', icon: DASHBOARD_ICONS.map },
  ]

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper
        title="Admin Dashboard"
        subtitle="Administration, oversight, storage, and location management"
      >
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="app-surface-card-strong rounded-2xl border border-amber-200/80 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={getDashboardIconChipClasses('amber')}>
                  <DashboardIconSlot
                    icon={DASHBOARD_ICONS.fare}
                    size={DASHBOARD_ICON_POLICY.sizes.hero}
                    className="text-amber-700"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-amber-900">Fare rate management</h2>
                  <p className="mt-1 text-sm text-amber-800">
                    Update the base fare and per-kilometer rate from the dedicated admin page.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/fare-rates"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                <DashboardIconSlot
                  icon={DASHBOARD_ICONS.fare}
                  size={DASHBOARD_ICON_POLICY.sizes.button}
                  className="text-white"
                />
                <span>Open Fare Rates</span>
              </Link>
            </div>
          </div>

          <div className="app-surface-card-strong rounded-2xl border border-blue-200/80 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={getDashboardIconChipClasses('blue')}>
                  <DashboardIconSlot
                    icon={DASHBOARD_ICONS.announcements}
                    size={DASHBOARD_ICON_POLICY.sizes.hero}
                    className="text-blue-700"
                  />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-blue-900">Traffic announcements</h2>
                  <p className="mt-1 text-sm text-blue-800">
                    Post road advisories and emergency notices for constituents.
                  </p>
                </div>
              </div>
              <Link
                href="/admin/announcements"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <DashboardIconSlot
                  icon={DASHBOARD_ICONS.announcements}
                  size={DASHBOARD_ICON_POLICY.sizes.button}
                  className="text-white"
                />
                <span>Open Announcements</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <nav className="app-surface-card flex flex-wrap gap-2 rounded-2xl p-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'app-surface-inner text-emerald-700'
                    : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
                }`}
              >
                <DashboardIconSlot
                  icon={tab.icon}
                  size={DASHBOARD_ICON_POLICY.sizes.tab}
                />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'users' && <AdminUserManagement />}
        {activeTab === 'storage' && <StorageManagement />}
        {activeTab === 'locations' && <AdminLocationManager />}
        {activeTab === 'dashboard' && <AdminDashboard />}
      </PageWrapper>
    </RoleGuard>
  )
}
