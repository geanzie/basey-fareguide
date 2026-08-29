'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { LogOut, User } from 'lucide-react'
import BrandMark from './BrandMark'
import { useAuth } from './AuthProvider'
import type { SessionUserDto } from '@/lib/contracts'
import {
  AuthenticatedMobileBottomNavigation,
  AuthenticatedMobileProfileSheet,
  AuthenticatedSidebarNavigation,
} from '@/components/AuthenticatedNavigation'
import { swrFetcher } from '@/lib/swr'

interface AppShellProps {
  children: React.ReactNode
  user: SessionUserDto
}

/**
 * Authenticated app chrome: sidebar on lg+, bottom tab bar + profile sheet
 * below lg. Pages own their headers (ui/GradientHeader) — the shell renders
 * no title bar. Replaces UnifiedLayout and its PageWrapper pub/sub.
 */
export default function AppShell({ children, user }: AppShellProps) {
  const [mobileProfileSheetOpen, setMobileProfileSheetOpen] = useState(false)
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
    setMobileProfileSheetOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    if (status === 'logging_out') {
      return
    }
    setMobileProfileSheetOpen(false)
    await logout()
  }

  return (
    <div className="flex min-h-dvh bg-surface-bg">
      <aside className="hidden w-64 border-r border-surface-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex h-20 items-center border-b border-surface-border px-6 py-5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-ink-strong">Basey FareCheck</h1>
              <p className="text-xs text-ink-muted">Fare Reference System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          <AuthenticatedSidebarNavigation user={user} pathname={pathname} tabBadges={driverTabBadges} />
        </nav>

        {/* User block + logout pinned to the sidebar footer (mobile gets the profile sheet) */}
        <div className="border-t border-surface-border p-4">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-alt"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-tint text-sm font-bold text-primary-dark">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-strong">
                {user.firstName} {user.lastName}
              </span>
              <span className="block truncate text-xs text-ink-muted">@{user.username}</span>
            </span>
            <User className="ml-auto h-4 w-4 shrink-0 text-ink-faint" />
          </Link>
          <button
            onClick={handleLogout}
            disabled={status === 'logging_out'}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            <span>{status === 'logging_out' ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="app-mobile-nav-offset min-w-0 flex-1">{children}</main>
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
