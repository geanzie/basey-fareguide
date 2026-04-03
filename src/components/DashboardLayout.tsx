'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

import type { SessionUserDto } from '@/lib/contracts'

import { useAuth } from '@/components/AuthProvider'
import BrandMark from '@/components/BrandMark'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  type DashboardIcon,
} from '@/components/dashboardIcons'
import RoleGuard from '@/components/RoleGuard'

interface NavigationItem {
  key: string
  label: string
  icon: DashboardIcon
  path: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      {user ? <DashboardLayoutBody user={user}>{children}</DashboardLayoutBody> : null}
    </RoleGuard>
  )
}

function DashboardLayoutBody({
  children,
  user,
}: {
  children: React.ReactNode
  user: SessionUserDto
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigationItems: NavigationItem[] = [
    {
      key: 'dashboard',
      label: 'My Dashboard',
      icon: DASHBOARD_ICONS.dashboard,
      path: '/dashboard',
    },
    {
      key: 'calculator',
      label: 'Fare Calculator',
      icon: DASHBOARD_ICONS.calculator,
      path: '/dashboard/calculator',
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: DASHBOARD_ICONS.user,
      path: '/dashboard/profile',
    },
    {
      key: 'report',
      label: 'Report Incident',
      icon: DASHBOARD_ICONS.incidents,
      path: '/dashboard/report',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden bg-white shadow-sm border-b px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-gray-600 hover:text-emerald-600"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.menu} size={DASHBOARD_ICON_POLICY.sizes.button} />
          <span className="text-sm font-medium">Menu</span>
        </button>
      </div>

      <div className="lg:flex">
        <div
          className={`
            ${sidebarOpen ? 'block' : 'hidden'} lg:block
            w-full lg:w-64 bg-white shadow-lg lg:shadow-xl
            fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
            overflow-y-auto
          `}
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <BrandMark />
              <div>
                <h2 className="text-lg font-bold text-gray-900">Basey Fare Guide</h2>
                <p className="text-sm text-gray-500">Dashboard</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.key}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive
                      ? 'bg-emerald-100 text-emerald-700 border-l-4 border-emerald-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-emerald-600'
                    }
                  `}
                >
                  <DashboardIconSlot icon={item.icon} size={DASHBOARD_ICON_POLICY.sizes.button} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 mt-auto">
            <div className="text-sm text-gray-500">
              <p><strong>Welcome back,</strong></p>
              <p>{user.firstName} {user.lastName}</p>
              <p className="text-xs mt-1 bg-gray-100 px-2 py-1 rounded">
                {user.userType}
              </p>
            </div>
          </div>
        </div>

        {sidebarOpen ? (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <div className="flex-1 lg:ml-0">
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
