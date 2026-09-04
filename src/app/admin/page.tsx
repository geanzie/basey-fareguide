'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import RoleGuard from '@/components/RoleGuard'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  type DashboardIcon,
  type DashboardIconTone,
} from '@/components/dashboardIcons'
import NavCard from '@/ui/NavCard'
import PageShell from '@/ui/PageShell'

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

/**
 * Admin destinations that are NOT one tap away on a phone.
 *
 * Everything here is a secondary action in authenticatedNavigation, i.e. it
 * lives behind the mobile profile sheet, or (driver sessions) is in no nav list
 * at all. /admin/announcements is deliberately absent: it is a primary tab, so
 * a card for it would just be the bottom nav drawn twice.
 * See docs/adr/0004-dashboard-cards-are-not-a-second-navigation.md.
 */
const ADMIN_SHORTCUTS: Array<{
  title: string
  description: string
  href: string
  icon: DashboardIcon
  tone: DashboardIconTone
}> = [
  {
    title: 'Fare rate management',
    description: 'Update the base fare and per-kilometer rate.',
    href: '/admin/fare-rates',
    icon: DASHBOARD_ICONS.fare,
    tone: 'amber',
  },
  {
    title: 'User feedback',
    description: 'Read what riders and staff report, and mark each one reviewed.',
    href: '/admin/feedback',
    icon: DASHBOARD_ICONS.feedback,
    tone: 'violet',
  },
  {
    title: 'Driver session suspension',
    description: 'Choose which vehicle types let riders record trips by scanning the permit QR.',
    href: '/admin/settings/driver-sessions',
    icon: DASHBOARD_ICONS.vehicle,
    tone: 'emerald',
  },
  {
    title: 'Vehicle seat capacity',
    description: 'Set how many passengers each vehicle type carries, and what a charter costs.',
    href: '/admin/settings/vehicle-capacity',
    icon: DASHBOARD_ICONS.vehicle,
    tone: 'emerald',
  },
  {
    title: 'Routing settings',
    description: 'Manage the primary route provider.',
    href: '/admin/settings/routing',
    icon: DASHBOARD_ICONS.map,
    tone: 'emerald',
  },
]

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
      <PageShell
        title="Admin Dashboard"
        subtitle="Administration, oversight, storage, and location management"
      >
        <section className="mb-8 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Quick access
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Priority admin actions</h2>
            </div>
            <p className="hidden text-sm text-slate-500 lg:block">
              Jump directly into the tools you are most likely to use first.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ADMIN_SHORTCUTS.map((shortcut) => (
              <NavCard
                key={shortcut.href}
                href={shortcut.href}
                icon={shortcut.icon}
                tone={shortcut.tone}
                title={shortcut.title}
                description={shortcut.description}
              />
            ))}
          </div>
        </section>

        <div className="mb-8">
          {/* Scrolls on a phone, wraps on desktop — the FilterChips idiom, so
              a tab never gets clipped off the right edge. */}
          <nav className="flex gap-2 overflow-x-auto rounded-card border border-surface-border bg-surface p-2 shadow-card lg:flex-wrap lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border border-surface-border bg-surface-alt text-primary-dark'
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
      </PageShell>
    </RoleGuard>
  )
}
