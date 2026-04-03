'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { getCurrentPageData, subscribeToPageData } from './PageWrapper'
import BrandMark from './BrandMark'
import { useAuth } from './AuthProvider'
import type { SessionUserDto } from '@/lib/contracts'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  type DashboardIcon,
} from '@/components/dashboardIcons'

interface NavigationItem {
  id: string
  label: string
  icon: DashboardIcon
  href: string
  badge?: string
  children?: NavigationItem[]
}

interface UnifiedLayoutProps {
  children: React.ReactNode
  user: SessionUserDto
  title?: string
  subtitle?: string
  headerContent?: React.ReactNode
}

export default function UnifiedLayout({
  children,
  user,
  title,
  subtitle,
  headerContent,
}: UnifiedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [pageData, setPageData] = useState(getCurrentPageData)
  const pathname = usePathname()
  const { logout, status } = useAuth()

  useEffect(() => {
    const unsubscribe = subscribeToPageData(() => {
      setPageData({ ...getCurrentPageData() })
    })
    return unsubscribe
  }, [])

  const handleLogout = async () => {
    if (status === 'logging_out') {
      return
    }

    setUserMenuOpen(false)
    await logout()
  }

  const navigationItems: NavigationItem[] = getNavigationItems(user.userType)

  const isActive = (href: string) => {
    if (href === '/') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="app-shell-bg min-h-screen flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
        app-surface-overlay fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200/80 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:relative lg:flex lg:flex-col
      `}
      >
        <div className="flex flex-col h-full">
          <div className="flex h-20 items-center border-b border-slate-200/80 px-6 py-5">
            <div className="flex items-center space-x-3">
              <BrandMark />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">Basey Fare</h1>
                <p className="text-xs text-gray-500">Municipality System</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => (
              <NavigationLink
                key={item.id}
                item={item}
                isActive={isActive(item.href)}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="app-surface-overlay sticky top-0 z-30 h-20 flex-shrink-0 border-b border-slate-200/80">
          <div className="flex items-center justify-between px-4 py-5 sm:px-6 h-full">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg p-2 text-gray-600 transition-colors hover:bg-white/70 hover:text-gray-900"
            >
              <DashboardIconSlot
                icon={DASHBOARD_ICONS.menu}
                size={24}
              />
            </button>

            <div className="flex-1 min-w-0 px-4 lg:px-0">
              {(pageData.title || title) && (
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 truncate">
                    {pageData.title || title}
                  </h1>
                  {(pageData.subtitle || subtitle) && (
                    <p className="text-sm text-gray-500 mt-1">
                      {pageData.subtitle || subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>

            {(pageData.headerContent || headerContent) && (
              <div className="flex-shrink-0 mr-4">
                {pageData.headerContent || headerContent}
              </div>
            )}

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-white/70 hover:text-gray-900"
              >
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-emerald-600 text-sm font-semibold">
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </span>
                </div>
                <DashboardIconSlot
                  icon={DASHBOARD_ICONS.chevronDown}
                  size={16}
                />
              </button>

              {userMenuOpen && (
                <div className="app-surface-overlay absolute right-0 z-50 mt-2 w-48 rounded-2xl py-2">
                  <div className="border-b border-slate-200/80 px-4 py-2">
                    <p className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-white/70"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.user}
                      size={DASHBOARD_ICON_POLICY.sizes.button}
                    />
                    <span>Profile Settings</span>
                  </Link>
                  {user.userType === 'PUBLIC' && (
                    <Link
                      href="/profile/discount"
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50/80"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <DashboardIconSlot
                        icon={DASHBOARD_ICONS.discount}
                        size={DASHBOARD_ICON_POLICY.sizes.button}
                      />
                      <span>Discount Card</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    disabled={status === 'logging_out'}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50/80 disabled:opacity-60"
                  >
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.logout}
                      size={DASHBOARD_ICON_POLICY.sizes.button}
                    />
                    <span>{status === 'logging_out' ? 'Signing out...' : 'Logout'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

function NavigationLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavigationItem
  isActive: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`
        flex items-center space-x-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors
        ${
          isActive
            ? 'bg-emerald-100/90 text-emerald-700 ring-1 ring-emerald-200'
            : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
        }
      `}
    >
      <DashboardIconSlot
        icon={item.icon}
        size={DASHBOARD_ICON_POLICY.sizes.tab}
      />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function getNavigationItems(userType: string): NavigationItem[] {
  const commonItems: NavigationItem[] = [
    // Removed coordinate verification from common items - now admin only
  ]

  switch (userType) {
    case 'ADMIN':
      return [
        {
          id: 'dashboard',
          label: 'Admin Dashboard',
          icon: DASHBOARD_ICONS.dashboard,
          href: '/admin',
        },
        {
          id: 'users',
          label: 'User Management',
          icon: DASHBOARD_ICONS.users,
          href: '/admin/users',
        },
        {
          id: 'discount-cards',
          label: 'Discount Cards',
          icon: DASHBOARD_ICONS.discount,
          href: '/admin/discount-cards',
        },
        {
          id: 'incidents',
          label: 'All Incidents',
          icon: DASHBOARD_ICONS.incidents,
          href: '/admin/incidents',
        },
        {
          id: 'reports',
          label: 'System Reports',
          icon: DASHBOARD_ICONS.reports,
          href: '/admin/reports',
        },
        {
          id: 'fare-rates',
          label: 'Fare Rates',
          icon: DASHBOARD_ICONS.fare,
          href: '/admin/fare-rates',
        },
        {
          id: 'announcements',
          label: 'Announcements',
          icon: DASHBOARD_ICONS.announcements,
          href: '/admin/announcements',
        },
        ...commonItems,
      ]

    case 'DATA_ENCODER':
      return [
        {
          id: 'dashboard',
          label: 'Encoder Dashboard',
          icon: DASHBOARD_ICONS.dashboard,
          href: '/encoder',
        },
        {
          id: 'permits',
          label: 'Permit Management',
          icon: DASHBOARD_ICONS.fileText,
          href: '/encoder/permits',
        },
        {
          id: 'vehicles',
          label: 'Vehicle Registry',
          icon: DASHBOARD_ICONS.vehicle,
          href: '/encoder/vehicles',
        },
        ...commonItems,
      ]

    case 'ENFORCER':
      return [
        {
          id: 'dashboard',
          label: 'Enforcement Dashboard',
          icon: DASHBOARD_ICONS.dashboard,
          href: '/enforcer',
        },
      ]

    case 'PUBLIC':
      return [
        {
          id: 'dashboard',
          label: 'My Dashboard',
          icon: DASHBOARD_ICONS.dashboard,
          href: '/dashboard',
        },
        {
          id: 'calculator',
          label: 'Fare Calculator',
          icon: DASHBOARD_ICONS.calculator,
          href: '/calculator',
        },
        {
          id: 'discount',
          label: 'Discount Card',
          icon: DASHBOARD_ICONS.discount,
          href: '/profile/discount',
        },
        {
          id: 'report',
          label: 'Report Incident',
          icon: DASHBOARD_ICONS.incidents,
          href: '/report',
        },
        {
          id: 'history',
          label: 'My History',
          icon: DASHBOARD_ICONS.history,
          href: '/history',
        },
        {
          id: 'profile',
          label: 'My Profile',
          icon: DASHBOARD_ICONS.user,
          href: '/profile',
        },
      ]

    default:
      return []
  }
}
