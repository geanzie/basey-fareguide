'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { getCurrentPageData, subscribeToPageData } from './PageWrapper'
import BrandMark from './BrandMark'
import { useAuth } from './AuthProvider'
import type { SessionUserDto } from '@/lib/contracts'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'
import {
  AuthenticatedMobileBottomNavigation,
  AuthenticatedMobileProfileSheet,
  AuthenticatedSidebarNavigation,
} from '@/components/AuthenticatedNavigation'
import { getAuthenticatedNavigationTitle } from '@/lib/navigation/authenticatedNavigation'
import { swrFetcher } from '@/lib/swr'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileProfileSheetOpen, setMobileProfileSheetOpen] = useState(false)
  const [pageData, setPageData] = useState(getCurrentPageData)
  const pathname = usePathname()
  const { logout, status } = useAuth()

  const { data: incidentCountData } = useSWR<{ count: number }>(
    user.userType === 'DRIVER' ? '/api/driver/incidents/count' : null,
    swrFetcher,
    { refreshInterval: 60000 },
  )
  const driverTabBadges: Record<string, number> =
    user.userType === 'DRIVER' && (incidentCountData?.count ?? 0) > 0
      ? { incidents: incidentCountData!.count }
      : {}

  useEffect(() => {
    const unsubscribe = subscribeToPageData(() => {
      setPageData({ ...getCurrentPageData() })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    setUserMenuOpen(false)
    setMobileProfileSheetOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    if (status === 'logging_out') {
      return
    }

    setUserMenuOpen(false)
    setMobileProfileSheetOpen(false)
    await logout()
  }

  const resolvedTitle =
    pageData.title || title || getAuthenticatedNavigationTitle(pathname, user.userType)
  const resolvedSubtitle = pageData.subtitle || subtitle
  const resolvedHeaderContent = pageData.headerContent || headerContent

  return (
    <div className="app-shell-bg min-h-screen flex">
      <aside
        className="app-surface-overlay hidden w-64 border-r border-slate-200/80 lg:relative lg:flex lg:min-h-screen lg:flex-col"
      >
        <div className="flex flex-col h-full">
          <div className="flex h-20 items-center border-b border-slate-200/80 px-6 py-5">
            <div className="flex items-center space-x-3">
              <BrandMark />
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-gray-900 truncate">Basey Fare Check</h1>
                <p className="text-xs text-gray-500">Fare Referrence System</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <AuthenticatedSidebarNavigation user={user} pathname={pathname} tabBadges={driverTabBadges} />
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="app-surface-overlay sticky top-0 z-30 h-16 flex-shrink-0 border-b border-slate-200/80 lg:h-20">
          <div className="flex items-center justify-between px-4 sm:px-6 h-full">
            <div className="flex min-w-0 flex-1 items-center gap-3 lg:block">
              <div className="lg:hidden">
                <BrandMark size="sm" />
              </div>
              <div className="min-w-0">
                {resolvedTitle ? (
                  <div>
                    <h1 className="truncate text-base font-semibold text-gray-900 lg:text-xl">
                      {resolvedTitle}
                    </h1>
                    {resolvedSubtitle ? (
                      <p className="mt-1 hidden text-sm text-gray-500 lg:block">
                        {resolvedSubtitle}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <h1 className="truncate text-base font-semibold text-gray-900 lg:text-xl">
                      Basey Fare Check
                    </h1>
                    <p className="mt-1 hidden text-sm text-gray-500 lg:block">
                      Fare Reference System
                    </p>
                  </div>
                )}
              </div>
            </div>

            {resolvedHeaderContent && (
              <div className="mr-0 flex-shrink-0 lg:mr-4">
                {resolvedHeaderContent}
              </div>
            )}

            <div className="relative hidden lg:block">
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

        <main className="app-mobile-nav-offset flex-1 overflow-auto">{children}</main>
      </div>

      <AuthenticatedMobileBottomNavigation
        user={user}
        pathname={pathname}
        profileSheetOpen={mobileProfileSheetOpen}
        onOpenProfileSheet={() => setMobileProfileSheetOpen(true)}
        tabBadges={driverTabBadges}
      />

      <AuthenticatedMobileProfileSheet
        user={user}
        pathname={pathname}
        open={mobileProfileSheetOpen}
        onClose={() => setMobileProfileSheetOpen(false)}
        onLogout={handleLogout}
        isLoggingOut={status === 'logging_out'}
      />
    </div>
  )
}
