'use client'

import { useEffect } from 'react'
import Link from 'next/link'

import type { SessionUserDto } from '@/lib/contracts'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'
import {
  getAuthenticatedMobilePrimaryActionCount,
  MOBILE_PROFILE_LAUNCHER,
  getAuthenticatedNavigationConfig,
  isAuthenticatedNavigationItemActive,
  isAuthenticatedProfileSheetActive,
} from '@/lib/navigation/authenticatedNavigation'

interface AuthenticatedNavigationProps {
  user: SessionUserDto
  pathname: string
}

export function AuthenticatedSidebarNavigation({
  user,
  pathname,
  onNavigate,
  tabBadges,
}: AuthenticatedNavigationProps & { onNavigate?: () => void; tabBadges?: Record<string, number> }) {
  const navigation = getAuthenticatedNavigationConfig(user.userType)

  return (
    <>
      <div className="space-y-2">
        {navigation.tabs.map((item) => (
          <SidebarNavigationLink
            key={item.id}
            label={item.label}
            href={item.href}
            icon={item.icon}
            active={isAuthenticatedNavigationItemActive(pathname, item)}
            onNavigate={onNavigate}
            badge={(tabBadges?.[item.id] ?? 0) > 0 ? tabBadges![item.id] : undefined}
          />
        ))}
      </div>

      {navigation.secondaryActions.length > 0 ? (
        <div className="mt-6 border-t border-slate-200/80 pt-4">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            More
          </p>
          <div className="mt-3 space-y-2">
            {navigation.secondaryActions.map((item) => (
              <SidebarNavigationLink
                key={item.id}
                label={item.label}
                href={item.href}
                icon={item.icon}
                active={isAuthenticatedNavigationItemActive(pathname, item)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

export function AuthenticatedMobileBottomNavigation({
  user,
  pathname,
  profileSheetOpen,
  onOpenProfileSheet,
  tabBadges,
}: AuthenticatedNavigationProps & {
  profileSheetOpen: boolean
  onOpenProfileSheet: () => void
  tabBadges?: Record<string, number>
}) {
  const navigation = getAuthenticatedNavigationConfig(user.userType)
  const mobilePrimaryActionCount = getAuthenticatedMobilePrimaryActionCount(user.userType)
  const profileSheetActive =
    profileSheetOpen || isAuthenticatedProfileSheetActive(pathname, user.userType)

  return (
    <nav className="app-mobile-bottom-nav lg:hidden" aria-label="Primary mobile navigation">
      <div
        className="grid gap-1 px-2 py-2"
        style={{ gridTemplateColumns: `repeat(${mobilePrimaryActionCount}, minmax(0, 1fr))` }}
      >
        {navigation.tabs.map((item) => {
          const active = isAuthenticatedNavigationItemActive(pathname, item)
          const badgeCount = tabBadges?.[item.id] ?? 0

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <DashboardIconSlot icon={item.icon} size={20} />
                {badgeCount > 0 ? (
                  <span
                    aria-label={`${badgeCount} active incident${badgeCount !== 1 ? 's' : ''}`}
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400"
                  />
                ) : null}
              </div>
              <span className="mt-1 truncate">{item.shortLabel}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={onOpenProfileSheet}
          className={`flex min-w-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-[11px] font-medium transition-colors ${
            profileSheetActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <DashboardIconSlot icon={MOBILE_PROFILE_LAUNCHER.icon} size={20} />
          <span className="mt-1 truncate">{MOBILE_PROFILE_LAUNCHER.shortLabel}</span>
        </button>
      </div>
    </nav>
  )
}

export function AuthenticatedMobileProfileSheet({
  user,
  pathname,
  open,
  onClose,
  onLogout,
  isLoggingOut,
}: AuthenticatedNavigationProps & {
  open: boolean
  onClose: () => void
  onLogout: () => void
  isLoggingOut: boolean
}) {
  const navigation = getAuthenticatedNavigationConfig(user.userType)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Close profile sheet"
        className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
      />

      <section className="app-surface-overlay app-mobile-sheet-safe fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-slate-200/80 px-4 pt-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />

        <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Signed in
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-slate-500">@{user.username}</p>
        </div>

        <div className="space-y-2 pb-2">
          {navigation.secondaryActions.map((item) => {
            const active = isAuthenticatedNavigationItemActive(pathname, item)

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <DashboardIconSlot icon={item.icon} size={DASHBOARD_ICON_POLICY.sizes.button} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            <DashboardIconSlot icon={DASHBOARD_ICONS.logout} size={DASHBOARD_ICON_POLICY.sizes.button} />
            <span>{isLoggingOut ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </section>
    </div>
  )
}

function SidebarNavigationLink({
  label,
  href,
  icon,
  active,
  onNavigate,
  badge,
}: {
  label: string
  href: string
  icon: React.ComponentProps<typeof DashboardIconSlot>['icon']
  active: boolean
  onNavigate?: () => void
  badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center space-x-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-100/90 text-emerald-700 ring-1 ring-emerald-200'
          : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
      }`}
    >
      <div className="relative shrink-0">
        <DashboardIconSlot icon={icon} size={DASHBOARD_ICON_POLICY.sizes.tab} />
        {badge != null && badge > 0 ? (
          <span
            aria-label={`${badge} active incident${badge !== 1 ? 's' : ''}`}
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400"
          />
        ) : null}
      </div>
      <span className="flex-1">{label}</span>
    </Link>
  )
}