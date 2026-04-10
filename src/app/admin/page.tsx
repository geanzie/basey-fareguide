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
  type DashboardIconTone,
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

const ADMIN_SHORTCUTS: Array<{
  title: string
  description: string
  href: string
  actionLabel: string
  icon: DashboardIcon
  tone: DashboardIconTone
}> = [
  {
    title: 'Fare rate management',
    description: 'Update the base fare and per-kilometer rate from the dedicated admin page.',
    href: '/admin/fare-rates',
    actionLabel: 'Open Fare Rates',
    icon: DASHBOARD_ICONS.fare,
    tone: 'amber',
  },
  {
    title: 'Traffic announcements',
    description: 'Post road advisories and emergency notices for constituents.',
    href: '/admin/announcements',
    actionLabel: 'Open Announcements',
    icon: DASHBOARD_ICONS.announcements,
    tone: 'blue',
  },
  {
    title: 'Routing settings',
    description: 'Manage the primary route provider from the dedicated routing settings page.',
    href: '/admin/settings/routing',
    actionLabel: 'Open Routing Settings',
    icon: DASHBOARD_ICONS.map,
    tone: 'emerald',
  },
]

const SHORTCUT_CARD_STYLES: Record<DashboardIconTone, {
  border: string
  eyebrow: string
  title: string
  description: string
  button: string
}> = {
  slate: {
    border: 'border-slate-200/80',
    eyebrow: 'text-slate-600',
    title: 'text-slate-900',
    description: 'text-slate-700',
    button: 'bg-slate-700 hover:bg-slate-800 text-white',
  },
  blue: {
    border: 'border-blue-200/80',
    eyebrow: 'text-blue-700',
    title: 'text-blue-950',
    description: 'text-blue-800',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  emerald: {
    border: 'border-emerald-200/80',
    eyebrow: 'text-emerald-700',
    title: 'text-emerald-950',
    description: 'text-emerald-800',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  red: {
    border: 'border-red-200/80',
    eyebrow: 'text-red-700',
    title: 'text-red-950',
    description: 'text-red-800',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  violet: {
    border: 'border-violet-200/80',
    eyebrow: 'text-violet-700',
    title: 'text-violet-950',
    description: 'text-violet-800',
    button: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  amber: {
    border: 'border-amber-200/80',
    eyebrow: 'text-amber-700',
    title: 'text-amber-950',
    description: 'text-amber-800',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  purple: {
    border: 'border-purple-200/80',
    eyebrow: 'text-purple-700',
    title: 'text-purple-950',
    description: 'text-purple-800',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
}

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
            {ADMIN_SHORTCUTS.map((shortcut) => {
              const cardStyles = SHORTCUT_CARD_STYLES[shortcut.tone]

              return (
                <article
                  key={shortcut.href}
                  className={`app-surface-card-strong flex h-full flex-col justify-between rounded-3xl border p-5 transition-transform duration-200 hover:-translate-y-0.5 ${cardStyles.border}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className={getDashboardIconChipClasses(shortcut.tone)}>
                        <DashboardIconSlot
                          icon={shortcut.icon}
                          size={DASHBOARD_ICON_POLICY.sizes.hero}
                          className={cardStyles.eyebrow}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${cardStyles.eyebrow}`}>
                          Direct page
                        </p>
                        <h3 className={`text-lg font-semibold ${cardStyles.title}`}>{shortcut.title}</h3>
                      </div>
                    </div>

                    <p className={`max-w-sm text-sm leading-6 ${cardStyles.description}`}>
                      {shortcut.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Admin shortcut
                    </p>
                    <Link
                      href={shortcut.href}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${cardStyles.button}`}
                    >
                      <span>{shortcut.actionLabel}</span>
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.arrowRight}
                        size={DASHBOARD_ICON_POLICY.sizes.button}
                        className="text-current"
                      />
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

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
